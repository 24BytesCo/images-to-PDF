from util import abrir, dimensiones, leer, servidor, sin_desborde  # noqa: F401

SVG = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50">'
       '<rect width="50" height="50" fill="#ff0000"/><rect x="50" width="50" height="50" fill="#0000ff"/></svg>')


def test_pegar_codigo_x4(servidor):
    with abrir(servidor, "svg-a-png") as (pagina, errores):
        pagina.click("#tab-codigo")
        pagina.fill("#codigo", SVG)
        pagina.wait_for_selector("#panel:not([hidden])")
        pagina.select_option("#escala", "4")
        assert "400 × 200" in pagina.inner_text("#medida")
        with pagina.expect_download() as d:
            pagina.click("#convertir")
        datos = leer(d.value)
        assert datos.startswith(b"\x89PNG")
        info = dimensiones(pagina, datos, "image/png")
        assert (info["w"], info["h"]) == (400, 200)
        assert info["izq"][0] > 200 and info["der"][2] > 200
        assert info["izq"][3] == 255
        assert not errores


def test_archivo_ancho_exacto_transparente(servidor, tmp_path):
    f = tmp_path / "dos.svg"
    f.write_text(SVG.replace('<rect width="50"', '<rect width="20"'))
    with abrir(servidor, "svg-a-png") as (pagina, errores):
        pagina.set_input_files("#entrada", str(f))
        pagina.wait_for_selector("#panel:not([hidden])")
        pagina.select_option("#escala", "ancho")
        pagina.fill("#ancho", "1000")
        with pagina.expect_download() as d:
            pagina.click("#convertir")
        assert d.value.suggested_filename == "dos-1000x500.png"
        info = dimensiones(pagina, leer(d.value), "image/png")
        assert (info["w"], info["h"]) == (1000, 500)
        assert info["der"][2] > 200
        assert not errores


def test_svg_invalido_y_movil(servidor):
    with abrir(servidor, "svg-a-png", 390, 800) as (pagina, errores):
        pagina.click("#tab-codigo")
        pagina.fill("#codigo", "esto no es svg")
        pagina.wait_for_selector("#aviso:not([hidden])")
        assert pagina.locator("#panel").is_hidden()
        pagina.fill("#codigo", SVG)
        pagina.wait_for_selector("#panel:not([hidden])")
        assert sin_desborde(pagina)
