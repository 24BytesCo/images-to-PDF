import io
import struct
import zipfile

from util import abrir, leer, servidor, sin_desborde, subir  # noqa: F401


def test_zip_completo(servidor):
    with abrir(servidor, "generador-favicon") as (pagina, errores):
        subir(pagina, w=600, h=400)
        pagina.wait_for_selector("#panel:not([hidden])")
        pagina.select_option("#esquinas", "0.22")
        with pagina.expect_download() as d:
            pagina.click("#generar")
        z = zipfile.ZipFile(io.BytesIO(leer(d.value)))
        nombres = set(z.namelist())
        assert {"favicon.ico", "favicon-16x16.png", "favicon-32x32.png", "apple-touch-icon.png",
                "android-chrome-192x192.png", "android-chrome-512x512.png", "site.webmanifest",
                "pegar-en-head.html"} <= nombres
        ico = z.read("favicon.ico")
        assert ico[:4] == b"\x00\x00\x01\x00" and struct.unpack("<H", ico[4:6])[0] == 3
        # cada entrada del ICO apunta a un PNG con el tamaño declarado
        for i, n in enumerate([16, 32, 48]):
            e = 6 + i * 16
            assert ico[e] == n
            tam, off = struct.unpack("<II", ico[e + 8:e + 16])
            png = ico[off:off + tam]
            assert png[:8] == b"\x89PNG\r\n\x1a\n"
            assert struct.unpack(">II", png[16:24]) == (n, n)
        for archivo, n in [("apple-touch-icon.png", 180), ("android-chrome-512x512.png", 512)]:
            assert struct.unpack(">II", z.read(archivo)[16:24]) == (n, n)
        assert not errores


def test_svg_y_movil(servidor, tmp_path):
    svg = tmp_path / "logo.svg"
    svg.write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#d92d20"/></svg>')
    with abrir(servidor, "generador-favicon", 390, 800) as (pagina, errores):
        pagina.set_input_files("#entrada", str(svg))
        pagina.wait_for_selector("#panel:not([hidden])")
        assert sin_desborde(pagina)
        with pagina.expect_download() as d:
            pagina.click("#generar")
        z = zipfile.ZipFile(io.BytesIO(leer(d.value)))
        assert struct.unpack(">II", z.read("android-chrome-192x192.png")[16:24]) == (192, 192)
        assert not errores
