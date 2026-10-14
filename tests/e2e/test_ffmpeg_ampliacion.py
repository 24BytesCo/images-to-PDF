"""E2E de la ampliación 14/10: herramientas nuevas de audio y video (ffmpeg.wasm).

Usa los mismos fixtures que test_ffmpeg.py (núcleo local con CORS, medios generados con el ffmpeg del
sistema, nada versionado). Cada prueba verifica el resultado con ffprobe/ffmpeg, no solo que haya archivo.
  ~/.local/betlab-uploader/.venv/bin/python -m pytest tests/e2e/test_ffmpeg_ampliacion.py -q
"""
import json
import re
import struct
import subprocess
import zipfile

import pytest

from test_ffmpeg import FFMPEG, FFPROBE, RAIZ, cdn, medios, sesion_factory, sitios, sondar  # noqa: F401

AUDIO_NUEVAS = ["volumen-audio", "velocidad-audio", "quitar-silencios-audio", "reducir-ruido-audio",
                "fundido-audio", "audio-a-video", "grabadora-de-voz"]
VIDEO_NUEVAS = ["recortar-video", "unir-videos", "convertir-a-mp4", "velocidad-video", "rotar-voltear-video",
                "redimensionar-video", "video-a-jpg", "cambiar-audio-video", "grabador-de-pantalla", "gif-a-mp4"]

pytestmark = pytest.mark.skipif(not FFMPEG or not FFPROBE, reason="hace falta ffmpeg/ffprobe del sistema")


@pytest.fixture(scope="module")
def m2(tmp_path_factory):
    d = tmp_path_factory.mktemp("medios2")

    def gen(nombre, *args):
        subprocess.run([FFMPEG, "-v", "error", "-y", *args, str(d / nombre)], check=True)
        return d / nombre

    lav = lambda f, dur: ["-f", "lavfi", "-i", f"{f}:duration={dur}"]  # noqa: E731
    return {
        "mp3_6s": gen("tono6.mp3", *lav("sine=frequency=330", 6), "-c:a", "libmp3lame"),
        "wav_2s": gen("tono2.wav", *lav("sine=frequency=500", 2)),
        "silencios": gen("silencios.wav", "-f", "lavfi", "-i",
                         "sine=f=440:d=1[a];anullsrc=r=44100:cl=mono:d=2[s];sine=f=440:d=1[b];[a][s][b]concat=n=3:v=0:a=1",
                         "-ar", "44100"),
        # 2 s de solo ruido y luego un tono (como una voz tras una pausa) con el mismo ruido encima.
        "ruido": gen("ruido.wav", "-f", "lavfi", "-i", "anoisesrc=d=4:a=0.08:c=white,aformat=sample_rates=44100:channel_layouts=mono",
                     "-f", "lavfi", "-i", "sine=f=440:d=4,volume=0.3,adelay=2000,apad=whole_dur=4",
                     "-filter_complex", "amix=inputs=2:normalize=0:duration=longest", "-t", "4"),
        "jpg": gen("img.jpg", "-f", "lavfi", "-i", "testsrc=size=800x600:rate=1:duration=1", "-frames:v", "1"),
        "png": gen("img.png", "-f", "lavfi", "-i", "testsrc=size=400x400:rate=1:duration=1", "-frames:v", "1"),
        "clip": gen("clip.mp4", *lav("testsrc=size=640x360:rate=24", 3), "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
                    "-c:v", "libx264", "-g", "12", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest"),
        "sin_audio": gen("mudo.mp4", *lav("testsrc=size=320x240:rate=24", 2), "-c:v", "libx264", "-pix_fmt", "yuv420p"),
        "mkv": gen("clip.mkv", *lav("testsrc=size=640x360:rate=24", 2), "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
                   "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest"),
        "avi": gen("clip.avi", *lav("testsrc=size=320x240:rate=24", 2), "-c:v", "mpeg4", "-an"),
        "gif": gen("anim.gif", *lav("testsrc=size=160x120:rate=10", 2)),
        "grande": gen("grande.mp4", *lav("testsrc2=size=1280x720:rate=25", 20), "-f", "lavfi", "-i", "sine=duration=20",
                      "-c:v", "libx264", "-b:v", "3M", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest"),
        "largo": gen("largo.mp4", "-f", "lavfi", "-i", "color=c=black:s=320x240:r=5:d=300", "-f", "lavfi", "-i", "anullsrc=d=300",
                     "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest"),
    }


def ff_json(ruta):
    r = subprocess.run([FFPROBE, "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(ruta)],
                       capture_output=True, text=True)
    j = json.loads(r.stdout)
    v = next((s for s in j["streams"] if s["codec_type"] == "video"), {})
    a = next((s for s in j["streams"] if s["codec_type"] == "audio"), {})
    return {"dur": float(j["format"].get("duration", 0)), "w": v.get("width"), "h": v.get("height"),
            "cv": v.get("codec_name"), "ca": a.get("codec_name"), "tiene_audio": bool(a),
            "tiene_video": bool(v), "pix": v.get("pix_fmt")}


def rms_db(ruta, ss=None, t=None):
    cmd = [FFMPEG, "-hide_banner", "-nostats"] + (["-ss", str(ss)] if ss is not None else []) + (["-t", str(t)] if t else []) \
        + ["-i", str(ruta), "-af", "astats=metadata=0", "-f", "null", "-"]
    err = subprocess.run(cmd, capture_output=True, text=True).stderr
    vals = re.findall(r"RMS level dB: (-?[\d.]+|-inf)", err)
    return float(vals[-1]) if vals and vals[-1] != "-inf" else -120.0


def lufs(ruta):
    err = subprocess.run([FFMPEG, "-hide_banner", "-nostats", "-i", str(ruta), "-af", "ebur128", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", err)[-1])


def frecuencia(ruta):
    """Frecuencia dominante aproximada (cruces por cero) de un audio tono puro."""
    raw = subprocess.run([FFMPEG, "-v", "error", "-i", str(ruta), "-t", "1", "-ac", "1", "-ar", "8000", "-f", "s16le", "-"],
                         capture_output=True).stdout
    n = len(raw) // 2
    muestras = struct.unpack(f"<{n}h", raw[: n * 2])
    cruces = sum(1 for a, b in zip(muestras, muestras[1:]) if a < 0 <= b)
    return cruces / (n / 8000)


def bajar(pg, tmp, selector="#descargar", timeout=300000):
    pg.wait_for_selector(f"{selector}, .ff-error:not([hidden]), #errorGrabadora:not([hidden])", timeout=timeout)
    for err in (".ff-error:not([hidden])", "#errorGrabadora:not([hidden])"):
        assert pg.locator(err).count() == 0, pg.inner_text(err) + " | consola: " + " || ".join(getattr(pg, "consola", []))[-900:]
    with pg.expect_download() as info:
        pg.click(selector)
    ruta = tmp / info.value.suggested_filename
    info.value.save_as(ruta)
    return ruta


def subir_y_ejecutar(s, slug, archivos, tmp, opciones=None, esperar=None):
    pg = s.abrir(slug)
    pg.set_input_files("#entrada", [str(a) for a in archivos])
    pg.wait_for_selector("#panel:not([hidden])")
    if esperar:
        pg.wait_for_function(esperar)
    for campo, valor in (opciones or {}).items():
        el = pg.locator(f"#{campo}")
        if el.evaluate("e => e.tagName") == "SELECT":
            el.select_option(valor)
        elif el.get_attribute("type") == "checkbox":
            el.set_checked(bool(valor))
        else:
            el.fill(str(valor))
    pg.click("#ejecutar")
    return pg


# ---------------------------------------------------------------- audio
def test_volumen_subir_6db(sesion_factory, m2, tmp_path):
    s = sesion_factory("audio")
    subir_y_ejecutar(s, "volumen-audio", [m2["mp3_6s"]], tmp_path, {"modo": "ganancia", "db": "6", "formato": "wav"})
    ruta = bajar(s.pagina, tmp_path)
    assert ruta.read_bytes()[:4] == b"RIFF"
    delta = rms_db(ruta) - rms_db(m2["mp3_6s"])
    assert 4.5 < delta < 7.0, delta
    assert not s.errores, s.errores


def test_volumen_normaliza_a_menos16(sesion_factory, m2, tmp_path):
    s = sesion_factory("audio")
    subir_y_ejecutar(s, "volumen-audio", [m2["mp3_6s"]], tmp_path, {"modo": "normalizar"})
    ruta = bajar(s.pagina, tmp_path)
    assert -19 < lufs(ruta) < -13, lufs(ruta)
    assert ff_json(ruta)["ca"] == "mp3"


def test_volumen_exige_db(sesion_factory, m2, tmp_path):
    s = sesion_factory("audio")
    pg = subir_y_ejecutar(s, "volumen-audio", [m2["mp3_6s"]], tmp_path, {"modo": "ganancia", "db": "0"})
    pg.wait_for_selector(".ff-error:not([hidden])")
    assert "dB" in pg.inner_text(".ff-error")


@pytest.mark.parametrize("factor,tono,dur,freq", [("2", "mantener", 3.0, 330), ("0.5", "cambiar", 12.0, 165)])
def test_velocidad_audio(sesion_factory, m2, tmp_path, factor, tono, dur, freq):
    s = sesion_factory("audio")
    subir_y_ejecutar(s, "velocidad-audio", [m2["mp3_6s"]], tmp_path, {"factor": factor, "tono": tono})
    ruta = bajar(s.pagina, tmp_path)
    d = ff_json(ruta)["dur"]
    assert dur - 0.4 < d < dur + 0.4, d
    f = frecuencia(ruta)
    assert freq * 0.93 < f < freq * 1.07, f  # «mantener» no cambia el tono; «cambiar» lo baja con la velocidad
    assert not s.errores, s.errores


def test_velocidad_audio_rechaza_fuera_de_rango(sesion_factory, m2, tmp_path):
    s = sesion_factory("audio")
    pg = subir_y_ejecutar(s, "velocidad-audio", [m2["mp3_6s"]], tmp_path, {"factor": "9"})
    pg.wait_for_selector(".ff-error:not([hidden])")
    assert "entre 0,25" in pg.inner_text(".ff-error")


def test_quitar_silencios(sesion_factory, m2, tmp_path):
    s = sesion_factory("audio")
    subir_y_ejecutar(s, "quitar-silencios-audio", [m2["silencios"]], tmp_path, {"minimo": "0.5"})
    ruta = bajar(s.pagina, tmp_path)
    d = ff_json(ruta)["dur"]
    assert 1.9 < d < 2.7, d  # 4 s con 2 s de silencio -> ~2 s (+ respiro de 0,15 s)
    assert not s.errores, s.errores


def test_reducir_ruido_baja_el_nivel(sesion_factory, m2, tmp_path):
    s = sesion_factory("audio")
    subir_y_ejecutar(s, "reducir-ruido-audio", [m2["ruido"]], tmp_path, {"nivel": "30"})
    ruta = bajar(s.pagina, tmp_path)
    antes, despues = rms_db(m2["ruido"], ss=0.3, t=1.5), rms_db(ruta, ss=0.3, t=1.5)
    assert despues < antes - 6, (antes, despues)  # el tramo de solo ruido baja
    assert rms_db(ruta, ss=2.3, t=1.5) > -36, "la señal útil no debe desaparecer"
    assert not s.errores, s.errores


def test_fundido_baja_inicio_y_final(sesion_factory, m2, tmp_path):
    s = sesion_factory("audio")
    subir_y_ejecutar(s, "fundido-audio", [m2["mp3_6s"]], tmp_path, {"fadeIn": "2", "fadeOut": "2"},
                     esperar="document.querySelector('.barra-info').textContent.includes('0:0')")
    ruta = bajar(s.pagina, tmp_path)
    medio = rms_db(ruta, ss=2.5, t=1)
    assert rms_db(ruta, ss=0, t=0.4) < medio - 8
    assert rms_db(ruta, ss=5.6, t=0.4) < medio - 8
    assert 5.7 < ff_json(ruta)["dur"] < 6.4


def test_fundido_valida_suma(sesion_factory, m2, tmp_path):
    s = sesion_factory("audio")
    pg = subir_y_ejecutar(s, "fundido-audio", [m2["wav_2s"]], tmp_path, {"fadeIn": "1.5", "fadeOut": "1.5"})
    pg.wait_for_selector(".ff-error:not([hidden])")
    assert "suman" in pg.inner_text(".ff-error")


@pytest.mark.parametrize("formato,w,h,imagen", [("1280x720", 1280, 720, "jpg"), ("1080x1920", 1080, 1920, "png")])
def test_audio_a_video(sesion_factory, m2, tmp_path, formato, w, h, imagen):
    s = sesion_factory("audio")
    subir_y_ejecutar(s, "audio-a-video", [m2["mp3_6s"], m2[imagen]], tmp_path, {"formato": formato})
    ruta = bajar(s.pagina, tmp_path)
    j = ff_json(ruta)
    assert (j["w"], j["h"]) == (w, h) and j["cv"] == "h264" and j["ca"] == "aac", j
    assert 5.6 < j["dur"] < 6.6, j
    assert s.pagina.locator(".ff-resultado video").count() == 1
    assert not s.errores, s.errores


def test_audio_a_video_pide_las_dos_cosas(sesion_factory, m2, tmp_path):
    s = sesion_factory("audio")
    pg = subir_y_ejecutar(s, "audio-a-video", [m2["mp3_6s"]], tmp_path)
    pg.wait_for_selector(".ff-error:not([hidden])")
    assert "imagen" in pg.inner_text(".ff-error")


FLAGS_MIC = ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"]


def test_grabadora_de_voz_graba_y_exporta_mp3(sesion_factory, tmp_path, sitios, cdn):
    s = sesion_factory("audio", args=FLAGS_MIC)
    pg = s.abrir("grabadora-de-voz")
    pg.click("#grabar")
    pg.wait_for_selector("#detener:not([hidden])")
    pg.wait_for_timeout(2500)
    pg.click("#detener")
    pg.wait_for_selector("#resultado:not([hidden])")
    assert pg.eval_on_selector("#previa", "a => a.src").startswith("blob:")
    pg.click("#convertir")
    ruta = bajar(pg, tmp_path)
    j = ff_json(ruta)
    assert ruta.suffix == ".mp3" and j["ca"] == "mp3" and 1.8 < j["dur"] < 4.5, j
    assert not s.errores, s.errores


def test_grabadora_sin_microfono_avisa(sesion_factory):
    s = sesion_factory("audio")  # sin dispositivo falso ni permiso: getUserMedia falla
    pg = s.abrir("grabadora-de-voz")
    pg.click("#grabar")
    pg.wait_for_selector("#errorGrabadora:not([hidden])", timeout=15000)
    assert "micrófono" in pg.inner_text("#errorGrabadora")
    assert pg.is_enabled("#grabar")


def test_grabadora_cdn_caido_conserva_la_grabacion(sesion_factory):
    s = sesion_factory("audio", args=FLAGS_MIC, cdn="http://127.0.0.1:9/ffmpeg/0.12.10")
    pg = s.abrir("grabadora-de-voz")
    pg.click("#grabar")
    pg.wait_for_timeout(1200)
    pg.click("#detener")
    pg.wait_for_selector("#resultado:not([hidden])")
    pg.click("#convertir")
    pg.wait_for_selector("#errorGrabadora:not([hidden])", timeout=60000)
    assert "No se pudo cargar el motor" in pg.inner_text("#errorGrabadora")
    assert pg.is_enabled("#convertir") and pg.is_enabled("#descargarOriginal")


# ---------------------------------------------------------------- video
def test_recortar_video_preciso(sesion_factory, m2, tmp_path):
    s = sesion_factory("video")
    subir_y_ejecutar(s, "recortar-video", [m2["clip"]], tmp_path, {"inicio": "1", "fin": "2.5", "modo": "preciso"},
                     esperar="Number(document.getElementById('fin').value) > 2.9")
    pg = s.pagina
    # el fixture rellenó fin con la duración; subir_y_ejecutar ya lo sobrescribió después de esperar
    ruta = bajar(pg, tmp_path)
    j = ff_json(ruta)
    assert 1.2 < j["dur"] < 1.9 and j["cv"] == "h264" and j["tiene_audio"], j
    assert not s.errores, s.errores


def test_recortar_video_rapido_copia(sesion_factory, m2, tmp_path):
    s = sesion_factory("video")
    subir_y_ejecutar(s, "recortar-video", [m2["clip"]], tmp_path, {"inicio": "1", "fin": "2.5", "modo": "rapido"},
                     esperar="Number(document.getElementById('fin').value) > 2.9")
    ruta = bajar(s.pagina, tmp_path)
    j = ff_json(ruta)
    assert j["cv"] == "h264" and 1.2 < j["dur"] < 2.4, j
    assert "rápido" in s.pagina.inner_text(".ff-aviso")


def test_recortar_video_rechaza_fin_invalido(sesion_factory, m2, tmp_path):
    s = sesion_factory("video")
    pg = subir_y_ejecutar(s, "recortar-video", [m2["clip"]], tmp_path, {"inicio": "0", "fin": "99"},
                          esperar="Number(document.getElementById('fin').value) > 2.9")
    pg.wait_for_selector(".ff-error:not([hidden])")
    assert "duración" in pg.inner_text(".ff-error")


def test_unir_videos_distinto_tamano_y_sin_audio(sesion_factory, m2, tmp_path):
    s = sesion_factory("video")
    subir_y_ejecutar(s, "unir-videos", [m2["clip"], m2["sin_audio"]], tmp_path)
    ruta = bajar(s.pagina, tmp_path)
    j = ff_json(ruta)
    assert (j["w"], j["h"]) == (640, 360) and j["cv"] == "h264" and j["ca"] == "aac", j
    assert 4.6 < j["dur"] < 5.6, j
    assert not s.errores, s.errores


def test_unir_videos_pide_dos(sesion_factory, m2, tmp_path):
    s = sesion_factory("video")
    pg = subir_y_ejecutar(s, "unir-videos", [m2["clip"]], tmp_path)
    pg.wait_for_selector(".ff-error:not([hidden])")
    assert "al menos dos" in pg.inner_text(".ff-error")


def test_convertir_mkv_copia_sin_recodificar(sesion_factory, m2, tmp_path):
    s = sesion_factory("video")
    subir_y_ejecutar(s, "convertir-a-mp4", [m2["mkv"]], tmp_path)
    ruta = bajar(s.pagina, tmp_path)
    j = ff_json(ruta)
    assert ruta.suffix == ".mp4" and ruta.read_bytes()[4:8] == b"ftyp" and j["cv"] == "h264", j
    assert "sin recodificar" in s.pagina.inner_text(".ff-aviso")


def test_convertir_avi_recodifica(sesion_factory, m2, tmp_path):
    s = sesion_factory("video")
    subir_y_ejecutar(s, "convertir-a-mp4", [m2["avi"]], tmp_path)
    ruta = bajar(s.pagina, tmp_path)
    j = ff_json(ruta)
    assert j["cv"] == "h264" and (j["w"], j["h"]) == (320, 240) and 1.7 < j["dur"] < 2.5, j
    assert "recodificó" in s.pagina.inner_text(".ff-aviso")
    assert not s.errores, s.errores


@pytest.mark.parametrize("clip,factor,audio,dur,con_audio", [("clip", "2", "conservar", 1.5, True),
                                                             ("sin_audio", "0.5", "conservar", 4.0, False),
                                                             ("clip", "2", "quitar", 1.5, False)])
def test_velocidad_video(sesion_factory, m2, tmp_path, clip, factor, audio, dur, con_audio):
    s = sesion_factory("video")
    subir_y_ejecutar(s, "velocidad-video", [m2[clip]], tmp_path, {"factor": factor, "audio": audio})
    ruta = bajar(s.pagina, tmp_path)
    j = ff_json(ruta)
    assert dur - 0.4 < j["dur"] < dur + 0.5 and j["tiene_audio"] == con_audio and j["cv"] == "h264", j
    assert not s.errores, s.errores


@pytest.mark.parametrize("accion,w,h", [("derecha", 360, 640), ("180", 640, 360), ("horizontal", 640, 360)])
def test_rotar_voltear_video(sesion_factory, m2, tmp_path, accion, w, h):
    s = sesion_factory("video")
    subir_y_ejecutar(s, "rotar-voltear-video", [m2["clip"]], tmp_path, {"accion": accion})
    ruta = bajar(s.pagina, tmp_path)
    j = ff_json(ruta)
    assert (j["w"], j["h"]) == (w, h) and 2.6 < j["dur"] < 3.5 and j["tiene_audio"], j
    assert not s.errores, s.errores


@pytest.mark.parametrize("prop,ajuste,lado,w,h", [("vertical", "desenfocado", "480", 480, 854),
                                                  ("cuadrado", "barras", "480", 480, 480),
                                                  ("retrato", "recortar", "480", 480, 600),
                                                  ("igual", None, "1080", 640, 360)])
def test_redimensionar_video(sesion_factory, m2, tmp_path, prop, ajuste, lado, w, h):
    s = sesion_factory("video")
    subir_y_ejecutar(s, "redimensionar-video", [m2["clip"]], tmp_path, {k: v for k, v in {"proporcion": prop, "ajuste": ajuste, "lado": lado}.items() if v})
    ruta = bajar(s.pagina, tmp_path)
    j = ff_json(ruta)
    assert (j["w"], j["h"]) == (w, h), j  # «igual» no amplía: 640x360 sigue igual aunque pidas 1080
    assert j["cv"] == "h264" and j["tiene_audio"] and j["pix"] == "yuv420p", j
    assert not s.errores, s.errores


def test_video_a_jpg_un_fotograma(sesion_factory, m2, tmp_path):
    s = sesion_factory("video")
    subir_y_ejecutar(s, "video-a-jpg", [m2["clip"]], tmp_path, {"modo": "uno", "instante": "1.2"})
    ruta = bajar(s.pagina, tmp_path)
    assert ruta.suffix == ".jpg" and ruta.read_bytes()[:3] == b"\xff\xd8\xff"
    j = ff_json(ruta)
    assert (j["w"], j["h"]) == (640, 360), j
    assert s.pagina.locator(".ff-resultado img").count() == 1
    assert not s.errores, s.errores


def test_video_a_jpg_varios_en_zip(sesion_factory, m2, tmp_path):
    s = sesion_factory("video")
    subir_y_ejecutar(s, "video-a-jpg", [m2["clip"]], tmp_path, {"modo": "varios", "cada": "1", "desde": "0", "hasta": "3"},
                     esperar="Number(document.getElementById('hasta').value) > 2.9")
    ruta = bajar(s.pagina, tmp_path)
    assert ruta.suffix == ".zip"
    with zipfile.ZipFile(ruta) as z:
        nombres = sorted(z.namelist())
        assert 3 <= len(nombres) <= 4, nombres
        assert all(z.read(n)[:3] == b"\xff\xd8\xff" for n in nombres)
    assert not s.errores, s.errores


def test_video_a_jpg_limite_de_fotogramas(sesion_factory, m2, tmp_path):
    s = sesion_factory("video")
    pg = subir_y_ejecutar(s, "video-a-jpg", [m2["largo"]], tmp_path, {"modo": "varios", "cada": "1", "desde": "0", "hasta": "290"},
                          esperar="Number(document.getElementById('hasta').value) > 100")
    pg.wait_for_selector(".ff-error:not([hidden])")
    assert "máximo es 150" in pg.inner_text(".ff-error")


def test_cambiar_audio_reemplaza_y_repite(sesion_factory, m2, tmp_path):
    s = sesion_factory("video")
    subir_y_ejecutar(s, "cambiar-audio-video", [m2["clip"], m2["wav_2s"]], tmp_path, {"modo": "reemplazar", "ajuste": "repetir"})
    ruta = bajar(s.pagina, tmp_path)
    j = ff_json(ruta)
    assert j["cv"] == "h264" and j["ca"] == "aac" and 2.6 < j["dur"] < 3.5, j  # 2 s de audio repetido cubre 3 s
    assert 440 * 0.9 > frecuencia(ruta) or frecuencia(ruta) > 470, "el audio original (440 Hz) no debe quedar"
    assert not s.errores, s.errores


def test_cambiar_audio_a_video_sin_audio(sesion_factory, m2, tmp_path):
    s = sesion_factory("video")
    subir_y_ejecutar(s, "cambiar-audio-video", [m2["mp3_6s"], m2["sin_audio"]], tmp_path, {"modo": "mezclar", "ajuste": "cortar"})
    ruta = bajar(s.pagina, tmp_path)
    j = ff_json(ruta)
    assert j["tiene_audio"] and j["tiene_video"] and 1.7 < j["dur"] < 2.6, j
    assert "no tenía audio" in s.pagina.inner_text(".ff-aviso")


def test_cambiar_audio_mezclar(sesion_factory, m2, tmp_path):
    s = sesion_factory("video")
    subir_y_ejecutar(s, "cambiar-audio-video", [m2["clip"], m2["mp3_6s"]], tmp_path, {"modo": "mezclar", "volumen": "0.5"})
    ruta = bajar(s.pagina, tmp_path)
    j = ff_json(ruta)
    assert j["tiene_audio"] and 2.6 < j["dur"] < 3.5, j


def test_cambiar_audio_pide_ambos(sesion_factory, m2, tmp_path):
    s = sesion_factory("video")
    pg = subir_y_ejecutar(s, "cambiar-audio-video", [m2["clip"]], tmp_path)
    pg.wait_for_selector(".ff-error:not([hidden])")
    assert "Falta el audio" in pg.inner_text(".ff-error")


def test_gif_a_mp4(sesion_factory, m2, tmp_path):
    s = sesion_factory("video")
    subir_y_ejecutar(s, "gif-a-mp4", [m2["gif"]], tmp_path, {"repetir": "3"})
    ruta = bajar(s.pagina, tmp_path)
    j = ff_json(ruta)
    assert ruta.suffix == ".mp4" and j["cv"] == "h264" and (j["w"], j["h"]) == (160, 120), j
    assert 5.4 < j["dur"] < 6.6 and not j["tiene_audio"], j
    assert not s.errores, s.errores


def test_comprimir_a_tamano_objetivo(sesion_factory, m2, tmp_path):
    assert m2["grande"].stat().st_size > 1.5 * 1024 * 1024
    s = sesion_factory("video")
    subir_y_ejecutar(s, "comprimir-video", [m2["grande"]], tmp_path, {"modo": "objetivo", "destino": "otro", "objetivoMb": "1"},
                     esperar="document.getElementById('campoMb') && !document.getElementById('campoMb').hidden || true")
    ruta = bajar(s.pagina, tmp_path)
    tam = ruta.stat().st_size
    assert 0.35 * 1024 * 1024 < tam < 1.15 * 1024 * 1024, tam
    j = ff_json(ruta)
    assert j["cv"] == "h264" and 18 < j["dur"] < 22 and j["tiene_audio"], j
    assert not s.errores, s.errores


def test_comprimir_objetivo_imposible_avisa(sesion_factory, m2, tmp_path):
    s = sesion_factory("video")
    pg = subir_y_ejecutar(s, "comprimir-video", [m2["largo"]], tmp_path, {"modo": "objetivo", "destino": "otro", "objetivoMb": "0.5"},
                          esperar="document.querySelector('.barra-info').textContent.includes(':')")
    pg.wait_for_selector(".ff-error:not([hidden])")
    assert "inservible" in pg.inner_text(".ff-error")


# ---------------------------------------------------------------- pantalla
INIT_PANTALLA = """
navigator.mediaDevices.getDisplayMedia = async () => {
  const c = document.createElement('canvas'); c.width = 640; c.height = 360;
  const x = c.getContext('2d'); let n = 0;
  setInterval(() => { x.fillStyle = `hsl(${n * 7 % 360},70%,50%)`; x.fillRect(0, 0, 640, 360);
    x.fillStyle = '#fff'; x.font = '40px sans-serif'; x.fillText('cuadro ' + n++, 40, 200); }, 40);
  return c.captureStream(25);
};
"""


def test_grabador_de_pantalla_exporta_mp4(sesion_factory, tmp_path):
    s = sesion_factory("video", init_extra=INIT_PANTALLA)
    pg = s.abrir("grabador-de-pantalla")
    pg.uncheck("#sistema")
    pg.click("#grabar")
    pg.wait_for_selector("#detener:not([hidden])")
    pg.wait_for_timeout(2500)
    pg.click("#detener")
    pg.wait_for_selector("#resultado:not([hidden])")
    pg.click("#convertir")
    ruta = bajar(pg, tmp_path)
    j = ff_json(ruta)
    assert ruta.suffix == ".mp4" and j["cv"] == "h264" and (j["w"], j["h"]) == (640, 360), j
    assert 1.8 < j["dur"] < 4.0 and not j["tiene_audio"], j
    assert not s.errores, s.errores


def test_grabador_de_pantalla_sin_permiso_avisa(sesion_factory):
    s = sesion_factory("video", init_extra="navigator.mediaDevices.getDisplayMedia = async () => { throw new DOMException('no', 'NotAllowedError'); };")
    pg = s.abrir("grabador-de-pantalla")
    pg.click("#grabar")
    pg.wait_for_selector("#errorGrabadora:not([hidden])")
    assert "escoge" in pg.inner_text("#errorGrabadora")
    assert pg.is_enabled("#grabar")


# ---------------------------------------------------------------- transversales
@pytest.mark.parametrize("sitio,slug", [("audio", s) for s in AUDIO_NUEVAS] + [("video", s) for s in VIDEO_NUEVAS])
def test_nuevas_sin_desborde_ni_errores_y_livianas(sesion_factory, sitio, slug):
    s = sesion_factory(sitio, ancho=390)
    pesos = []
    s.pagina.on("response", lambda r: pesos.append((r.url, len(r.body() or b""))) if r.ok else None)
    pg = s.abrir(slug)
    pg.wait_for_load_state("networkidle")
    assert not pg.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1"), "desborde a 390 px"
    assert not s.errores, s.errores
    total = sum(n for u, n in pesos if "ffmpeg-core" not in u and "/vendor/ffmpeg/" not in u)
    assert total < 300 * 1024, f"{slug}: {total} bytes antes del primer uso"
    assert not any("ffmpeg-core" in u for u, _ in pesos), "el núcleo no debe bajarse hasta usar la herramienta"


def test_archivo_sobre_el_tope_en_herramienta_nueva(sesion_factory, m2):
    s = sesion_factory("audio", tope_mb=0.01)
    pg = s.abrir("velocidad-audio")
    pg.set_input_files("#entrada", str(m2["mp3_6s"]))
    pg.wait_for_selector(".ff-error:not([hidden])")
    assert "tope" in pg.inner_text(".ff-error") and pg.locator("#panel").is_hidden()


def test_titulos_y_descripciones_unicos():
    titulos, descs = {}, {}
    for f in (RAIZ / "tools/paginas").glob("*.json"):
        d = json.loads(f.read_text(encoding="utf-8"))
        if d.get("tipo") == "texto":
            continue
        nuevo = d["slug"] in AUDIO_NUEVAS + VIDEO_NUEVAS
        assert d["titulo"] not in titulos, (d["slug"], titulos.get(d["titulo"]))
        assert d["descripcion"] not in descs, (d["slug"], descs.get(d["descripcion"]))
        titulos[d["titulo"]] = d["slug"]
        descs[d["descripcion"]] = d["slug"]
        if nuevo:
            assert len(d["faqs"]) >= 4 and len(d["secciones"]) >= 2, d["slug"]
