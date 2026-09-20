/* Unir PDF con pdf-lib. Todo en el navegador. */
(function () {
  'use strict';
  const S = window.Suite;
  const zona = document.getElementById('unirZona');
  const entrada = document.getElementById('unirEntrada');
  const panel = document.getElementById('unirPanel');
  const lista = document.getElementById('unirLista');
  const resumen = document.getElementById('unirResumen');
  const boton = document.getElementById('unirBoton');

  /** @type {{nombre:string, tamano:number, paginas:number, doc:Object, cifrado:boolean}[]} */
  let pdfs = [];

  const pintar = () => {
    panel.hidden = pdfs.length === 0;
    boton.disabled = pdfs.length === 0;
    const peso = pdfs.reduce((s, p) => s + p.tamano, 0);
    const paginas = pdfs.reduce((s, p) => s + p.paginas, 0);
    resumen.textContent = `${pdfs.length} ${pdfs.length === 1 ? 'PDF' : 'PDF'} · ${paginas} ${paginas === 1 ? 'página' : 'páginas'} · ${S.tamano(peso)}`;
    lista.textContent = '';
    pdfs.forEach((p, i) => {
      const item = document.createElement('li');
      item.className = 'lista-item';
      item.draggable = true;
      item.innerHTML = '<span class="lista-asa" aria-hidden="true">⠿</span><span class="lista-nombre"></span><span class="lista-meta"></span>';
      item.querySelector('.lista-nombre').textContent = p.nombre + (p.cifrado ? ' (protegido)' : '');
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

  /** Intenta abrir el PDF normal y, si falla por cifrado, con ignoreEncryption. */
  const cargarUno = async (archivo) => {
    const bytes = await S.leer(archivo);
    try {
      const doc = await PDFLib.PDFDocument.load(bytes);
      pdfs.push({ nombre: archivo.name, tamano: archivo.size, paginas: doc.getPageCount(), doc, cifrado: false });
    } catch (errorNormal) {
      try {
        const doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
        pdfs.push({ nombre: archivo.name, tamano: archivo.size, paginas: doc.getPageCount(), doc, cifrado: true });
        S.aviso(`"${archivo.name}" está protegido con contraseña; se abrió igual, revisa que el resultado quede bien.`, 'error');
      } catch (_) {
        S.aviso(`"${archivo.name}" no se pudo abrir: está cifrado o dañado. Se omitió.`, 'error');
      }
    }
  };

  const recibir = async (archivos) => {
    S.ocupado(true, 'Leyendo PDF…');
    try {
      for (const archivo of archivos) {
        await cargarUno(archivo);
      }
      pintar();
    } finally {
      S.ocupado(false);
    }
  };

  const unir = async () => {
    if (!pdfs.length) return;
    const nombre = S.nombreBase(document.getElementById('unirNombre').value, 'documento-unido') + '.pdf';
    S.ocupado(true, 'Uniendo PDF…');
    try {
      const salida = await PDFLib.PDFDocument.create();
      for (const p of pdfs) {
        const paginas = await salida.copyPages(p.doc, p.doc.getPageIndices());
        paginas.forEach((pg) => salida.addPage(pg));
      }
      const bytes = await salida.save();
      S.descargar(bytes, nombre);
      S.aviso('PDF unido. Revisa tus descargas.', 'ok');
      S.evento('pdf-creado', { herramienta: 'unir-pdf', paginas: salida.getPageCount() });
    } catch (error) {
      console.error(error);
      S.aviso('No se pudo unir los PDF. Prueba quitando el archivo protegido y vuelve a intentar.', 'error');
    } finally {
      S.ocupado(false);
    }
  };

  S.zona(zona, {
    input: entrada,
    aceptar: (f) => S.esPdf(f),
    mensajeVacio: 'Solo se aceptan archivos PDF.',
    alRecibir: recibir,
  });
  S.ordenable(lista, '.lista-item', (desde, hasta) => {
    const [movido] = pdfs.splice(desde, 1);
    pdfs.splice(hasta, 0, movido);
    pintar();
  });
  document.getElementById('unirVaciar').addEventListener('click', () => { pdfs = []; pintar(); });
  boton.addEventListener('click', unir);
})();
