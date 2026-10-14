/* Unir varias imágenes en una sola: vertical, horizontal o cuadrícula. */
(function () {
  'use strict';
  const S = window.Suite;
  const I = window.Img;
  const $ = (id) => document.getElementById(id);
  const MAX = 16000;
  const MAX_IMAGENES = 40;
  let items = []; // { nombre, bitmap }

  /** Posiciones de cada imagen (sin escalar de vista) y tamaño total. */
  const disponer = () => {
    const modo = $('modo').value;
    const gap = Number($('espacio').value);
    const pos = [];
    if (modo === 'vertical') {
      const ancho = Math.min(...items.map((i) => i.bitmap.width));
      let y = 0;
      items.forEach((it) => {
        const h = Math.round((it.bitmap.height * ancho) / it.bitmap.width);
        pos.push({ x: 0, y, w: ancho, h });
        y += h + gap;
      });
      return { pos, w: ancho, h: y - gap };
    }
    if (modo === 'horizontal') {
      const alto = Math.min(...items.map((i) => i.bitmap.height));
      let x = 0;
      items.forEach((it) => {
        const w = Math.round((it.bitmap.width * alto) / it.bitmap.height);
        pos.push({ x, y: 0, w, h: alto });
        x += w + gap;
      });
      return { pos, w: x - gap, h: alto };
    }
    const cols = Math.min(Number($('columnas').value), items.length);
    const celda = Math.min(...items.map((i) => i.bitmap.width));
    const filas = [];
    items.forEach((it, i) => {
      const h = Math.round((it.bitmap.height * celda) / it.bitmap.width);
      const f = Math.floor(i / cols);
      (filas[f] = filas[f] || []).push(h);
    });
    items.forEach((it, i) => {
      const c = i % cols;
      pos.push({ x: c * (celda + gap), y: y0(filas, Math.floor(i / cols), gap), w: celda, h: Math.round((it.bitmap.height * celda) / it.bitmap.width) });
    });
    return { pos, w: cols * celda + (cols - 1) * gap, h: y0(filas, filas.length, gap) - gap };
  };
  const y0 = (filas, hasta, gap) => {
    let y = 0;
    for (let f = 0; f < hasta; f++) y += Math.max(...filas[f]) + gap;
    return y;
  };

  const componer = (escala) => {
    const d = disponer();
    const l = I.lienzo(d.w * escala, d.h * escala);
    const x = l.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.fillStyle = $('fondo').value;
    x.fillRect(0, 0, l.width, l.height);
    items.forEach((it, i) => {
      const p = d.pos[i];
      x.drawImage(it.bitmap, Math.round(p.x * escala), Math.round(p.y * escala), Math.round(p.w * escala), Math.round(p.h * escala));
    });
    return l;
  };

  const lista = () => {
    const cont = $('lista');
    cont.textContent = '';
    items.forEach((it, i) => {
      const fila = document.createElement('div');
      fila.className = 'unir-fila';
      const mini = I.lienzo(48, 48);
      const k = Math.max(48 / it.bitmap.width, 48 / it.bitmap.height);
      mini.getContext('2d').drawImage(it.bitmap, (48 - it.bitmap.width * k) / 2, (48 - it.bitmap.height * k) / 2, it.bitmap.width * k, it.bitmap.height * k);
      const nombre = document.createElement('span');
      nombre.className = 'lista-nombre';
      nombre.textContent = `${i + 1}. ${it.nombre}`;
      const mk = (txt, etiqueta, activo, fn) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'unir-mover';
        b.textContent = txt;
        b.setAttribute('aria-label', `${etiqueta} ${it.nombre}`);
        b.disabled = !activo;
        b.addEventListener('click', fn);
        return b;
      };
      fila.append(mini, nombre,
        mk('↑', 'Subir', i > 0, () => { [items[i - 1], items[i]] = [items[i], items[i - 1]]; pintar(); }),
        mk('↓', 'Bajar', i < items.length - 1, () => { [items[i + 1], items[i]] = [items[i], items[i + 1]]; pintar(); }),
        mk('×', 'Quitar', true, () => { items.splice(i, 1)[0].bitmap.close(); pintar(); }));
      cont.appendChild(fila);
    });
  };

  const pintar = () => {
    $('panel').hidden = items.length === 0;
    $('zona').hidden = items.length > 0;
    if (!items.length) return;
    $('campoColumnas').hidden = $('modo').value !== 'cuadricula';
    lista();
    const d = disponer();
    const demasiado = d.w > MAX || d.h > MAX || items.length < 2;
    $('unir').disabled = demasiado;
    $('medida').textContent = items.length < 2
      ? 'añade al menos una imagen más'
      : `${d.w} × ${d.h} px${d.w > MAX || d.h > MAX ? ' (demasiado grande: máximo 16 000 px por lado)' : ''}`;
    const v = $('vista');
    const k = Math.min(1, 700 / Math.max(d.w, d.h));
    const c = componer(k);
    v.width = c.width;
    v.height = c.height;
    v.getContext('2d').drawImage(c, 0, 0);
  };

  const recibir = async (archivos) => {
    S.ocupado(true, 'Abriendo imágenes…');
    try {
      for (const f of archivos) {
        if (items.length >= MAX_IMAGENES) { S.aviso(`Máximo ${MAX_IMAGENES} imágenes.`, 'error'); break; }
        try {
          items.push({ nombre: f.name, bitmap: await I.cargar(f) });
        } catch (_) {
          S.aviso(`No se pudo abrir ${f.name}.`, 'error');
        }
      }
    } finally {
      S.ocupado(false);
    }
    pintar();
  };

  const unir = async () => {
    S.ocupado(true, 'Uniendo…');
    try {
      const tipo = $('formato').value;
      const blob = await I.aBlob(componer(1), tipo, 0.92);
      S.descargar(blob, `imagenes-unidas.${I.EXT[tipo]}`, tipo);
      S.aviso('Listo. Revisa tus descargas.', 'ok');
    } catch (error) {
      console.error(error);
      S.aviso('No se pudo unir: el resultado es demasiado grande para este equipo.', 'error');
    } finally {
      S.ocupado(false);
    }
  };

  S.zona($('zona'), {
    input: $('entrada'),
    aceptar: I.esImagen,
    mensajeVacio: 'Solo se aceptan imágenes JPG, PNG, WebP, GIF o BMP.',
    alRecibir: recibir,
  });
  $('agregar').addEventListener('click', () => $('entrada').click());
  $('vaciar').addEventListener('click', () => { items.forEach((i) => i.bitmap.close()); items = []; pintar(); });
  $('espacio').addEventListener('input', () => { $('espacioValor').textContent = `${$('espacio').value} px`; pintar(); });
  ['modo', 'columnas', 'fondo'].forEach((id) => $(id).addEventListener('input', pintar));
  $('unir').addEventListener('click', unir);
})();
