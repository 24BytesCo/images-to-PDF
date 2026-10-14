"""E2E de audio.24bytes.pro y video.24bytes.pro (ffmpeg.wasm de un solo hilo).

No dependen de R2: el núcleo de ffmpeg se sirve desde un directorio local, con CORS, en otro
puerto (igual que el CDN real, otro origen) y el motor apunta ahí con window.CDN_FFMPEG.
El núcleo no se versiona: se baja de npm en tiempo de prueba y queda en /tmp. Los medios de
prueba se generan con el ffmpeg del sistema; sin él, la prueba se omite. Correr:
  ~/.local/betlab-uploader/.venv/bin/python -m pytest tests/e2e/test_ffmpeg.py -q
"""
import functools
import http.server
import io
import json
import shutil
import socketserver
import subprocess
import tarfile
import threading
import urllib.request
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parents[2]
CHROME = "/usr/bin/google-chrome"
VERSION = "0.12.10"
NUCLEO = Path(f"/tmp/claude-1000/ffmpeg-core-{VERSION}")
NUCLEO_URL = f"https://registry.npmjs.org/@ffmpeg/core/-/core-{VERSION}.tgz"
FFMPEG = shutil.which("ffmpeg")
FFPROBE = shutil.which("ffprobe")

PAGINAS = {
    "audio": ["mp4-a-mp3", "convertir-audio", "recortar-audio", "unir-audios"],
    "video": ["comprimir-video", "video-a-gif", "quitar-audio-video"],
}


def servir(directorio, cors=False):
    class H(http.server.SimpleHTTPRequestHandler):
        def end_headers(self):
            if cors:
                self.send_header("Access-Control-Allow-Origin", "*")
            super().end_headers()

        def log_message(self, *a):
            pass

    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(H, directory=str(directorio)))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f"http://127.0.0.1:{httpd.server_address[1]}"


@pytest.fixture(scope="module")
def sitios():
    subprocess.run(["python3", "tools/build.py"], cwd=RAIZ, check=True, capture_output=True)
    h1, audio = servir(RAIZ / "sitios/audio")
    h2, video = servir(RAIZ / "sitios/video")
    yield {"audio": audio, "video": video}
    h1.shutdown()
    h2.shutdown()


@pytest.fixture(scope="module")
def cdn():
    destino = NUCLEO / "ffmpeg" / VERSION
    if not (destino / "ffmpeg-core.wasm").exists():
        try:
            datos = urllib.request.urlopen(NUCLEO_URL, timeout=120).read()
        except Exception as e:  # noqa: BLE001
            pytest.skip(f"sin núcleo de ffmpeg (offline?): {e}")
        destino.mkdir(parents=True, exist_ok=True)
        with tarfile.open(fileobj=io.BytesIO(datos)) as tar:
            for nombre in ("ffmpeg-core.js", "ffmpeg-core.wasm"):
                (destino / nombre).write_bytes(tar.extractfile(f"package/dist/umd/{nombre}").read())
    httpd, url = servir(NUCLEO, cors=True)
    yield f"{url}/ffmpeg/{VERSION}"
    httpd.shutdown()


@pytest.fixture(scope="module")
def medios(tmp_path_factory):
    if not FFMPEG:
        pytest.skip("no hay ffmpeg del sistema para generar los medios de prueba")
    d = tmp_path_factory.mktemp("medios")

    def gen(nombre, *args):
        subprocess.run([FFMPEG, "-v", "error", "-y", *args, str(d / nombre)], check=True)
        return d / nombre

    return {
        "video": gen("clip.mp4", "-f", "lavfi", "-i", "testsrc=size=640x360:rate=24:duration=3",
                     "-f", "lavfi", "-i", "sine=frequency=440:duration=3", "-c:v", "libx264", "-pix_fmt", "yuv420p",
                     "-c:a", "aac", "-shortest"),
        "mp3_6s": gen("tono6.mp3", "-f", "lavfi", "-i", "sine=frequency=330:duration=6", "-c:a", "libmp3lame"),
        "wav_2s": gen("tono2.wav", "-f", "lavfi", "-i", "sine=frequency=500:duration=2"),
        "m4a_3s": gen("tono3.m4a", "-f", "lavfi", "-i", "sine=frequency=700:duration=3", "-c:a", "aac"),
    }


def sondar(ruta):
    """Devuelve {'duracion', 'streams':[codec_type...], 'codec_v'} con ffprobe, o None sin él."""
    if not FFPROBE:
        return None
    r = subprocess.run([FFPROBE, "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(ruta)],
                       capture_output=True, text=True)
    j = json.loads(r.stdout)
    return {"duracion": float(j["format"].get("duration", 0)),
            "streams": [s["codec_type"] for s in j.get("streams", [])],
            "codecs": [s.get("codec_name") for s in j.get("streams", [])],
            "ancho": next((s.get("width") for s in j["streams"] if s["codec_type"] == "video"), None)}


class Sesion:
    def __init__(self, url, cdn_url, tope_mb=None, ancho=1280):
        self.p = sync_playwright().start()
        self.navegador = self.p.chromium.launch(executable_path=CHROME)
        self.pagina = self.navegador.new_page(viewport={"width": ancho, "height": 900}, accept_downloads=True)
        init = f"window.CDN_FFMPEG = {json.dumps(cdn_url)};"
        if tope_mb is not None:
            init += f"window.FFMPEG_TOPE_MB = {tope_mb};"
        self.pagina.add_init_script(init)
        self.errores = []
        self.pagina.on("console", lambda m: self.errores.append(m.text) if m.type == "error" else None)
        self.pagina.on("pageerror", lambda e: self.errores.append(str(e)))
        self.url = url

    def abrir(self, slug):
        self.pagina.goto(f"{self.url}/{slug}/")
        return self.pagina

    def cerrar(self):
        self.navegador.close()
        self.p.stop()

    def procesar(self, archivos, destino, opciones=None):
        """Elige archivos, ejecuta, espera el resultado, descarga y devuelve la ruta."""
        pg = self.pagina
        pg.set_input_files("#entrada", [str(a) for a in archivos])
        pg.wait_for_selector("#panel:not([hidden])")
        for campo, valor in (opciones or {}).items():
            pg.select_option(f"#{campo}", valor)
        pg.click("#ejecutar")
        pg.wait_for_selector("#descargar", timeout=240000)
        with pg.expect_download() as info:
            pg.click("#descargar")
        ruta = Path(destino) / info.value.suggested_filename
        info.value.save_as(ruta)
        return ruta


@pytest.fixture
def sesion_factory(sitios, cdn):
    abiertas = []

    def crear(sitio, **kw):
        s = Sesion(sitios[sitio], kw.pop("cdn", cdn), **kw)
        abiertas.append(s)
        return s

    yield crear
    for s in abiertas:
        s.cerrar()


def test_video_a_mp3_es_un_mp3_valido(sesion_factory, medios, tmp_path):
    s = sesion_factory("audio")
    s.abrir("mp4-a-mp3")
    ruta = s.procesar([medios["video"]], tmp_path)
    datos = ruta.read_bytes()
    assert ruta.suffix == ".mp3"
    assert datos[:3] == b"ID3" or (datos[0] == 0xFF and datos[1] & 0xE0 == 0xE0), "no es un MP3 válido"
    info = sondar(ruta)
    if info:
        assert info["codecs"] == ["mp3"]
        assert 2.7 < info["duracion"] < 3.4
    # La vista previa del resultado existe y el motor no dejó errores de consola.
    assert s.pagina.locator(".ff-resultado audio").count() == 1
    assert not s.errores, s.errores


def test_recortar_audio_dura_lo_esperado(sesion_factory, medios, tmp_path):
    s = sesion_factory("audio")
    pg = s.abrir("recortar-audio")
    pg.set_input_files("#entrada", str(medios["mp3_6s"]))
    pg.wait_for_selector("#panel:not([hidden])")
    # Espera a que se hayan leído los metadatos: el fin se rellena con la duración.
    pg.wait_for_function("Number(document.getElementById('fin').value) > 5")
    pg.fill("#inicio", "1")
    pg.fill("#fin", "3.5")
    pg.click("#ejecutar")
    pg.wait_for_selector("#descargar", timeout=240000)
    with pg.expect_download() as info:
        pg.click("#descargar")
    ruta = tmp_path / info.value.suggested_filename
    info.value.save_as(ruta)
    assert ruta.suffix == ".mp3"
    d = sondar(ruta)
    if d:
        assert 2.2 < d["duracion"] < 2.8, d
    assert ruta.stat().st_size > 1000
    assert not s.errores, s.errores


def test_recortar_rechaza_fin_invalido(sesion_factory, medios):
    s = sesion_factory("audio")
    pg = s.abrir("recortar-audio")
    pg.set_input_files("#entrada", str(medios["mp3_6s"]))
    pg.wait_for_function("Number(document.getElementById('fin').value) > 5")
    pg.fill("#fin", "99")
    pg.click("#ejecutar")
    pg.wait_for_selector(".ff-error:not([hidden])")
    assert "duración" in pg.inner_text(".ff-error")


@pytest.mark.parametrize("formato,firma", [("ogg", lambda b: b[:4] == b"OggS"),
                                           ("m4a", lambda b: b[4:8] == b"ftyp"),
                                           ("wav", lambda b: b[:4] == b"RIFF")])
def test_convertir_audio(sesion_factory, medios, tmp_path, formato, firma):
    s = sesion_factory("audio")
    s.abrir("convertir-audio")
    origen = medios["m4a_3s"] if formato == "wav" else medios["wav_2s"]
    ruta = s.procesar([origen], tmp_path, {"formato": formato})
    assert ruta.suffix == f".{formato}"
    assert firma(ruta.read_bytes()), f"cabecera inválida para {formato}"
    assert not s.errores, s.errores


def test_unir_audios_suma_duraciones(sesion_factory, medios, tmp_path):
    s = sesion_factory("audio")
    s.abrir("unir-audios")
    ruta = s.procesar([medios["wav_2s"], medios["m4a_3s"]], tmp_path)
    d = sondar(ruta)
    assert ruta.read_bytes()[:3] == b"ID3" or ruta.read_bytes()[0] == 0xFF
    if d:
        assert 4.6 < d["duracion"] < 5.5, d
    assert not s.errores, s.errores


def test_unir_pide_dos_audios(sesion_factory, medios):
    s = sesion_factory("audio")
    pg = s.abrir("unir-audios")
    pg.set_input_files("#entrada", str(medios["wav_2s"]))
    pg.wait_for_selector("#panel:not([hidden])")
    pg.click("#ejecutar")
    pg.wait_for_selector(".ff-error:not([hidden])")
    assert "al menos dos" in pg.inner_text(".ff-error")


def test_comprimir_video(sesion_factory, medios, tmp_path):
    s = sesion_factory("video")
    s.abrir("comprimir-video")
    ruta = s.procesar([medios["video"]], tmp_path, {"resolucion": "480", "nivel": "32"})
    assert ruta.suffix == ".mp4" and ruta.read_bytes()[4:8] == b"ftyp"
    d = sondar(ruta)
    if d:
        assert "h264" in d["codecs"] and "audio" in d["streams"]
        assert d["ancho"] == 640, d  # 360 p < tope de 480 p: no se amplía
    assert not s.errores, s.errores


def test_video_a_gif(sesion_factory, medios, tmp_path):
    s = sesion_factory("video")
    pg = s.abrir("video-a-gif")
    pg.set_input_files("#entrada", str(medios["video"]))
    pg.wait_for_function("document.getElementById('duracion').value === '3'")
    pg.select_option("#ancho", "320")
    pg.click("#ejecutar")
    pg.wait_for_selector("#descargar", timeout=240000)
    with pg.expect_download() as info:
        pg.click("#descargar")
    ruta = tmp_path / info.value.suggested_filename
    info.value.save_as(ruta)
    datos = ruta.read_bytes()
    assert datos[:6] in (b"GIF89a", b"GIF87a")
    d = sondar(ruta)
    if d:
        assert d["ancho"] == 320 and 2.5 < d["duracion"] < 3.5, d
    assert pg.locator(".ff-resultado img").count() == 1
    assert not s.errores, s.errores


def test_quitar_audio_deja_el_video(sesion_factory, medios, tmp_path):
    s = sesion_factory("video")
    s.abrir("quitar-audio-video")
    ruta = s.procesar([medios["video"]], tmp_path)
    d = sondar(ruta)
    assert ruta.read_bytes()[4:8] == b"ftyp"
    if d:
        assert d["streams"] == ["video"], d
        assert d["codecs"] == ["h264"]
    assert not s.errores, s.errores


def test_cdn_caido_muestra_aviso(sesion_factory, medios):
    s = sesion_factory("audio", cdn="http://127.0.0.1:9/ffmpeg/0.12.10")
    pg = s.abrir("mp4-a-mp3")
    pg.set_input_files("#entrada", str(medios["video"]))
    pg.wait_for_selector("#panel:not([hidden])")
    pg.click("#ejecutar")
    pg.wait_for_selector(".ff-error:not([hidden])", timeout=60000)
    texto = pg.inner_text(".ff-error")
    assert "No se pudo cargar el motor" in texto
    # El botón vuelve a quedar disponible para reintentar.
    assert pg.is_enabled("#ejecutar")


def test_archivo_sobre_el_tope_avisa_antes_de_procesar(sesion_factory, medios):
    s = sesion_factory("video", tope_mb=0.01)  # ~10 KB: el clip pesa más
    pg = s.abrir("comprimir-video")
    pg.set_input_files("#entrada", str(medios["video"]))
    pg.wait_for_selector(".ff-error:not([hidden])")
    texto = pg.inner_text(".ff-error")
    assert "tope" in texto and "clip.mp4" in texto
    assert pg.locator("#panel").is_hidden(), "no debe ofrecer procesar un archivo rechazado"


@pytest.mark.parametrize("sitio,slug", [(s, p) for s, ps in PAGINAS.items() for p in ps] + [("audio", ""), ("video", "")])
def test_sin_desborde_en_movil_ni_errores(sesion_factory, sitio, slug):
    s = sesion_factory(sitio, ancho=390)
    pg = s.abrir(slug)
    assert not pg.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1"), "desborde a 390 px"
    assert not s.errores, s.errores
