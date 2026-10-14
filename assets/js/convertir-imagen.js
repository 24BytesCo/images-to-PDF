/* Convertir entre PNG, JPG, WebP y BMP con canvas. Todo en el navegador. */
(function () {
  'use strict';
  const S = window.Suite;
  const I = window.Img;
  const $ = (id) => document.getElementById(id);
  const formato = $('formato');
  const calidad = $('calidad');
  let imagenes = [];

  /** BMP de 24 bits escrito a mano: canvas no sabe exportarlo. */
  const aBmp = (lienzo) => {
    const w = lienzo.width;
    const h = lienzo.height;
    const px = lienzo.getContext('2d').getImageData(0, 0, w, h).data;
    const fila = (w * 3 + 3) & ~3;
    const total = 54 + fila * h;
    const buf = new ArrayBuffer(total);
    const v = new DataView(buf);
    v.setUint8(0, 0x42); v.setUint8(1, 0x4d);
    v.setUint32(2, total, true);
    v.setUint32(10, 54, true);
    v.setUint32(14, 40, true);
    v.setInt32(18, w, true);
    v.setInt32(22, h, true);
    v.setUint16(26, 1, true);
    v.setUint16(28, 24, true);
    v.setUint32(34, fila * h, true);
    v.setInt32(38, 2835, true);
    v.setInt32(42, 2835, true);
    const u = new Uint8Array(buf);
    for (let y = 0; y < h; y++) {
      let o = 54 + (h - 1 - y) * fila;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        u[o++] = px[i + 2]; u[o++] = px[i + 1]; u[o++] = px[i];
      }
    }
    return new Blob([buf], { type: 'image/bmp' });
  };

  const pintar = () => {
    $('panel').hidden = imagenes.length === 0;
    $('zona').hidden = imagenes.length > 0;
    const peso = imagenes.reduce((s, i) => s + i.archivo.size, 0);
    $('resumen').textContent = `${imagenes.length} ${imagenes.length === 1 ? 'imagen' : 'imágenes'} · ${S.tamano(peso)}`;
    I.lista($('lista'), imagenes.map((i) => ({ nombre: i.archivo.name, meta: S.tamano(i.archivo.size) })),
      (n) => { imagenes.splice(n, 1); pintar(); });
  };

  const alCambiarFormato = () => {
    const t = formato.value;
    $('campoCalidad').hidden = !(t === 'image/jpeg' || t === 'image/webp');
    $('campoFondo').hidden = !(t === 'image/jpeg' || t === 'image/bmp');
  };

  const convertirUna = async (archivo, tipo, q, fondo) => {
    const bitmap = await I.cargar(archivo);
    const lienzo = I.lienzo(bitmap.width, bitmap.height);
    const ctx = lienzo.getContext('2d', { willReadFrequently: tipo === 'image/bmp' });
    if (tipo === 'image/jpeg' || tipo === 'image/bmp') { ctx.fillStyle = fondo; ctx.fillRect(0, 0, lienzo.width, lienzo.height); }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = tipo === 'image/bmp' ? aBmp(lienzo) : await I.aBlob(lienzo, tipo, q);
    return { blob, nombre: `${S.nombreBase(archivo.name, 'imagen')}.${I.EXT[tipo]}` };
  };

  const convertir = async () => {
    if (!imagenes.length) return;
    const tipo = formato.value;
    const q = Number(calidad.value) / 100;
    S.ocupado(true, 'Convirtiendo…');
    const hechos = [];
    try {
      for (const im of imagenes) {
        try {
          hechos.push(await convertirUna(im.archivo, tipo, q, $('fondo').value));
        } catch (error) {
          console.error(error);
          S.aviso(`No se pudo convertir ${im.archivo.name}.`, 'error');
        }
      }
      if (!hechos.length) return;
      await I.entregar(hechos, `imagenes-${I.EXT[tipo]}.zip`);
      S.aviso('Listo. Revisa tus descargas.', 'ok');
    } finally {
      S.ocupado(false);
    }
  };

  calidad.addEventListener('input', () => { $('calidadValor').textContent = `${calidad.value} %`; });
  formato.addEventListener('change', alCambiarFormato);
  S.zona($('zona'), {
    input: $('entrada'),
    aceptar: I.esImagen,
    mensajeVacio: 'Solo se aceptan imágenes JPG, PNG, WebP, GIF o BMP.',
    alRecibir: (archivos) => { archivos.forEach((archivo) => imagenes.push({ archivo })); pintar(); },
  });
  $('vaciar').addEventListener('click', () => { imagenes = []; pintar(); });
  $('convertir').addEventListener('click', convertir);
  alCambiarFormato();
})();
