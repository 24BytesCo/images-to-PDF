"""Invariantes del sitio imagenes: páginas únicas (nada de plantillas en serie), peso y recursos."""
import json
import re
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PAGINAS = [json.loads(p.read_text(encoding="utf-8")) for p in sorted((RAIZ / "tools/paginas").glob("*.json"))]
IMAGENES = [p for p in PAGINAS if p.get("sitio") == "imagenes"]


def construir():
    subprocess.run([sys.executable, "tools/build.py"], cwd=RAIZ, check=True, capture_output=True)


def test_hay_al_menos_diez_herramientas():
    assert len(IMAGENES) >= 10


def test_titulos_descripciones_y_h1_unicos():
    for campo in ("titulo", "descripcion", "h1", "nombre", "resumen_tarjeta"):
        valores = [p[campo] for p in IMAGENES]
        assert len(set(valores)) == len(valores), f"{campo} repetido"


def test_cada_herramienta_tiene_texto_propio_y_faq():
    for p in IMAGENES:
        assert len(p["faqs"]) >= 3, p["slug"]
        assert p.get("secciones"), f"{p['slug']} sin sección propia"
        texto = " ".join(" ".join(s["p"]) for s in p["secciones"])
        assert len(texto) > 250, f"{p['slug']}: sección demasiado corta"
        assert not p.get("variante_de"), f"{p['slug']} es una variante por plantilla"
        # Cada herramienta con su propia lógica e interfaz.
        assert (RAIZ / "tools/ui" / f"{p['slug']}.html").exists()
        assert (RAIZ / "assets/js" / f"{p['slug']}.js").exists() or any(s.endswith(f"{p['slug']}.js") for s in p["scripts"]), p["slug"]


def test_interfaces_y_logica_no_son_copias():
    """Dos herramientas no pueden compartir la misma interfaz ni el mismo script (anti-serie)."""
    firmas = {}
    for p in IMAGENES:
        for ruta in (RAIZ / "tools/ui" / f"{p['slug']}.html",):
            contenido = re.sub(r"\s+", " ", ruta.read_text(encoding="utf-8"))
            assert contenido not in firmas, f"{p['slug']} duplica la interfaz de {firmas.get(contenido)}"
            firmas[contenido] = p["slug"]


def test_peso_antes_del_primer_uso_menor_a_300kb():
    construir()
    for p in IMAGENES:
        base = RAIZ / "sitios/imagenes"
        pagina = base / p["slug"] / "index.html"
        peso = pagina.stat().st_size + (base / "assets/css/suite.css").stat().st_size
        peso += (base / "assets/js/comun.js").stat().st_size
        for s in p["scripts"]:
            peso += (base / s).stat().st_size
        assert peso < 300 * 1024, f"{p['slug']} pesa {peso // 1024} KB"


def test_recursos_locales_existen_y_sin_cdn():
    construir()
    base = RAIZ / "sitios/imagenes"
    for p in IMAGENES:
        html = (base / p["slug"] / "index.html").read_text(encoding="utf-8")
        for src in re.findall(r'<script[^>]+src="([^"]+)"', html):
            if src.startswith("http"):
                # Analítica propia (Umami en 24bytes.pro) y, desde el 15/10, el
                # script de AdSense: son los dos únicos externos admitidos.
                # Librerías por CDN siguen prohibidas.
                permitido = src.startswith("https://24bytes.pro/") or src.startswith(
                    "https://pagead2.googlesyndication.com/"
                )
                assert permitido, f"{p['slug']} carga {src}"
                continue
            assert (base / p["slug"] / src).resolve().exists(), f"{p['slug']}: falta {src}"


def test_sitemap_incluye_todas_las_herramientas():
    construir()
    sitemap = (RAIZ / "sitios/imagenes/sitemap.xml").read_text(encoding="utf-8")
    for p in IMAGENES:
        assert f"https://imagenes.24bytes.pro/{p['slug']}/" in sitemap
