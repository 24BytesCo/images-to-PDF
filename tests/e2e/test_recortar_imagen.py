from util import abrir, dimensiones, leer, servidor, sin_desborde, subir  # noqa: F401


def arrastrar(pagina, x0, y0, x1, y1):
    caja = pagina.locator("#lienzo").bounding_box()
    pagina.mouse.move(caja["x"] + x0 * caja["width"], caja["y"] + y0 * caja["height"])
    pagina.mouse.down()
    pagina.mouse.move(caja["x"] + x1 * caja["width"], caja["y"] + y1 * caja["height"], steps=6)
    pagina.mouse.up()


def test_recorta_mitad_izquierda_roja(servidor):
    with abrir(servidor, "recortar-imagen") as (pagina, errores):
        subir(pagina, w=400, h=300)
        pagina.wait_for_selector("#panel:not([hidden])")
        # Fuera del recuadro inicial (10 %): dibuja uno nuevo dentro de la mitad roja, sin tocar el verde.
        arrastrar(pagina, 0.02, 0.02, 0.45, 0.6)
        texto = pagina.inner_text("#medida")
        w, h = [int(t) for t in texto.replace("px", "").split("×")]
        assert 150 < w < 190 and 160 < h < 190, texto
        with pagina.expect_download() as d:
            pagina.click("#recortar")
        info = dimensiones(pagina, leer(d.value), "image/png")
        assert (info["w"], info["h"]) == (w, h)
        assert info["izq"][0] > 200 and info["der"][0] > 200 and info["der"][2] < 60  # todo rojo
        assert not errores


def test_proporcion_cuadrada(servidor):
    with abrir(servidor, "recortar-imagen") as (pagina, errores):
        subir(pagina, w=400, h=300)
        pagina.wait_for_selector("#panel:not([hidden])")
        pagina.select_option("#proporcion", "1")
        w, h = [int(t) for t in pagina.inner_text("#medida").replace("px", "").split("×")]
        assert w == h
        with pagina.expect_download() as d:
            pagina.click("#recortar")
        info = dimensiones(pagina, leer(d.value), "image/png")
        assert info["w"] == info["h"] == w
        assert not errores


def test_movil(servidor):
    with abrir(servidor, "recortar-imagen", 390, 800) as (pagina, _):
        subir(pagina, w=1600, h=1200)
        pagina.wait_for_selector("#panel:not([hidden])")
        assert sin_desborde(pagina)
