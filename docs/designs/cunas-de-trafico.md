# Design: cuñas de tráfico para 24Bytes PDF (y después convertidores)

Generado por /office-hours el 12/10/2026 · Repo: images-to-PDF · Estado: BORRADOR · Modo: startup

## Problema
Alexis quiere una herramienta gratuita «que la gente use mucho», con publicidad y membresía.
pdf.24bytes.pro (nueve herramientas PDF en el navegador, publicada el 20/09) **no tiene tráfico**:
2 impresiones y 0 clics en Google en tres semanas (Search Console, 20/09-11/10). Sumar
convertidores sin resolver de dónde llega la gente repetiría ese resultado.

## Decisiones de la sesión
- **Descargador de YouTube: descartado.** Viola los términos de YouTube y la política de AdSense;
  YouTube bloquea las IP de servidor; las quejas DMCA a Contabo tumbarían SECOP y San Roque; y
  arriesga los canales, que dependen de las mismas cuentas de Google.
- **Todo en el navegador.** Sin costo de servidor; el ángulo «tus archivos no salen de tu equipo».
- **Tres cuñas, en orden** (Alexis eligió las tres): A → B → C. Cada una se mide 4 semanas antes de
  invertir en la siguiente.
- **Nada de páginas en serie por plantilla** (lo que castigó a SECOP el 22/08).

## Premisas (aceptadas)
1. En Google, «HEIC a JPG» y «MP4 a MP3» los dominan iLoveIMG, Convertio y similares, que ya venden
   «100 % local»; un dominio nuevo no les gana pronto.
2. Los sitios de convertidores crecen con enlaces y durante años (CoolUtils: de 20k a 200k visitas
   orgánicas al mes en unos 3 años).
3. La ventaja propia es SECOP: constructoras que suben ofertas a SECOP II, donde cada documento
   está limitado a 50 MB (módulo de formación de Colombia Compra) y las licitaciones exigen foliar.

## Cuña A — «Preparar oferta para SECOP II» (primero)
- **Usuario:** el contratista o la persona de la constructora que arma la oferta y tiene un PDF
  escaneado de 120 MB que SECOP II rechaza la noche antes del cierre.
- **Qué es:** UNA página que encadena lo que ya existe en el repo (`comprimir-pdf`, `dividir-pdf`,
  `unir-pdf`, `numerar-paginas-pdf`): unir los anexos → foliar → comprimir y, si sigue pasando de
  50 MB, dividir en partes de menos de 50 MB, con un aviso claro del tamaño de cada parte.
- **Distribución:** desde SECOP Monitor, que ya tiene el tráfico: enlace en las fichas de proceso,
  en los correos y alertas de WhatsApp («¿tu oferta pesa más de 50 MB?»), y en la guía del RUP.
- **Monetización:** AdSense en la página; la membresía de SECOP Monitor quita los anuncios y suma
  el procesamiento por lotes. Volumen modesto, pero usuarios con dinero y un dolor con fecha límite.
- **Esfuerzo:** 1-2 días (casi todo es reutilizar).

## Cuña B — Markdown a PDF + enlaces (segundo)
- Ya existe y es el único hueco SEO real en español (ver `docs/seo-palabras-clave.md`).
- El trabajo es de distribución, no de código: listas awesome (el PR #81 de awesome-pdf sigue
  abierto), AlternativeTo, dev.to en español, Reddit (r/devsarg, r/programacion), Show HN.

## Cuña C — HEIC a JPG (tercero)
- La herramienta masiva para usuarios de iPhone, procesada en el navegador. Mucho volumen y mucha
  competencia: solo después de que A y B den enlaces y autoridad al dominio.
- Audio y video (ffmpeg en el navegador) quedan para después de C, con datos en la mano.

## Criterios de éxito (medir en Umami «24Bytes PDF» y Search Console)
- A: al menos 50 usos al mes (evento `descarga`) llegados desde SECOP Monitor en las primeras 4 semanas.
- B: al menos 5 enlaces nuevos y las primeras 100 impresiones en Google en 4 semanas.
- C: no se empieza hasta cumplir A o B.
- AdSense: solicitarlo cuando el sitio pase de unas 1.000 visitas al mes.

## Preguntas abiertas
- ¿El límite de 50 MB vale también para la carga de la oferta del proveedor? La fuente encontrada
  habla de los documentos del proceso: confirmarlo con una constructora o en un pliego real.
- ¿«Foliar» debe numerar como «Folio 1 de N» o solo con el número? Preguntarle a una constructora.

## La tarea
Antes de escribir código, preguntarle a 2 constructoras usuarias de SECOP Monitor cuánto pesa su
última oferta, si SECOP II se la rechazó por tamaño y cómo la foliaron. Si al menos una dice que
sí, se construye A.

## Lo que noté
- «puede que no rinda pero quisiera que sea que la gente lo ve mucho»: el objetivo es volumen, y
  por eso la cuña A, que es de nicho, va con distribución propia y no con Google.
- Al elegir, eligió «todas las anteriores»: el orden A → B → C con medición entre cuñas mantiene
  esa ambición sin repartir el esfuerzo en tres frentes a la vez.
