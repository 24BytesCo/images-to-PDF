import base64

from util import abrir, dimensiones, leer, servidor, sin_desborde  # noqa: F401

JS_PNG = """async ([w, h, color]) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, w, h);
  const b = await new Promise((r) => c.toBlob(r, 'image/png'));
  const u = new Uint8Array(await b.arrayBuffer()); let s = ''; for (const n of u) s += String.fromCharCode(n);
  return btoa(s); }"""


def tres(pagina, tmp_path):
    rutas = []
    for nombre, color, w, h in [("1.png", "#ff0000", 200, 100), ("2.png", "#00ff00", 300, 150), ("3.png", "#0000ff", 200, 100)]:
        f = tmp_path / nombre
        f.write_bytes(base64.b64decode(pagina.evaluate(JS_PNG, [w, h, color])))
        rutas.append(str(f))
    return rutas


def bajar(pagina):
    with pagina.expect_download() as d:
        pagina.click("#unir")
    return dimensiones(pagina, leer(d.value), "image/png")


def test_vertical_orden_y_horizontal(servidor, tmp_path):
    with abrir(servidor, "unir-imagenes") as (pagina, errores):
        pagina.set_input_files("#entrada", tres(pagina, tmp_path))
        pagina.wait_for_selector("#panel:not([hidden])")
        assert "200 × 300 px" in pagina.inner_text("#medida")  # la de 300 se reduce al ancho 200
        info = bajar(pagina)
        assert (info["w"], info["h"]) == (200, 300)
        assert info["sup"][0] > 200 and info["inf"][2] > 200   # rojo arriba, azul abajo
        # subir la tercera (azul) a la primera posición
        pagina.click("button[aria-label='Subir 3.png']")
        pagina.click("button[aria-label='Subir 3.png']")
        info = bajar(pagina)
        assert info["sup"][2] > 200 and info["inf"][1] > 200   # orden 3,1,2: azul arriba, verde abajo
        pagina.select_option("#modo", "horizontal")
        info = bajar(pagina)
        assert (info["h"], info["w"]) == (100, 200 + 200 + 200)  # alto común 100: 200 + 200 + 200
        assert not errores


def test_cuadricula_con_separacion_y_movil(servidor, tmp_path):
    with abrir(servidor, "unir-imagenes", 390, 800) as (pagina, errores):
        pagina.set_input_files("#entrada", tres(pagina, tmp_path))
        pagina.wait_for_selector("#panel:not([hidden])")
        pagina.select_option("#modo", "cuadricula")
        pagina.select_option("#columnas", "2")
        pagina.fill("#espacio", "10")
        # celda 200: fila1 = 100 (rojo) y 100 (verde 300x150 -> 200x100); fila2 = 100 -> 100+10+100
        info = bajar(pagina)
        assert (info["w"], info["h"]) == (410, 210)
        assert sin_desborde(pagina)
        assert not errores
