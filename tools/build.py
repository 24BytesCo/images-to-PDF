#!/usr/bin/env python3
"""Genera el sitio estático de la suite (GitHub Pages, sin dependencias).

Cada herramienta es una página propia (`/<slug>/index.html`) para que posicione
por su propia búsqueda; todas comparten plantilla, estilos y pie. Las páginas se
definen en `tools/paginas/<slug>.json` y su interfaz en `tools/ui/<slug>.html`.

Uso:  python3 tools/build.py
Al cambiar de dominio (p. ej. pdf.24bytes.pro) basta con tocar BASE_URL.
"""
import html
import json
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
BASE_URL = "https://24bytesco.github.io/images-to-PDF/"
MARCA = "24Bytes PDF"
LEMA = "Herramientas PDF que no suben tus archivos"
VERIFICACION_GOOGLE = "35QQddAFVCcauzJO1nGmIASlRfsLoPmEYeIm7bbcaj4"
# Publicidad: vacío = no se pinta nada. Con el id de AdSense (ca-pub-…) se
# añaden el script y los huecos reservados, sin saltos de maquetación.
ADSENSE_CLIENT = ""

ICONOS = {
    "imagenes": '<path d="M4 5h16v14H4z"/><path d="m4 16 4.5-4.5 3.5 3.5 3-3L20 16"/><circle cx="9" cy="9" r="1.4"/>',
    "markdown": '<path d="M3 6h18v12H3z"/><path d="M6.5 15V9l2.5 3 2.5-3v6M15 9v6m0 0-2-2m2 2 2-2"/>',
    "unir": '<path d="M5 4h6v7H5zM13 13h6v7h-6z"/><path d="M11 7.5h3.5V13M13 16.5H9.5V11"/>',
    "dividir": '<path d="M6 3h12v18H6z"/><path d="M3 12h3m3 0h2m2 0h2m3 0h3" stroke-dasharray="0"/>',
    "organizar": '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
    "pdf-imagenes": '<path d="M6 3h9l3 3v15H6z"/><path d="m8.5 17 3-3 2 2 2-2.5"/><circle cx="10" cy="10" r="1.2"/>',
    "comprimir": '<path d="M6 3h12v18H6z"/><path d="M12 6v4m0 0-2-2m2 2 2-2M12 18v-4m0 0-2 2m2-2 2 2"/>',
    "marca": '<path d="M6 3h12v18H6z"/><path d="m9 15 6-6M9 11l2-2m2 6 2-2"/>',
    "numerar": '<path d="M6 3h12v18H6z"/><path d="M10 17h4M11 7l1.5-1v5"/>',
    "candado": '<path d="M6 11h12v9H6z"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>',
}


def svg(clave: str) -> str:
    trazos = ICONOS.get(clave, ICONOS["organizar"])
    return (
        '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" '
        f'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{trazos}</svg>'
    )


def e(texto: str) -> str:
    return html.escape(texto, quote=True)


def cargar_paginas() -> list[dict]:
    paginas = [json.loads(p.read_text(encoding="utf-8")) for p in sorted((RAIZ / "tools/paginas").glob("*.json"))]
    return sorted(paginas, key=lambda p: p.get("orden", 99))


def tarjetas(paginas: list[dict], raiz: str, excluir: str | None = None) -> str:
    items = []
    for p in paginas:
        if p["slug"] == excluir:
            continue
        items.append(
            f'<a class="tarjeta" href="{raiz}{p["slug"]}/">'
            f'<span class="tarjeta-icono">{svg(p.get("icono", ""))}</span>'
            f'<span class="tarjeta-nombre">{e(p["nombre"])}</span>'
            f'<span class="tarjeta-texto">{e(p["resumen_tarjeta"])}</span></a>'
        )
    return "\n".join(items)


def navegacion(paginas: list[dict], raiz: str, actual: str | None) -> str:
    enlaces = []
    for p in paginas:
        marca = ' aria-current="page"' if p["slug"] == actual else ""
        enlaces.append(f'<a href="{raiz}{p["slug"]}/"{marca}>{e(p["nombre"])}</a>')
    return "\n".join(enlaces)


def json_ld(objeto: dict) -> str:
    return '<script type="application/ld+json">' + json.dumps(objeto, ensure_ascii=False) + "</script>"


def anuncio(posicion: str) -> str:
    if not ADSENSE_CLIENT:
        return ""
    return (
        f'<aside class="anuncio" aria-label="Publicidad" data-posicion="{posicion}">'
        f'<ins class="adsbygoogle" style="display:block" data-ad-client="{ADSENSE_CLIENT}" '
        'data-ad-format="auto" data-full-width-responsive="true"></ins>'
        "<script>(adsbygoogle = window.adsbygoogle || []).push({});</script></aside>"
    )


def render(plantilla: str, valores: dict) -> str:
    salida = plantilla
    for clave, valor in valores.items():
        salida = salida.replace("{{" + clave + "}}", valor)
    return salida


def pagina_herramienta(p: dict, paginas: list[dict], plantilla: str) -> str:
    raiz = "../"
    url = f'{BASE_URL}{p["slug"]}/'
    ui = (RAIZ / "tools/ui" / f'{p["slug"]}.html').read_text(encoding="utf-8").replace("{{raiz}}", raiz)
    pasos = "\n".join(f"<li><strong>{e(t)}</strong> {e(d)}</li>" for t, d in p["pasos"])
    faqs = "\n".join(
        f'<details class="faq"><summary>{e(f["p"])}</summary><p>{e(f["r"])}</p></details>' for f in p["faqs"]
    )
    datos = [
        {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": f'{p["nombre"]} — {MARCA}',
            "url": url,
            "description": p["descripcion"],
            "applicationCategory": "UtilitiesApplication",
            "operatingSystem": "Cualquiera con navegador web",
            "inLanguage": "es",
            "isAccessibleForFree": True,
            "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
            "creator": {"@type": "Person", "name": "Alexis Dorado Muñoz", "url": "https://24bytes.pro"},
            "publisher": {"@type": "Organization", "name": "24Bytes", "url": "https://24bytes.pro"},
        },
        {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
                {"@type": "Question", "name": f["p"], "acceptedAnswer": {"@type": "Answer", "text": f["r"]}}
                for f in p["faqs"]
            ],
        },
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": MARCA, "item": BASE_URL},
                {"@type": "ListItem", "position": 2, "name": p["nombre"], "item": url},
            ],
        },
    ]
    scripts = "\n".join(f'<script src="{raiz}{s}" defer></script>' for s in p.get("scripts", []))
    cuerpo = f"""
    <section class="portada portada-herramienta">
      <p class="migas"><a href="{raiz}">{e(MARCA)}</a> <span aria-hidden="true">/</span> {e(p["nombre"])}</p>
      <h1>{e(p["h1"])}</h1>
      <p class="bajada">{e(p["bajada"])}</p>
      <ul class="sellos"><li>Todo ocurre en tu navegador</li><li>Sin registro</li><li>Gratis y sin límite</li></ul>
    </section>
    <section class="herramienta" aria-label="{e(p["nombre"])}">
{ui}
    </section>
    {anuncio("tras-herramienta")}
    <section class="bloque">
      <h2>Cómo funciona</h2>
      <ol class="pasos">{pasos}</ol>
    </section>
    <section class="bloque">
      <h2>Preguntas frecuentes</h2>
      {faqs}
    </section>
    <section class="bloque">
      <h2>Más herramientas</h2>
      <div class="rejilla">{tarjetas(paginas, raiz, excluir=p["slug"])}</div>
    </section>
"""
    return render(plantilla, {
        "titulo": e(p["titulo"]),
        "descripcion": e(p["descripcion"]),
        "canonical": url,
        "raiz": raiz,
        "marca": e(MARCA),
        "navegacion": navegacion(paginas, raiz, p["slug"]),
        "cuerpo": cuerpo,
        "json_ld": "\n".join(json_ld(d) for d in datos),
        "scripts": scripts,
        "verificacion": VERIFICACION_GOOGLE,
        "adsense": f'<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={ADSENSE_CLIENT}" crossorigin="anonymous"></script>' if ADSENSE_CLIENT else "",
        "clase_cuerpo": "pagina-herramienta",
    })


def portada(paginas: list[dict], plantilla: str) -> str:
    raiz = ""
    datos = [
        {"@context": "https://schema.org", "@type": "WebSite", "name": MARCA, "url": BASE_URL, "inLanguage": "es",
         "description": LEMA, "publisher": {"@type": "Organization", "name": "24Bytes", "url": "https://24bytes.pro"}},
        {"@context": "https://schema.org", "@type": "ItemList", "name": "Herramientas PDF",
         "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": p["nombre"], "url": f'{BASE_URL}{p["slug"]}/'}
                             for i, p in enumerate(paginas)]},
    ]
    contacto = (RAIZ / "tools/ui/_contacto.html").read_text(encoding="utf-8")
    cuerpo = f"""
    <section class="portada">
      <h1>{e(LEMA)}</h1>
      <p class="bajada">Une, divide, ordena y convierte PDF directamente en tu navegador. Tus documentos no salen de tu equipo: no hay servidor que los reciba, ni registro, ni límite de uso.</p>
      <ul class="sellos"><li>Todo ocurre en tu navegador</li><li>Sin registro</li><li>Gratis y sin límite</li></ul>
    </section>
    <section class="bloque bloque-rejilla" aria-label="Herramientas">
      <div class="rejilla rejilla-grande">{tarjetas(paginas, raiz)}</div>
    </section>
    {anuncio("portada")}
    <section class="bloque">
      <h2>Por qué no subimos nada</h2>
      <p class="parrafo">Casi todas las herramientas PDF en línea envían tu archivo a un servidor ajeno, lo procesan allá y te lo devuelven. Aquí el trabajo lo hace tu propio navegador: el contrato, la cédula escaneada o la historia clínica nunca viajan por internet. Puedes comprobarlo desconectando el wifi después de cargar la página: todo sigue funcionando.</p>
    </section>
{contacto}
"""
    return render(plantilla, {
        "titulo": e(f"{MARCA}: unir, dividir y convertir PDF sin subir archivos"),
        "descripcion": e("Herramientas PDF gratis que funcionan en tu navegador: unir, dividir, ordenar páginas, pasar imágenes o Markdown a PDF y PDF a imágenes. Tus archivos no se suben a ningún servidor."),
        "canonical": BASE_URL,
        "raiz": raiz,
        "marca": e(MARCA),
        "navegacion": navegacion(paginas, raiz, None),
        "cuerpo": cuerpo,
        "json_ld": "\n".join(json_ld(d) for d in datos),
        "scripts": f'<script src="{raiz}assets/js/contacto.js" defer></script>',
        "verificacion": VERIFICACION_GOOGLE,
        "adsense": f'<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={ADSENSE_CLIENT}" crossorigin="anonymous"></script>' if ADSENSE_CLIENT else "",
        "clase_cuerpo": "pagina-portada",
    })


def main() -> None:
    plantilla = (RAIZ / "tools/plantilla.html").read_text(encoding="utf-8")
    paginas = cargar_paginas()
    (RAIZ / "index.html").write_text(portada(paginas, plantilla), encoding="utf-8")
    for p in paginas:
        destino = RAIZ / p["slug"]
        destino.mkdir(exist_ok=True)
        (destino / "index.html").write_text(pagina_herramienta(p, paginas, plantilla), encoding="utf-8")
    hoy = date.today().isoformat()
    urls = [BASE_URL] + [f'{BASE_URL}{p["slug"]}/' for p in paginas]
    sitemap = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    sitemap += [f"  <url><loc>{u}</loc><lastmod>{hoy}</lastmod></url>" for u in urls]
    sitemap.append("</urlset>")
    (RAIZ / "sitemap.xml").write_text("\n".join(sitemap) + "\n", encoding="utf-8")
    (RAIZ / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {BASE_URL}sitemap.xml\n", encoding="utf-8")
    print(f"{len(paginas)} herramientas + portada + sitemap ({len(urls)} URLs)")


if __name__ == "__main__":
    main()
