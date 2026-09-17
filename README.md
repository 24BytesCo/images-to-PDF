
# Images-to-PDF Studio


Convierte, une y agrupa imágenes JPG y PNG en un solo PDF, directo en tu navegador. 100% local, gratis, sin publicidad y sin subir archivos. Nació para resolver mi propia necesidad y está abierto para cualquiera que lo necesite: https://24bytesco.github.io/images-to-PDF/

## Propósito
- Pasar imágenes a PDF sin instalar nada ni subirlas a servidores.
- Ofrecer una herramienta ilimitada, sin anuncios y lista para usar en cualquier navegador moderno.

## Características
- Arrastra y suelta, con orden alfabético o manual (drag & drop).
- Convierte, une y agrupa JPG/PNG en un único PDF (A4) en segundos.
- Procesamiento 100% cliente: tus archivos no salen de tu dispositivo.
- Marca de agua de marca fija en el PDF.
- Contadores públicos: visitas, PDFs creados y clicks al badge (sin cookies ni datos personales).
- Formulario de feedback/contacto (nombre, correo/número, mensaje) vía FormSubmit.

## 🛠️ Stack
- HTML5
- CSS3
- JavaScript (ES6)
- Librería: [jsPDF](https://github.com/parallax/jsPDF) (v2.5.1)

## 🚀 Cómo usar
### Clonar el repositorio
```bash
git clone https://github.com/24BytesCo/Images-to-PDF.git
cd Images-to-PDF
# Abre index.html en tu navegador favorito
```

### Descarga directa
1. Descarga el ZIP del repositorio.
2. Descomprime la carpeta.
3. Abre `index.html` en tu navegador.

## 📂 Estructura del proyecto
```plaintext
Images-to-PDF/
├── index.html
├── robots.txt
├── sitemap.xml
├── manifest.json
├── assets/
│   ├── css/styles.css
│   └── js/app.js
└── imgs/ (marca de agua, favicon, imagen OG)
```

## 🌐 Preparado para un subdominio propio (pendiente, no activado)
Hoy vive en `https://24bytesco.github.io/images-to-PDF/`. Si en el futuro se
sirve en `pdf.24bytes.pro`, falta:
1. Crear un archivo `CNAME` en la raíz del repo con el contenido `pdf.24bytes.pro`.
2. En Cloudflare (DNS de `24bytes.pro`), un registro `CNAME` de `pdf` →
   `24bytesco.github.io`, proxy desactivado (GitHub Pages gestiona su propio TLS).
3. Activar "Enforce HTTPS" en GitHub Pages una vez el DNS resuelva.
4. Actualizar `canonical`, `og:url`, `og:image`, `twitter:image` y
   `sitemap.xml` en `index.html` para que apunten a `https://pdf.24bytes.pro/`
   en vez de `https://24bytesco.github.io/images-to-PDF/`.

## Stack
- HTML5
- CSS3
- JavaScript (ES6)
- Librería: jsPDF (v2.5.1)

## Contribuir
- Fork + PR con tu mejora. Rama sugerida: `feature/tu-mejora`.
- Ideas: más formatos, mejoras de accesibilidad/SEO, UX, tests, nuevas opciones de salida.

## Licencia
MIT. Disfruta y compártelo. Sin publicidad, sin límites. 
