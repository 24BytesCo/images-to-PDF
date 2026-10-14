/* Video (o audio) a MP3 con ffmpeg.wasm. Todo en el navegador. */
(function () {
  'use strict';
  const M = window.FFmpegMotor;
  const S = window.Suite;
  const calidad = document.getElementById('calidad');

  M.montar({
    aceptar: M.esMedio,
    mensajeVacio: 'Elige un video o un audio (MP4, MOV, WebM, MKV, M4A…).',
    comando({ archivos, infos }) {
      const [kbps, mono] = calidad.value.split(':');
      return {
        args: (e) => ['-i', e[0], '-vn', '-c:a', 'libmp3lame', '-b:a', `${kbps}k`, ...(mono ? ['-ac', '1'] : []), 'salida.mp3'],
        salida: 'salida.mp3',
        mime: 'audio/mpeg',
        nombre: `${S.nombreBase(archivos[0].name, 'audio')}.mp3`,
        duracion: infos[0].duracion,
      };
    },
  });
})();
