# Imágenes a PDF — contexto para una sesión nueva

> Escrito 2026-09-17. Reglas comunes en `../SESIONES.md` y `../CLAUDE.md`.

## 1. Qué es

Herramienta estática (HTML + JS, jsPDF desde cdnjs) que convierte y une
imágenes en un PDF sin salir del navegador. Repo público
`24BytesCo/images-to-PDF`, publicada en GitHub Pages:
https://24bytesco.github.io/images-to-PDF/ (rama `main` = producción; el push
a `main` despliega solo).

## 2. Estado al 2026-09-17

- Clonado el 16/09 en esta carpeta. Rama `seo/mejoras-20260916` con 3 commits
  **sin push** (`3dd38a7`, `8ef9e8f`, `4efed6b`): canonical, OG/Twitter con
  imagen propia de 46 KB (antes apuntaba a otro repo y pesaba 6,3 MB), favicon,
  manifest, robots.txt, sitemap.xml, JSON-LD `WebApplication` con oferta
  gratis y `FAQPage`, secciones «Cómo funciona» y «Preguntas frecuentes»,
  autoría con enlace a 24bytes.pro. Conversión probada con Playwright.
- Bug encontrado: los contadores usaban CounterAPI v1, apagada desde agosto
  (410). Ahora se ocultan en silencio en vez de llenar la consola de errores.
- Falta el **sí de Alexis para fusionar a `main` y hacer push** (eso publica).

## 3. Pendientes / decisiones

1. Push a `main` (publica los cambios en Pages).
2. Contadores: migrar a CounterAPI v2 (necesita cuenta y clave) o quitarlos.
3. Borrar `imgs/img_24_bytes_image_to_pdf.png` (6,3 MB, ya sin referencias).
4. Subdominio `pdf.24bytes.pro`: documentado en el README (CNAME en el repo,
   CNAME en Cloudflare a `24bytesco.github.io`, cambiar canonical y sitemap).
   No activado.
