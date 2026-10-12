"""E2E de heic-a-jpg: decodifica un HEIC real con libheif (wasm) en el Web Worker.

La muestra HEIC se descarga del repo de libheif en tiempo de prueba (no se versiona).
Sin red, la prueba de decodificación se omite. Correr:
  ~/.local/betlab-uploader/.venv/bin/python -m pytest tests/e2e/test_heic.py -q
"""
import base64
import functools
import http.server
import socketserver
import threading
import urllib.request
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parents[2]
DIR = RAIZ / "sitios/imagenes"
CHROME = "/usr/bin/google-chrome"
MUESTRA_URL = "https://github.com/strukturag/libheif/raw/master/examples/example.heic"
MUESTRA = Path("/tmp/claude-1000/heic-muestra-example.heic")


@pytest.fixture(scope="module")
def heic_bytes():
    if not MUESTRA.exists():
        try:
            MUESTRA.parent.mkdir(parents=True, exist_ok=True)
            urllib.request.urlretrieve(MUESTRA_URL, MUESTRA)
        except Exception as e:  # noqa: BLE001
            pytest.skip(f"sin muestra HEIC (offline?): {e}")
    datos = MUESTRA.read_bytes()
    if datos[4:8] != b"ftyp":
        pytest.skip("la muestra descargada no es HEIF")
    return datos


@pytest.fixture(scope="module")
def servidor():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(DIR))
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}"
    httpd.shutdown()


INYECTAR = """(b64) => {
  const bin = atob(b64); const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const file = new File([arr], 'foto.heic', { type: 'image/heic' });
  const dt = new DataTransfer(); dt.items.add(file);
  const inp = document.getElementById('entrada');
  inp.files = dt.files;
  inp.dispatchEvent(new Event('change', { bubbles: true }));
}"""


def test_decodifica_heic_a_jpg(servidor, heic_bytes):
    b64 = base64.b64encode(heic_bytes).decode()
    with sync_playwright() as p:
        navegador = p.chromium.launch(executable_path=CHROME)
        pagina = navegador.new_page()
        errores = []
        pagina.on("console", lambda m: errores.append(m.text) if m.type == "error" else None)
        pagina.on("pageerror", lambda e: errores.append(str(e)))
        pagina.goto(f"{servidor}/heic-a-jpg/")
        pagina.evaluate(INYECTAR, b64)
        pagina.wait_for_selector("#panel:not([hidden])")
        with pagina.expect_download(timeout=60000) as info:
            pagina.click("#convertir")
        ruta = Path(info.value.path())
        datos = ruta.read_bytes()
        navegador.close()
        assert datos[:2] == b"\xff\xd8", "la descarga no es un JPEG válido"
        assert len(datos) > 1000, "el JPEG parece vacío"
        assert not errores, f"errores de consola: {errores}"


def test_no_desborde_movil(servidor):
    with sync_playwright() as p:
        navegador = p.chromium.launch(executable_path=CHROME)
        pagina = navegador.new_page(viewport={"width": 390, "height": 800})
        pagina.goto(f"{servidor}/heic-a-jpg/")
        desborde = pagina.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
        navegador.close()
        assert not desborde, "hay desborde horizontal a 390 px"
