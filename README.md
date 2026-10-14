# 24Bytes Herramientas

49 herramientas gratuitas de PDF, imágenes, audio y video que **no suben tus archivos**:
todo se procesa en tu navegador. No hay servidor que reciba tus documentos, ni registro,
ni límite de uso.

| Sitio | Herramientas |
|---|---|
| [pdf.24bytes.pro](https://pdf.24bytes.pro/) | Unir, dividir, organizar, comprimir, marca de agua, numerar páginas, imágenes a PDF, Markdown a PDF, PDF a imágenes y preparar una oferta para SECOP II (une, folía y parte en archivos de menos de 50 MB) |
| [imagenes.24bytes.pro](https://imagenes.24bytes.pro/) | HEIC a JPG, comprimir, convertir formato, redimensionar, recortar, rotar y voltear, unir imágenes, marca de agua, pixelar, quitar EXIF/GPS, Base64, SVG a PNG, favicon, paleta de colores y QR |
| [audio.24bytes.pro](https://audio.24bytes.pro/) | Video a MP3, recortar, convertir, unir, volumen y normalizar, velocidad, quitar silencios, reducir ruido, fundidos, audio a video y grabadora de voz |
| [video.24bytes.pro](https://video.24bytes.pro/) | Comprimir (también a un tamaño objetivo), recortar, unir, convertir a MP4, velocidad, rotar y voltear, vertical 9:16, extraer fotogramas, cambiar o quitar el audio, video a GIF, GIF a MP4 y grabador de pantalla |

Puedes comprobar que nada se sube: carga la página, desconecta el wifi y usa la herramienta.
(Audio y video necesitan internet solo la primera vez, para bajar el motor de ffmpeg, que
queda en la caché del navegador.)

## Cómo está hecho

Sitios estáticos, sin framework ni paso de compilación de JavaScript. Un solo repositorio
genera los cuatro sitios:

```bash
python3 tools/build.py      # escribe sitios/pdf, sitios/imagenes, sitios/audio y sitios/video
```

- `tools/sitios.json` — configuración de cada sitio (dominio, marca, portada, medición, espera).
- Cada herramienta son tres archivos: `tools/paginas/<slug>.json` (texto, pasos, preguntas y
  campo `sitio`), `tools/ui/<slug>.html` (interfaz) y `assets/js/<slug>.js` (lógica; utilidades
  comunes en `assets/js/comun.js`).
- `sitios/` es salida generada: no se edita a mano ni se versiona.

Librerías incluidas en `assets/vendor/` (nada se carga de un CDN de terceros):
[pdf-lib](https://pdf-lib.js.org/), [pdf.js](https://mozilla.github.io/pdf.js/),
[jsPDF](https://github.com/parallax/jsPDF), [pdfmake](http://pdfmake.org/),
[marked](https://marked.js.org/), [DOMPurify](https://github.com/cure53/DOMPurify),
[JSZip](https://stuk.github.io/jszip/), [libheif-js](https://github.com/catdad-experiments/libheif-js),
[qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) y los envoltorios de
[ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm). El núcleo de ffmpeg (~31 MB) se sirve
desde `cdn.24bytes.pro` y se descarga solo al usar una herramienta de audio o video. HEIC y
ffmpeg corren en Web Workers para no congelar la página.

## Usarlo en tu propio equipo

Si tu red bloquea los conversores en línea, o prefieres no depender de ningún sitio:

```bash
git clone https://github.com/24BytesCo/images-to-PDF.git
cd images-to-PDF
python3 tools/build.py
python3 -m http.server 8765 -d sitios/pdf      # o sitios/imagenes, sitios/audio, sitios/video
```

Abre http://localhost:8765/. Solo hace falta Python.

## Pruebas

Suite de 155 pruebas: el generador y una prueba de navegador por herramienta (Playwright con
Chrome) que verifica el resultado real (en audio y video, con `ffprobe`), cero errores de consola
y que no haya desborde a 390 px.

```bash
pip install pytest playwright
python3 -m pytest tests -q
```

## Contribuir

Fork y PR. Si te falta una herramienta, abre un issue.

## Licencia

MIT (ver `LICENSE`). Las librerías de `assets/vendor/` conservan sus propias licencias: MIT o
Apache-2.0, salvo libheif-js (LGPL-3.0). El núcleo de ffmpeg que se sirve desde el CDN es
[`@ffmpeg/core` 0.12.10](https://github.com/ffmpegwasm/ffmpeg.wasm) sin modificar, bajo
GPL-2.0-or-later; su código fuente está en ese repositorio. Hecho en Colombia por
[Alexis Dorado Muñoz — 24Bytes](https://24bytes.pro).
