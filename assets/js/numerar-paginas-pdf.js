/* Numerar páginas con pdf-lib. Vista previa con pdf.js. Todo en el navegador. */
(function () {
  'use strict';
  const S = window.Suite;
  const zona = document.getElementById('zona');
  const entrada = document.getElementById('entrada');
  const panel = document.getElementById('panel');
  const resumen = document.getElementById('resumen');
  const previa = document.getElementById('previa');
  const previaCtx = previa.getContext('2d');
  const previaTexto = document.getElementById('previaTexto');

  window.pdfjsLib.GlobalWorkerOptions.workerSrc = '../assets/vendor/pdf.worker.min.js';

  let bytesOriginal = null; // Uint8Array del PDF cargado, para pdf-lib al exportar
  let docPreview = null; // documento de pdf.js, solo para la vista previa
  let numPaginas = 0;

  /** Texto visible del número, según el formato elegido. */
  const formatearNumero = (formato, numero, total) => {
    if (formato === 'n-total') return `${numero} / ${total}`;
    if (formato === 'pagina-n-de-total') return `Página ${numero} de ${total}`;
    if (formato === 'guion-n-guion') return `- ${numero} -`;
    return `${numero}`;
  };

  const leerOpciones = () => ({
    posicion: document.getElementById('posicion').value,
    formato: document.getElementById('formato').value,
    numeroInicial: Number.isFinite(Number(document.getElementById('numeroInicial').value)) ? Math.trunc(Number(document.getElementById('numeroInicial').value)) : 1,
    empezarEn: Math.max(1, Math.trunc(Number(document.getElementById('empezarEn').value)) || 1),
    tamano: Math.max(1, Number(document.getElementById('tamano').value) || 11),
    color: document.getElementById('color').value,
    margen: Math.max(0, Number(document.getElementById('margen').value) || 0),
  });

  const hexARgb = (hex) => {
    const n = parseInt(String(hex || '#000000').replace('#', ''), 16) || 0;
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };

  /** Punto visual (vx,vy) donde va el ancla del texto, y a qué borde de la caja de texto corresponde. */
  const puntoYAlineacion = (visW, visH, posicion, margen, ascentAprox) => {
    const [vert, horiz] = posicion.split('-');
    const vy = vert === 'arriba' ? visH - margen - ascentAprox : margen;
    const vx = horiz === 'izquierda' ? margen : horiz === 'derecha' ? visW - margen : visW / 2;
    return { vx, vy, horiz };
  };

  // ---------- vista previa (canvas, pdf.js ya resuelve la rotación de la página) ----------
  let baseBitmap = null;
  let basePaginaActual = null;
  let baseEscalaActual = null;

  const asegurarBase = async (numeroPagina) => {
    const pagina = await docPreview.getPage(numeroPagina);
    const viewport1 = pagina.getViewport({ scale: 1 });
    const escala = Math.min(560 / viewport1.width, 720 / viewport1.height, 2.2);
    const viewport = pagina.getViewport({ scale: escala });
    if (basePaginaActual === numeroPagina && baseEscalaActual === escala && baseBitmap) {
      return { viewport, bitmap: baseBitmap };
    }
    const off = document.createElement('canvas');
    off.width = Math.max(1, Math.round(viewport.width));
    off.height = Math.max(1, Math.round(viewport.height));
    await pagina.render({ canvasContext: off.getContext('2d'), viewport }).promise;
    baseBitmap = off;
    basePaginaActual = numeroPagina;
    baseEscalaActual = escala;
    return { viewport, bitmap: off };
  };

  const dibujarOverlay = (pxW, pxH, escala, opciones, textoNumero) => {
    const fontPx = opciones.tamano * escala;
    const margenPx = opciones.margen * escala;
    const { vx, vy, horiz } = puntoYAlineacion(pxW, pxH, opciones.posicion, margenPx, fontPx * 0.72);
    previaCtx.save();
    previaCtx.font = `${fontPx}px system-ui, sans-serif`;
    previaCtx.fillStyle = opciones.color;
    previaCtx.textAlign = horiz === 'izquierda' ? 'left' : horiz === 'derecha' ? 'right' : 'center';
    previaCtx.textBaseline = 'alphabetic';
    previaCtx.fillText(textoNumero, vx, pxH - vy);
    previaCtx.restore();
  };

  let renderToken = 0;
  let previaTimer = null;
  const actualizarPreviaYa = async () => {
    if (!docPreview) return;
    const token = ++renderToken;
    const opciones = leerOpciones();
    const primerNumerada = opciones.empezarEn;
    if (primerNumerada > numPaginas) {
      previaTexto.textContent = `Con «empieza en la página» = ${primerNumerada}, ninguna página de las ${numPaginas} se numera.`;
      try {
        const { viewport, bitmap } = await asegurarBase(numPaginas);
        if (token !== renderToken) return;
        previa.width = bitmap.width;
        previa.height = bitmap.height;
        previaCtx.clearRect(0, 0, previa.width, previa.height);
        previaCtx.drawImage(bitmap, 0, 0);
      } catch (_) { /* si ni así se puede pintar, se deja el aviso de texto solamente */ }
      return;
    }
    const total = numPaginas - opciones.empezarEn + 1;
    const textoNumero = formatearNumero(opciones.formato, opciones.numeroInicial, total);
    try {
      const { viewport, bitmap } = await asegurarBase(primerNumerada);
      if (token !== renderToken) return;
      previa.width = bitmap.width;
      previa.height = bitmap.height;
      previaCtx.clearRect(0, 0, previa.width, previa.height);
      previaCtx.drawImage(bitmap, 0, 0);
      dibujarOverlay(viewport.width, viewport.height, viewport.scale, opciones, textoNumero);
      previaTexto.textContent = `Vista previa (simulada) · página ${primerNumerada} de ${numPaginas} · se ve «${textoNumero}»`;
    } catch (error) {
      console.error(error);
      previaTexto.textContent = 'No se pudo generar la vista previa.';
    }
  };
  const actualizarPrevia = () => { clearTimeout(previaTimer); previaTimer = setTimeout(actualizarPreviaYa, 90); };

  // ---------- exportación real con pdf-lib ----------
  const dibujarNumeroEnPagina = (pagina, fuente, textoNumero, tamano, color, posicion, margen) => {
    const { width: W, height: H } = pagina.getSize();
    const r = ((pagina.getRotation().angle % 360) + 360) % 360;
    const visW = r === 90 || r === 270 ? H : W;
    const visH = r === 90 || r === 270 ? W : H;
    const w = fuente.widthOfTextAtSize(textoNumero, tamano);
    const ascentAprox = tamano * 0.72;
    const { vx, vy, horiz } = puntoYAlineacion(visW, visH, posicion, margen, ascentAprox);
    let x, y;
    if (r === 90) { x = W - vy; y = vx; }
    else if (r === 180) { x = W - vx; y = H - vy; }
    else if (r === 270) { x = vy; y = H - vx; }
    else { x = vx; y = vy; }
    const cu = horiz === 'izquierda' ? 0 : horiz === 'derecha' ? w : w / 2;
    const rad = (r * Math.PI) / 180;
    const dx = -(cu * Math.cos(rad));
    const dy = -(cu * Math.sin(rad));
    pagina.drawText(textoNumero, { x: x + dx, y: y + dy, size: tamano, font: fuente, color, rotate: PDFLib.degrees(r) });
  };

  // ---------- carga del archivo ----------
  const restablecer = () => {
    bytesOriginal = null;
    docPreview = null;
    numPaginas = 0;
    baseBitmap = null;
    basePaginaActual = null;
    panel.hidden = true;
    entrada.value = '';
  };

  const cargar = async (archivos) => {
    const archivo = archivos[0];
    if (archivos.length > 1) S.aviso('Solo se procesa un PDF a la vez; se tomó el primero.', 'error');
    S.ocupado(true, 'Leyendo PDF…');
    try {
      const bytes = new Uint8Array(await S.leer(archivo));
      bytesOriginal = bytes;
      const tarea = window.pdfjsLib.getDocument({ data: bytes.slice() }); // copia: pdf.js puede transferir el buffer
      docPreview = await tarea.promise;
      numPaginas = docPreview.numPages;
      baseBitmap = null;
      basePaginaActual = null;
      panel.hidden = false;
      resumen.textContent = `${archivo.name} · ${numPaginas} ${numPaginas === 1 ? 'página' : 'páginas'} · ${S.tamano(archivo.size)}`;
      document.getElementById('empezarEn').max = String(numPaginas);
      document.getElementById('nombre').value = S.nombreBase(archivo.name);
      actualizarPrevia();
    } catch (error) {
      restablecer();
      if (error && error.name === 'PasswordException') {
        S.aviso('Este PDF está protegido con contraseña. Quítale la protección antes de continuar.', 'error');
      } else if (error && error.name === 'InvalidPDFException') {
        S.aviso('Ese archivo no es un PDF válido o está corrupto.', 'error');
      } else {
        console.error(error);
        S.aviso('No se pudo leer el PDF. Prueba con otro archivo.', 'error');
      }
    } finally {
      S.ocupado(false);
    }
  };

  const aplicar = async () => {
    if (!bytesOriginal) return;
    const opciones = leerOpciones();
    if (opciones.empezarEn > numPaginas) {
      S.aviso(`Tu PDF tiene ${numPaginas} página(s); no puedes empezar a numerar en la ${opciones.empezarEn}.`, 'error');
      return;
    }
    const nombre = S.nombreBase(document.getElementById('nombre').value) + '.pdf';
    S.ocupado(true, 'Numerando páginas…');
    try {
      const doc = await PDFLib.PDFDocument.load(bytesOriginal.slice());
      const totalPaginasDoc = doc.getPageCount();
      const fuente = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
      const [rr, gg, bb] = hexARgb(opciones.color);
      const color = PDFLib.rgb(rr, gg, bb);
      const total = totalPaginasDoc - opciones.empezarEn + 1;
      let cuenta = 0;
      for (let i = opciones.empezarEn - 1; i < totalPaginasDoc; i++) {
        const numeroMostrado = opciones.numeroInicial + cuenta;
        const textoNumero = formatearNumero(opciones.formato, numeroMostrado, total);
        dibujarNumeroEnPagina(doc.getPage(i), fuente, textoNumero, opciones.tamano, color, opciones.posicion, opciones.margen);
        cuenta++;
      }
      const bytesSalida = await doc.save();
      S.descargar(bytesSalida, nombre);
      S.aviso('PDF numerado. Revisa tus descargas.', 'ok');
      S.evento('pdf-creado', { herramienta: 'numerar-paginas-pdf', paginas: cuenta });
    } catch (error) {
      console.error(error);
      if (error && /encrypt/i.test(error.message || '')) {
        S.aviso('Este PDF está protegido con contraseña; no se puede procesar.', 'error');
      } else {
        S.aviso('No se pudo numerar el PDF. Revisa el archivo e inténtalo de nuevo.', 'error');
      }
    } finally {
      S.ocupado(false);
    }
  };

  // ---------- eventos ----------
  S.zona(zona, {
    input: entrada,
    aceptar: (f) => S.esPdf(f),
    mensajeVacio: 'Solo se acepta un archivo PDF.',
    alRecibir: cargar,
  });
  document.getElementById('quitar').addEventListener('click', restablecer);
  document.getElementById('aplicar').addEventListener('click', aplicar);
  ['posicion', 'formato', 'numeroInicial', 'empezarEn', 'tamano', 'color', 'margen'].forEach((id) => {
    document.getElementById(id).addEventListener('input', actualizarPrevia);
  });
})();
