"""E2E de comprimir-imagen: genera un PNG en el navegador, lo comprime y descarga.

Requiere Playwright y Chrome. Correr:
  ~/.local/betlab-uploader/.venv/bin/python -m pytest tests/e2e/test_comprimir_imagen.py -q
"""
import functools
import http.server
import os
import socketserver
import threading
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parents[2]
DIR = RAIZ / "sitios/imagenes"
CHROME = "/usr/bin/google-chrome"

GENERAR_PNG = """async () => {
  // Imagen fotográfica (gradientes suaves): es lo que la gente comprime de verdad.
  const c = document.createElement('canvas'); c.width = 2000; c.height = 1500;
  const x = c.getContext('2d');
  const g1 = x.createLinearGradient(0, 0, 2000, 1500);
  g1.addColorStop(0, '#1a2a6c'); g1.addColorStop(0.5, '#b21f1f'); g1.addColorStop(1, '#fdbb2d');
  x.fillStyle = g1; x.fillRect(0, 0, 2000, 1500);
  for (let i = 0; i < 40; i++) {
    const r = x.createRadialGradient(Math.random()*2000, Math.random()*1500, 10, Math.random()*2000, Math.random()*1500, 400);
    r.addColorStop(0, 'rgba(255,255,255,0.4)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = r; x.fillRect(0, 0, 2000, 1500);
  }
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const file = new File([blob], 'prueba.png', { type: 'image/png' });
  const dt = new DataTransfer(); dt.items.add(file);
  const inp = document.getElementById('entrada');
  inp.files = dt.files;
  inp.dispatchEvent(new Event('change', { bubbles: true }));
  return blob.size;
}"""


@pytest.fixture(scope="module")
def servidor():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(DIR))
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}"
    httpd.shutdown()


def test_comprime_descarga_sin_errores(servidor):
    with sync_playwright() as p:
        navegador = p.chromium.launch(executable_path=CHROME)
        pagina = navegador.new_page()
        errores = []
        pagina.on("console", lambda m: errores.append(m.text) if m.type == "error" else None)
        pagina.on("pageerror", lambda e: errores.append(str(e)))
        pagina.goto(f"{servidor}/comprimir-imagen/")
        original = pagina.evaluate(GENERAR_PNG)
        pagina.wait_for_selector("#panel:not([hidden])")
        pagina.select_option("#formato", "image/jpeg")
        with pagina.expect_download() as info:
            pagina.click("#comprimir")
        ruta = info.value.path()
        tam = os.path.getsize(ruta)
        navegador.close()
        assert tam > 0, "la descarga está vacía"
        assert tam < original, f"el JPG ({tam}) no es más liviano que el PNG ({original})"
        assert not errores, f"errores de consola: {errores}"


def test_no_desborde_movil(servidor):
    with sync_playwright() as p:
        navegador = p.chromium.launch(executable_path=CHROME)
        pagina = navegador.new_page(viewport={"width": 390, "height": 800})
        pagina.goto(f"{servidor}/comprimir-imagen/")
        desborde = pagina.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
        navegador.close()
        assert not desborde, "hay desborde horizontal a 390 px"
