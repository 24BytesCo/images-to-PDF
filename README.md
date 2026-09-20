# 24Bytes PDF

Herramientas PDF que no suben tus archivos: **https://pdf.24bytes.pro/**

Todo se procesa en tu navegador con JavaScript. No hay servidor que reciba tus
documentos, ni registro, ni límite de uso. Puedes comprobarlo desconectando el
wifi después de cargar la página: todo sigue funcionando.

## Herramientas

| Herramienta | Qué hace |
|---|---|
| [Imágenes a PDF](https://pdf.24bytes.pro/imagenes-a-pdf/) | Une JPG, PNG y WebP en un PDF, en el orden que elijas |
| [Markdown a PDF](https://pdf.24bytes.pro/markdown-a-pdf/) | Convierte `.md` a PDF con texto real, tablas, código y enlaces |
| [Unir PDF](https://pdf.24bytes.pro/unir-pdf/) | Combina varios PDF en uno |
| [Dividir PDF](https://pdf.24bytes.pro/dividir-pdf/) | Extrae un rango, separa cada página o parte cada N páginas |
| [Organizar PDF](https://pdf.24bytes.pro/organizar-pdf/) | Reordena, rota, duplica y elimina páginas con miniaturas |
| [PDF a imágenes](https://pdf.24bytes.pro/pdf-a-imagenes/) | Exporta páginas a JPG o PNG a 72, 150 o 300 ppp |
| [Comprimir PDF](https://pdf.24bytes.pro/comprimir-pdf/) | Reduce PDF escaneados o con fotos, y avisa si no hubo ahorro |
| [Marca de agua](https://pdf.24bytes.pro/marca-de-agua-pdf/) | Texto o imagen, con opacidad, ángulo y páginas a elegir |
| [Numerar páginas](https://pdf.24bytes.pro/numerar-paginas-pdf/) | Números de página o foliado, con formato y posición |

## Cómo está hecho

Sitio estático, sin framework ni paso de compilación de JavaScript. Las
librerías van incluidas en `assets/vendor/` (nada se carga de un CDN):
[pdf-lib](https://pdf-lib.js.org/), [pdf.js](https://mozilla.github.io/pdf.js/),
[jsPDF](https://github.com/parallax/jsPDF), [pdfmake](http://pdfmake.org/),
[marked](https://marked.js.org/), [DOMPurify](https://github.com/cure53/DOMPurify)
y [JSZip](https://stuk.github.io/jszip/).

Las páginas se generan con un script de Python sin dependencias:

```bash
python3 tools/build.py          # regenera index.html, /<slug>/, sitemap.xml y robots.txt
python3 -m http.server 8765     # y abre http://localhost:8765/
```

Cada herramienta son tres archivos:

- `tools/paginas/<slug>.json` — título, descripción, pasos, preguntas y texto de la página
- `tools/ui/<slug>.html` — la interfaz
- `assets/js/<slug>.js` — la lógica (utilidades comunes en `assets/js/comun.js`)

Los `index.html` son generados: no se editan a mano.

## Contribuir

Fork y PR. Si te falta una herramienta, cuéntamelo desde el formulario de la
portada o abre un issue.

## Licencia

MIT. Hecho en Colombia por [Alexis Dorado Muñoz — 24Bytes](https://24bytes.pro).
