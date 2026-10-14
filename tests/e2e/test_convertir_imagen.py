import pytest
from util import abrir, dimensiones, leer, servidor, sin_desborde, subir  # noqa: F401


@pytest.mark.parametrize("formato,magia,tipo", [
    ("image/jpeg", b"\xff\xd8\xff", "image/jpeg"),
    ("image/webp", b"RIFF", "image/webp"),
    ("image/bmp", b"BM", "image/bmp"),
])
def test_convierte_png(servidor, formato, magia, tipo):
    with abrir(servidor, "convertir-imagen") as (pagina, errores):
        subir(pagina, w=200, h=100)
        pagina.wait_for_selector("#panel:not([hidden])")
        pagina.select_option("#formato", formato)
        with pagina.expect_download() as d:
            pagina.click("#convertir")
        datos = leer(d.value)
        assert datos.startswith(magia)
        assert d.value.suggested_filename.endswith({"image/jpeg": ".jpg", "image/webp": ".webp", "image/bmp": ".bmp"}[formato])
        if formato != "image/bmp":
            info = dimensiones(pagina, datos, tipo)
            assert (info["w"], info["h"]) == (200, 100)
            assert info["izq"][0] > 200 and info["der"][2] > 200  # rojo a la izquierda, azul a la derecha
        else:
            assert int.from_bytes(datos[18:22], "little") == 200
        assert not errores


def test_varias_en_zip(servidor):
    with abrir(servidor, "convertir-imagen") as (pagina, errores):
        subir(pagina, nombre="a.png")
        subir(pagina, nombre="b.png")
        pagina.wait_for_function("document.querySelectorAll('#lista .lista-item').length === 2")
        with pagina.expect_download() as d:
            pagina.click("#convertir")
        assert leer(d.value).startswith(b"PK")
        assert not errores


def test_movil(servidor):
    with abrir(servidor, "convertir-imagen", 390, 800) as (pagina, _):
        subir(pagina)
        pagina.wait_for_selector("#panel:not([hidden])")
        assert sin_desborde(pagina)
