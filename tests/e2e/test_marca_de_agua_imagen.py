import io
import zipfile

from util import abrir, contar, leer, servidor, sin_desborde, subir  # noqa: F401

BLANCO = "(r, g, b) => r > 235 && g > 235 && b > 235"
AMARILLO = "(r, g, b) => r > 230 && g > 230 && b < 40"


def test_texto_en_esquina(servidor):
    with abrir(servidor, "marca-de-agua-imagen") as (pagina, errores):
        subir(pagina, w=800, h=600)  # rojo/azul/verde: no hay blanco de origen
        pagina.wait_for_selector("#panel:not([hidden])")
        pagina.fill("#texto", "COPIA")
        pagina.fill("#opacidad", "100")
        with pagina.expect_download() as d:
            pagina.click("#aplicar")
        datos = leer(d.value)
        assert d.value.suggested_filename == "prueba-marca.png"
        assert contar(pagina, datos, "image/png", BLANCO) > 300
        assert not errores


JS_PNG = """async ([w, h, color]) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, w, h);
  const b = await new Promise((r) => c.toBlob(r, 'image/png'));
  const u = new Uint8Array(await b.arrayBuffer()); let s = ''; for (const n of u) s += String.fromCharCode(n);
  return btoa(s); }"""


def test_logo_en_mosaico_varias_fotos_zip(servidor, tmp_path):
    import base64
    with abrir(servidor, "marca-de-agua-imagen") as (pagina, errores):
        rutas = []
        for nombre, color, tam in [("a.png", "#ff0000", (800, 600)), ("b.png", "#0000ff", (600, 400))]:
            f = tmp_path / nombre
            f.write_bytes(base64.b64decode(pagina.evaluate(JS_PNG, [tam[0], tam[1], color])))
            rutas.append(str(f))
        logo = tmp_path / "logo.png"
        logo.write_bytes(base64.b64decode(pagina.evaluate(JS_PNG, [60, 30, "#ffff00"])))
        pagina.set_input_files("#entrada", rutas)
        pagina.wait_for_selector("#panel:not([hidden])")
        assert "2 fotos" in pagina.inner_text("#resumen")
        pagina.click("#tab-logo")
        pagina.set_input_files("#logo", str(logo))
        pagina.select_option("#posicion", "mosaico")
        pagina.fill("#opacidad", "100")
        with pagina.expect_download() as d:
            pagina.click("#aplicar")
        assert d.value.suggested_filename.endswith(".zip")
        z = zipfile.ZipFile(io.BytesIO(leer(d.value)))
        assert sorted(z.namelist()) == ["a-marca.png", "b-marca.png"]
        for nombre in z.namelist():
            assert contar(pagina, z.read(nombre), "image/png", AMARILLO) > 200
        assert not errores


def test_movil(servidor):
    with abrir(servidor, "marca-de-agua-imagen", 390, 800) as (pagina, _):
        subir(pagina, w=1600, h=1200)
        pagina.wait_for_selector("#panel:not([hidden])")
        assert sin_desborde(pagina)
