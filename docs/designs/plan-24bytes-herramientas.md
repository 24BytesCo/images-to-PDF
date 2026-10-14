# Plan: 24Bytes Herramientas (pdf., imagenes., audio., video. de 24bytes.pro)

Revisado con /plan-eng-review el 12/10/2026 · Repo: images-to-PDF · Alcance elegido por Alexis: **plan completo (B)**.
Diseño previo: `docs/designs/cunas-de-trafico.md`.

> **Cambio de decisión (12/10, Alexis):** la salida NO se versiona en git (`sitios/` en `.gitignore`).
> Cloudflare Pages corre `python3 tools/build.py` como build command (cero dependencias, ~1 s) y publica
> `sitios/<sitio>`. Evita ~18 MB de librerías duplicadas entre los 4 sitios; una sola fuente de verdad.

## Objetivo
Un solo repo que genera y publica cuatro sitios de herramientas, todas en el navegador, con el núcleo
compartido (plantilla, CSS, `comun.js`, `build.py`, Umami, AdSense). Más el aviso de «Preparar oferta
para SECOP II» dentro de SECOP Monitor.

```
                 tools/paginas/<slug>.json  (campo nuevo "sitio": pdf|imagenes|audio|video)
                 tools/ui/<slug>.html
                 tools/sitios.json          (por sitio: dominio, marca, Umami, AdSense, portada)
                          │
                    python3 tools/build.py   (sin dependencias, como hoy)
                          │
      ┌───────────────┬───┴────────────┬────────────────┐
  sitios/pdf/     sitios/imagenes/  sitios/audio/   sitios/video/     ← salida versionada en git
      │               │                │                │
  CF Pages «pdf»  CF Pages «img»   CF Pages «audio» CF Pages «video»   (sin build: solo publica la carpeta)
      │               │                │                │
 pdf.24bytes.pro imagenes.24bytes.pro audio.…      video.…
                                       └──── ffmpeg-core.wasm (31 MB) ──→ cdn.24bytes.pro (R2)
```

## Lo que ya existe y se reutiliza
- `tools/build.py`: genera páginas desde JSON + UI; se le agrega el campo `sitio` y la config por sitio.
  Hoy tiene `BASE_URL`, `MARCA` y `ADSENSE_CLIENT` fijos (líneas 17-23): pasan a `tools/sitios.json`.
- `assets/js/comun.js` (`Suite`: zona de carga, ordenar, descargar, avisos, Umami): igual en los cuatro sitios.
- La compresión por rasterizado está duplicada en `comprimir-pdf.js` y `oferta-secop-pdf.js`: se extrae
  a `assets/js/rasterizar.js` (con pdf-lib, que no comparte recursos entre páginas; ver la prueba del 12/10).
- Patrón de herramienta = `.json` + `.html` + `.js`; se mantiene.

## Pasos
1. **Núcleo multisitio (sin cambiar nada visible).** `sitios.json`, campo `sitio` en cada página
   (las 10 actuales = `pdf`), salida en `sitios/<sitio>/`, `assets/` copiado a cada sitio, sitemap y
   robots por sitio, portada y «Más herramientas» solo del mismo sitio + enlace cruzado a los otros sitios
   en el pie. Prueba: las URL y el HTML de pdf generados son idénticos a los de hoy salvo rutas de assets.
2. **pdf.24bytes.pro a Cloudflare Pages.** Proyecto «pdf» con carpeta `sitios/pdf`, dominio pdf.24bytes.pro;
   conservar el archivo de verificación de Google y el `ads.txt`/Umami. Cambio de DNS (CNAME de GitHub a
   Pages) en el mismo minuto; verificar desde fuera las 19 URL en 200. GitHub Pages queda apagado después.
   Reversible: volver el CNAME a `24bytesco.github.io`.
3. **imagenes.24bytes.pro.** HEIC a JPG (decodificador libheif en wasm vendorizado, en un Web Worker;
   Safari usa su decodificador nativo) y Comprimir imagen (canvas + calidad, sin librerías). Cada una con
   su contenido propio: nada de páginas en serie por plantilla.
4. **cdn.24bytes.pro en R2** con `ffmpeg-core.wasm`/`.js` versionados en la ruta (`/ffmpeg/0.12.x/`),
   CORS solo para `*.24bytes.pro`, caché larga. Se usa el núcleo de un solo hilo: no exige cabeceras
   COOP/COEP (si algún día se quiere el multihilo, `_headers` de Pages las pone).
5. **audio.24bytes.pro y video.24bytes.pro.** MP4 a MP3, recortar audio, comprimir video, video a GIF.
   Tope de tamaño por archivo con aviso claro (la memoria del wasm ronda 2 GB) y progreso real.
6. **Aviso en SECOP Monitor** (repo SECOP-Monitor, rama → QA → master, nunca directo a producción):
   bloque propio «¿Tu oferta pesa más de 50 MB? Prepárala aquí» en las fichas de proceso y en los correos
   de alertas, con UTM `utm_source=secop&utm_medium=ficha|correo`. AdSense solo en páginas públicas,
   nunca en las de suscriptores que pagan.

## Pruebas (decidido: suite E2E en el repo)
`tests/` con Playwright (venv de `~/.local/betlab-uploader`, `/usr/bin/google-chrome`), archivos de prueba
generados en el propio navegador (sin binarios en git).

```
CÓDIGO                                   PRUEBA
build.py
  ├─ URLs de pdf idénticas a hoy         tests/test_build.py  (lista de rutas + diff de HTML sin assets)
  ├─ sitemap/robots por sitio            tests/test_build.py
  └─ «Más herramientas» solo del sitio   tests/test_build.py
oferta-secop-pdf                         tests/e2e/test_oferta.py: 1 parte · varias partes · folio corrido ·
                                         compresión que engorda (usa original) · una página > límite (aviso)
rasterizar.js (compartido)               tests/e2e/test_comprimir.py + test_oferta.py
cada herramienta pdf existente           tests/e2e/test_pdf_<slug>.py: carga, procesa, descarga, verifica
heic-a-jpg                               tests/e2e/test_heic.py: HEIC real (de muestra libre) → JPG decodificable;
                                         archivo no HEIC → aviso; HEIC con varias imágenes → la principal
comprimir-imagen                         tests/e2e/test_comprimir_imagen.py: más liviano; si engorda, aviso
audio/video (ffmpeg desde R2)            tests/e2e/test_ffmpeg.py: MP4 corto → MP3 reproducible; CDN caído → aviso
todas las páginas                        sin errores de consola, sin desborde a 390 px
```
Se corre antes de cada publicación (`python3 -m pytest tests`).

## Modos de falla
| Codepath | Falla realista | Prueba | Manejo | ¿Silenciosa? |
|---|---|---|---|---|
| Cambio de DNS de pdf | URL en 404 tras mover | test_build + chequeo externo | revertir CNAME | no |
| HEIC raro (retrato, multi-imagen) | libheif no lo decodifica | test_heic | aviso por archivo | no |
| ffmpeg desde R2 | CORS mal puesto o R2 caído | test_ffmpeg | aviso «no se pudo cargar el motor» | no |
| Video grande | memoria del wasm agotada | tope de tamaño | aviso antes de procesar | no |
| Partir oferta | una página pesa más que el límite | test_oferta | aviso en la lista de partes | no |
Sin brechas críticas.

## Rendimiento
- libheif y ffmpeg en Web Worker: la página no se congela.
- ffmpeg se descarga solo al usar una herramienta de audio/video, una vez, con caché del navegador.
- Medir peso de cada página nueva: menos de 300 KB antes del primer uso.

## NOT in scope
- Membresía y cobros: se deciden con datos de tráfico (criterio del diseño: >1.000 visitas/mes).
- Las 200 herramientas: crecer según las métricas de cada cuña, no por cantidad.
- ffmpeg multihilo (COOP/COEP): el de un hilo basta para empezar.
- Descargador de YouTube: descartado (términos de YouTube, AdSense, DMCA, riesgo para los canales).

## Paralelización
| Paso | Módulos | Depende de |
|---|---|---|
| 1 Núcleo multisitio | tools/, assets/ | — |
| 2 pdf a CF Pages | DNS, Cloudflare | 1 |
| 3 imagenes | tools/, assets/js | 1 |
| 4 R2 | Cloudflare | — |
| 5 audio/video | tools/, assets/js | 1, 4 |
| 6 Aviso SECOP | repo SECOP-Monitor | — |
Carriles: A = 1 → 3 → 5 (mismo módulo, secuencial) · B = 4 · C = 6 · luego 2 tras 1.

## Ampliación 14/10/2026 (pedido de Alexis)

### A. Más herramientas de audio y video (ffmpeg.wasm, mismo motor y tope de 500 MB)
Criterio: búsqueda real en español + gancho de privacidad; una herramienta = una lógica propia (nada de
páginas casi duplicadas por plantilla: «MOV/MKV/AVI/WEBM a MP4» es UNA herramienta con selector).
- **Fase A — audio (sitio `audio`):** volumen y normalizar · velocidad (con/sin cambio de tono) ·
  quitar silencios · reducir ruido · fundido de entrada/salida · audio a video (MP3 + imagen → MP4 para
  YouTube/Reels) · grabadora de voz (MediaRecorder, sin ffmpeg para grabar; exporta a MP3).
- **Fase A — video (sitio `video`):** recortar · unir · convertir a MP4 (MOV/MKV/AVI/WEBM) · velocidad
  (cámara lenta/rápida) · rotar y voltear · redimensionar / pasar a vertical 9:16 · extraer fotogramas a
  JPG · cambiar o añadir audio · grabador de pantalla (getDisplayMedia + MediaRecorder; exporta a MP4) ·
  GIF a MP4. «Comprimir a X MB para WhatsApp/Discord» entra como MODO de comprimir-video, no como página.
- **Fase B (evaluar con métricas):** marca de agua en video · transcribir audio con Whisper en wasm
  (modelo de 40-150 MB: caro en descarga, alto valor).
- Total tras Fase A: ~45 herramientas (28 actuales + ~17).

### B. Espera con apoyo al proyecto (modal al procesar)
- Al pulsar el botón que procesa/descarga, aparece un modal **no cerrable** con barra de progreso, mínimo
  **10 s** o lo que tarde la conversión (lo mayor). Al terminar se cierra solo y se inicia la descarga.
  Un error cierra el modal de inmediato (no se castiga el fallo).
- Texto fijo «¿Por qué te mostramos esto?»: el sitio es gratuito y de código abierto; el aviso (y, cuando
  haya, un anuncio) ayuda a pagar dominios, servidores y bases de datos. Botón **«Invítame un café»**
  (`cafe_url` en `sitios.json`; si está vacío, el botón no se pinta).
- Configurable por sitio en `sitios.json` (`espera.activa`, `minimo_seg`, `cafe_url`,
  `anuncio_en_modal`). Gancho de pruebas: `window.SUITE_ESPERA_MIN_MS`.
- **Riesgo AdSense:** hasta donde sé, las políticas de AdSense no admiten anuncios dentro de pop-ups o
  interstitiales forzados, y una sanción afecta a la cuenta que cubre `24bytes.pro` (incluye SECOP). Por eso
  `anuncio_en_modal` queda en **false** por defecto: el modal muestra la explicación y el café; el anuncio
  va en el hueco normal bajo la herramienta. Revisar la política vigente antes de activarlo.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 3 decisiones: alcance B, ffmpeg en R2, suite E2E; DRY de rasterizar resuelto en el plan |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **VERDICT:** ENG CLEARED — listo para implementar.

NO UNRESOLVED DECISIONS
