/* Audio + imagen -> MP4 (YouTube, Reels, Shorts, TikTok). Una imagen fija y el audio completo. */
(function () {
  'use strict';
  const M = window.FFmpegMotor;
  const S = window.Suite;
  const formato = document.getElementById('formato');
  const ajuste = document.getElementById('ajuste');
  const lista = document.getElementById('lista');

  const esImagen = (f) => /^image\//.test(f.type) || ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'].includes(M.extension(f.name));
  const aceptar = (f) => esImagen(f) || M.esAudio(f);

  const aPng = async (archivo) => {
    const bmp = await createImageBitmap(archivo);
    const c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    c.getContext('2d').drawImage(bmp, 0, 0);
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/png'));
    return new File([blob], `${S.nombreBase(archivo.name, 'imagen')}.png`, { type: 'image/png' });
  };

  const pintarLista = (estado) => {
    lista.textContent = '';
    const img = estado.archivos.filter(esImagen);
    const aud = estado.archivos.filter((f) => !esImagen(f));
    [['Imagen', img], ['Audio', aud]].forEach(([titulo, fs]) => {
      const fila = document.createElement('div');
      fila.className = 'lista-item';
      fila.style.cursor = 'default';
      const n = document.createElement('span');
      n.className = 'lista-nombre';
      n.textContent = `${titulo}: ${fs.length ? fs.map((f) => f.name).join(', ') : 'falta elegirlo'}`;
      fila.appendChild(n);
      lista.appendChild(fila);
    });
  };

  const ctl = M.montar({
    multiple: true,
    aceptar,
    mensajeVacio: 'Elige un audio (MP3, WAV, M4A…) y una imagen (JPG, PNG, WebP).',
    pintarLista,
    async alElegir(estado) {
      // WebP, BMP y GIF pasan a PNG en el navegador: así ffmpeg solo recibe JPG o PNG.
      for (let i = 0; i < estado.archivos.length; i++) {
        const f = estado.archivos[i];
        if (esImagen(f) && !['jpg', 'jpeg', 'png'].includes(M.extension(f.name))) {
          try { estado.archivos[i] = await aPng(f); } catch (_) { /* se deja tal cual */ }
        }
      }
    },
    validar({ archivos }) {
      const img = archivos.filter(esImagen);
      const aud = archivos.filter((f) => !esImagen(f));
      if (!aud.length) return 'Falta el audio. Añade un MP3, WAV o M4A.';
      if (!img.length) return 'Falta la imagen. Añade un JPG o PNG que se verá todo el tiempo.';
      if (aud.length > 1) return 'Hay más de un audio. Para unirlos antes usa «Unir audios» y vuelve con uno solo.';
      if (img.length > 1) return 'Hay más de una imagen. Aquí se usa una sola imagen fija: quita las que sobren.';
      return null;
    },
    comando({ archivos, infos }) {
      const ia = archivos.findIndex((f) => !esImagen(f));
      const ii = archivos.findIndex(esImagen);
      const [w, h] = formato.value.split('x').map(Number);
      const vf = ajuste.value === 'recortar'
        ? `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,format=yuv420p`
        : `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,format=yuv420p`;
      const d = infos[ia].duracion;
      return {
        args: (e) => ['-loop', '1', '-framerate', '5', '-i', e[ii], '-i', e[ia],
          '-vf', vf, '-c:v', 'libx264', '-tune', 'stillimage', '-preset', 'veryfast', '-crf', '30', '-r', '5',
          '-c:a', 'aac', '-b:a', '192k', ...(d ? ['-t', String(d)] : ['-shortest']), '-movflags', '+faststart', 'salida.mp4'],
        salida: 'salida.mp4',
        mime: 'video/mp4',
        nombre: `${S.nombreBase(archivos[ia].name, 'audio')}-video.mp4`,
        duracion: d,
      };
    },
  });
  void ctl;
})();
