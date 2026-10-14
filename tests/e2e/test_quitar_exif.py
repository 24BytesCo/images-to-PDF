import base64
import struct
import zlib

from util import abrir, dimensiones, leer, servidor, sin_desborde, subir  # noqa: F401

JS_BYTES = """async ({tipo}) => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 48;
  const x = c.getContext('2d'); x.fillStyle = '#ff0000'; x.fillRect(0, 0, 64, 48);
  const b = await new Promise((r) => c.toBlob(r, tipo, 0.9));
  const u = new Uint8Array(await b.arrayBuffer()); let s = '';
  for (const n of u) s += String.fromCharCode(n);
  return btoa(s);
}"""
JS_SUBIR_BYTES = """({b64, nombre, tipo}) => {
  const u = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const dt = new DataTransfer(); dt.items.add(new File([u], nombre, { type: tipo }));
  const inp = document.getElementById('entrada'); inp.files = dt.files;
  inp.dispatchEvent(new Event('change', { bubbles: true }));
}"""


def tiff_con_gps():
    h = b"II*\x00" + struct.pack("<I", 8)
    ifd0 = struct.pack("<H", 2)
    ifd0 += struct.pack("<HHII", 0x010F, 2, 8, 38)   # Make -> offset 38
    ifd0 += struct.pack("<HHII", 0x8825, 4, 1, 46)   # GPS IFD -> offset 46
    ifd0 += struct.pack("<I", 0)
    make = b"TestCam\x00"
    gps = struct.pack("<H", 4)
    gps += struct.pack("<HHI", 1, 2, 2) + b"N\x00\x00\x00"
    gps += struct.pack("<HHII", 2, 5, 3, 100)
    gps += struct.pack("<HHI", 3, 2, 2) + b"W\x00\x00\x00"
    gps += struct.pack("<HHII", 4, 5, 3, 124)
    gps += struct.pack("<I", 0)
    lat = struct.pack("<IIIIII", 4, 1, 36, 1, 0, 1)
    lon = struct.pack("<IIIIII", 74, 1, 5, 1, 0, 1)
    return h + ifd0 + make + gps + lat + lon


def test_jpeg_con_gps(servidor):
    with abrir(servidor, "quitar-exif") as (pagina, errores):
        jpg = base64.b64decode(pagina.evaluate(JS_BYTES, {"tipo": "image/jpeg"}))
        carga = b"Exif\x00\x00" + tiff_con_gps()
        app1 = b"\xff\xe1" + struct.pack(">H", len(carga) + 2) + carga
        sucio = jpg[:2] + app1 + jpg[2:]
        assert b"TestCam" in sucio
        pagina.evaluate(JS_SUBIR_BYTES, {"b64": base64.b64encode(sucio).decode(), "nombre": "casa.jpg", "tipo": "image/jpeg"})
        pagina.wait_for_selector(".exif-gps")
        texto = pagina.inner_text("#lista")
        assert "4.60000, -74.08333" in texto, texto
        assert "TestCam" in texto
        with pagina.expect_download() as d:
            pagina.click("#limpiar")
        limpio = leer(d.value)
        assert limpio.startswith(b"\xff\xd8\xff")
        assert b"Exif" not in limpio and b"TestCam" not in limpio
        assert len(limpio) == len(jpg)  # mismos bytes que el JPG original: no se recomprimió
        assert dimensiones(pagina, limpio, "image/jpeg")["w"] == 64
        assert not errores


def test_png_con_texto(servidor):
    with abrir(servidor, "quitar-exif") as (pagina, errores):
        png = base64.b64decode(pagina.evaluate(JS_BYTES, {"tipo": "image/png"}))
        cuerpo = b"tEXt" + b"Author\x00Alguien Secreto"
        trozo = struct.pack(">I", len(cuerpo) - 4) + cuerpo + struct.pack(">I", zlib.crc32(cuerpo))
        sucio = png[:33] + trozo + png[33:]  # tras IHDR
        pagina.evaluate(JS_SUBIR_BYTES, {"b64": base64.b64encode(sucio).decode(), "nombre": "a.png", "tipo": "image/png"})
        pagina.wait_for_selector(".exif-datos")
        with pagina.expect_download() as d:
            pagina.click("#limpiar")
        limpio = leer(d.value)
        assert b"tEXt" not in limpio and b"Secreto" not in limpio
        assert dimensiones(pagina, limpio, "image/png")["w"] == 64
        assert not errores


def test_webp_y_movil(servidor):
    with abrir(servidor, "quitar-exif", 390, 800) as (pagina, errores):
        webp = base64.b64decode(pagina.evaluate(JS_BYTES, {"tipo": "image/webp"}))
        pagina.evaluate(JS_SUBIR_BYTES, {"b64": base64.b64encode(webp).decode(), "nombre": "w.webp", "tipo": "image/webp"})
        pagina.wait_for_selector(".exif-item")
        assert sin_desborde(pagina)
        with pagina.expect_download() as d:
            pagina.click("#limpiar")
        out = leer(d.value)
        assert out[:4] == b"RIFF" and out[8:12] == b"WEBP"
        assert int.from_bytes(out[4:8], "little") == len(out) - 8
        assert dimensiones(pagina, out, "image/webp")["w"] == 64
        assert not errores
