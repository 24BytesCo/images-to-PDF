/* Utilidades de imagen compartidas por las herramientas del sitio «imagenes». Requiere comun.js. */
(function () {
  'use strict';
  const S = window.Suite;

  const Img = {
    EXT: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/bmp': 'bmp', 'image/gif': 'gif' },

    esImagen(f) {
      return /^image\/(jpeg|png|webp|gif|bmp)$/.test(f.type) || /\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name);
    },

    /** Decodifica respetando la orientación EXIF. */
    async cargar(archivo) {
      try {
        return await createImageBitmap(archivo, { imageOrientation: 'from-image' });
      } catch (_) {
        return createImageBitmap(archivo);
      }
    },

    lienzo(w, h) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w));
      c.height = Math.max(1, Math.round(h));
      return c;
    },

    aBlob(lienzo, tipo = 'image/png', calidad = 0.92) {
      return new Promise((ok, mal) => lienzo.toBlob((b) => (b ? ok(b) : mal(new Error('canvas no pudo exportar'))), tipo, calidad));
    },

    /** Escala por pasos de la mitad para que reducir mucho no deje dientes. */
    escalar(fuente, w, h) {
      let actual = fuente;
      let cw = fuente.width;
      let ch = fuente.height;
      w = Math.max(1, Math.round(w));
      h = Math.max(1, Math.round(h));
      while (cw / 2 > w && ch / 2 > h) {
        cw = Math.ceil(cw / 2);
        ch = Math.ceil(ch / 2);
        const t = Img.lienzo(cw, ch);
        const x = t.getContext('2d');
        x.imageSmoothingQuality = 'high';
        x.drawImage(actual, 0, 0, cw, ch);
        actual = t;
      }
      const sal = Img.lienzo(w, h);
      const x = sal.getContext('2d');
      x.imageSmoothingQuality = 'high';
      x.drawImage(actual, 0, 0, w, h);
      return sal;
    },

    /** Pinta `fuente` en `destino` reducida a un lado máximo (para vistas previas). */
    vista(destino, fuente, maximo = 900) {
      const k = Math.min(1, maximo / Math.max(fuente.width, fuente.height));
      destino.width = Math.max(1, Math.round(fuente.width * k));
      destino.height = Math.max(1, Math.round(fuente.height * k));
      const x = destino.getContext('2d');
      x.clearRect(0, 0, destino.width, destino.height);
      x.drawImage(fuente, 0, 0, destino.width, destino.height);
      return k;
    },

    /** Una imagen: descarga directa; varias: ZIP. items: [{blob, nombre}] */
    async entregar(items, nombreZip = 'imagenes.zip') {
      if (items.length === 1) {
        S.descargar(items[0].blob, items[0].nombre, items[0].blob.type);
        return;
      }
      const zip = new window.JSZip();
      const usados = {};
      for (const it of items) {
        let nombre = it.nombre;
        if (usados[it.nombre]) nombre = it.nombre.replace(/(\.[^.]+)$/, `-${usados[it.nombre]}$1`);
        usados[it.nombre] = (usados[it.nombre] || 0) + 1;
        zip.file(nombre, it.blob);
      }
      const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      S.descargar(blob, nombreZip, 'application/zip');
    },

    /** Lista simple con peso y botón de quitar. */
    lista(contenedor, items, alQuitar) {
      contenedor.textContent = '';
      items.forEach((it, i) => {
        const fila = document.createElement('div');
        fila.className = 'lista-item';
        const nombre = document.createElement('span');
        nombre.className = 'lista-nombre';
        nombre.textContent = it.nombre;
        const meta = document.createElement('span');
        meta.className = 'lista-meta';
        meta.textContent = it.meta || '';
        const quitar = document.createElement('button');
        quitar.type = 'button';
        quitar.className = 'quitar';
        quitar.setAttribute('aria-label', `Quitar ${it.nombre}`);
        quitar.textContent = '×';
        quitar.addEventListener('click', () => alQuitar(i));
        fila.append(nombre, meta, quitar);
        contenedor.appendChild(fila);
      });
    },

    /**
     * Herramientas de una sola imagen: zona de carga + panel oculto hasta tener imagen.
     * alCargar(bitmap, archivo) se llama cada vez que el usuario elige una imagen.
     */
    unaImagen({ zona, entrada, panel, alCargar, cambiar }) {
      S.zona(zona, {
        input: entrada,
        aceptar: Img.esImagen,
        mensajeVacio: 'Solo se aceptan imágenes JPG, PNG, WebP, GIF o BMP.',
        alRecibir: async (archivos) => {
          try {
            const bitmap = await Img.cargar(archivos[0]);
            panel.hidden = false;
            zona.hidden = true;
            await alCargar(bitmap, archivos[0]);
          } catch (error) {
            console.error(error);
            S.aviso('No se pudo abrir esa imagen. Puede estar dañada.', 'error');
          }
        },
      });
      if (cambiar) {
        cambiar.addEventListener('click', () => { panel.hidden = true; zona.hidden = false; entrada.click(); });
      }
    },

    /** Posición del puntero en coordenadas del propio lienzo (px del canvas). */
    punto(ev, lienzo) {
      const r = lienzo.getBoundingClientRect();
      return {
        x: ((ev.clientX - r.left) / r.width) * lienzo.width,
        y: ((ev.clientY - r.top) / r.height) * lienzo.height,
      };
    },

    async copiar(texto) {
      try {
        await navigator.clipboard.writeText(texto);
        return true;
      } catch (_) {
        const t = document.createElement('textarea');
        t.value = texto;
        document.body.appendChild(t);
        t.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (_e) { /* sin portapapeles */ }
        t.remove();
        return ok;
      }
    },
  };

  window.Img = Img;
})();
