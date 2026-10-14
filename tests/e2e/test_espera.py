"""E2E de la espera con apoyo al proyecto (panel en la página, con mínimo antes de descargar).

conftest.py fija el mínimo en 0 para toda la suite; aquí se reactiva con un mínimo pequeño
(window.SUITE_ESPERA_MIN_MS = 2000). Correr:
  ~/.local/betlab-uploader/.venv/bin/python -m pytest tests/e2e/test_espera.py -q
"""
import functools
import http.server
import re
import socketserver
import threading
from contextlib import contextmanager

import pytest
from playwright.sync_api import sync_playwright

from test_ffmpeg import CHROME, RAIZ, Sesion, cdn, medios, sitios  # noqa: F401  (fixtures de ffmpeg)
from util import _construir, subir

MIN_MS = 2000
# Registra, en el instante de cada descarga, si el modal seguía visible y cuándo ocurrió.
ESPIA = """
window.SUITE_ESPERA_MIN_MS = %d;
window.__descargas = [];
const _click = HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click = function () {
  if (this.hasAttribute('download')) {
    const m = document.querySelector('.espera');
    window.__descargas.push({ t: performance.now(), modalVisible: !!(m && !m.hidden) });
  }
  return _click.apply(this, arguments);
};
""" % MIN_MS


@pytest.fixture(scope="module")
def web():
    _construir()
    servidores = {}

    def servir(sitio):
        h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(RAIZ / "sitios" / sitio))

        class Silencioso(http.server.SimpleHTTPRequestHandler):
            def log_message(self, *a):
                pass

        httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Silencioso, directory=str(RAIZ / "sitios" / sitio)))
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        servidores[sitio] = httpd
        return f"http://127.0.0.1:{httpd.server_address[1]}"

    yield {s: servir(s) for s in ("pdf", "imagenes")}
    for h in servidores.values():
        h.shutdown()


@contextmanager
def pagina(url, ancho=1280, cambios=None):
    """Página con el espía de descargas; `cambios` reescribe el HTML (config del sitio)."""
    with sync_playwright() as p:
        navegador = p.chromium.launch(executable_path=CHROME)
        pg = navegador.new_page(viewport={"width": ancho, "height": 900}, accept_downloads=True)
        pg.add_init_script(ESPIA)  # después del 0 de conftest: gana este
        errores = []
        pg.on("console", lambda m: errores.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errores.append(str(e)))
        if cambios:
            def reescribir(ruta):
                r = ruta.fetch()
                cuerpo = r.text()
                for a, b in cambios.items():
                    cuerpo = cuerpo.replace(a, b)
                ruta.fulfill(response=r, body=cuerpo)
            pg.route(re.compile(r"/$"), reescribir)
        pg.goto(url)
        try:
            yield pg, errores
        finally:
            navegador.close()


def modal_visible(pg):
    """¿Está visible el panel de espera?"""
    return pg.evaluate("(() => { const m = document.querySelector('.espera'); return !!(m && !m.hidden); })()")


def preparar_imagenes(pg):
    subir(pg, w=800, h=600)
    pg.wait_for_selector("#panel:not([hidden])")


def preparar_pdf(pg):
    subir(pg, w=800, h=600)
    pg.wait_for_selector("#panel:not([hidden])")


CASOS = [
    ("imagenes", "comprimir-imagen", "#comprimir", preparar_imagenes),
    ("pdf", "imagenes-a-pdf", "#crear", preparar_pdf),
]


@pytest.mark.parametrize("sitio,slug,boton,preparar", CASOS, ids=[c[0] for c in CASOS])
def test_panel_en_la_pagina_dura_el_minimo_y_descarga_despues(web, sitio, slug, boton, preparar):
    with pagina(f"{web[sitio]}/{slug}/") as (pg, errores):
        preparar(pg)
        t0 = pg.evaluate("performance.now()")
        pg.click(boton)
        pg.wait_for_selector(".espera:not([hidden])", timeout=1500)
        panel = pg.locator(".espera")
        # Dentro de .herramienta, antes del hueco de anuncio; no es un diálogo ni hay overlay.
        assert pg.evaluate("document.querySelector('.espera').parentElement.classList.contains('herramienta')")
        assert pg.locator("[role=dialog], [aria-modal]").count() == 0
        assert "Procesando tu archivo" in panel.inner_text()
        assert "¿Por qué te mostramos esto?" in panel.inner_text()
        assert pg.locator(".espera [role=progressbar]").get_attribute("aria-valuenow") is not None
        assert pg.locator(".espera [aria-live=polite]").count() >= 1
        assert pg.locator(".espera-cafe").count() == 0  # cafe_url vacío
        # Cuenta regresiva y barra que avanzan.
        n1 = int(re.search(r"(\d+)", panel.locator(".espera-tiempo").inner_text()).group(1))
        a = int(pg.locator(".espera [role=progressbar]").get_attribute("aria-valuenow"))
        pg.wait_for_timeout(1100)
        txt = panel.locator(".espera-tiempo").inner_text()
        b = int(pg.locator(".espera [role=progressbar]").get_attribute("aria-valuenow"))
        assert b > a, (a, b)
        m = re.search(r"(\d+)", txt)
        assert (m is None and "Terminando" in txt) or int(m.group(1)) < n1, (n1, txt)
        # La herramienta queda inerte y se reactiva al terminar.
        assert pg.evaluate("[...document.querySelectorAll('.herramienta > *')].filter(e => !e.classList.contains('espera')).every(e => e.inert)")
        pg.wait_for_selector(".espera", state="hidden", timeout=5000)
        assert pg.evaluate("[...document.querySelectorAll('.herramienta > *')].every(e => !e.inert)")
        pg.wait_for_function("window.__descargas.length > 0", timeout=5000)
        d = pg.evaluate("window.__descargas")
        assert len(d) == 1, d
        assert d[0]["modalVisible"] is False
        assert d[0]["t"] - t0 >= MIN_MS - 50, d[0]["t"] - t0
        assert not errores, errores


def test_un_error_cierra_de_inmediato(web):
    with pagina(f"{web['pdf']}/imagenes-a-pdf/") as (pg, errores):
        # Un «PNG» que no es imagen: la lectura falla dentro de la espera.
        pg.set_input_files("#entrada", files=[{"name": "falso.png", "mimeType": "image/png", "buffer": b"no soy una imagen"}])
        t0 = pg.evaluate("performance.now()")
        pg.wait_for_selector("#aviso:not([hidden])", timeout=4000)
        assert pg.inner_text("#aviso")
        assert not modal_visible(pg)
        assert pg.evaluate("performance.now()") - t0 < MIN_MS
        assert pg.evaluate("window.__descargas.length") == 0


def test_con_cafe_url_pinta_el_boton(web):
    cambios = {'"cafe_url": ""': '"cafe_url": "https://ejemplo.test/cafe"'}
    with pagina(f"{web['imagenes']}/comprimir-imagen/", cambios=cambios) as (pg, errores):
        preparar_imagenes(pg)
        pg.click("#comprimir")
        pg.wait_for_selector(".espera:not([hidden])", timeout=1500)
        cafe = pg.locator(".espera-cafe")
        assert cafe.count() == 1
        assert cafe.inner_text().strip() == "Invítame un café"
        assert cafe.get_attribute("href") == "https://ejemplo.test/cafe"
        assert cafe.get_attribute("target") == "_blank"
        assert "noopener" in cafe.get_attribute("rel")
        assert cafe.evaluate("e => e.closest('.espera') !== null")
        pg.wait_for_selector(".espera", state="hidden", timeout=5000)
        assert not errores, errores


def test_espera_desactivada_no_muestra_modal(web):
    cambios = {'"activa": true': '"activa": false'}
    with pagina(f"{web['imagenes']}/comprimir-imagen/", cambios=cambios) as (pg, errores):
        preparar_imagenes(pg)
        t0 = pg.evaluate("performance.now()")
        pg.click("#comprimir")
        pg.wait_for_function("window.__descargas.length > 0", timeout=5000)
        assert pg.locator(".espera").count() == 0
        assert pg.evaluate("window.__descargas[0].t") - t0 < MIN_MS
        assert not errores, errores


def test_sin_desborde_a_390(web):
    cambios = {'"cafe_url": ""': '"cafe_url": "https://ejemplo.test/cafe"'}
    with pagina(f"{web['imagenes']}/comprimir-imagen/", ancho=390, cambios=cambios) as (pg, errores):
        preparar_imagenes(pg)
        pg.click("#comprimir")
        pg.wait_for_selector(".espera:not([hidden])", timeout=1500)
        assert not pg.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
        caja = pg.locator(".espera").bounding_box()
        assert caja["x"] >= 0 and caja["x"] + caja["width"] <= 390 + 0.5, caja
        pg.wait_for_selector(".espera", state="hidden", timeout=5000)
        assert not errores, errores


@pytest.fixture
def ffmpeg_sesion(sitios, cdn):  # noqa: F811
    abiertas = []

    def crear(sitio):
        s = Sesion(sitios[sitio], cdn)
        s.pagina.add_init_script(ESPIA)
        abiertas.append(s)
        return s

    yield crear
    for s in abiertas:
        s.cerrar()


@pytest.mark.parametrize("sitio,slug", [("audio", "mp4-a-mp3"), ("video", "comprimir-video")])
def test_ffmpeg_muestra_modal_y_libera_tras_el_minimo(ffmpeg_sesion, medios, sitio, slug):  # noqa: F811
    s = ffmpeg_sesion(sitio)
    pg = s.abrir(slug)
    pg.set_input_files("#entrada", str(medios["video"]))
    pg.wait_for_selector("#panel:not([hidden])")
    t0 = pg.evaluate("performance.now()")
    pg.click("#ejecutar")
    pg.wait_for_selector(".espera:not([hidden])", timeout=1500)
    pg.wait_for_selector("#descargar", timeout=240000)
    # El resultado aparece al cumplirse el mínimo y el modal ya está cerrado.
    assert pg.evaluate("performance.now()") - t0 >= MIN_MS - 50
    pg.wait_for_selector(".espera", state="hidden", timeout=5000)
    with pg.expect_download():
        pg.click("#descargar")
    d = pg.evaluate("window.__descargas")
    assert len(d) == 1 and d[0]["modalVisible"] is False
    assert not s.errores, s.errores


def test_ffmpeg_error_cierra_de_inmediato(ffmpeg_sesion, medios):  # noqa: F811
    s = ffmpeg_sesion("audio")
    pg = s.abrir("recortar-audio")
    pg.set_input_files("#entrada", str(medios["mp3_6s"]))
    pg.wait_for_function("Number(document.getElementById('fin').value) > 5")
    pg.fill("#fin", "99")
    pg.click("#ejecutar")
    pg.wait_for_selector(".ff-error:not([hidden])")
    assert not modal_visible(pg)
