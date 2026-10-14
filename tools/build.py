#!/usr/bin/env python3
"""Genera los sitios estáticos de la suite (Cloudflare Pages, sin dependencias).

Un solo repo publica varios sitios (pdf, imagenes, audio, video). Cada sitio se
configura en `tools/sitios.json`; cada herramienta es una página propia
(`/<slug>/index.html`) definida en `tools/paginas/<slug>.json` (con el campo
`sitio`, por defecto "pdf") y su interfaz en `tools/ui/<slug>.html`. Todas las
páginas de un sitio comparten plantilla, estilos y pie.

Salida: `sitios/<sitio>/` (lo que publica Cloudflare Pages, sin build propio).
Uso:  python3 tools/build.py
"""
import html
import json
import shutil
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
# Estáticos que se copian tal cual a la carpeta de cada sitio.
ESTATICOS = ["assets", "imgs", "manifest.json", "9bed2c2d09393a8db9d492ed35b949ba.txt"]

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
    "convertir": '<path d="M5 8h11m0 0-3-3m3 3-3 3M19 16H8m0 0 3-3m-3 3 3 3"/>',
    "redimensionar": '<path d="M4 4h16v16H4z"/><path d="M14 10l6-6m0 0h-4m4 0v4M10 14l-6 6m0 0h4m-4 0v-4"/>',
    "recortar": '<path d="M7 3v14h14M3 7h14v14"/>',
    "rotar": '<path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5"/>',
    "exif": '<path d="M4 6h5l2 2h9v11H4z"/><path d="m9 13 6 3m0-3-6 3"/>',
    "base64": '<path d="M8 8 4 12l4 4M16 8l4 4-4 4M13.5 6l-3 12"/>',
    "favicon": '<path d="M4 4h16v16H4z"/><path d="M8 8h8v8H8z"/>',
    "pixelar": '<path d="M4 4h5v5H4zM9 9h5v5H9zM14 14h5v5h-5zM14 4h5v5h-5zM4 14h5v5H4z"/>',
    "svg": '<path d="M8 6 3 12l5 6M16 6l5 6-5 6"/><circle cx="12" cy="12" r="1.3"/>',
    "marca-imagen": '<path d="M4 5h16v14H4z"/><path d="m8 16 3-6 3 6m-5-2h4"/>',
    "paleta": '<path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 1.6-2-.5-1.2.2-2.5 1.6-2.5H17a4 4 0 0 0 4-4c0-5-4-9.5-9-9.5z"/><circle cx="8" cy="11" r="1.1"/><circle cx="11" cy="7.5" r="1.1"/><circle cx="15.5" cy="8.5" r="1.1"/>',
    "qr": '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z"/><path d="M14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z"/>',
    "unir-imagen": '<path d="M4 4h7v16H4zM13 4h7v16h-7z"/>',
    "candado": '<path d="M6 11h12v9H6z"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>',
}


# Iconos de audio y video (bloque aparte para no chocar al fusionar con otras ramas).
ICONOS.update({
    "audio": '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    "recortar": '<circle cx="6" cy="7" r="2.5"/><circle cx="6" cy="17" r="2.5"/><path d="m8 8.5 12 8M8 15.5l12-8"/>',
    "video": '<path d="M3 6h13v12H3z"/><path d="m16 10 5-3v10l-5-3"/>',
    "gif": '<path d="M3 5h18v14H3z"/><path d="M9.5 10.5H8a1.5 1.5 0 0 0 0 3h1.5V12M13 10v4M16 14v-4h2.5M16 12h2"/>',
    "silencio": '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="m16 9 5 6m0-6-5 6"/>',
    "unir-audio": '<path d="M3 9h3v6H3zM9 6h3v12H9zM15 8h3v8h-3z"/><path d="M20.5 12H22"/>',
})


def svg(clave: str) -> str:
    trazos = ICONOS.get(clave, ICONOS["organizar"])
    return (
        '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" '
        f'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{trazos}</svg>'
    )


def e(texto: str) -> str:
    return html.escape(texto, quote=True)


def cargar_sitios() -> dict:
    return json.loads((RAIZ / "tools/sitios.json").read_text(encoding="utf-8"))


def cargar_paginas(sitio: str) -> list[dict]:
    """Páginas del sitio indicado (campo `sitio`, por defecto "pdf")."""
    todas = [json.loads(p.read_text(encoding="utf-8")) for p in sorted((RAIZ / "tools/paginas").glob("*.json"))]
    propias = [p for p in todas if p.get("sitio", "pdf") == sitio]
    return sorted(propias, key=lambda p: p.get("orden", 99))


def principales(paginas: list[dict]) -> list[dict]:
    """Herramientas con tarjeta y menú propios (ni variantes ni páginas de texto)."""
    return [p for p in paginas if not p.get("variante_de") and p.get("tipo") != "texto"]


def tareas(paginas: list[dict], raiz: str, de: str | None = None, excluir: str | None = None) -> str:
    """Enlaces a las páginas por tarea (variantes), todas o solo las de una herramienta."""
    enlaces = [f'<a href="{raiz}{p["slug"]}/">{e(p["nombre"])}</a>' for p in paginas
               if p.get("variante_de") and p["slug"] != excluir and (de is None or p["variante_de"] == de)]
    return f'<p class="tareas">{" ".join(enlaces)}</p>' if enlaces else ""


def secciones(p: dict) -> str:
    bloques = []
    for s in p.get("secciones", []):
        parrafos = "\n".join(f'<p class="parrafo">{e(x)}</p>' for x in s["p"])
        bloques.append(f'<section class="bloque"><h2>{e(s["h"])}</h2>{parrafos}</section>')
    return "\n".join(bloques)


def tarjetas(paginas: list[dict], raiz: str, excluir: str | None = None) -> str:
    items = []
    for p in principales(paginas):
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
    for p in principales(paginas):
        marca = ' aria-current="page"' if p["slug"] == actual else ""
        enlaces.append(f'<a href="{raiz}{p["slug"]}/"{marca}>{e(p["nombre"])}</a>')
    return "\n".join(enlaces)


def json_ld(objeto: dict) -> str:
    return '<script type="application/ld+json">' + json.dumps(objeto, ensure_ascii=False) + "</script>"


def anuncio(cfg: dict, posicion: str) -> str:
    if not cfg["adsense_client"]:
        return ""
    return (
        f'<aside class="anuncio" aria-label="Publicidad" data-posicion="{posicion}">'
        f'<ins class="adsbygoogle" style="display:block" data-ad-client="{cfg["adsense_client"]}" '
        'data-ad-format="auto" data-full-width-responsive="true"></ins>'
        "<script>(adsbygoogle = window.adsbygoogle || []).push({});</script></aside>"
    )


def script_adsense(cfg: dict) -> str:
    if not cfg["adsense_client"]:
        return ""
    return (f'<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'
            f'?client={cfg["adsense_client"]}" crossorigin="anonymous"></script>')


def script_umami(cfg: dict) -> str:
    if not cfg.get("umami_id"):
        return ""
    return (f'<script defer src="https://24bytes.pro/stats/script.js" '
            f'data-website-id="{cfg["umami_id"]}" data-domains="{cfg["dominio"]}"></script>')


def pie_sitios(cfg: dict, sitios: dict) -> str:
    """Enlace cruzado a los otros sitios de la suite (vacío si solo hay uno)."""
    otros = [f'<a href="https://{o["dominio"]}/" rel="noopener">{e(o["marca"])}</a>'
             for clave, o in sitios.items() if clave != cfg["_clave"]]
    if not otros:
        return ""
    return f'\n    <p class="pie-sitios">Más herramientas de 24Bytes: {" · ".join(otros)}</p>'


def render(plantilla: str, valores: dict) -> str:
    salida = plantilla
    for clave, valor in valores.items():
        salida = salida.replace("{{" + clave + "}}", valor)
    return salida


def comunes(cfg: dict, sitios: dict) -> dict:
    """Placeholders iguales en toda página del sitio."""
    return {
        "marca": e(cfg["marca"]),
        "sello": e(cfg["sello"]),
        "verificacion": cfg["verificacion_google"],
        "base": cfg["base_url"],
        "og_image_alt": e(cfg["og_image_alt"]),
        "adsense": script_adsense(cfg),
        "umami": script_umami(cfg),
        "pie_sitios": pie_sitios(cfg, sitios),
    }


def pagina_herramienta(p: dict, paginas: list[dict], plantilla: str, cfg: dict, com: dict) -> str:
    raiz = "../"
    url = f'{cfg["base_url"]}{p["slug"]}/'
    base = p.get("variante_de") or p["slug"]
    ui = (RAIZ / "tools/ui" / f'{base}.html').read_text(encoding="utf-8").replace("{{raiz}}", raiz)
    pasos = "\n".join(f"<li><strong>{e(t)}</strong> {e(d)}</li>" for t, d in p["pasos"])
    faqs = "\n".join(
        f'<details class="faq"><summary>{e(f["p"])}</summary><p>{e(f["r"])}</p></details>' for f in p["faqs"]
    )
    datos = [
        {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": f'{p["nombre"]} — {cfg["marca"]}',
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
                {"@type": "ListItem", "position": 1, "name": cfg["marca"], "item": cfg["base_url"]},
                {"@type": "ListItem", "position": 2, "name": p["nombre"], "item": url},
            ],
        },
    ]
    scripts = "\n".join(f'<script src="{raiz}{s}" defer></script>' for s in p.get("scripts", []))
    cuerpo = f"""
    <section class="portada portada-herramienta">
      <p class="migas"><a href="{raiz}">{e(cfg["marca"])}</a> <span aria-hidden="true">/</span> {e(p["nombre"])}</p>
      <h1>{e(p["h1"])}</h1>
      <p class="bajada">{e(p["bajada"])}</p>
      <ul class="sellos"><li>Todo ocurre en tu navegador</li><li>Sin registro</li><li>Gratis y sin límite</li></ul>
    </section>
    <section class="herramienta" aria-label="{e(p["nombre"])}">
{ui}
    </section>
    {anuncio(cfg, "tras-herramienta")}
    {secciones(p)}
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
      {tareas(paginas, raiz, de=base, excluir=p["slug"])}
      <div class="rejilla">{tarjetas(paginas, raiz, excluir=p["slug"])}</div>
    </section>
"""
    return render(plantilla, {
        "titulo": e(p["titulo"]),
        "descripcion": e(p["descripcion"]),
        "canonical": url,
        "raiz": raiz,
        "navegacion": navegacion(paginas, raiz, p["slug"]),
        "cuerpo": cuerpo,
        "json_ld": "\n".join(json_ld(d) for d in datos),
        "scripts": scripts,
        "clase_cuerpo": "pagina-herramienta",
        **com,
    })


def pagina_texto(p: dict, paginas: list[dict], plantilla: str, cfg: dict, com: dict) -> str:
    raiz = "../"
    cuerpo = f"""
    <section class="portada portada-herramienta">
      <p class="migas"><a href="{raiz}">{e(cfg["marca"])}</a> <span aria-hidden="true">/</span> {e(p["nombre"])}</p>
      <h1>{e(p["h1"])}</h1>
      <p class="bajada">{e(p["bajada"])}</p>
    </section>
    {secciones(p)}
    <section class="bloque">
      <h2>Herramientas</h2>
      <div class="rejilla">{tarjetas(paginas, raiz)}</div>
    </section>
"""
    return render(plantilla, {
        "titulo": e(p["titulo"]), "descripcion": e(p["descripcion"]), "canonical": f'{cfg["base_url"]}{p["slug"]}/',
        "raiz": raiz, "navegacion": navegacion(paginas, raiz, None), "cuerpo": cuerpo,
        "json_ld": "", "scripts": "", "clase_cuerpo": "pagina-texto", **com,
    })


def portada(paginas: list[dict], plantilla: str, cfg: dict, com: dict) -> str:
    raiz = ""
    po = cfg["portada"]
    datos = [
        {"@context": "https://schema.org", "@type": "WebSite", "name": cfg["marca"], "url": cfg["base_url"],
         "inLanguage": "es", "description": cfg["lema"],
         "publisher": {"@type": "Organization", "name": "24Bytes", "url": "https://24bytes.pro"}},
        {"@context": "https://schema.org", "@type": "ItemList", "name": cfg.get("lista_nombre", "Herramientas PDF"),
         "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": p["nombre"], "url": f'{cfg["base_url"]}{p["slug"]}/'}
                             for i, p in enumerate(principales(paginas))]},
    ]
    enlaces_tareas = tareas(paginas, raiz)
    seccion_tareas = f"""    <section class="bloque">
      <h2>Tareas frecuentes</h2>
      {enlaces_tareas}
    </section>""" if enlaces_tareas else ""
    contacto = (RAIZ / "tools/ui/_contacto.html").read_text(encoding="utf-8") if cfg.get("contacto") else ""
    cuerpo = f"""
    <section class="portada">
      <h1>{e(cfg["lema"])}</h1>
      <p class="bajada">{e(po["bajada"])}</p>
      <ul class="sellos"><li>Todo ocurre en tu navegador</li><li>Sin registro</li><li>Gratis y sin límite</li></ul>
    </section>
    <section class="bloque bloque-rejilla" aria-label="Herramientas">
      <div class="rejilla rejilla-grande">{tarjetas(paginas, raiz)}</div>
    </section>
{seccion_tareas}
    {anuncio(cfg, "portada")}
    <section class="bloque">
      <h2>{e(po["porque_h"])}</h2>
      <p class="parrafo">{e(po["porque_p"])}</p>
    </section>
{contacto}
"""
    return render(plantilla, {
        "titulo": e(po["titulo"]),
        "descripcion": e(po["descripcion"]),
        "canonical": cfg["base_url"],
        "raiz": raiz,
        "navegacion": navegacion(paginas, raiz, None),
        "cuerpo": cuerpo,
        "json_ld": "\n".join(json_ld(d) for d in datos),
        "scripts": f'<script src="{raiz}assets/js/contacto.js" defer></script>' if cfg.get("contacto") else "",
        "clase_cuerpo": "pagina-portada",
        **com,
    })


def construir_sitio(clave: str, cfg: dict, sitios: dict, plantilla: str) -> int:
    cfg = {**cfg, "_clave": clave}
    salida = RAIZ / "sitios" / clave
    if salida.exists():
        shutil.rmtree(salida)
    salida.mkdir(parents=True)
    for nombre in ESTATICOS:
        origen = RAIZ / nombre
        if not origen.exists():
            continue
        destino = salida / nombre
        if origen.is_dir():
            shutil.copytree(origen, destino)
        else:
            shutil.copy2(origen, destino)

    paginas = cargar_paginas(clave)
    com = comunes(cfg, sitios)
    (salida / "index.html").write_text(portada(paginas, plantilla, cfg, com), encoding="utf-8")
    for p in paginas:
        destino = salida / p["slug"]
        destino.mkdir(exist_ok=True)
        hacer = pagina_texto if p.get("tipo") == "texto" else pagina_herramienta
        (destino / "index.html").write_text(hacer(p, paginas, plantilla, cfg, com), encoding="utf-8")

    cuerpo_404 = f"""
    <section class="portada">
      <h1>Esta página no existe</h1>
      <p class="bajada">Puede que el enlace esté mal escrito o que la herramienta haya cambiado de dirección. Todas siguen aquí:</p>
    </section>
    <section class="bloque bloque-rejilla" aria-label="Herramientas">
      <div class="rejilla rejilla-grande">{tarjetas(paginas, "/")}</div>
    </section>
"""
    (salida / "404.html").write_text(render(plantilla, {
        "titulo": e(f"Página no encontrada — {cfg['marca']}"), "descripcion": e(cfg["lema"]), "canonical": cfg["base_url"],
        "raiz": "/", "navegacion": navegacion(paginas, "/", None), "cuerpo": cuerpo_404,
        "json_ld": "", "scripts": "", "clase_cuerpo": "pagina-portada", **com,
    }).replace('content="index, follow, max-image-preview:large"', 'content="noindex, follow"'), encoding="utf-8")

    hoy = date.today().isoformat()
    urls = [cfg["base_url"]] + [f'{cfg["base_url"]}{p["slug"]}/' for p in paginas]
    sitemap = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    sitemap += [f"  <url><loc>{u}</loc><lastmod>{hoy}</lastmod></url>" for u in urls]
    sitemap.append("</urlset>")
    (salida / "sitemap.xml").write_text("\n".join(sitemap) + "\n", encoding="utf-8")
    (salida / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {cfg['base_url']}sitemap.xml\n", encoding="utf-8")
    print(f"[{clave}] {len(principales(paginas))} herramientas, {len(paginas) - len(principales(paginas))} páginas más + portada + sitemap ({len(urls)} URLs)")
    return len(urls)


def main() -> None:
    plantilla = (RAIZ / "tools/plantilla.html").read_text(encoding="utf-8")
    sitios = cargar_sitios()
    for clave, cfg in sitios.items():
        construir_sitio(clave, cfg, sitios, plantilla)


if __name__ == "__main__":
    main()
