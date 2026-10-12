/* Web Worker: decodifica HEIC/HEIF con libheif (wasm) y lo entrega como JPEG.
   Se carga solo cuando el navegador no decodifica HEIC de forma nativa. */
/* global libheif, OffscreenCanvas, ImageData */
'use strict';
importScripts('/assets/vendor/libheif-bundle.js');

// libheif es una factory: invocarla da el Module con las clases HeifDecoder/HeifImage.
let modulo = null;
const obtenerModulo = () => (modulo || (modulo = libheif()));

self.onmessage = async (e) => {
  const { id, buffer, quality } = e.data;
  let imagenes = null;
  try {
    const decoder = new (obtenerModulo().HeifDecoder)();
    imagenes = decoder.decode(new Uint8Array(buffer));
    if (!imagenes || !imagenes.length) throw new Error('El archivo no contiene una imagen HEIC válida.');
    // Imagen principal si está marcada; si no, la primera.
    let img = imagenes.find((im) => { try { return im.is_primary(); } catch (_) { return false; } }) || imagenes[0];
    const w = img.get_width();
    const h = img.get_height();
    const datos = new ImageData(w, h);
    await new Promise((ok, mal) => {
      img.display(datos, (resultado) => (resultado ? ok() : mal(new Error('No se pudo decodificar la imagen.'))));
    });
    const lienzo = new OffscreenCanvas(w, h);
    lienzo.getContext('2d').putImageData(datos, 0, 0);
    const blob = await lienzo.convertToBlob({ type: 'image/jpeg', quality });
    self.postMessage({ id, ok: true, blob, ancho: w, alto: h });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  } finally {
    if (imagenes) imagenes.forEach((im) => { try { im.free(); } catch (_) { /* nada */ } });
  }
};
