# 24Bytes PDF (antes «Imágenes a PDF») — contexto para una sesión nueva

> Actualizado 2026-09-20. Reglas comunes en `../SESIONES.md` y `../CLAUDE.md`.

## 0. Estado al 2026-10-12 — LEER PRIMERO

- **Publicada** «Preparar oferta para SECOP II» (`/oferta-secop-pdf/`, commit `ee3fd93`): une, folia con folio
  corrido entre partes y parte en archivos de menos de 50 MB; compresión opcional con pdf-lib (jsPDF compartía
  recursos y cada parte cargaba todas las imágenes). Probada en Chrome a 1280 y 390 px.
- **Rumbo decidido** (office-hours + plan-eng-review con Alexis): el repo pasa a «24Bytes Herramientas», cuatro
  sitios (pdf., imagenes., audio., video. de 24bytes.pro) en Cloudflare Pages desde un solo repo, ffmpeg en R2
  (cdn.24bytes.pro) y suite E2E en `tests/`. Alexis eligió el **plan completo**.
- Diseño: `docs/designs/cunas-de-trafico.md` · Plan aprobado: `docs/designs/plan-24bytes-herramientas.md`.
- **Paso 1 HECHO (12/10, sin push):** núcleo multisitio. `tools/sitios.json` (config por sitio), build a
  `sitios/<sitio>/`, estáticos copiados por sitio, sitemap/robots por sitio, enlaces cruzados en el pie
  (mecanismo listo, no pintan con 1 solo sitio). Salida de pdf **byte-idéntica** a la de hoy; la raíz (prod
  de GitHub Pages) quedó intacta. Tests `tests/test_build.py` 6/6.
  - **Decisión (cambia el plan):** `sitios/` va en `.gitignore`; no se versiona la salida.
- **Paso 2 HECHO (12/10):** pdf.24bytes.pro corre en **Cloudflare Workers Static Assets** (Pages quedó
  fusionado en Workers; se eligió el camino moderno). Worker `pdf` sirve `sitios/pdf`
  (`wrangler.pdf.jsonc`). Cutover por API: se borró el CNAME viejo (`pdf → 24bytesco.github.io`, DNS-only)
  y se adjuntó el dominio al Worker; CF creó el DNS proxied y el SSL. Verificado desde fuera: portada +
  herramientas + assets + sitemap/robots en 200, `server: cloudflare`, Umami y verificación Google intactos.
  - **Despliegue:** `CLOUDFLARE_API_TOKEN=$(cat ~/.cf-pages-token) npx wrangler deploy -c wrangler.pdf.jsonc`
    (account `ee64910954440d0ebd76761796e8d674`). El clasificador bloquea que lo corra Claude: va por
    `! bash <script>` revisado (patrón [[clasificador-bloquea-borrados]]). No hay auto-deploy desde git.
  - **Rollback:** recrear en Cloudflare el CNAME `pdf → 24bytesco.github.io` (DNS only).
  - Pendiente menor: apagar GitHub Pages en Settings→Pages (ya no recibe tráfico); los archivos generados
    en la RAÍZ del repo (index.html, 404, sitemap, robots, <slug>/) quedaron MUERTOS (build.py solo escribe
    `sitios/`): no editarlos; borrarlos en una limpieza aparte. El token de acceso total sigue en
    `~/.cf-pages-token`: borrarlo o rotarlo cuando se termine la tanda de Cloudflare.
- **Paso 3 HECHO (12/10):** imagenes.24bytes.pro vivo en Cloudflare Workers (Worker `imagenes`,
  `wrangler.imagenes.jsonc`, dominio adjuntado por API; CF creó el registro proxied `AAAA 100::`).
  Dos herramientas, ambas con E2E (Playwright) y verificadas en producción vía resolutor público:
  - `comprimir-imagen`: canvas, calidad + tamaño máximo, respeta EXIF, conserva el original si engordaría.
  - `heic-a-jpg`: nativo en Safari; en el resto, **libheif-js 1.23.5** (`libheif-bundle.js`, wasm) en un
    Web Worker con carga perezosa. API: `libheif()` es una FACTORY → `new libheif().HeifDecoder()`
    (equivocarse con `new libheif.HeifDecoder()` fue el bug). Bundle solo-decodificación (no trae encoder).
  - Suite: `python3 -m pytest tests` = 10/10 (6 build + 2 comprimir + 2 heic; la de heic baja un HEIC real
    del repo de libheif en tiempo de prueba, no se versiona binario).
  - Pendientes de imagenes: **Umami** (crear sitio en el panel y poner `umami_id` en `sitios.json`);
    **formulario de contacto** desactivado (añadir origen `imagenes.24bytes.pro` al mapa `ORIGENES` del
    Portafolio y poner `"contacto": true`). Faltan Paso 4 (R2/ffmpeg) y Paso 5 (audio/video).
  - **Aviso en SECOP Monitor** (Paso 6, lo más rápido para ingresos): lo ejecuta la **sesión de SECOP-Monitor**
    por rama→QA→master (regla de una sesión por proyecto). Encargo listo en `docs/encargo-aviso-secop.md`.
  - Pendiente aquí: Paso 2 (CF Pages + DNS, requiere Alexis/Cloudflare), Paso 3 (imagenes.24bytes.pro),
    extraer `assets/js/rasterizar.js` (DRY comprimir+oferta, con E2E).
- Descargador de YouTube: descartado (términos de YouTube, AdSense, DMCA, riesgo para sus canales). No re-proponer.
- 200 herramientas: crecer por métricas de cada cuña, no por cantidad; nunca páginas en serie por plantilla.

## 1. Qué es

Suite de herramientas PDF 100 % en el navegador (sitio estático, sin servidor,
sin subir archivos). Repo público `24BytesCo/images-to-PDF`, alojado en GitHub
Pages (rama `main` = producción; el push a `main` despliega solo). Dominio
decidido el 20/09: **https://pdf.24bytes.pro/** (hosting sigue en Pages; el
dominio propio es lo que exige AdSense, que se solicita sobre `24bytes.pro` y
cubre los subdominios; `ads.txt` va en la raíz, o sea en el Portafolio).

**Para qué**: abrir una vía de ingresos por tráfico de búsqueda + anuncios
(decisión de Alexis del 20/09, tras el fracaso de TikTok). Horizonte honesto:
meses, no semanas. El diferencial es la privacidad («no suben tus archivos»).

## 2. Estado al 2026-09-20

**Publicado el 20/09** en https://pdf.24bytes.pro/ (`main` = `6ffc1de`, HTTPS
forzado, la URL vieja de `github.io` redirige con 301). Verificado desde fuera:
18 páginas en 200, 13 descargas reales con Playwright contra producción y
eventos llegando a Umami. El DNS (`pdf` CNAME → `24bytesco.github.io`, sin
proxy) se creó por API con el token del `cert.pem` de cloudflared, que ahora
vive en `/root/.cloudflared` del servidor.

Nueve herramientas, todas probadas con Playwright en escritorio y a 390 px
(descarga real, páginas contadas, cero errores de consola, sin desborde):

| Slug | Librerías |
|---|---|
| `imagenes-a-pdf` | jsPDF |
| `markdown-a-pdf` | marked + DOMPurify (vista previa) + pdfmake (texto real) |
| `unir-pdf`, `dividir-pdf` | pdf-lib (+ JSZip) |
| `organizar-pdf` | pdf.js (miniaturas) + pdf-lib |
| `pdf-a-imagenes` | pdf.js + JSZip |
| `comprimir-pdf` | pdf.js → JPEG → jsPDF (rasteriza: avisa y no descarga si queda más pesado) |
| `marca-de-agua-pdf`, `numerar-paginas-pdf` | pdf-lib + pdf.js (vista previa) |

Además, desde el 20/09 por la tarde (informe de palabras clave completo en
`docs/seo-palabras-clave.md`):

- 7 **páginas por tarea** que reutilizan la interfaz de una herramienta
  (`"variante_de"` en su JSON) con texto propio: `jpg-a-pdf`, `foto-a-pdf`,
  `pdf-a-jpg`, `rotar-pdf`, `eliminar-paginas-pdf`, `extraer-paginas-pdf`,
  `reducir-tamano-pdf-correo`. **No añadir más por plantilla**: `png-a-pdf`,
  `pdf-a-png`, `md-a-pdf` y `foliar-pdf` se descartaron a propósito por ser
  casi duplicados (lección de SECOP: contenido a escala).
- Sección de texto propio por herramienta (`"secciones"`), `privacidad/`
  (`"tipo": "texto"`), `404.html`, `CNAME`, manifest.
- Analítica: sitio «24Bytes PDF» en el Umami de `24bytes.pro/stats`
  (id `00ab1a32-c1d0-4735-8506-4104a5eb7f58`, solo cuenta en el dominio real);
  evento `descarga` con la herramienta usada.
- Diagnóstico SEO: las consultas de cabeza (unir, comprimir, jpg a pdf) son de
  Adobe/iLovePDF/Smallpdf; el único hueco real de cabeza es **Markdown a PDF**
  (SERP en español casi toda en inglés). El resto es cola larga + privacidad.

- **Formulario de contacto propio** (20/09): la portada envía a
  `https://24bytes.pro/api/contacto`, una ruta del Portafolio
  (`apps/web/src/app/api/contacto/route.ts`) que solo acepta el origen
  `pdf.24bytes.pro`, con honeypot, Zod y tope de 5 envíos/hora por IP, y sale
  por Resend. Probado de punta a punta en producción. Para otro sitio estático:
  añadir su origen al mapa `ORIGENES` de esa ruta y redesplegar el Portafolio.
- Lighthouse móvil (20/09): rendimiento 94-100, SEO 100, buenas prácticas 100,
  CLS 0. IndexNow enviado (`python3 tools/indexnow.py`, 202).

## 3. Cómo está hecho

- `python3 tools/build.py` (sin dependencias) lee `tools/paginas/<slug>.json`
  (SEO, pasos, FAQ) y `tools/ui/<slug>.html` (interfaz), y escribe
  `index.html`, `<slug>/index.html`, `sitemap.xml` y `robots.txt`. **Los
  `index.html` son generados: no editarlos a mano.**
- Constantes arriba de `build.py`: `BASE_URL`, `MARCA`, `ADSENSE_CLIENT`
  (vacío; con valor pinta el script y los huecos `.anuncio`).
- Lógica por herramienta en `assets/js/<slug>.js`; utilidades comunes en
  `assets/js/comun.js` (`window.Suite`); estilos en `assets/css/suite.css`.
  Cada interfaz puede traer un `<style>` propio con prefijo (`mdapdf-`,
  `cpdf-`, `maw-`, `num-`, `organizar-`).
- Librerías vendorizadas en `assets/vendor/` (nada por CDN).
- Herramienta nueva = tres archivos (`.json`, `.html`, `.js`) + `build.py`.
- Probar: `python3 -m http.server 8765` en la raíz; Playwright con
  `~/.local/betlab-uploader/.venv/bin/python` y `/usr/bin/google-chrome`.

## 4. Trampas

- `pdfjsLib.PasswordException` **no existe** en este build de pdf.js: un
  `instanceof` revienta. Comparar `error.name === 'PasswordException'`.
- pdf-lib guarda con object streams: contar páginas con regex sobre el binario
  no sirve; reabrir con pdf.js o pikepdf.
- pdf-lib no abre PDF cifrados (AES): se descartan con aviso, no se «salvan».
- El vfs de pdfmake solo trae Roboto: el código en Markdown a PDF no es
  monoespaciado. Las fuentes estándar de pdf-lib son WinAnsi: emojis en la
  marca de agua dan aviso.

## 5. Pendientes / decisiones de Alexis

1. Search Console: si `24bytes.pro` es propiedad de dominio, ya cubre el
   subdominio; enviar `https://pdf.24bytes.pro/sitemap.xml` (el acceso por API
   es de solo lectura, lo envía Alexis).
2. Distribución — **empezada el 10/10** (3 semanas tras publicar: 29
   visitantes, 1 impresión en Google, `markdown-a-pdf` sin indexar). Hecho:
   PR karllhughes/awesome-pdf#81, issue OneOffTech/awesome-pdf#104, enlace en
   el pie de SECOP Monitor (prod). Pendiente de Alexis (necesitan su cuenta):
   pedir indexación en GSC, AlternativeTo, Show HN, Product Hunt, dev.to —
   textos listos en `Capturas/pdf-distribucion-20261010.md` y
   `Capturas/pdf-distribucion-devto.md`. Revisar Umami/GSC el 10/11.
3. AdSense: solicitar cuenta cuando haya tráfico; poner el id en
   `ADSENSE_CLIENT`.
6. Ideas siguientes por volumen de búsqueda: PDF a Word/Word a PDF (difícil sin
   servidor), firmar PDF, proteger/desbloquear PDF, HTML a PDF, rotar PDF como
   página propia, versión en inglés.
