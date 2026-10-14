import base64
import sys
from pathlib import Path

import pytest
from util import abrir, leer, servidor, sin_desborde  # noqa: F401

# Decodificador opcional (zxing-cpp + numpy). Si no está, se cae a una comprobación estructural.
for ruta in ("/tmp/claude-1000/pylibs",):
    if Path(ruta).is_dir() and ruta not in sys.path:
        sys.path.append(ruta)
try:
    import numpy as np
    import zxingcpp
except Exception:  # pragma: no cover
    zxingcpp = None

JS_PIXELES = """async (b64) => {
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const bmp = await createImageBitmap(new Blob([bin], { type: 'image/png' }));
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  const x = c.getContext('2d'); x.drawImage(bmp, 0, 0);
  return { w: bmp.width, h: bmp.height, d: Array.from(x.getImageData(0, 0, bmp.width, bmp.height).data) };
}"""


def decodificar(pagina, png: bytes):
    p = pagina.evaluate(JS_PIXELES, base64.b64encode(png).decode())
    rgba = np.array(p["d"], dtype=np.uint8).reshape(p["h"], p["w"], 4)
    res = zxingcpp.read_barcodes(rgba[:, :, :3])
    return res[0].text if res else None


def bajar_png(pagina):
    with pagina.expect_download() as d:
        pagina.click("#bajarPng")
    return leer(d.value)


def test_qr_enlace_se_decodifica(servidor):
    with abrir(servidor, "generador-qr") as (pagina, errores):
        pagina.select_option("#tamano", "512")
        pagina.fill("#texto", "https://24bytes.pro/ñandú?x=1")
        png = bajar_png(pagina)
        assert png.startswith(b"\x89PNG")
        if zxingcpp is None:
            pytest.skip("sin zxing-cpp: no se puede decodificar el QR")
        assert decodificar(pagina, png) == "https://24bytes.pro/ñandú?x=1"
        assert not errores


def test_qr_wifi_whatsapp_y_svg(servidor):
    with abrir(servidor, "generador-qr") as (pagina, errores):
        pagina.select_option("#tamano", "512")
        pagina.click("[data-tipo=wifi]")
        pagina.fill("#ssid", "Casa;Alexis")
        pagina.fill("#clave", "clave:123")
        esperado_wifi = r"WIFI:T:WPA;S:Casa\;Alexis;P:clave\:123;;"
        png = bajar_png(pagina)
        if zxingcpp is not None:
            assert decodificar(pagina, png) == esperado_wifi
        pagina.click("[data-tipo=whatsapp]")
        pagina.fill("#telefono", "+57 300 123 4567")
        pagina.fill("#mensaje", "Hola, vi tu anuncio")
        png = bajar_png(pagina)
        if zxingcpp is not None:
            assert decodificar(pagina, png) == "https://wa.me/573001234567?text=Hola%2C%20vi%20tu%20anuncio"
        with pagina.expect_download() as d:
            pagina.click("#bajarSvg")
        svg = leer(d.value).decode()
        assert svg.startswith("<?xml") and "<path d=\"M" in svg
        assert not errores


def test_vacio_y_movil(servidor):
    with abrir(servidor, "generador-qr", 390, 800) as (pagina, errores):
        pagina.fill("#texto", "")
        assert pagina.is_disabled("#bajarPng")
        pagina.fill("#texto", "hola")
        assert pagina.is_enabled("#bajarPng")
        assert sin_desborde(pagina)
        assert not errores
