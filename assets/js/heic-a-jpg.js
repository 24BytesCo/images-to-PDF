/* HEIC/HEIF → JPG. Nativo en Safari; libheif (wasm) en un Web Worker en el resto.
   Todo en el navegador, sin subir nada. */
(function () {
  'use strict';
  const S = window.Suite;
  const zona = document.getElementById('zona');
  const entrada = document.getElementById('entrada');
  const panel = document.getElementById('panel');
  const lista = document.getElementById('lista');
  const resumen = document.getElementById('resumen');
  const calidad = document.getElementById('calidad');
  const calidadValor = document.getElementById('calidadValor');

  /** @type {{nombre:string, tamano:number, archivo:File, resultado:number|null}[]} */
  let archivos = [];
  let worker = null;

  const esHeic = (f) => /\.(heic|heif)$/i.test(f.name) || f.type === 'image/heic' || f.type === 'image/heif';

  const pintar = () => {
    panel.hidden = archivos.length === 0;
    const peso = archivos.reduce((s, a) => s + a.tamano, 0);
    resumen.textContent = `${archivos.length} ${archivos.length === 1 ? 'archivo' : 'archivos'} · ${S.tamano(peso)}`;
    lista.textContent = '';
    archivos.forEach((a, i) => {
      const fila = document.createElement('div');
      fila.className = 'lista-item';
      const dest = a.resultado != null ? `<strong>${S.tamano(a.resultado)}</strong>` : '—';
      fila.innerHTML = '<span class="lista-nombre"></span>'
        + `<span class="lista-meta">${S.tamano(a.tamano)} → ${dest}</span>`;
      fila.querySelector('.lista-nombre').textContent = a.nombre;
      const quitar = document.createElement('button');
      quitar.type = 'button';
      quitar.className = 'quitar';
      quitar.setAttribute('aria-label', `Quitar ${a.nombre}`);
      quitar.textContent = '×';
      quitar.addEventListener('click', () => { archivos.splice(i, 1); pintar(); });
      fila.appendChild(quitar);
      lista.appendChild(fila);
    });
  };

  const recibir = (lista2) => {
    for (const archivo of lista2) archivos.push({ nombre: archivo.name, tamano: archivo.size, archivo, resultado: null });
    pintar();
  };

  const porWorker = (archivo, q) => new Promise((resolve, reject) => {
    if (!worker) worker = new Worker('/assets/js/heic-worker.js');
    const id = Math.random().toString(36).slice(2);
    const alMensaje = (e) => {
      if (e.data.id !== id) return;
      worker.removeEventListener('message', alMensaje);
      e.data.ok ? resolve(e.data.blob) : reject(new Error(e.data.error));
    };
    worker.addEventListener('message', alMensaje);
    archivo.arrayBuffer().then((buf) => worker.postMessage({ id, buffer: buf, quality: q }, [buf]), reject);
  });

  const convertirUno = async (archivo, q) => {
    // Safari decodifica HEIC de forma nativa; probarlo primero evita bajar el wasm.
    try {
      const bmp = await createImageBitmap(archivo);
      if (bmp && bmp.width > 0) {
        const c = document.createElement('canvas');
        c.width = bmp.width;
        c.height = bmp.height;
        c.getContext('2d').drawImage(bmp, 0, 0);
        bmp.close();
        const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', q));
        if (blob) return blob;
      }
    } catch (_) { /* sin soporte nativo: usar libheif */ }
    return porWorker(archivo, q);
  };

  const convertir = async () => {
    if (!archivos.length) return;
    const q = Number(calidad.value) / 100;
    S.ocupado(true, 'Convirtiendo… (la primera vez carga el decodificador)');
    const resultados = [];
    try {
      for (const a of archivos) {
        try {
          const blob = await convertirUno(a.archivo, q);
          a.resultado = blob.size;
          resultados.push({ blob, nombre: `${S.nombreBase(a.nombre)}.jpg` });
        } catch (error) {
          console.error(error);
          a.resultado = null;
          S.aviso(`No se pudo convertir ${a.nombre}. ${error.message || ''}`.trim(), 'error');
        }
      }
      pintar();
      if (!resultados.length) return;
      if (resultados.length === 1) {
        S.descargar(resultados[0].blob, resultados[0].nombre, 'image/jpeg');
      } else {
        const zip = new window.JSZip();
        const usados = {};
        for (const r of resultados) {
          let nombre = r.nombre;
          if (usados[nombre]) nombre = nombre.replace(/(\.[^.]+)$/, `-${usados[nombre]}$1`);
          usados[r.nombre] = (usados[r.nombre] || 0) + 1;
          zip.file(nombre, r.blob);
        }
        const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
        S.descargar(blob, 'heic-convertidas.zip', 'application/zip');
      }
      S.aviso('Listo. Revisa tus descargas.', 'ok');
      S.evento('descarga', { herramienta: 'heic-a-jpg' });
    } finally {
      S.ocupado(false);
    }
  };

  calidad.addEventListener('input', () => { calidadValor.textContent = `${calidad.value} %`; });
  S.zona(zona, {
    input: entrada,
    aceptar: esHeic,
    mensajeVacio: 'Solo se aceptan archivos HEIC o HEIF (los que hace el iPhone).',
    alRecibir: recibir,
  });
  document.getElementById('vaciar').addEventListener('click', () => { archivos = []; pintar(); });
  document.getElementById('convertir').addEventListener('click', convertir);
})();
