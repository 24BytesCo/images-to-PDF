# Encargo: aviso de «Preparar oferta para SECOP II» dentro de SECOP Monitor

> Para la **sesión de SECOP-Monitor** (no esta). Es el Paso 6 del plan de 24Bytes Herramientas y, por
> urgencia de ingresos, lo más rápido para traer usuarios reales a `/oferta-secop-pdf/`.
> Creado el 12/10/2026 por la sesión de images-to-PDF.

## Qué
Un bloque de promoción de la herramienta gratuita que une, folia y parte ofertas en archivos de menos de
50 MB para subir a SECOP II. La herramienta ya está publicada: https://pdf.24bytes.pro/oferta-secop-pdf/

## Dónde
1. **Fichas de proceso** (páginas públicas de cada proceso): bloque propio, visible, no intrusivo.
2. **Correos de alertas** de nuevos procesos / cambios: bloque al pie del correo.

## Texto propuesto (ajustar al tono del sitio)
- Título: **¿Tu oferta pesa más de 50 MB?**
- Cuerpo: «Únela, folíala con folio corrido y pártela en archivos de menos de 50 MB para subirla a SECOP II.
  Gratis, en tu navegador, sin subir nada a ningún servidor.»
- Botón/enlace: «Preparar mi oferta →»

## Enlaces con UTM (medir en Umami/GA)
- En ficha: `https://pdf.24bytes.pro/oferta-secop-pdf/?utm_source=secop&utm_medium=ficha`
- En correo: `https://pdf.24bytes.pro/oferta-secop-pdf/?utm_source=secop&utm_medium=correo`

## Reglas (de Alexis y del plan)
- **Flujo rama → QA → master. NUNCA directo a producción** (memoria `secop-flujo-despliegue-qa-master`;
  migraciones a mano en prod en el mismo minuto si las hubiera — aquí no debería haber).
- **AdSense solo en páginas públicas, jamás en las de suscriptores que pagan.** Este aviso sí puede ir en
  fichas públicas y correos; no mezclar con zonas de pago.
- Español, sin romper maquetación móvil.

## Criterios de aceptación
- El bloque aparece en ficha pública y en el correo de alerta, con el UTM correcto en cada uno.
- Clic desde ficha/correo cae en `/oferta-secop-pdf/` y el evento llega con `utm_medium` distinto.
- QA verde; nada tocado en zonas de suscriptores de pago.
