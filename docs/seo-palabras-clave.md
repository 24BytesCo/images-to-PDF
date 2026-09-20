# Investigación de palabras clave — pdf.24bytes.pro (mercado ES/LatAm)

Metodología: ~30 búsquedas reales en español sobre las consultas y variantes de cada
herramienta, analizando quién ocupa el top de la SERP, qué ángulos aparecen en los
snippets (privacidad, sin registro, sin marca de agua) y qué long-tails se repiten.
No hay acceso a Search Console/Keyword Planner, así que la prioridad (alta/media/baja)
es relativa, razonada por: cuántos jugadores grandes dominan la SERP, si el resultado
está en español o se cuela contenido en inglés/portugués (señal de hueco), y cuántas
variantes/preguntas reales aparecieron.

**Diagnóstico general (léase antes que todo lo demás):** para los términos de cabeza
(«unir pdf», «comprimir pdf», «pdf a jpg», «firmar pdf», etc.) la SERP en español está
ocupada casi al 100% por Adobe Acrobat, Smallpdf, iLovePDF, PDF24 y PDFgear — los
cinco aparecen en prácticamente todas las búsquedas, con dominios de autoridad muy
alta y páginas dedicadas por keyword exacta. Un dominio nuevo no va a rankear ahí en
6-12 meses por mérito de contenido; hay que jugar en cola larga y en el ángulo de
privacidad, sabiendo que ese ángulo **ya tiene competidores** (ver más abajo) aunque
ninguno con autoridad real todavía.

---

## 1. Herramientas existentes: consultas, intención, quién domina, hueco real

### Unir PDF (`unir-pdf`)
- **Consulta principal**: unir pdf
- **Variantes reales**: combinar pdf, juntar pdf, unir pdf gratis, unir pdf sin registrarse, unir pdf online, combinar varios pdf en uno, unir pdf y descargar
- **Intención**: transaccional (herramienta), volumen alto
- **Domina la SERP**: Smallpdf, Adobe, PDF24, iLovePDF, PDFCandy — y **ya hay un competidor client-side español-friendly: `unepdf.com`**, que además une PDF+JPG+HEIC+PNG+TXT sin subir nada. Es la comparación más directa que existe hoy contra este proyecto.
- **Hueco real**: bajo en la cabeza («unir pdf»); medio en «unir pdf sin subir archivos» / «unir pdf privacidad» donde compite con unepdf.com y pdfree.io, no con los grandes. Cola larga tipo «unir pdf para trámite» o «unir pdf sin instalar nada offline» sigue libre.

### Dividir PDF (`dividir-pdf`)
- **Consulta principal**: dividir pdf
- **Variantes**: separar pdf, dividir pdf online, separar páginas pdf, partir un pdf
- **Intención**: transaccional, volumen alto
- **Domina**: Adobe, PDFgear, iLovePDF, PDF24, Smallpdf, SplitAPDF, LightPDF
- **Hueco real**: bajo. Es de las categorías más peleadas. Mejor apostar por las dos sub-intenciones (ver §4: extraer páginas / eliminar páginas) que por el término genérico.

### Extraer páginas de un PDF (variante dentro de `dividir-pdf`)
- **Consulta principal**: extraer páginas de un pdf
- **Variantes**: extraer una página de un pdf, sacar páginas de un pdf, extraer páginas pdf online
- **Intención**: transaccional, específica (quiere UN sub-documento, no partir todo)
- **Domina**: Adobe, iLovePDF, Smallpdf, PDF24, AvePDF, PDFBeast
- **Hueco real**: medio. Menos peleado que «dividir pdf» genérico porque varios grandes ni siquiera tienen landing dedicada (Smallpdf sí, con URL propia `/es/extraer-paginas-pdf`, prueba de que la intención se considera distinta).

### Comprimir PDF (`comprimir-pdf`)
- **Consulta principal**: comprimir pdf
- **Variantes**: reducir tamaño pdf, comprimir pdf sin perder calidad, comprimir pdf para correo, reducir peso de un pdf, comprimir pdf online gratis
- **Intención**: transaccional, volumen muy alto
- **Domina**: Canva, Adobe, PDFgear, PDF24, Smallpdf, iLovePDF, AvePDF
- **Hueco real**: bajo en la cabeza. La particularidad de esta herramienta (rasteriza a JPG, por eso «no siempre reduce si el PDF ya es texto liviano») es una limitación honesta que ningún competidor grande explica con esa claridad — puede ser un diferencial de contenido, no de ranking.
- **Long-tail con hueco**: «reducir tamaño pdf para correo» (ver §4, página propia) tiene intención más específica y menos jugadores peleando la keyword exacta.

### Organizar PDF — reordenar/rotar/eliminar/duplicar (`organizar-pdf`)
- **Consulta principal**: organizar pdf
- **Variantes**: ordenar páginas pdf, reorganizar pdf, rotar y ordenar pdf
- **Intención**: transaccional
- **Domina**: **iLovePDF usa exactamente el slug `/es/organizar-pdf`** — mismo slug que el nuestro. Además PDF24 usa `/es/ordenar-paginas`, Smallpdf `/es/organizar-pdf`, Adobe `/es/acrobat/online/rearrange-pdf.html`. Ojo: buscar «organizar paginas pdf» (con paginas) devolvió mayoritariamente resultados en portugués, señal de que en español puro el volumen es bajo y está fragmentado entre «organizar», «ordenar» y «reorganizar».
- **Hueco real**: bajo-medio. El diferencial real es que esta página combina 4 acciones (reordenar + rotar + eliminar + duplicar) en una sola vista de miniaturas — ningún competidor lo vende así en el título. Conviene separar rotar y eliminar como páginas propias (ver §4) porque tienen intención y volumen propios y más simples de satisfacer con una sola acción.

### Rotar PDF (variante dentro de `organizar-pdf`)
- **Consulta principal**: rotar pdf
- **Variantes**: girar pdf, rotar pdf online, rotar pdf y guardar, rotar una página de un pdf
- **Domina**: PDFgear, Adobe, Smallpdf («girar-pdf»), PDF24 («girar-pdf»), iLovePDF, PDF2Go
- **Hueco real**: bajo en volumen de la keyword exacta, pero como es una tarea de una sola acción (sin necesidad de subir, un clic, descargar) es ideal para long-tail «rotar pdf sin subir archivos» / «rotar pdf gratis sin marca de agua», donde el listado de resultados no muestra ningún jugador insistiendo en privacidad.

### Eliminar páginas de un PDF (variante dentro de `organizar-pdf`)
- **Consulta principal**: eliminar páginas de un pdf
- **Variantes**: borrar páginas pdf, quitar página de un pdf, eliminar hoja de un pdf
- **Domina**: iLovePDF, Smallpdf, Adobe, PDF24, PDFgear — todos con landing dedicada y URL propia (`ilovepdf.com/es/eliminar-paginas`), prueba de que la intención se trata aparte de «organizar».
- **Hueco real**: medio-bajo en la keyword exacta; el gancho es que la mayoría exige elegir página por página en una interfaz más pesada — «eliminar página de un pdf en 2 clics, sin subir nada» es un mensaje diferenciador viable.

### PDF a imágenes (`pdf-a-imagenes`)
- **Consulta principal**: pdf a imagenes / convertir pdf a jpg
- **Variantes**: pdf a jpg, pdf a png, extraer imágenes de un pdf, convertir pdf a imagen
- **Intención**: transaccional, volumen alto (especialmente «pdf a jpg»)
- **Domina**: PDF24, Smallpdf, iLovePDF, Adobe, FreeConvert, pdf2jpg.net
- **Hueco real**: bajo en «pdf a jpg» (el más buscado); la página genérica «pdf a imagenes» diluye tráfico que debería ir a una landing «pdf a jpg» específica (ver §4), que es como la nombran los propios competidores (PDF24 tiene páginas separadas `/es/pdf-a-jpg` y `/es/pdf-a-imagenes`).

### Imágenes a PDF (`imagenes-a-pdf`)
- **Consulta principal**: convertir imágenes a pdf / jpg a pdf
- **Variantes**: jpg a pdf, foto a pdf, png a pdf, convertir fotos a pdf, unir fotos en un pdf
- **Intención**: transaccional, volumen muy alto, con fuerte componente móvil («foto a pdf desde el celular» tiene resultados dominados por YouTube y blogs tipo tutorial, no por las herramientas grandes — señal de que la intención de búsqueda desde el celular está mal servida por landing pages).
- **Domina**: PDFgear, PDF24, Smallpdf, Adobe, iLovePDF, Canva
- **Hueco real**: medio en «foto a pdf» por el ángulo móvil desatendido; bajo en «jpg a pdf» (muy peleado) pero vale la pena por volumen, con mensaje de privacidad porque son justo los documentos más sensibles (cédula, recibos) los que la gente fotografía para convertir.

### Marca de agua (`marca-de-agua-pdf`)
- **Consulta principal**: marca de agua pdf
- **Variantes**: poner marca de agua a un pdf, agregar marca de agua pdf, marca de agua texto o imagen pdf, quitar marca de agua pdf (¡ojo, intención distinta y no cubierta!)
- **Domina**: Watermarkly, PDF24, Smallpdf, CleverPDF, PDFCandy, LightPDF — SERP más fragmentada, ningún gigante (Adobe, iLovePDF) apareció en el top del snippet analizado, y varios jugadores medianos sin autoridad enorme.
- **Hueco real**: medio-alto. Es la categoría con SERP menos dominada por los cinco grandes — vale la pena reforzar contenido y FAQ aquí.

### Numerar páginas (`numerar-paginas-pdf`)
- **Consulta principal**: numerar páginas pdf
- **Variantes**: insertar número de página pdf, poner número de página pdf, numerar pdf online, foliar pdf
- **Domina**: Adobe, PDF24, Smallpdf, iLovePDF, PDFCandy, y dos sitios nicho: numerapdf.com, alejandrius.com (foliador) — señal de que hay demanda específica en español («foliar» es término legal/administrativo usado en Colombia y otros países de LatAm) mal cubierta por los grandes en inglés.
- **Hueco real**: medio. El término «foliar pdf» es un ángulo casi sin explotar por los grandes jugadores y calza con el público de trámites/documentos oficiales.

### Markdown a PDF (`markdown-a-pdf`)
- **Consulta principal**: markdown a pdf / convertir md a pdf
- **Variantes**: md a pdf, markdown to pdf online, convertir readme a pdf, exportar markdown a pdf con estilo
- **Domina**: **Nadie en español.** Los resultados para «markdown a pdf» y «convertir md a pdf» en español son casi todos en inglés (CloudConvert, PDF24 en su versión EN, markdowntopdf.com, md2file.com, pdfforge, Zamzar, Aspose, GroupDocs, CoolUtils). Ningún jugador grande (Adobe, Smallpdf, iLovePDF) tiene ni siquiera página para esto.
- **Hueco real**: **alto — el mejor de las nueve herramientas.** Es la única categoría donde el sitio puede aspirar a página 1 en español en plazo razonable, además con diferencial técnico real (texto seleccionable/buscable de verdad, no captura de la vista previa).

---

## 2. Title, meta description y H1 propuestos

Reglas aplicadas: consulta principal al inicio, sin mayúsculas gritonas, sin emojis,
mencionando el diferencial de privacidad solo donde no se pisa el conteo de caracteres.

| Página | Title (≤60) | Meta description (≤155) | H1 |
|---|---|---|---|
| `unir-pdf` | Unir PDF gratis online, sin subir archivos | Une varios PDF en uno solo, en el orden que quieras. Todo pasa en tu navegador: tus archivos nunca se suben a un servidor. Gratis, sin registro. | Unir PDF sin subir archivos |
| `dividir-pdf` | Dividir PDF gratis: separar y extraer páginas | Extrae un rango, separa cada página o divide cada N páginas, sin subir tu PDF a ningún servidor. Gratis, sin registro ni límites. | Dividir PDF sin subir archivos |
| `comprimir-pdf` | Comprimir PDF gratis, sin subir el archivo | Reduce el peso de un PDF escaneado o con fotos directamente en tu navegador. Compara el tamaño antes de descargar. Gratis, sin registro. | Comprimir PDF sin subir archivos |
| `organizar-pdf` | Reordenar, rotar y eliminar páginas de un PDF | Mueve, rota, duplica o elimina páginas de tu PDF arrastrando miniaturas, sin subirlo a internet. Gratis y sin límite de páginas. | Ordenar páginas de un PDF sin subir archivos |
| `pdf-a-imagenes` | PDF a JPG o PNG gratis, sin subir el archivo | Convierte cada página de tu PDF en imagen JPG o PNG con la calidad que elijas, directo en tu navegador. Gratis, sin registro. | Convertir PDF a imágenes sin subir archivos |
| `imagenes-a-pdf` | Imágenes a PDF gratis: unir JPG y PNG online | Convierte tus fotos o capturas en un solo PDF, en el orden que quieras, sin subirlas a ningún servidor. Gratis y sin límite de uso. | Convertir imágenes a PDF sin subir archivos |
| `marca-de-agua-pdf` | Poner marca de agua a un PDF, gratis y online | Agrega texto o imagen como marca de agua: tamaño, color, ángulo y páginas. Se procesa en tu navegador, sin subir el archivo. | Poner marca de agua a un PDF sin subir archivos |
| `numerar-paginas-pdf` | Numerar páginas de un PDF gratis online | Agrega número de página con el formato y la posición que quieras, sin subir tu PDF a ningún servidor. Gratis, sin registro. | Numerar páginas de un PDF sin subir archivos |
| `markdown-a-pdf` | Markdown a PDF online, con texto real y buscable | Convierte tu .md a PDF con tablas, código y enlaces reales, no una imagen. Vista previa en vivo, sin subir el archivo a ningún lado. | Convertir Markdown a PDF sin subir archivos |

---

## 3. Preguntas reales de usuarios para las FAQ (adicionales a las que ya existen en el JSON)

Basadas en snippets de blogs/foros y en las variantes que se repiten en la SERP.

- **Unir PDF**: ¿Puedo unir un PDF con una imagen o un Word? (limitación real: no, aclarar) · ¿El orden se puede cambiar después de unir? · ¿Sirve para unir escaneos hechos con el celular?
- **Dividir/extraer páginas**: ¿Cuál es la diferencia entre dividir y extraer páginas? · ¿Puedo extraer páginas que no son consecutivas? · ¿El PDF original se modifica?
- **Comprimir PDF**: ¿Cuánto pesa un PDF después de comprimirlo? · ¿Sirve para bajar de los 25 MB de Gmail o los 20 MB de Outlook? · ¿Por qué mi PDF pesa más después de comprimirlo?
- **Organizar/rotar/eliminar**: ¿Puedo rotar solo una página y no todas? · ¿Se puede deshacer un cambio antes de descargar? · ¿Sirve para arreglar un PDF escaneado al revés?
- **PDF a imágenes**: ¿En qué formato es mejor exportar, JPG o PNG? · ¿Pierde calidad la imagen? · ¿Puedo convertir solo una página?
- **Imágenes a PDF**: ¿Puedo unir fotos tomadas con el celular directamente? · ¿Se puede ajustar el tamaño de página (carta, A4)? · ¿Sirve para escanear un documento con la cámara?
- **Marca de agua**: ¿Se puede quitar la marca de agua después? · ¿Puedo poner el logo de mi empresa? · ¿Se aplica a todas las páginas o puedo elegir cuáles?
- **Numerar páginas**: ¿Puedo empezar a numerar desde una página distinta a la 1? · ¿Sirve para «foliar» un expediente? · ¿Qué formatos de número admite?
- **Markdown a PDF**: ¿Se ve igual que en GitHub? · ¿Funciona con tablas y bloques de código? · ¿Puedo exportar un README.md directamente? · ¿Las imágenes del markdown salen en el PDF?

---

## 4. Páginas de aterrizaje adicionales — recomendación final

**Construir (8), cada una con texto propio real, no plantilla rellena:**

1. **`jpg-a-pdf`** (spinoff de `imagenes-a-pdf`, formato preseleccionado en JPG) — consulta de altísimo volumen, propia y bien delimitada.
2. **`foto-a-pdf`** (spinoff de `imagenes-a-pdf`) — ángulo móvil desatendido por los grandes; contenido propio real: consejos para fotografiar documentos derecho, con buena luz, sin sombra, antes de convertir.
3. **`pdf-a-jpg`** (spinoff de `pdf-a-imagenes`, formato preseleccionado en JPG) — la página genérica actual diluye la keyword más buscada de esa categoría.
4. **`rotar-pdf`** (spinoff de `organizar-pdf`, abre directo en modo rotar) — tarea de una sola acción, buen candidato a long-tail de privacidad.
5. **`eliminar-paginas-pdf`** (spinoff de `organizar-pdf`, abre directo en modo eliminar) — intención más simple y específica que «organizar».
6. **`extraer-paginas-pdf`** (spinoff de `dividir-pdf`, abre directo en modo rango) — intención distinta a «dividir en varios archivos».
7. **`reducir-tamaño-pdf-correo`** (spinoff de `comprimir-pdf`) — contenido propio real y verificable: límites de Gmail (25 MB) y Outlook (20 MB), qué hacer si sigue pesando mucho.
8. **`foliar-pdf`** (alias/variante de `numerar-paginas-pdf`, mismo contenido con el término administrativo) — evaluar si conviene página propia o solo agregar el término como sinónimo en el H2/FAQ de `numerar-paginas-pdf`; si el volumen real es bajo, mejor lo segundo para no arriesgar contenido casi duplicado.

**Descartar como página nueva (evitar duplicado casi plantilla):**

- **`png-a-pdf`** (dirección imagen→PDF): la búsqueda «png a pdf» en español devolvió mayoría de resultados en inglés, señal de volumen bajo, y el contenido sería casi idéntico a `jpg-a-pdf` cambiando una palabra — justo el patrón de «plantilla × dato» que ya causó una penalización en otro sitio del propietario. Cubrir PNG como sección/FAQ dentro de `imagenes-a-pdf` y `jpg-a-pdf`, no como URL propia.
- **`pdf-a-png`** (dirección PDF→imagen): mismo argumento; cubrir como toggle de formato dentro de `pdf-a-jpg` / `pdf-a-imagenes`, con un párrafo real explicando cuándo conviene PNG (diagramas, capturas con texto nítido) en vez de una landing aparte.
- **`md-a-pdf`** como URL separada de `markdown-a-pdf`: es el mismo público, la misma herramienta, el mismo contenido — agregar «MD» como sinónimo en el title/meta/H2 de la página existente en vez de crear un duplicado.

---

## 5. Herramientas nuevas a construir (client-side, sin servidor) — por oportunidad

1. **Recortar PDF (crop de márgenes)** — bajo esfuerzo (`pdf-lib` ya soporta `setCropBox`), demanda real («recortar márgenes de un pdf online»), SERP sin ningún jugador insistiendo en privacidad.
2. **Rellenar formulario PDF (AcroForm)** — esfuerzo medio (`pdf-lib` ya lee/llena AcroForms), demanda real y estable, encaja con el stack actual.
3. **Firmar PDF (firma visual: dibujar/escribir/subir imagen y colocarla)** — esfuerzo medio, demanda muy alta pero SERP muy peleada; el diferencial es 100% privacidad (competidores como Adobe/iLovePDF sí piden cuenta para guardar la firma).
4. **CSV/Excel a PDF (tabla)** — esfuerzo bajo-medio reutilizando `pdfmake` (ya está en el stack de `markdown-a-pdf`), nicho poco cubierto en español con el ángulo «sin subir archivos» (datos de nómina, notas, inventarios).
5. **Comparar dos PDF (diferencias de texto)** — esfuerzo medio con `pdf.js` extrayendo texto + diff; sirve solo para PDF con texto real (no escaneados), aclarar esa limitación en el contenido.
6. **Proteger PDF con contraseña (cifrado)** — esfuerzo alto (`pdf-lib` no cifra nativo; requiere una librería WASM tipo qpdf), pero es un diferencial fuerte: casi ningún competidor cifra realmente en el cliente aunque digan «gratis y sin subir».
7. **OCR de PDF escaneado (Tesseract.js/WASM)** — esfuerzo alto (paquete WASM pesado, afecta tiempo de carga), pero es la categoría de mayor crecimiento a mediano plazo y ningún competidor client-side la resuelve bien todavía; dejar para cuando el dominio tenga algo de tráfico.
8. **HTML a PDF** — esfuerzo medio-alto (CSS complejo), demanda de nicho (devs), menor prioridad.

Descartado explícitamente: **PDF a Word** — sin servidor no hay forma razonable de reconstruir el DOCX con buen formato (requiere OCR + heurísticas de layout muy pesadas); el resultado sería de mala calidad y dañaría la confianza en el resto de la suite. No construir.

---

## 6. Distribución para arrancar un dominio nuevo (realista, una persona)

- **GitHub — PRs a listas "awesome"**: `karllhughes/awesome-pdf` y `OneOffTech/awesome-pdf` ya listan herramientas equivalentes client-side (hushvert, PDFGem, DoItSwift, OnDevicePDF, norito, free-pdf-suite). Es el mismo patrón que encaja con este sitio — mandar PR agregándolo en la sección de herramientas sin subida de archivos. Costo: cero, backlink real de un repo con autoridad.
- **AlternativeTo.net**: crear la ficha como alternativa a iLovePDF y Smallpdf, con tags «Privacy», «No sign up», «Browser-based» — ya hay precedentes de sitios similares (RaptorPDF, ihatepdf, Kopivo cubriéndolos en blog) haciendo justamente eso.
- **Show HN / Hacker News**: el ángulo «suite de PDF 100% en el navegador, sin backend» es exactamente el tipo de post que ese público valora (se vio un post de daily.dev cubriendo una herramienta PDF privada como noticia). Un solo post bien escrito puede traer tráfico y backlinks de blogs que agregan noticias de HN.
- **Product Hunt**: lanzamiento martes-jueves, con capturas mostrando el flujo sin subida. Cross-post en r/SideProject, r/InternetIsBeautiful, r/privacy, r/webdev, IndieHackers.
- **Dev.to en español**: artículo técnico «cómo construí una suite de PDF sin backend» — dev.to tiene tag en español y comunidad hispana activa; mismo contenido sirve para Hashnode.
- **Markdown a PDF — distribución de nicho**: es la categoría con más hueco real, así que vale la pena empuje específico: comunidades hispanas de desarrollo (r/programacion, r/devsarg y similares), foros/Discord de Obsidian y Notion en español (gente que exporta notas Markdown a PDF), y mencionarlo en el propio README de proyectos open source de Alexis como ejemplo de uso.
- **Canal propio ya construido**: el público de SECOP-Monitor (personas subiendo documentos a procesos de contratación estatal) necesita justo estas herramientas — unir, comprimir y numerar PDF son tareas típicas de un proponente armando una propuesta. Un enlace o mención discreta desde SECOP-Monitor (o desde 24bytes.pro) es distribución gratuita hacia una audiencia con la intención exacta.
- **Evitar**: cualquier directorio de "SEO tools/backlinks masivos" de baja calidad — dado el antecedente de penalización por contenido a escala en otro sitio del propietario, más vale pocos enlaces de comunidades reales que muchos de directorios genéricos.
