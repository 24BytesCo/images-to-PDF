from util import abrir, leer, servidor, sin_desborde, subir  # noqa: F401


def cerca(hex_, esperado, tol=24):
    c = [int(hex_[i:i + 2], 16) for i in (1, 3, 5)]
    return all(abs(a - b) <= tol for a, b in zip(c, esperado))


def test_paleta_y_cuentagotas(servidor):
    with abrir(servidor, "paleta-colores") as (pagina, errores):
        subir(pagina, w=400, h=300)  # rojo, azul y un cuadro verde
        pagina.wait_for_selector("#panel:not([hidden])")
        codigos = [t.strip().lower() for t in pagina.locator("#muestras code").all_inner_texts()]
        assert 3 <= len(codigos) <= 6
        assert any(cerca(c, (255, 0, 0)) for c in codigos), codigos
        assert any(cerca(c, (0, 0, 255)) for c in codigos), codigos
        assert any(cerca(c, (0, 255, 0)) for c in codigos), codigos
        # cuentagotas: un punto de la mitad derecha (azul)
        caja = pagina.locator("#lienzo").bounding_box()
        pagina.mouse.click(caja["x"] + caja["width"] * 0.9, caja["y"] + caja["height"] * 0.2)
        assert pagina.inner_text("#cHex").lower() == "#0000ff"
        assert pagina.inner_text("#cRgb") == "rgb(0, 0, 255)"
        assert pagina.inner_text("#cHsl") == "hsl(240, 100%, 50%)"
        with pagina.expect_download() as d:
            pagina.click("#bajar")
        assert leer(d.value).startswith(b"\x89PNG")
        assert not errores


def test_movil(servidor):
    with abrir(servidor, "paleta-colores", 390, 800) as (pagina, _):
        subir(pagina, w=1600, h=1200)
        pagina.wait_for_selector("#panel:not([hidden])")
        assert sin_desborde(pagina)
