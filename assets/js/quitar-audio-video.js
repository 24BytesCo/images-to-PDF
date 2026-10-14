/* Quitar el audio de un video sin recodificar (copia del video tal cual) con ffmpeg.wasm. */
(function () {
  'use strict';
  const M = window.FFmpegMotor;
  const S = window.Suite;
  const MIME = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska' };

  M.montar({
    aceptar: M.esVideo,
    mensajeVacio: 'Elige un video (MP4, MOV, WebM, MKV…).',
    comando({ archivos, infos }) {
      const origen = M.extension(archivos[0].name);
      const ext = MIME[origen] ? origen : 'mp4';
      const salida = `salida.${ext}`;
      return {
        args: (e) => ['-i', e[0], '-map', '0:v', '-c:v', 'copy', '-an', salida],
        salida,
        mime: MIME[ext],
        nombre: `${S.nombreBase(archivos[0].name, 'video')}-sin-audio.${ext}`,
        duracion: infos[0].duracion,
      };
    },
  });
})();
