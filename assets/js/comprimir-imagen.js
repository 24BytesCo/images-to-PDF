/* Comprimir imágenes con canvas. Todo en el navegador, sin subir nada. */
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
  const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
  const EXT = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' };

  /** @type {{nombre:string, tamano:number, archivo:File, resultado:number|null}[]} */
  let imagenes = [];

  const pintar = () => {
    panel.hidden = imagenes.length === 0;
    const peso = imagenes.reduce((s, i) => s + i.tamano, 0);
    resumen.textContent = `${imagenes.length} ${imagenes.length === 1 ? 'imagen' : 'imágenes'} · ${S.tamano(peso)}`;
    lista.textContent = '';
    imagenes.forEach((im, i) => {
      const fila = document.createElement('div');
      fila.className = 'lista-item';
      const dest = im.resultado != null
        ? `<strong>${S.tamano(im.resultado)}</strong> (${im.resultado < im.tamano ? '−' : '+'}${Math.abs(Math.round((1 - im.resultado / im.tamano) * 100))} %)`
        : '—';
      fila.innerHTML = `<span class="lista-nombre"></span>`
        + `<span class="lista-meta">${S.tamano(im.tamano)} → ${dest}</span>`;
      fila.querySelector('.lista-nombre').textContent = im.nombre;
      const quitar = document.createElement('button');
      quitar.type = 'button';
      quitar.className = 'quitar';
      quitar.setAttribute('aria-label', `Quitar ${im.nombre}`);
      quitar.textContent = '×';
      quitar.addEventListener('click', () => { imagenes.splice(i, 1); pintar(); });
      fila.appendChild(quitar);
      lista.appendChild(fila);
    });
  };

  const recibir = (archivos) => {
    for (const archivo of archivos) {
      imagenes.push({ nombre: archivo.name, tamano: archivo.size, archivo, resultado: null });
    }
    pintar();
  };

  /** Comprime un File y devuelve { blob, nombre } ya con el mejor resultado. */
  const comprimirUno = async (im, tipoSalida, q, maximo) => {
    const tipo = tipoSalida === 'original' ? im.archivo.type : tipoSalida;
    let bitmap;
    try {
      bitmap = await createImageBitmap(im.archivo, { imageOrientation: 'from-image' });
    } catch (_) {
      bitmap = await createImageBitmap(im.archivo);
    }
    let { width: w, height: h } = bitmap;
    if (maximo > 0 && Math.max(w, h) > maximo) {
      const escala = maximo / Math.max(w, h);
      w = Math.round(w * escala);
      h = Math.round(h * escala);
    }
    const lienzo = document.createElement('canvas');
    lienzo.width = w;
    lienzo.height = h;
    const ctx = lienzo.getContext('2d');
    if (tipo === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise((ok) => lienzo.toBlob(ok, tipo, q));
    if (!blob) throw new Error('canvas no pudo exportar');
    // Si no se redimensiona ni cambia el formato y el resultado engorda, conservar el original.
    const mismoFormato = tipo === im.archivo.type;
    if (blob.size >= im.archivo.size && maximo === 0 && mismoFormato) {
      return { blob: im.archivo, nombre: im.nombre, original: true };
    }
    const base = S.nombreBase(im.nombre);
    return { blob, nombre: `${base}.${EXT[tipo] || 'jpg'}`, original: false };
  };

  const comprimir = async () => {
    if (!imagenes.length) return;
    const tipoSalida = document.getElementById('formato').value;
    const q = Number(calidad.value) / 100;
    const maximo = Number(document.getElementById('maximo').value) || 0;
    S.ocupado(true, 'Comprimiendo…');
    const resultados = [];
    let conservados = 0;
    try {
      for (const im of imagenes) {
        try {
          const r = await comprimirUno(im, tipoSalida, q, maximo);
          im.resultado = r.blob.size;
          if (r.original) conservados++;
          resultados.push(r);
        } catch (error) {
          console.error(error);
          im.resultado = null;
          S.aviso(`No se pudo comprimir ${im.nombre}.`, 'error');
        }
      }
      pintar();
      if (!resultados.length) return;
      if (resultados.length === 1) {
        S.descargar(resultados[0].blob, resultados[0].nombre, resultados[0].blob.type);
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
        S.descargar(blob, 'imagenes-comprimidas.zip', 'application/zip');
      }
      const aviso = conservados
        ? `Listo. ${conservados} imagen(es) ya estaban optimizadas y se conservaron tal cual.`
        : 'Listo. Revisa tus descargas.';
      S.aviso(aviso, 'ok');
      S.evento('descarga', { herramienta: 'comprimir-imagen' });
    } finally {
      S.ocupado(false);
    }
  };

  calidad.addEventListener('input', () => { calidadValor.textContent = `${calidad.value} %`; });
  S.zona(zona, {
    input: entrada,
    aceptar: (f) => TIPOS.includes(f.type),
    mensajeVacio: 'Solo se aceptan imágenes JPG, PNG o WebP.',
    alRecibir: recibir,
  });
  document.getElementById('vaciar').addEventListener('click', () => { imagenes = []; pintar(); });
  document.getElementById('comprimir').addEventListener('click', comprimir);
})();
