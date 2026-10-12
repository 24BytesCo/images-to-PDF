/* Preparar oferta para SECOP II: une los PDF en orden, folia todas las páginas, comprime si se pide
   y parte el resultado en archivos que no pasen del límite por documento (50 MB por defecto).
   Todo en el navegador con pdf-lib (unir, foliar, partir) y pdf.js + jsPDF (comprimir). */
(function () {
  'use strict';
  const S = window.Suite;
  const MB = 1024 * 1024;
  const zona = document.getElementById('ofertaZona');
  const entrada = document.getElementById('ofertaEntrada');
  const panel = document.getElementById('ofertaPanel');
  const lista = document.getElementById('ofertaLista');
  const resumen = document.getElementById('ofertaResumen');
  const boton = document.getElementById('ofertaBoton');
  const partesEl = document.getElementById('ofertaPartes');
  const LIMITE_PX = 16_000_000;

  window.pdfjsLib.GlobalWorkerOptions.workerSrc = '../assets/vendor/pdf.worker.min.js';

  /** @type {{nombre:string, tamano:number, paginas:number, bytes:ArrayBuffer}[]} */
  let pdfs = [];

  const pintar = () => {
    panel.hidden = pdfs.length === 0;
    boton.disabled = pdfs.length === 0;
    const peso = pdfs.reduce((s, p) => s + p.tamano, 0);
    const paginas = pdfs.reduce((s, p) => s + p.paginas, 0);
    resumen.textContent = `${pdfs.length} PDF · ${paginas} ${paginas === 1 ? 'página' : 'páginas'} · ${S.tamano(peso)}`;
    lista.textContent = '';
    pdfs.forEach((p, i) => {
      const item = document.createElement('li');
      item.className = 'lista-item';
      item.draggable = true;
      item.innerHTML = '<span class="lista-asa" aria-hidden="true">⠿</span><span class="lista-nombre"></span><span class="lista-meta"></span>';
      item.querySelector('.lista-nombre').textContent = p.nombre;
      item.querySelector('.lista-meta').textContent = `${p.paginas} ${p.paginas === 1 ? 'pág.' : 'págs.'} · ${S.tamano(p.tamano)}`;
      const quitar = document.createElement('button');
      quitar.type = 'button';
      quitar.className = 'quitar';
      quitar.setAttribute('aria-label', `Quitar ${p.nombre}`);
      quitar.textContent = '×';
      quitar.addEventListener('click', (ev) => { ev.stopPropagation(); pdfs.splice(i, 1); pintar(); });
      item.appendChild(quitar);
      lista.appendChild(item);
    });
  };

  const abrir = async (bytes) => {
    try {
      return await PDFLib.PDFDocument.load(bytes);
    } catch (error) {
      return PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
    }
  };

  const cargar = async (archivos) => {
    S.ocupado(true, 'Leyendo PDF…');
    try {
      for (const archivo of archivos) {
        try {
          const bytes = await S.leer(archivo);
          const doc = await abrir(bytes);
          pdfs.push({ nombre: archivo.name, tamano: archivo.size, paginas: doc.getPageCount(), bytes });
        } catch (error) {
          S.aviso(`"${archivo.name}" no se pudo abrir: está cifrado o dañado. Se omitió.`, 'error');
        }
      }
      if (!document.getElementById('ofertaNombre').dataset.tocado && pdfs.length) {
        document.getElementById('ofertaNombre').value = 'oferta';
      }
      pintar();
    } finally {
      S.ocupado(false);
    }
  };

  /** Une todos los PDF en el orden de la lista. */
  const unir = async () => {
    const salida = await PDFLib.PDFDocument.create();
    for (const p of pdfs) {
      const doc = await abrir(p.bytes);
      const paginas = await salida.copyPages(doc, doc.getPageIndices());
      paginas.forEach((pg) => salida.addPage(pg));
    }
    return salida;
  };

  /** Reescribe cada página como JPEG (como «Comprimir PDF»). Devuelve bytes de un PDF nuevo. Se arma con
      pdf-lib y no con jsPDF: jsPDF comparte un solo diccionario de recursos entre todas las páginas, y al
      partir el PDF cada parte se llevaba TODAS las imágenes (una página de 5 MB en la prueba del 12/10). */
  const comprimir = async (bytes, nivel) => {
    const doc = await window.pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
    const lienzo = document.createElement('canvas');
    const ctx = lienzo.getContext('2d');
    const salida = await PDFLib.PDFDocument.create();
    for (let n = 1; n <= doc.numPages; n++) {
      S.ocupado(true, `Comprimiendo página ${n} de ${doc.numPages}…`);
      const pagina = await doc.getPage(n);
      const base = pagina.getViewport({ scale: 1 });
      let escala = nivel.ppp / 72;
      let viewport = pagina.getViewport({ scale: escala });
      if (viewport.width * viewport.height > LIMITE_PX) {
        escala *= Math.sqrt(LIMITE_PX / (viewport.width * viewport.height));
        viewport = pagina.getViewport({ scale: escala });
      }
      lienzo.width = Math.max(1, Math.round(viewport.width));
      lienzo.height = Math.max(1, Math.round(viewport.height));
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, lienzo.width, lienzo.height);
      await pagina.render({ canvasContext: ctx, viewport }).promise;
      const jpeg = await new Promise((ok) => lienzo.toBlob(ok, 'image/jpeg', nivel.calidad));
      const imagen = await salida.embedJpg(await jpeg.arrayBuffer());
      const ancho = Math.abs(base.width);
      const alto = Math.abs(base.height);
      salida.addPage([ancho, alto]).drawImage(imagen, { x: 0, y: 0, width: ancho, height: alto });
      pagina.cleanup();
    }
    return salida.save({ useObjectStreams: true });
  };

  /** Folio en cada página, en la esquina elegida y respetando la rotación. */
  const foliar = async (doc, opciones) => {
    const fuente = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const total = doc.getPageCount();
    const color = PDFLib.rgb(0.1, 0.1, 0.1);
    for (let i = 0; i < total; i++) {
      const pagina = doc.getPage(i);
      const numero = opciones.inicio + i;
      const ultimo = opciones.inicio + total - 1;
      const texto = opciones.formato === 'n-de-total' ? `Folio ${numero} de ${ultimo}`
        : opciones.formato === 'folio' ? `Folio ${numero}` : String(numero);
      const { width: W, height: H } = pagina.getSize();
      const r = ((pagina.getRotation().angle % 360) + 360) % 360;
      const visW = r === 90 || r === 270 ? H : W;
      const visH = r === 90 || r === 270 ? W : H;
      const tamano = 11;
      const ancho = fuente.widthOfTextAtSize(texto, tamano);
      const margen = 24;
      const vx = opciones.posicion.endsWith('derecha') ? visW - margen - ancho : margen;
      const vy = opciones.posicion.startsWith('arriba') ? visH - margen - tamano : margen;
      let x, y;
      if (r === 90) { x = W - vy; y = vx; }
      else if (r === 180) { x = W - vx; y = H - vy; }
      else if (r === 270) { x = vy; y = H - vx; }
      else { x = vx; y = vy; }
      // fondo blanco detrás del folio para que se lea sobre un escaneo oscuro
      if (r === 0) pagina.drawRectangle({ x: x - 3, y: y - 3, width: ancho + 6, height: tamano + 5, color: PDFLib.rgb(1, 1, 1), opacity: 0.85 });
      pagina.drawText(texto, { x, y, size: tamano, font: fuente, color, rotate: PDFLib.degrees(r) });
    }
  };

  /** Guarda las páginas [desde, hasta) de `doc` en un PDF nuevo. */
  const tramo = async (doc, desde, hasta) => {
    const parte = await PDFLib.PDFDocument.create();
    const indices = [];
    for (let i = desde; i < hasta; i++) indices.push(i);
    (await parte.copyPages(doc, indices)).forEach((pg) => parte.addPage(pg));
    return parte.save({ useObjectStreams: true });
  };

  /** Parte `doc` en archivos de menos de `limite` bytes: estima por página y corrige con el tamaño real. */
  const partir = async (doc, limite) => {
    const total = doc.getPageCount();
    const pesos = [];
    for (let i = 0; i < total; i++) {
      S.ocupado(true, `Midiendo página ${i + 1} de ${total}…`);
      pesos.push((await tramo(doc, i, i + 1)).byteLength);
    }
    const partes = [];
    let desde = 0;
    while (desde < total) {
      let hasta = desde;
      let suma = 0;
      while (hasta < total && (hasta === desde || suma + pesos[hasta] <= limite * 0.95)) { suma += pesos[hasta]; hasta++; }
      let bytes = await tramo(doc, desde, hasta);
      while (bytes.byteLength > limite && hasta - desde > 1) {   // la estimación se quedó corta: una página menos
        hasta--;
        bytes = await tramo(doc, desde, hasta);
      }
      partes.push({ bytes, desde, hasta });
      S.ocupado(true, `Parte ${partes.length} lista (${hasta} de ${total} páginas)…`);
      desde = hasta;
    }
    return partes;
  };

  const preparar = async () => {
    if (!pdfs.length) return;
    const base = S.nombreBase(document.getElementById('ofertaNombre').value, 'oferta');
    const limiteMB = Math.max(1, Number(document.getElementById('ofertaLimite').value) || 50);
    const limite = limiteMB * MB;
    const conFolio = document.getElementById('ofertaFoliar').checked;
    const nivel = document.getElementById('ofertaComprimir').value;
    partesEl.hidden = true;
    partesEl.textContent = '';
    S.ocupado(true, 'Uniendo los PDF…');
    try {
      let doc = await unir();
      if (nivel !== 'no') {
        const niveles = { ligero: { ppp: 150, calidad: 0.82 }, medio: { ppp: 110, calidad: 0.68 }, fuerte: { ppp: 85, calidad: 0.5 } };
        const original = await doc.save();
        const comprimido = await comprimir(original, niveles[nivel] || niveles.medio);
        if (comprimido.byteLength < original.byteLength) doc = await PDFLib.PDFDocument.load(comprimido);
        else S.aviso('Comprimir no lo hacía más liviano: se usó el original.', 'error');
      }
      if (conFolio) {
        S.ocupado(true, 'Foliando…');
        await foliar(doc, {
          inicio: Math.max(1, Number(document.getElementById('ofertaInicio').value) || 1),
          formato: document.getElementById('ofertaFormato').value,
          posicion: document.getElementById('ofertaPosicion').value,
        });
      }
      S.ocupado(true, 'Guardando…');
      const completo = await doc.save({ useObjectStreams: true });
      let partes;
      if (completo.byteLength <= limite) {
        partes = [{ bytes: completo, desde: 0, hasta: doc.getPageCount() }];
      } else {
        partes = await partir(await PDFLib.PDFDocument.load(completo), limite);
      }
      const grande = partes.find((p) => p.bytes.byteLength > limite);
      const filas = partes.map((p, i) => {
        const nombre = partes.length === 1 ? `${base}.pdf` : `${base}-parte-${i + 1}-de-${partes.length}.pdf`;
        return { nombre, ...p };
      });
      if (filas.length === 1) {
        S.descargar(filas[0].bytes, filas[0].nombre);
      } else {
        const zip = new JSZip();
        filas.forEach((f) => zip.file(f.nombre, f.bytes));
        S.descargar(await zip.generateAsync({ type: 'blob' }), `${base}-partes.zip`, 'application/zip');
      }
      partesEl.hidden = false;
      const lineas = filas.map((f) => {
        const li = document.createElement('li');
        li.textContent = `${f.nombre} · páginas ${f.desde + 1} a ${f.hasta} · ${S.tamano(f.bytes.byteLength)}`
          + (f.bytes.byteLength > limite ? ' · pasa del límite (una sola página pesa más; comprime más fuerte)' : '');
        return li;
      });
      lineas.forEach((li) => partesEl.appendChild(li));
      S.aviso(grande
        ? `Listo, pero una parte pasa de ${limiteMB} MB: elige una compresión más fuerte.`
        : filas.length === 1 ? `Listo: ${S.tamano(filas[0].bytes.byteLength)}, por debajo de ${limiteMB} MB.`
          : `Listo: ${filas.length} partes de menos de ${limiteMB} MB, en un ZIP.`, grande ? 'error' : 'ok');
      S.evento('pdf-creado', { herramienta: 'oferta-secop-pdf', partes: filas.length, folio: conFolio, comprimir: nivel });
    } catch (error) {
      console.error(error);
      S.aviso('No se pudo preparar la oferta. Quita el archivo protegido o prueba con menos archivos a la vez.', 'error');
    } finally {
      S.ocupado(false);
    }
  };

  S.zona(zona, {
    input: entrada,
    aceptar: (f) => S.esPdf(f),
    mensajeVacio: 'Solo se aceptan archivos PDF.',
    alRecibir: cargar,
  });
  S.ordenable(lista, '.lista-item', (desde, hasta) => {
    const [movido] = pdfs.splice(desde, 1);
    pdfs.splice(hasta, 0, movido);
    pintar();
  });
  document.getElementById('ofertaNombre').addEventListener('input', (ev) => { ev.target.dataset.tocado = '1'; });
  document.getElementById('ofertaVaciar').addEventListener('click', () => { pdfs = []; partesEl.hidden = true; pintar(); });
  document.getElementById('ofertaFoliar').addEventListener('change', (ev) => {
    document.getElementById('ofertaOpcionesFolio').hidden = !ev.target.checked;
  });
  boton.addEventListener('click', preparar);
})();
