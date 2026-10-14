"""Configuración común de los E2E.

La espera con apoyo al proyecto (modal con mínimo de 10 s antes de descargar) alargaría cada
prueba. Aquí se fija en 0 UNA vez, para todo `Browser.new_page` / `new_context` de Playwright,
sin tocar cada archivo. `test_espera.py` la reactiva añadiendo su propio init script después
(los init scripts se ejecutan en el orden en que se registran, gana el último).
"""
import pytest
from playwright.sync_api import Browser

SIN_ESPERA = "window.SUITE_ESPERA_MIN_MS = 0;"

_new_page = Browser.new_page
_new_context = Browser.new_context


def _new_page_sin_espera(self, *args, **kwargs):
    pagina = _new_page(self, *args, **kwargs)
    pagina.add_init_script(SIN_ESPERA)
    return pagina


def _new_context_sin_espera(self, *args, **kwargs):
    contexto = _new_context(self, *args, **kwargs)
    contexto.add_init_script(SIN_ESPERA)
    return contexto


@pytest.fixture(autouse=True, scope="session")
def _espera_a_cero():
    Browser.new_page = _new_page_sin_espera
    Browser.new_context = _new_context_sin_espera
    yield
    Browser.new_page = _new_page
    Browser.new_context = _new_context
