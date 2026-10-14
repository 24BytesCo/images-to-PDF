/* GIF animado a MP4: mucho más liviano y apto para WhatsApp, Instagram y X. */
(function () {
  'use strict';
  const M = window.FFmpegMotor;
  const S = window.Suite;
  const repetir = document.getElementById('repetir');
  const esGif = (f) => /^image\/gif$/.test(f.type) || M.extension(f.name) === 'gif';

  M.montar({
    aceptar: esGif,
    comparar: true,
    mensajeVacio: 'Elige un archivo GIF (.gif).',
    comando({ archivos }) {
      const veces = Number(repetir.value);
      return {
        args: (e) => [...(veces > 1 ? ['-stream_loop', String(veces - 1)] : []), '-i', e[0],
          '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
          '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', 'salida.mp4'],
        salida: 'salida.mp4',
        mime: 'video/mp4',
        nombre: `${S.nombreBase(archivos[0].name, 'animacion')}.mp4`,
        aviso: (nuevo, antes) => (nuevo < antes
          ? `El MP4 pesa ${Math.round((1 - nuevo / antes) * 100)} % menos que el GIF.`
          : 'Este GIF ya era pequeño y el MP4 no pesa menos; igual te sirve si la app solo acepta video.'),
      };
    },
  });
})();
