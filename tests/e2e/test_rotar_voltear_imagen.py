from util import abrir, dimensiones, leer, servidor, sin_desborde, subir  # noqa: F401


def descargar(pagina):
    with pagina.expect_download() as d:
        pagina.click("#guardar")
    return dimensiones(pagina, leer(d.value), "image/png")


def test_girar_derecha(servidor):
    with abrir(servidor, "rotar-voltear-imagen") as (pagina, errores):
        subir(pagina, w=400, h=300)
        pagina.wait_for_selector("#panel:not([hidden])")
        pagina.click("#derecha")
        info = descargar(pagina)
        assert (info["w"], info["h"]) == (300, 400)
        # izquierda roja pasa arriba; derecha azul pasa abajo
        assert info["sup"][0] > 200 and info["inf"][2] > 200
        assert not errores


def test_voltear_horizontal_y_fino(servidor):
    with abrir(servidor, "rotar-voltear-imagen") as (pagina, errores):
        subir(pagina, w=400, h=300)
        pagina.wait_for_selector("#panel:not([hidden])")
        pagina.click("#horizontal")
        info = descargar(pagina)
        assert info["izq"][2] > 200 and info["der"][0] > 200  # azul a la izquierda ahora
        pagina.fill("#fino", "10")
        info = descargar(pagina)
        assert info["w"] > 400 and info["h"] > 300  # el lienzo crece al inclinar
        assert not errores


def test_movil(servidor):
    with abrir(servidor, "rotar-voltear-imagen", 390, 800) as (pagina, _):
        subir(pagina, w=1600, h=1200)
        pagina.wait_for_selector("#panel:not([hidden])")
        assert sin_desborde(pagina)
