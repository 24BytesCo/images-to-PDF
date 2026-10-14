"""Ayudas compartidas por los E2E del sitio imagenes (Playwright + Chrome del sistema)."""
import functools
import http.server
import socketserver
import subprocess
import sys
import threading
from contextlib import contextmanager
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parents[2]
DIR = RAIZ / "sitios/imagenes"
CHROME = "/usr/bin/google-chrome"

_construido = False


def _construir():
    global _construido
    if not _construido:
        subprocess.run([sys.executable, "tools/build.py"], cwd=RAIZ, check=True, capture_output=True)
        _construido = True


@pytest.fixture(scope="module")
def servidor():
    _construir()

    class Silencioso(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):  # sin ruido en la salida de pytest
            pass

    handler = functools.partial(Silencioso, directory=str(DIR))
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}"
    httpd.shutdown()


@contextmanager
def abrir(servidor, slug, ancho=1280, alto=900):
    """Abre la herramienta y recoge errores de consola. Entrega (pagina, errores)."""
    with sync_playwright() as p:
        navegador = p.chromium.launch(executable_path=CHROME)
        pagina = navegador.new_page(viewport={"width": ancho, "height": alto})
        errores = []
        pagina.on("console", lambda m: errores.append(m.text) if m.type == "error" else None)
        pagina.on("pageerror", lambda e: errores.append(str(e)))
        pagina.goto(f"{servidor}/{slug}/")
        try:
            yield pagina, errores
        finally:
            navegador.close()


# Dibuja una imagen de prueba: mitad izquierda roja, derecha azul, cuadro verde abajo.
JS_SUBIR = """async ({sel, nombre, tipo, w, h, fondoIzq, fondoDer}) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = fondoIzq; x.fillRect(0, 0, w / 2, h);
  x.fillStyle = fondoDer; x.fillRect(w / 2, 0, w / 2, h);
  x.fillStyle = '#00ff00'; x.fillRect(w * 0.1, h * 0.7, w * 0.2, h * 0.2);
  const blob = await new Promise((r) => c.toBlob(r, tipo, 0.92));
  const file = new File([blob], nombre, { type: tipo });
  const dt = new DataTransfer(); dt.items.add(file);
  const inp = document.querySelector(sel);
  inp.files = dt.files;
  inp.dispatchEvent(new Event('change', { bubbles: true }));
  return blob.size;
}"""


def subir(pagina, sel="#entrada", nombre="prueba.png", tipo="image/png", w=400, h=300,
          izq="#ff0000", der="#0000ff"):
    return pagina.evaluate(JS_SUBIR, {"sel": sel, "nombre": nombre, "tipo": tipo, "w": w, "h": h,
                                      "fondoIzq": izq, "fondoDer": der})


def sin_desborde(pagina):
    return not pagina.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")


def leer(descarga):
    return Path(descarga.path()).read_bytes()


def dimensiones(pagina, datos: bytes, tipo: str):
    """Decodifica los bytes en el navegador y devuelve (ancho, alto, [r,g,b,a] de pixeles pedidos)."""
    return pagina.evaluate(
        """async ({b64, tipo}) => {
          const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          const bmp = await createImageBitmap(new Blob([bin], { type: tipo }));
          const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
          const x = c.getContext('2d'); x.drawImage(bmp, 0, 0);
          const px = (fx, fy) => Array.from(x.getImageData(Math.floor(fx * (bmp.width - 1)), Math.floor(fy * (bmp.height - 1)), 1, 1).data);
          return { w: bmp.width, h: bmp.height, izq: px(0.05, 0.1), der: px(0.95, 0.1), verde: px(0.2, 0.8), sup: px(0.5, 0.03), inf: px(0.5, 0.97) };
        }""",
        {"b64": __import__("base64").b64encode(datos).decode(), "tipo": tipo},
    )


def contar(pagina, datos: bytes, tipo: str, predicado_js: str) -> int:
    """Cuenta píxeles de la imagen decodificada que cumplen `predicado_js` (función de r,g,b,a)."""
    return pagina.evaluate(
        """async ({b64, tipo, pred}) => {
          const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          const bmp = await createImageBitmap(new Blob([bin], { type: tipo }));
          const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
          const x = c.getContext('2d'); x.drawImage(bmp, 0, 0);
          const f = eval(pred); const d = x.getImageData(0, 0, c.width, c.height).data; let n = 0;
          for (let i = 0; i < d.length; i += 4) if (f(d[i], d[i + 1], d[i + 2], d[i + 3])) n++;
          return n;
        }""",
        {"b64": __import__("base64").b64encode(datos).decode(), "tipo": tipo, "pred": predicado_js},
    )
