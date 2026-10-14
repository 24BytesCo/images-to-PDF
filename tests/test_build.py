"""Pruebas del generador multisitio (Paso 1 del plan).

No dependen de binarios ni de red: construyen en un directorio temporal y
comprueban invariantes. Correr: python3 -m pytest tests/test_build.py
"""
import json
import re
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SITIOS = json.loads((RAIZ / "tools/sitios.json").read_text(encoding="utf-8"))

# Las 10 herramientas + 7 variantes + privacidad = 18 páginas de pdf hoy.
RUTAS_PDF = {
    "imagenes-a-pdf", "markdown-a-pdf", "unir-pdf", "dividir-pdf", "organizar-pdf",
    "pdf-a-imagenes", "comprimir-pdf", "marca-de-agua-pdf", "numerar-paginas-pdf",
    "oferta-secop-pdf", "jpg-a-pdf", "foto-a-pdf", "pdf-a-jpg", "rotar-pdf",
    "eliminar-paginas-pdf", "extraer-paginas-pdf", "reducir-tamano-pdf-correo", "privacidad",
}


def construir():
    subprocess.run([sys.executable, "tools/build.py"], cwd=RAIZ, check=True, capture_output=True)


def test_build_corre_sin_error():
    construir()


def test_pdf_tiene_todas_sus_paginas():
    construir()
    base = RAIZ / "sitios/pdf"
    assert (base / "index.html").exists()
    assert (base / "404.html").exists()
    for slug in RUTAS_PDF:
        assert (base / slug / "index.html").exists(), f"falta /{slug}/"


def test_estaticos_copiados_a_cada_sitio():
    construir()
    for clave in SITIOS:
        base = RAIZ / "sitios" / clave
        assert (base / "assets").is_dir(), f"sin assets en {clave}"
        assert (base / "imgs").is_dir(), f"sin imgs en {clave}"
        assert (base / "manifest.json").exists(), f"sin manifest en {clave}"


def test_sitemap_y_robots_por_sitio():
    construir()
    for clave, cfg in SITIOS.items():
        base = RAIZ / "sitios" / clave
        sitemap = (base / "sitemap.xml").read_text(encoding="utf-8")
        robots = (base / "robots.txt").read_text(encoding="utf-8")
        locs = re.findall(r"<loc>(.*?)</loc>", sitemap)
        assert locs, f"sitemap vacío en {clave}"
        # Todas las URL del sitemap son del dominio del sitio, de ningún otro.
        for loc in locs:
            assert loc.startswith(cfg["base_url"]), f"{loc} no pertenece a {clave}"
        assert f"{cfg['base_url']}sitemap.xml" in robots


def test_paginas_filtradas_por_sitio():
    """Ninguna página de otro sitio aparece en el sitemap de pdf."""
    construir()
    sitemap = (RAIZ / "sitios/pdf/sitemap.xml").read_text(encoding="utf-8")
    slugs = {re.search(r"pdf\.24bytes\.pro/([^/]+)/", loc).group(1)
             for loc in re.findall(r"<loc>(.*?)</loc>", sitemap) if loc.rstrip("/") != cfg_pdf_base()}
    assert slugs == RUTAS_PDF


def cfg_pdf_base():
    return SITIOS["pdf"]["base_url"].rstrip("/")


def test_mas_herramientas_solo_del_sitio():
    """Los enlaces de navegación y tarjetas son relativos (mismo sitio), nunca absolutos a otro dominio."""
    construir()
    html = (RAIZ / "sitios/pdf/unir-pdf/index.html").read_text(encoding="utf-8")
    cuerpo = html.split('<main', 1)[1].split("</main>", 1)[0]
    # Dentro del contenido no hay enlaces a otros dominios de la suite.
    for clave, cfg in SITIOS.items():
        if clave == "pdf":
            continue
        assert f'https://{cfg["dominio"]}' not in cuerpo


RUTAS_AUDIO = {"mp4-a-mp3", "convertir-audio", "recortar-audio", "unir-audios", "privacidad"}
RUTAS_VIDEO = {"comprimir-video", "video-a-gif", "quitar-audio-video", "privacidad"}


def slugs_de_sitemap(clave):
    base = SITIOS[clave]["base_url"]
    sitemap = (RAIZ / "sitios" / clave / "sitemap.xml").read_text(encoding="utf-8")
    return {loc[len(base):].strip("/") for loc in re.findall(r"<loc>(.*?)</loc>", sitemap)} - {""}


def test_audio_y_video_tienen_sus_paginas():
    construir()
    assert slugs_de_sitemap("audio") == RUTAS_AUDIO
    assert slugs_de_sitemap("video") == RUTAS_VIDEO
    for clave, rutas in (("audio", RUTAS_AUDIO), ("video", RUTAS_VIDEO)):
        base = RAIZ / "sitios" / clave
        assert (base / "index.html").exists() and (base / "404.html").exists()
        for slug in rutas:
            assert (base / slug / "index.html").exists(), f"falta /{slug}/ en {clave}"
    # Los slugs de audio/video no se cuelan en pdf ni imagenes.
    assert not (RUTAS_AUDIO | RUTAS_VIDEO) - {"privacidad"} & slugs_de_sitemap("pdf")


def test_audio_y_video_cargan_el_motor_solo_al_usarlo():
    """La página no pesa el wasm: el núcleo no está en el repo ni se referencia en el HTML."""
    construir()
    for clave, rutas in (("audio", RUTAS_AUDIO), ("video", RUTAS_VIDEO)):
        base = RAIZ / "sitios" / clave
        assert not list(base.rglob("ffmpeg-core*")), "el núcleo de ffmpeg no debe estar en el sitio"
        for slug in rutas - {"privacidad"}:
            html = (base / slug / "index.html").read_text(encoding="utf-8")
            assert "assets/js/ffmpeg-motor.js" in html
            assert "vendor/ffmpeg/ffmpeg.js" not in html, "el wrapper se carga perezosamente desde el motor"
            assert len(html.encode()) < 100_000
        # Ningún archivo del sitio supera el límite de assets de Workers (25 MiB).
        assert max(p.stat().st_size for p in base.rglob("*") if p.is_file()) < 25 * 1024 * 1024


def test_marca_y_sello_por_sitio():
    construir()
    for clave, marca, sello in (("audio", "24Bytes Audio", "AUD"), ("video", "24Bytes Video", "VID")):
        html = (RAIZ / "sitios" / clave / "index.html").read_text(encoding="utf-8")
        assert marca in html and f">{sello}<" in html
        assert "24Bytes PDF" not in html.split("<main", 1)[1].split("</main>", 1)[0]
        assert 'name="robots" content="index, follow' in html
        assert "umami" not in html and "/api/contacto" not in html
