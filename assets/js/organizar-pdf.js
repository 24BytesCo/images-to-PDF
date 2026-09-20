/* Organizar PDF: reordenar, rotar, duplicar y eliminar páginas. Todo en el navegador. */
(function () {
  'use strict';
  const S = window.Suite;
  const zona = document.getElementById('zona');
  const entrada = document.getElementById('entrada');
  const panel = document.getElementById('panel');
  const rejilla = document.getElementById('miniaturas');
  const resumen = document.getElementById('resumen');

  pdfjsLib.GlobalWorkerOptions.workerSrc = '../assets/vendor/pdf.worker.min.js';

  /** @type {{original:number, rotacionBase:number, rotacionExtra:number}[]} */
  let paginas = [];
  let paginasIniciales = [];
  let bytesOriginales = null;
  let pdfjsDoc = null;
  const cacheBitmap = new Map();
  const cachePromesa = new Map();

  /** Renderiza (o toma de cache) el bitmap de una página, en escala baja. */
  const asegurarBitmap = (idx0) => {
    if (cacheBitmap.has(idx0)) return Promise.resolve(cacheBitmap.get(idx0));
    if (cachePromesa.has(idx0)) return cachePromesa.get(idx0);
    const promesa = (async () => {
      const pagina = await pdfjsDoc.getPage(idx0 + 1);
      const base = pagina.getViewport({ scale: 1 });
      const escala = Math.min(2, 220 / base.width);
      const viewport = pagina.getViewport({ scale: escala });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));
      await pagina.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      cacheBitmap.set(idx0, canvas);
      cachePromesa.delete(idx0);
      return canvas;
    })();
    cachePromesa.set(idx0, promesa);
    return promesa;
  };

  const transformPara = (grados) => {
    const g = ((grados % 360) + 360) % 360;
    if (g === 0) return '';
    return `rotate(${g}deg)${g === 90 || g === 270 ? ' scale(0.72)' : ''}`;
  };

  /** Dibuja el bitmap ya cacheado (o lo renderiza) dentro de una hoja. Cada
   * miniatura tiene su propio canvas: dos páginas duplicadas no pueden
   * compartir el mismo nodo, así que se copia con drawImage (barato). */
  const pintarMiniatura = async (hoja) => {
    const idx0 = Number(hoja.dataset.original);
    try {
      const bitmap = await asegurarBitmap(idx0);
      const c = document.createElement('canvas');
      c.width = bitmap.width;
      c.height = bitmap.height;
      c.getContext('2d').drawImage(bitmap, 0, 0);
      c.style.transform = transformPara(Number(hoja.dataset.rot || 0));
      hoja.textContent = '';
      hoja.appendChild(c);
    } catch (error) {
      console.error(error);
      hoja.textContent = '⚠';
    }
  };

  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => {
      if (!e.isIntersecting) return;
      observador.unobserve(e.target);
      pintarMiniatura(e.target);
    });
  }, { rootMargin: '200px' });

  const botonAccion = (simbolo, etiqueta, deshabilitado, alHacerClic) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'organizar-accion';
    b.textContent = simbolo;
    b.title = etiqueta;
    b.setAttribute('aria-label', etiqueta);
    b.disabled = !!deshabilitado;
    b.addEventListener('click', (ev) => { ev.stopPropagation(); alHacerClic(); });
    return b;
  };

  const pintar = () => {
    observador.disconnect();
    panel.hidden = paginas.length === 0;
    resumen.textContent = `${paginas.length} ${paginas.length === 1 ? 'página' : 'páginas'}`;
    rejilla.textContent = '';
    paginas.forEach((entrada_, i) => {
      const caja = document.createElement('div');
      caja.className = 'miniatura';
      caja.draggable = true;

      const hoja = document.createElement('div');
      hoja.className = 'miniatura-hoja organizar-hoja';
      hoja.dataset.original = String(entrada_.original - 1);
      hoja.dataset.rot = String(entrada_.rotacionExtra);
      hoja.textContent = 'Cargando…';
      caja.appendChild(hoja);

      const pie = document.createElement('div');
      pie.className = 'miniatura-pie';
      pie.textContent = `${i + 1} · era ${entrada_.original}`;
      caja.appendChild(pie);

      const acciones = document.createElement('div');
      acciones.className = 'miniatura-acciones organizar-acciones';
      acciones.appendChild(botonAccion('‹', 'Mover antes', i === 0, () => mover(i, i - 1)));
      acciones.appendChild(botonAccion('⟲', 'Rotar a la izquierda', false, () => rotar(i, -90)));
      acciones.appendChild(botonAccion('⧉', 'Duplicar página', false, () => duplicar(i)));
      acciones.appendChild(botonAccion('⟳', 'Rotar a la derecha', false, () => rotar(i, 90)));
      acciones.appendChild(botonAccion('›', 'Mover después', i === paginas.length - 1, () => mover(i, i + 1)));
      caja.appendChild(acciones);

      const quitar = document.createElement('button');
      quitar.type = 'button';
      quitar.className = 'quitar';
      quitar.setAttribute('aria-label', `Quitar página ${i + 1}`);
      quitar.textContent = '×';
      quitar.addEventListener('click', (ev) => { ev.stopPropagation(); eliminar(i); });
      caja.appendChild(quitar);

      rejilla.appendChild(caja);
      observador.observe(hoja);
    });
  };

  const mover = (i, j) => {
    if (j < 0 || j >= paginas.length) return;
    [paginas[i], paginas[j]] = [paginas[j], paginas[i]];
    pintar();
  };
  const rotar = (i, delta) => {
    paginas[i].rotacionExtra = ((paginas[i].rotacionExtra + delta) % 360 + 360) % 360;
    pintar();
  };
  const duplicar = (i) => {
    paginas.splice(i + 1, 0, { ...paginas[i] });
    pintar();
  };
  const eliminar = (i) => {
    if (paginas.length <= 1) { S.aviso('Debe quedar al menos una página.', 'error'); return; }
    paginas.splice(i, 1);
    pintar();
  };

  const cargar = async (archivo) => {
    S.ocupado(true, 'Abriendo el PDF…');
    try {
      const bytes = new Uint8Array(await S.leer(archivo));
      let doc;
      let n;
      let nuevoDocPdfjs;
      try {
        // pdf-lib es permisivo (puede «abrir» basura sin lanzar error), así que la
        // validación real de que el archivo sirve queda en manos de pdf.js también,
        // dentro del mismo intento, para categorizar cualquier falla de los dos.
        doc = await PDFLib.PDFDocument.load(bytes);
        n = doc.getPageCount();
        if (n === 0) throw new Error('El PDF no tiene páginas.');
        nuevoDocPdfjs = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
      } catch (error) {
        const msg = String((error && error.message) || '');
        const nombre = String((error && error.name) || '');
        if (/encrypt|password/i.test(msg) || nombre === 'PasswordException') {
          S.aviso('Este PDF está protegido con contraseña. Quítale la protección y vuelve a cargarlo.', 'error');
        } else if (n === 0) {
          S.aviso('Este PDF no tiene páginas.', 'error');
        } else {
          S.aviso('No se pudo abrir el PDF: parece dañado o no es un PDF válido.', 'error');
        }
        return;
      }

      cacheBitmap.clear();
      cachePromesa.clear();
      bytesOriginales = bytes;
      pdfjsDoc = nuevoDocPdfjs;

      paginas = [];
      for (let i = 0; i < n; i++) {
        paginas.push({ original: i + 1, rotacionBase: doc.getPage(i).getRotation().angle, rotacionExtra: 0 });
      }
      paginasIniciales = paginas.map((p) => ({ ...p }));
      document.getElementById('nombre').value = S.nombreBase(archivo.name);
      pintar();
    } catch (error) {
      console.error(error);
      S.aviso('No se pudo procesar el PDF.', 'error');
    } finally {
      S.ocupado(false);
    }
  };

  const crear = async () => {
    if (!paginas.length) return;
    S.ocupado(true, 'Generando el PDF…');
    try {
      const nombre = S.nombreBase(document.getElementById('nombre').value) + '.pdf';
      const origen = await PDFLib.PDFDocument.load(bytesOriginales);
      const nuevo = await PDFLib.PDFDocument.create();
      const indicesUnicos = [...new Set(paginas.map((p) => p.original - 1))].sort((a, b) => a - b);
      const copiadas = await nuevo.copyPages(origen, indicesUnicos);
      const mapaCopia = new Map(indicesUnicos.map((idx, k) => [idx, copiadas[k]]));
      const primerUso = new Map(); // idxOriginal -> índice en `nuevo`

      for (let j = 0; j < paginas.length; j++) {
        const p = paginas[j];
        const idxOriginal = p.original - 1;
        let pagina;
        if (!primerUso.has(idxOriginal)) {
          pagina = mapaCopia.get(idxOriginal);
        } else {
          // Página duplicada: se clona desde `nuevo` (ya insertada antes) para
          // no reutilizar el mismo nodo de página dos veces en el árbol del PDF.
          [pagina] = await nuevo.copyPages(nuevo, [primerUso.get(idxOriginal)]);
        }
        const grados = ((p.rotacionBase + p.rotacionExtra) % 360 + 360) % 360;
        pagina.setRotation(PDFLib.degrees(grados));
        nuevo.addPage(pagina);
        if (!primerUso.has(idxOriginal)) primerUso.set(idxOriginal, j);
      }

      const bytes = await nuevo.save();
      S.descargar(bytes, nombre, 'application/pdf');
      S.aviso('PDF creado. Revisa tus descargas.', 'ok');
      S.evento('pdf-creado', { herramienta: 'organizar-pdf', paginas: paginas.length });
    } catch (error) {
      console.error(error);
      S.aviso('No se pudo generar el PDF. Intenta de nuevo.', 'error');
    } finally {
      S.ocupado(false);
    }
  };

  S.zona(zona, {
    input: entrada,
    aceptar: (f) => S.esPdf(f),
    mensajeVacio: 'Solo se aceptan archivos PDF.',
    alRecibir: (archivos) => {
      if (archivos.length > 1) S.aviso('Se cargó solo el primer PDF; esta herramienta trabaja con uno a la vez.', '');
      cargar(archivos[0]);
    },
  });
  S.ordenable(rejilla, '.miniatura', (desde, hasta) => {
    const [movida] = paginas.splice(desde, 1);
    paginas.splice(hasta, 0, movida);
    pintar();
  });
  document.getElementById('rotarTodas').addEventListener('click', () => {
    paginas.forEach((p) => { p.rotacionExtra = ((p.rotacionExtra + 90) % 360 + 360) % 360; });
    pintar();
  });
  document.getElementById('invertirOrden').addEventListener('click', () => { paginas.reverse(); pintar(); });
  document.getElementById('deshacerTodo').addEventListener('click', () => {
    paginas = paginasIniciales.map((p) => ({ ...p }));
    pintar();
  });
  document.getElementById('crear').addEventListener('click', crear);
})();
