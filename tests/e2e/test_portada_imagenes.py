from util import abrir, servidor, sin_desborde  # noqa: F401


def test_portada_con_todas_las_tarjetas(servidor):
    with abrir(servidor, "") as (pagina, errores):
        assert pagina.locator("a.tarjeta").count() >= 10
        assert "Tareas frecuentes" not in pagina.inner_text("main")  # sin variantes, sin sección vacía
        assert sin_desborde(pagina)
        assert not errores


def test_portada_movil_y_menu_con_scroll(servidor):
    with abrir(servidor, "", 390, 600) as (pagina, errores):
        assert sin_desborde(pagina)
        pagina.click(".menu summary")
        lista = pagina.locator(".menu-lista")
        caja = lista.bounding_box()
        assert caja["y"] + caja["height"] <= 600 + 1, "el menú se sale de la pantalla"
        assert not errores
