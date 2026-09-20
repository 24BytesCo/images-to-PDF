# 24Bytes PDF (antes «Imágenes a PDF») — contexto para una sesión nueva

> Actualizado 2026-09-20. Reglas comunes en `../SESIONES.md` y `../CLAUDE.md`.

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
2. Distribución (lo que de verdad mueve un dominio nuevo): PR a
   `karllhughes/awesome-pdf`, ficha en AlternativeTo, Show HN, dev.to en
   español, enlace desde SECOP Monitor y 24bytes.pro.
3. AdSense: solicitar cuenta cuando haya tráfico; poner el id en
   `ADSENSE_CLIENT`.
6. Ideas siguientes por volumen de búsqueda: PDF a Word/Word a PDF (difícil sin
   servidor), firmar PDF, proteger/desbloquear PDF, HTML a PDF, rotar PDF como
   página propia, versión en inglés.
