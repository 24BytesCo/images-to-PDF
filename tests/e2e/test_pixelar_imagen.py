from util import abrir, dimensiones, leer, servidor, sin_desborde, subir  # noqa: F401


def arrastrar(pagina, x0, y0, x1, y1):
    c = pagina.locator("#lienzo").bounding_box()
    pagina.mouse.move(c["x"] + x0 * c["width"], c["y"] + y0 * c["height"])
    pagina.mouse.down()
    pagina.mouse.move(c["x"] + x1 * c["width"], c["y"] + y1 * c["height"], steps=5)
    pagina.mouse.up()


def bajar(pagina):
    with pagina.expect_download() as d:
        pagina.click("#guardar")
    return dimensiones(pagina, leer(d.value), "image/png")


def test_tapar_zona(servidor):
    with abrir(servidor, "pixelar-imagen") as (pagina, errores):
        subir(pagina, w=400, h=300)
        pagina.wait_for_selector("#panel:not([hidden])")
        assert pagina.is_disabled("#guardar")
        pagina.select_option("#efecto", "tapar")
        arrastrar(pagina, 0.05, 0.6, 0.4, 0.95)  # cubre el cuadro verde (0.1-0.3, 0.7-0.9)
        assert "1 zona" in pagina.inner_text("#cuenta")
        info = bajar(pagina)
        assert (info["w"], info["h"]) == (400, 300)
        assert info["verde"][:3] == [0, 0, 0]           # el verde quedó negro
        assert info["izq"][0] > 200 and info["der"][2] > 200  # el resto intacto
        assert not errores


def test_pixelar_mezcla_borde_y_deshacer(servidor):
    with abrir(servidor, "pixelar-imagen") as (pagina, errores):
        subir(pagina, w=400, h=300)
        pagina.wait_for_selector("#panel:not([hidden])")
        pagina.select_option("#efecto", "pixelar")
        pagina.fill("#intensidad", "10")
        arrastrar(pagina, 0.3, 0.02, 0.7, 0.45)  # a caballo del borde rojo/azul, lejos del verde
        datos = bajar(pagina)
        # sup = (0.5, 0.03) es el borde exacto: tras pixelar mezcla rojo y azul
        assert datos["sup"][0] > 40 and datos["sup"][2] > 40, datos["sup"]
        pagina.click("#deshacer")
        assert pagina.is_disabled("#guardar")
        assert not errores


def test_movil(servidor):
    with abrir(servidor, "pixelar-imagen", 390, 800) as (pagina, _):
        subir(pagina, w=1600, h=1200)
        pagina.wait_for_selector("#panel:not([hidden])")
        assert sin_desborde(pagina)
