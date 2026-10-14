from util import abrir, dimensiones, leer, servidor, sin_desborde, subir  # noqa: F401


def test_px_mantiene_proporcion_y_contenido(servidor):
    with abrir(servidor, "redimensionar-imagen") as (pagina, errores):
        subir(pagina, w=400, h=300)
        pagina.wait_for_selector("#panel:not([hidden])")
        pagina.fill("#ancho", "200")
        assert pagina.input_value("#alto") == "150"
        with pagina.expect_download() as d:
            pagina.click("#aplicar")
        datos = leer(d.value)
        assert d.value.suggested_filename == "prueba-200x150.png"
        info = dimensiones(pagina, datos, "image/png")
        assert (info["w"], info["h"]) == (200, 150)
        assert info["izq"][0] > 200 and info["der"][2] > 200
        assert not errores


def test_porcentaje_y_preajuste(servidor):
    with abrir(servidor, "redimensionar-imagen") as (pagina, errores):
        subir(pagina, w=400, h=300)
        pagina.wait_for_selector("#panel:not([hidden])")
        pagina.click("[data-modo=pct]")
        pagina.fill("#pct", "50")
        assert "200 × 150" in pagina.inner_text("#resultado")
        pagina.click("[data-modo=pre]")
        pagina.select_option("#preajuste", "800x600")
        assert "800 × 600" in pagina.inner_text("#resultado")
        pagina.select_option("#formato", "image/jpeg")
        with pagina.expect_download() as d:
            pagina.click("#aplicar")
        assert leer(d.value).startswith(b"\xff\xd8\xff")
        assert not errores


def test_movil(servidor):
    with abrir(servidor, "redimensionar-imagen", 390, 800) as (pagina, _):
        subir(pagina)
        pagina.wait_for_selector("#panel:not([hidden])")
        assert sin_desborde(pagina)
