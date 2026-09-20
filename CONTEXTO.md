# 24Bytes PDF (antes «Imágenes a PDF») — contexto para una sesión nueva

> Actualizado 2026-09-20. Reglas comunes en `../SESIONES.md` y `../CLAUDE.md`.

## 1. Qué es

Suite de herramientas PDF 100 % en el navegador (sitio estático, sin servidor,
sin subir archivos). Repo público `24BytesCo/images-to-PDF`, publicado en
GitHub Pages: https://24bytesco.github.io/images-to-PDF/ (rama `main` =
producción; el push a `main` despliega solo).

**Para qué**: abrir una vía de ingresos por tráfico de búsqueda + anuncios
(decisión de Alexis del 20/09, tras el fracaso de TikTok). Horizonte honesto:
meses, no semanas. El diferencial es la privacidad («no suben tus archivos»).

## 2. Estado al 2026-09-20

Rama `suite/herramientas-pdf-20260920` (sale de `seo/mejoras-20260916`),
**sin push**. `main` sigue con la herramienta vieja de una sola página.

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

1. **Fusionar a `main` y push** (publica). Nada se ha publicado.
2. Dominio: `pdf.24bytes.pro` (CNAME en el repo + CNAME en Cloudflare a
   `24bytesco.github.io` + cambiar `BASE_URL` y regenerar). AdSense aprueba
   mejor un dominio propio que un `github.io`.
3. AdSense: solicitar cuenta cuando haya tráfico; poner el id en
   `ADSENSE_CLIENT`.
4. Search Console: dar de alta la propiedad y enviar `sitemap.xml`.
5. Borrar `imgs/img_24_bytes_image_to_pdf.png` (6,3 MB, sin referencias).
6. Ideas siguientes por volumen de búsqueda: PDF a Word/Word a PDF (difícil sin
   servidor), firmar PDF, proteger/desbloquear PDF, HTML a PDF, rotar PDF como
   página propia, versión en inglés.
