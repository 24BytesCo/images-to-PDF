/* Comprimir video (H.264 + AAC en MP4) con ffmpeg.wasm. */
(function () {
  'use strict';
  const M = window.FFmpegMotor;
  const S = window.Suite;
  const nivel = document.getElementById('nivel');
  const resolucion = document.getElementById('resolucion');
  const aviso = document.getElementById('avisoLargo');

  M.montar({
    aceptar: M.esVideo,
    comparar: true,
    mensajeVacio: 'Elige un video (MP4, MOV, WebM, MKV, AVI…).',
    alElegir(estado) {
      const d = estado.infos[0].duracion;
      aviso.hidden = !(d && d > 300);
    },
    comando({ archivos, infos }) {
      const h = Number(resolucion.value);
      const vf = h ? `scale=-2:'min(${h},ih)'` : 'scale=trunc(iw/2)*2:trunc(ih/2)*2';
      return {
        args: (e) => ['-i', e[0], '-vf', vf, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', nivel.value,
          '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', 'salida.mp4'],
        salida: 'salida.mp4',
        mime: 'video/mp4',
        nombre: `${S.nombreBase(archivos[0].name, 'video')}-comprimido.mp4`,
        duracion: infos[0].duracion,
        aviso: (nuevo, antes) => (nuevo >= antes
          ? 'El resultado no pesa menos que el original: ese video ya venía muy comprimido. Prueba con compresión fuerte o una resolución menor, o conserva el original.'
          : ''),
      };
    },
  });
})();
