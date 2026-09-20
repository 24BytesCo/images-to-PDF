/* Marca de agua (texto o imagen) con pdf-lib. Vista previa con pdf.js. Todo en el navegador. */
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
  const textoAviso = document.getElementById('textoAviso');

  window.pdfjsLib.GlobalWorkerOptions.workerSrc = '../assets/vendor/pdf.worker.min.js';

  let bytesOriginal = null; // Uint8Array del PDF cargado, para pdf-lib al exportar
  let docPreview = null; // documento de pdf.js, solo para la vista previa
  let numPaginas = 0;
  let imagenMarca = null; // {img, ancho, alto, bytes, tipo}
  let fontValidacion = null; // Helvetica-Bold de un documento auxiliar, para avisar de caracteres no compatibles mientras se escribe

  (async () => {
    try {
      const auxiliar = await PDFLib.PDFDocument.create();
      fontValidacion = await auxiliar.embedFont(PDFLib.StandardFonts.HelveticaBold);
    } catch (_) { /* si falla, el aviso en vivo simplemente no aparece; la verificación real ocurre al aplicar */ }
  })();

  /** «1-3, 5» → [1,2,3,5]. «todas» o vacío → todas. Lanza Error legible si algo no cuadra. */
  const parsearPaginas = (expresion, total) => {
    const texto = (expresion || '').trim();
    if (!texto || /^todas$/i.test(texto)) return Array.from({ length: total }, (_, i) => i + 1);
    const partes = texto.split(',').map((s) => s.trim()).filter(Boolean);
    if (!partes.length) return Array.from({ length: total }, (_, i) => i + 1);
    const set = new Set();
    for (const parte of partes) {
      const rango = parte.match(/^(\d+)\s*-\s*(\d+)$/);
      if (rango) {
        let a = Number(rango[1]);
        let b = Number(rango[2]);
        if (a > b) [a, b] = [b, a];
        for (let n = a; n <= b; n++) set.add(n);
      } else if (/^\d+$/.test(parte)) {
        set.add(Number(parte));
      } else {
        throw new Error(`«${parte}» no es una página ni un rango válido.`);
      }
    }
    const paginas = Array.from(set).sort((a, b) => a - b);
    const fuera = paginas.filter((n) => n < 1 || n > total);
    if (fuera.length) throw new Error(`Tu PDF tiene ${total} página(s); ${fuera.join(', ')} está(n) fuera de rango.`);
    if (!paginas.length) throw new Error('Escribe al menos una página válida.');
    return paginas;
  };

  const verificarTexto = (texto) => {
    if (!texto) return { ok: false, mensaje: 'Escribe el texto de la marca.' };
    if (!fontValidacion) return { ok: true, mensaje: '' };
    try {
      fontValidacion.widthOfTextAtSize(texto, 10);
      return { ok: true, mensaje: '' };
    } catch (_) {
      return { ok: false, mensaje: 'Ese texto tiene caracteres no compatibles (emojis u otros símbolos raros). Con tildes y ñ no hay problema; usa letras, números y signos comunes.' };
    }
  };

  const hexARgb = (hex) => {
    const n = parseInt(String(hex || '#000000').replace('#', ''), 16) || 0;
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };

  /**
   * Puntos {vx,vy} repartidos en un rectángulo visW×visH (origen abajo-izquierda, sin ángulo).
   * anchoAprox/altoAprox son el tamaño de una instancia de la marca, para espaciar el mosaico.
   */
  const generarPuntos = (visW, visH, posicion, anchoAprox, altoAprox) => {
    if (posicion === 'centro') return [{ vx: visW / 2, vy: visH / 2 }];
    if (posicion === 'esquinas') {
      const mx = Math.max(28, Math.min(visW, visH) * 0.1);
      return [
        { vx: mx, vy: mx },
        { vx: visW - mx, vy: mx },
        { vx: mx, vy: visH - mx },
        { vx: visW - mx, vy: visH - mx },
      ];
    }
    // mosaico: rejilla al tresbolillo que cubre todo el rectángulo
    const pasoX = Math.max(140, anchoAprox * 1.6);
    const pasoY = Math.max(110, altoAprox * 2.4);
    const filas = Math.max(1, Math.ceil(visH / pasoY) + 1);
    const puntos = [];
    for (let f = -1; f <= filas; f++) {
      const desplace = (((f % 2) + 2) % 2) * (pasoX / 2);
      for (let vx = desplace - pasoX; vx <= visW + pasoX; vx += pasoX) {
        puntos.push({ vx, vy: f * pasoY });
      }
    }
    return puntos;
  };

  // ---------- vista previa (canvas, pdf.js ya resuelve la rotación de la página) ----------
  let baseBitmap = null;
  let basePaginaActual = null;
  let baseEscalaActual = null;

  const leerOpciones = () => {
    const anguloSel = document.getElementById('anguloTipo').value;
    const anguloVisual = anguloSel === 'diagonal' ? 45
      : anguloSel === 'horizontal' ? 0
        : (Number(document.getElementById('anguloPersonalizado').value) || 0);
    return {
      tipo: document.getElementById('tipoImagen').checked ? 'imagen' : 'texto',
      texto: document.getElementById('texto').value.trim(),
      tamano: Math.max(1, Number(document.getElementById('tamanoTexto').value) || 48),
      color: document.getElementById('colorTexto').value,
      opacidad: Math.min(1, Math.max(0, Number(document.getElementById('opacidadTexto').value) / 100)),
      anguloVisual,
      posicionMarca: document.getElementById('posicion').value,
      paginasExpr: document.getElementById('paginas').value,
      opacidadImagen: Math.min(1, Math.max(0, Number(document.getElementById('opacidadImagen').value) / 100)),
      escalaImagen: Math.min(1, Math.max(0.01, Number(document.getElementById('escalaImagen').value) / 100)),
    };
  };

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

  const dibujarOverlay = (pxW, pxH, escala, opciones) => {
    if (opciones.tipo === 'texto') {
      if (!opciones.texto) return;
      const fontPx = opciones.tamano * escala; // el tamaño se configura en puntos PDF; se pasa a píxeles con la escala de render
      previaCtx.save();
      previaCtx.font = `700 ${fontPx}px system-ui, sans-serif`;
      const anchoTexto = previaCtx.measureText(opciones.texto).width;
      const altoTexto = fontPx * 1.15;
      const puntos = generarPuntos(pxW, pxH, opciones.posicionMarca, anchoTexto, altoTexto);
      previaCtx.globalAlpha = opciones.opacidad;
      previaCtx.fillStyle = opciones.color;
      previaCtx.textAlign = 'center';
      previaCtx.textBaseline = 'middle';
      const anguloRad = -(opciones.anguloVisual * Math.PI) / 180;
      for (const p of puntos) {
        previaCtx.save();
        previaCtx.translate(p.vx, pxH - p.vy);
        previaCtx.rotate(anguloRad);
        previaCtx.fillText(opciones.texto, 0, 0);
        previaCtx.restore();
      }
      previaCtx.restore();
    } else if (imagenMarca) {
      const anchoDeseado = pxW * opciones.escalaImagen;
      const factor = anchoDeseado / imagenMarca.ancho;
      const w = imagenMarca.ancho * factor;
      const h = imagenMarca.alto * factor;
      const puntos = generarPuntos(pxW, pxH, opciones.posicionMarca, w, h);
      previaCtx.save();
      previaCtx.globalAlpha = opciones.opacidadImagen;
      for (const p of puntos) previaCtx.drawImage(imagenMarca.img, p.vx - w / 2, pxH - p.vy - h / 2, w, h);
      previaCtx.restore();
    }
  };

  let renderToken = 0;
  let previaTimer = null;
  const actualizarPreviaYa = async () => {
    if (!docPreview) return;
    const token = ++renderToken;
    const opciones = leerOpciones();
    if (opciones.tipo === 'texto') {
      const v = verificarTexto(opciones.texto);
      textoAviso.textContent = v.ok ? '' : v.mensaje;
      textoAviso.style.color = v.ok ? '' : 'var(--acento-oscuro)';
    } else {
      textoAviso.textContent = '';
    }
    let primeraPagina;
    try {
      primeraPagina = parsearPaginas(opciones.paginasExpr, numPaginas)[0];
    } catch (error) {
      previaTexto.textContent = error.message;
      return;
    }
    try {
      const { viewport, bitmap } = await asegurarBase(primeraPagina);
      if (token !== renderToken) return;
      previa.width = bitmap.width;
      previa.height = bitmap.height;
      previaCtx.clearRect(0, 0, previa.width, previa.height);
      previaCtx.drawImage(bitmap, 0, 0);
      dibujarOverlay(viewport.width, viewport.height, viewport.scale, opciones);
      previaTexto.textContent = `Vista previa (simulada) · página ${primeraPagina} de ${numPaginas}`;
    } catch (error) {
      console.error(error);
      previaTexto.textContent = 'No se pudo generar la vista previa.';
    }
  };
  const actualizarPrevia = () => { clearTimeout(previaTimer); previaTimer = setTimeout(actualizarPreviaYa, 90); };

  // ---------- exportación real con pdf-lib ----------
  const posicionAnclaje = (pagina, r, W, H, vx, vy, anguloVisual, cu, cv) => {
    let x, y;
    if (r === 90) { x = W - vy; y = vx; }
    else if (r === 180) { x = W - vx; y = H - vy; }
    else if (r === 270) { x = vy; y = H - vx; }
    else { x = vx; y = vy; }
    const anguloRaw = anguloVisual + r;
    const rad = (anguloRaw * Math.PI) / 180;
    const dx = -(cu * Math.cos(rad) - cv * Math.sin(rad));
    const dy = -(cu * Math.sin(rad) + cv * Math.cos(rad));
    return { x: x + dx, y: y + dy, angulo: anguloRaw };
  };

  const dibujarTextoEnPagina = (pagina, fuente, texto, tamano, color, opacidad, anguloVisual, posicionMarca) => {
    const { width: W, height: H } = pagina.getSize();
    const r = ((pagina.getRotation().angle % 360) + 360) % 360;
    const visW = r === 90 || r === 270 ? H : W;
    const visH = r === 90 || r === 270 ? W : H;
    const w = fuente.widthOfTextAtSize(texto, tamano);
    const h = fuente.heightAtSize(tamano);
    const puntos = generarPuntos(visW, visH, posicionMarca, w, h);
    for (const p of puntos) {
      const { x, y, angulo } = posicionAnclaje(pagina, r, W, H, p.vx, p.vy, anguloVisual, w / 2, h * 0.32);
      pagina.drawText(texto, { x, y, size: tamano, font: fuente, color, opacity: opacidad, rotate: PDFLib.degrees(angulo) });
    }
  };

  const dibujarImagenEnPagina = (pagina, imagenEmbebida, opacidad, escalaAncho, posicionMarca) => {
    const { width: W, height: H } = pagina.getSize();
    const r = ((pagina.getRotation().angle % 360) + 360) % 360;
    const visW = r === 90 || r === 270 ? H : W;
    const visH = r === 90 || r === 270 ? W : H;
    const factor = (visW * escalaAncho) / imagenEmbebida.width;
    const w = imagenEmbebida.width * factor;
    const h = imagenEmbebida.height * factor;
    const puntos = generarPuntos(visW, visH, posicionMarca, w, h);
    for (const p of puntos) {
      const { x, y, angulo } = posicionAnclaje(pagina, r, W, H, p.vx, p.vy, 0, w / 2, h / 2);
      pagina.drawImage(imagenEmbebida, { x, y, width: w, height: h, opacity: opacidad, rotate: PDFLib.degrees(angulo) });
    }
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
    if (opciones.tipo === 'texto') {
      const v = verificarTexto(opciones.texto);
      if (!v.ok) { S.aviso(v.mensaje, 'error'); return; }
    } else if (!imagenMarca) {
      S.aviso('Elige una imagen (PNG o JPG) para la marca de agua.', 'error');
      return;
    }
    let paginasElegidas;
    try {
      paginasElegidas = parsearPaginas(opciones.paginasExpr, numPaginas);
    } catch (error) {
      S.aviso(error.message, 'error');
      return;
    }
    const nombre = S.nombreBase(document.getElementById('nombre').value) + '.pdf';
    S.ocupado(true, 'Aplicando marca de agua…');
    try {
      const doc = await PDFLib.PDFDocument.load(bytesOriginal.slice());
      if (opciones.tipo === 'texto') {
        const fuente = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
        const [rr, gg, bb] = hexARgb(opciones.color);
        const color = PDFLib.rgb(rr, gg, bb);
        for (const numeroPagina of paginasElegidas) {
          dibujarTextoEnPagina(doc.getPage(numeroPagina - 1), fuente, opciones.texto, opciones.tamano, color, opciones.opacidad, opciones.anguloVisual, opciones.posicionMarca);
        }
      } else {
        const imagenEmbebida = imagenMarca.tipo === 'image/png'
          ? await doc.embedPng(imagenMarca.bytes)
          : await doc.embedJpg(imagenMarca.bytes);
        for (const numeroPagina of paginasElegidas) {
          dibujarImagenEnPagina(doc.getPage(numeroPagina - 1), imagenEmbebida, opciones.opacidadImagen, opciones.escalaImagen, opciones.posicionMarca);
        }
      }
      const bytesSalida = await doc.save();
      S.descargar(bytesSalida, nombre);
      S.aviso('PDF con marca de agua listo. Revisa tus descargas.', 'ok');
      S.evento('pdf-creado', { herramienta: 'marca-de-agua-pdf', paginas: paginasElegidas.length });
    } catch (error) {
      console.error(error);
      if (error && /encrypt/i.test(error.message || '')) {
        S.aviso('Este PDF está protegido con contraseña; no se puede procesar.', 'error');
      } else {
        S.aviso('No se pudo aplicar la marca de agua. Revisa el PDF e inténtalo de nuevo.', 'error');
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

  document.querySelectorAll('input[name="tipo"]').forEach((r) => r.addEventListener('change', () => {
    const esImagen = document.getElementById('tipoImagen').checked;
    document.getElementById('seccionTexto').hidden = esImagen;
    document.getElementById('seccionImagen').hidden = !esImagen;
    actualizarPrevia();
  }));
  document.getElementById('anguloTipo').addEventListener('change', () => {
    document.getElementById('campoAnguloPersonalizado').hidden = document.getElementById('anguloTipo').value !== 'personalizado';
    actualizarPrevia();
  });
  document.getElementById('opacidadTexto').addEventListener('input', (ev) => {
    document.getElementById('opacidadTextoValor').textContent = `${ev.target.value} %`;
    actualizarPrevia();
  });
  document.getElementById('opacidadImagen').addEventListener('input', (ev) => {
    document.getElementById('opacidadImagenValor').textContent = `${ev.target.value} %`;
    actualizarPrevia();
  });
  document.getElementById('escalaImagen').addEventListener('input', (ev) => {
    document.getElementById('escalaImagenValor').textContent = `${ev.target.value} %`;
    actualizarPrevia();
  });
  ['texto', 'tamanoTexto', 'colorTexto', 'anguloPersonalizado', 'posicion', 'paginas'].forEach((id) => {
    document.getElementById(id).addEventListener('input', actualizarPrevia);
  });

  document.getElementById('entradaImagen').addEventListener('change', async (ev) => {
    const archivo = ev.target.files[0];
    if (!archivo) return;
    if (!['image/png', 'image/jpeg'].includes(archivo.type)) {
      S.aviso('La imagen debe ser PNG o JPG.', 'error');
      ev.target.value = '';
      return;
    }
    try {
      const bytes = new Uint8Array(await S.leer(archivo));
      const url = URL.createObjectURL(new Blob([bytes], { type: archivo.type }));
      const img = new Image();
      await new Promise((ok, mal) => { img.onload = ok; img.onerror = mal; img.src = url; });
      imagenMarca = { img, ancho: img.naturalWidth, alto: img.naturalHeight, bytes, tipo: archivo.type };
      actualizarPrevia();
    } catch (_) {
      S.aviso('No se pudo leer esa imagen.', 'error');
    }
  });
})();
