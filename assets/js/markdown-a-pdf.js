/* Markdown → PDF con marked (vista previa) y pdfmake (PDF con texto real). Todo en el navegador. */
(function () {
  'use strict';
  const S = window.Suite;
  // pdfmake y sus fuentes pesan ~1 MB: se cargan al primer uso y no al abrir la página.
  const VENDOR = new URL('../vendor/', document.currentScript.src).href;
  const cargarScript = (archivo) => new Promise((ok, mal) => {
    const s = document.createElement('script');
    s.src = VENDOR + archivo;
    s.onload = ok;
    s.onerror = () => mal(new Error('No se pudo cargar ' + archivo));
    document.head.appendChild(s);
  });
  let pdfmakeListo = null;
  const cargarPdfmake = () => {
    if (!pdfmakeListo) {
      pdfmakeListo = cargarScript('pdfmake.min.js').then(() => cargarScript('vfs_fonts.min.js'))
        .catch((error) => { pdfmakeListo = null; throw error; });
    }
    return pdfmakeListo;
  };
  const zona = document.getElementById('mdapdfZona');
  const entrada = document.getElementById('mdapdfArchivo');
  const editor = document.getElementById('mdapdfEditor');
  const vista = document.getElementById('mdapdfVista');
  const tabEscribir = document.getElementById('mdapdfTabEscribir');
  const tabVista = document.getElementById('mdapdfTabVista');
  const panelEditor = document.getElementById('mdapdfPanelEditor');
  const panelVista = document.getElementById('mdapdfPanelVista');

  const EXTENSIONES = ['.md', '.markdown', '.txt'];

  const EJEMPLO = [
    '# Guía rápida de Markdown a PDF',
    '',
    'Escribe o pega tu Markdown a la izquierda. Este texto de ejemplo desaparece en cuanto lo borras o pulsas **Limpiar**.',
    '',
    '## Por qué convertir a PDF',
    '',
    '- El PDF conserva el formato en cualquier dispositivo.',
    '- El texto queda seleccionable y buscable: no es una imagen.',
    '- Sirve para compartir documentación técnica o apuntes de clase.',
    '',
    '## Pasos',
    '',
    '1. Pega o carga tu Markdown.',
    '2. Revisa la vista previa.',
    '3. Ajusta las opciones y pulsa **Descargar PDF**.',
    '',
    '## Comparación rápida',
    '',
    '| Formato   | Texto buscable | Edición fácil |',
    '|-----------|:---------------:|:---------------:|',
    '| Markdown  | Sí | Sí |',
    '| PDF       | Sí (con esta herramienta) | No |',
    '| Imagen    | No | No |',
    '',
    '> El Markdown no reemplaza al PDF: lo alimenta. Esta herramienta convierte uno en otro sin subir tu texto a ningún servidor.',
    '',
    'Genera el sitio con `python3 tools/build.py` o revisa la guía completa en [Markdown Guide](https://www.markdownguide.org).',
    '',
    '```bash',
    'python3 tools/build.py',
    '```',
  ].join('\n');

  // --- Vista previa: marked → HTML → DOMPurify → innerHTML. Nunca sin sanear. ---
  const renderizar = () => {
    let html;
    try {
      html = window.marked.parse(editor.value || '', { breaks: true, gfm: true });
    } catch (_) {
      html = '<p>No se pudo interpretar el Markdown.</p>';
    }
    vista.innerHTML = window.DOMPurify.sanitize(html);
  };
  editor.addEventListener('input', renderizar);

  document.getElementById('mdapdfLimpiar').addEventListener('click', () => {
    editor.value = '';
    renderizar();
    editor.focus();
  });

  // --- Carga de archivo por arrastre o selección ---
  const esValido = (archivo) => {
    const nombre = (archivo.name || '').toLowerCase();
    return EXTENSIONES.some((ext) => nombre.endsWith(ext)) || archivo.type === 'text/markdown' || archivo.type === 'text/plain' || archivo.type === '';
  };

  const leerTexto = (archivo) => new Promise((ok, mal) => {
    const lector = new FileReader();
    lector.onload = () => ok(String(lector.result));
    lector.onerror = () => mal(lector.error);
    lector.readAsText(archivo, 'utf-8');
  });

  const cargarArchivo = async (archivos) => {
    const archivo = archivos[0];
    S.ocupado(true, 'Leyendo archivo…');
    try {
      editor.value = await leerTexto(archivo);
      renderizar();
      S.aviso(`Se cargó ${archivo.name}.`, 'ok');
    } catch (_) {
      S.aviso(`No se pudo leer ${archivo.name}.`, 'error');
    } finally {
      S.ocupado(false);
    }
  };

  S.zona(zona, {
    input: entrada,
    aceptar: esValido,
    mensajeVacio: 'Solo se aceptan archivos .md, .markdown o .txt.',
    alRecibir: cargarArchivo,
  });

  // --- Pestañas en móvil ---
  const mostrarPanel = (cual) => {
    const esEditor = cual === 'editor';
    tabEscribir.setAttribute('aria-selected', String(esEditor));
    tabVista.setAttribute('aria-selected', String(!esEditor));
    panelEditor.classList.toggle('mdapdf-oculto-movil', !esEditor);
    panelVista.classList.toggle('mdapdf-oculto-movil', esEditor);
  };
  tabEscribir.addEventListener('click', () => mostrarPanel('editor'));
  tabVista.addEventListener('click', () => { renderizar(); mostrarPanel('vista'); });

  // ============================================================
  // Construcción del PDF: recorre marked.lexer() y arma el
  // docDefinition de pdfmake (texto real, no una captura).
  // ============================================================

  const FORMATO_PAGINA = { a4: 'A4', carta: 'LETTER' };
  const ANCHO_PAGINA_PT = { a4: 595.28, carta: 612 };
  const MARGENES_PT = { estrecho: 28, normal: 50, amplio: 78 };
  const ESCALA_TITULO = { 1: 1.8, 2: 1.5, 3: 1.3, 4: 1.15, 5: 1.05, 6: 0.95 };

  const margenesPagina = (clave, conPie) => {
    const m = MARGENES_PT[clave] || MARGENES_PT.normal;
    return [m, m, m, conPie ? m + 24 : m];
  };

  const construirEstilos = (base) => {
    const estilos = { codigoBloque: { fontSize: Math.max(8, base - 1), color: '#0f172a', lineHeight: 1.4 } };
    Object.keys(ESCALA_TITULO).forEach((nivel) => {
      estilos['titulo' + nivel] = {
        fontSize: Math.round(base * ESCALA_TITULO[nivel] * 10) / 10,
        bold: true,
        color: nivel === '6' ? '#556070' : '#0f172a',
        margin: [0, nivel <= 2 ? 16 : 10, 0, nivel <= 2 ? 8 : 5],
      };
    });
    return estilos;
  };

  const alinear = (align) => (align === 'center' || align === 'right' ? align : 'left');

  const combinar = (base, extra) => Object.assign({}, base, extra);

  /** Aplana tokens en línea (negrita, cursiva, código, enlaces…) a "runs" de texto para pdfmake. */
  const correrInline = (tokens, estilo) => {
    const base = estilo || {};
    const partes = [];
    (tokens || []).forEach((t) => {
      switch (t.type) {
        case 'strong':
          partes.push(...correrInline(t.tokens, combinar(base, { bold: true })));
          break;
        case 'em':
          partes.push(...correrInline(t.tokens, combinar(base, { italics: true })));
          break;
        case 'del':
          partes.push(...correrInline(t.tokens, combinar(base, { decoration: 'lineThrough' })));
          break;
        case 'codespan':
          partes.push(combinar(base, { text: t.text, background: '#eef1f5', color: '#0f172a' }));
          break;
        case 'link': {
          const hijos = correrInline(t.tokens && t.tokens.length ? t.tokens : [{ type: 'text', text: t.text }], base);
          hijos.forEach((p) => partes.push(combinar(p, { link: t.href, color: '#b42318', decoration: 'underline' })));
          break;
        }
        case 'br':
          partes.push(combinar(base, { text: '\n' }));
          break;
        case 'image':
          // Imagen dentro de una línea de texto (no como párrafo propio): límite conocido, se omite.
          break;
        case 'html':
          break; // HTML incrustado en el Markdown: se ignora, nunca se interpreta.
        case 'escape':
        case 'text':
          if (t.tokens && t.tokens.length) partes.push(...correrInline(t.tokens, base));
          else partes.push(combinar(base, { text: t.text }));
          break;
        default:
          if (t.tokens && t.tokens.length) partes.push(...correrInline(t.tokens, base));
          else if (t.text) partes.push(combinar(base, { text: t.text }));
      }
    });
    return partes;
  };

  /** data: se usa tal cual; remotas del mismo origen (o accesibles por CORS) se incrustan; si fallan, null. */
  const resolverImagen = async (href) => {
    try {
      if (/^data:image\//i.test(href)) return href;
      const resp = await fetch(href, { mode: 'cors' });
      if (!resp.ok) throw new Error('http ' + resp.status);
      const blob = await resp.blob();
      if (!/^image\//.test(blob.type)) throw new Error('no es imagen');
      return await new Promise((ok, mal) => {
        const lector = new FileReader();
        lector.onload = () => ok(String(lector.result));
        lector.onerror = () => mal(lector.error);
        lector.readAsDataURL(blob);
      });
    } catch (_) {
      return null;
    }
  };

  const construirLista = async (token, ctx) => {
    const items = [];
    for (const it of token.items) items.push(await construirItemLista(it, ctx));
    const nodo = token.ordered
      ? { ol: items, start: token.start && token.start !== '' ? Number(token.start) : 1 }
      : { ul: items };
    if (token.items.length && token.items.every((it) => it.task)) nodo.type = 'none';
    nodo.margin = [0, 2, 0, 10];
    return nodo;
  };

  const construirItemLista = async (item, ctx) => {
    let textoPrincipal = null;
    const otros = [];
    for (const sub of item.tokens || []) {
      if (sub.type === 'text') {
        textoPrincipal = correrInline(sub.tokens && sub.tokens.length ? sub.tokens : [{ type: 'text', text: sub.text }], {});
      } else if (sub.type === 'list') {
        otros.push(await construirLista(sub, ctx));
      } else {
        const nodo = await construirBloque(sub, ctx);
        if (nodo) otros.push(nodo);
      }
    }
    const prefijo = item.task ? (item.checked ? '☑ ' : '☐ ') : '';
    const principal = { text: prefijo ? [{ text: prefijo }].concat(textoPrincipal || []) : (textoPrincipal || [{ text: '' }]) };
    if (!otros.length) return principal;
    return { stack: [principal].concat(otros) };
  };

  const construirBloque = async (token, ctx) => {
    switch (token.type) {
      case 'space':
      case 'def':
      case 'html':
        return null; // El HTML incrustado se ignora en el PDF, no se interpreta.
      case 'heading':
        return { text: correrInline(token.tokens, {}), style: 'titulo' + token.depth };
      case 'paragraph': {
        if (token.tokens && token.tokens.length === 1 && token.tokens[0].type === 'image') {
          const datos = await resolverImagen(token.tokens[0].href);
          if (datos) return { image: datos, fit: [ctx.anchoUtil, ctx.anchoUtil * 1.4], margin: [0, 4, 0, 10] };
          ctx.omitidas.valor = true;
          return null;
        }
        const partes = correrInline(token.tokens, {});
        if (!partes.length) return null;
        return { text: partes, margin: [0, 0, 0, 10], lineHeight: 1.35 };
      }
      case 'blockquote': {
        const hijos = [];
        for (const t of token.tokens) {
          const nodo = await construirBloque(t, ctx);
          if (nodo) hijos.push(nodo);
        }
        return {
          table: { widths: ['*'], body: [[{ stack: hijos, color: '#475569', italics: true }]] },
          layout: {
            hLineWidth: () => 0,
            vLineWidth: (i) => (i === 0 ? 3 : 0),
            vLineColor: () => '#c9cfd8',
            paddingLeft: (i) => (i === 0 ? 14 : 0),
            paddingRight: () => 0,
            paddingTop: () => 4,
            paddingBottom: () => 4,
          },
          margin: [0, 4, 0, 12],
        };
      }
      case 'code':
        return {
          table: { widths: ['*'], body: [[{ text: token.text, style: 'codigoBloque', fillColor: '#f1f5f9' }]] },
          layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 12, paddingRight: () => 12, paddingTop: () => 10, paddingBottom: () => 10 },
          margin: [0, 4, 0, 12],
        };
      case 'list':
        return construirLista(token, ctx);
      case 'table': {
        const cabecera = token.header.map((c, i) => ({ text: correrInline(c.tokens, {}), bold: true, fillColor: '#f1f5f9', alignment: alinear(token.align[i]) }));
        const filas = token.rows.map((fila) => fila.map((c, i) => ({ text: correrInline(c.tokens, {}), alignment: alinear(token.align[i]) })));
        return {
          table: { headerRows: 1, widths: cabecera.map(() => '*'), body: [cabecera].concat(filas) },
          layout: 'lightHorizontalLines',
          margin: [0, 4, 0, 12],
        };
      }
      case 'hr':
        return { canvas: [{ type: 'line', x1: 0, y1: 0, x2: ctx.anchoUtil, y2: 0, lineWidth: 1, lineColor: '#d8dee7' }], margin: [0, 10, 0, 10] };
      default:
        if (token.tokens && token.tokens.length) {
          const partes = correrInline(token.tokens, {});
          if (partes.length) return { text: partes, margin: [0, 0, 0, 8] };
        } else if (token.text) {
          return { text: token.text, margin: [0, 0, 0, 8] };
        }
        return null;
    }
  };

  const crear = async () => {
    const texto = editor.value.trim();
    if (!texto) {
      S.aviso('Escribe o carga un Markdown antes de descargar.', 'error');
      return;
    }
    const formato = document.getElementById('mdapdfFormato').value;
    const margenClave = document.getElementById('mdapdfMargen').value;
    const base = Number(document.getElementById('mdapdfTamano').value) || 12;
    const conPie = document.getElementById('mdapdfPie').checked;
    const nombre = S.nombreBase(document.getElementById('mdapdfNombre').value) + '.pdf';
    S.ocupado(true, 'Creando el PDF…');
    try {
      await cargarPdfmake();
      const tokens = window.marked.lexer(texto);
      const margen = margenesPagina(margenClave, conPie);
      const anchoPagina = ANCHO_PAGINA_PT[formato] || ANCHO_PAGINA_PT.a4;
      const ctx = { anchoUtil: anchoPagina - margen[0] - margen[2], omitidas: { valor: false } };
      const contenido = [];
      for (const t of tokens) {
        const nodo = await construirBloque(t, ctx);
        if (nodo) contenido.push(nodo);
      }
      if (!contenido.length) {
        S.aviso('No se encontró contenido para exportar.', 'error');
        return;
      }
      const docDefinition = {
        pageSize: FORMATO_PAGINA[formato] || 'A4',
        pageMargins: margen,
        defaultStyle: { font: 'Roboto', fontSize: base, color: '#0f172a', lineHeight: 1.35 },
        styles: construirEstilos(base),
        content: contenido,
        info: { title: nombre.replace(/\.pdf$/, '') },
      };
      if (conPie) {
        docDefinition.footer = (actual, total) => ({
          text: `${actual} / ${total}`,
          alignment: 'center',
          fontSize: Math.max(8, base - 3),
          color: '#556070',
          margin: [0, 8, 0, 0],
        });
      }
      window.pdfMake.createPdf(docDefinition).download(nombre);
      S.evento('descarga', { herramienta: 'markdown-a-pdf' });
      if (ctx.omitidas.valor) S.aviso('PDF creado. Algunas imágenes remotas no se pudieron incluir (bloqueadas por CORS).', '');
      else S.aviso('PDF creado. Revisa tus descargas.', 'ok');
      S.evento('pdf-creado', { herramienta: 'markdown-a-pdf' });
    } catch (error) {
      console.error(error);
      S.aviso('No se pudo crear el PDF. Revisa el Markdown e inténtalo de nuevo.', 'error');
    } finally {
      S.ocupado(false);
    }
  };

  document.getElementById('mdapdfDescargar').addEventListener('click', crear);
  // Al acercarse al botón se adelanta la carga, para que el clic no espere.
  document.getElementById('mdapdfDescargar').addEventListener('pointerenter', () => { cargarPdfmake().catch(() => {}); }, { once: true });

  editor.value = EJEMPLO;
  renderizar();
})();
