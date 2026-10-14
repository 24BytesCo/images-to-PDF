import base64

from util import abrir, leer, servidor, sin_desborde, subir  # noqa: F401


def test_ida_y_vuelta(servidor):
    with abrir(servidor, "imagen-base64") as (pagina, errores):
        subir(pagina, w=64, h=48)
        pagina.wait_for_selector("#resultado-a:not([hidden])")
        uri = pagina.input_value("#texto-a")
        assert uri.startswith("data:image/png;base64,")
        original = base64.b64decode(uri.split(",", 1)[1])
        assert original.startswith(b"\x89PNG")
        pagina.select_option("#salida", "html")
        assert pagina.input_value("#texto-a").startswith('<img src="data:image/png;base64,')
        pagina.select_option("#salida", "puro")
        puro = pagina.input_value("#texto-a")
        assert not puro.startswith("data:")
        # de vuelta: pegar el Base64 puro en la otra pestaña y descargar
        pagina.click("#tab-b")
        pagina.fill("#texto-b", puro)
        pagina.wait_for_selector("#bajar-img:not([disabled])")
        assert "PNG" in pagina.inner_text("#info-b") or pagina.wait_for_function("document.getElementById('info-b').textContent.includes('PNG')")
        with pagina.expect_download() as d:
            pagina.click("#bajar-img")
        assert leer(d.value) == original
        assert d.value.suggested_filename.endswith(".png")
        assert not errores


def test_base64_invalido(servidor):
    with abrir(servidor, "imagen-base64") as (pagina, errores):
        pagina.click("#tab-b")
        pagina.fill("#texto-b", "esto no es base64 ###")
        assert "no parece" in pagina.inner_text("#info-b")
        assert pagina.is_disabled("#bajar-img")
        assert not errores


def test_movil(servidor):
    with abrir(servidor, "imagen-base64", 390, 800) as (pagina, _):
        subir(pagina, w=64, h=48)
        pagina.wait_for_selector("#resultado-a:not([hidden])")
        assert sin_desborde(pagina)
