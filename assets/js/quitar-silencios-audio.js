/* Quitar los silencios de un audio (silenceremove): pausas largas, inicio y final. */
(function () {
  'use strict';
  const M = window.FFmpegMotor;
  const S = window.Suite;
  const umbral = document.getElementById('umbral');
  const minimo = document.getElementById('minimo');
  const respiro = document.getElementById('respiro');

  M.montar({
    aceptar: M.esMedio,
    mensajeVacio: 'Elige un audio (MP3, WAV, M4A, OGG…) o un video.',
    comando({ archivos, infos }) {
      const t = `${umbral.value}dB`;
      const quedarse = respiro.checked ? ':stop_silence=0.15' : '';
      const filtro = `silenceremove=start_periods=1:start_duration=0:start_threshold=${t}`
        + `:stop_periods=-1:stop_duration=${minimo.value}:stop_threshold=${t}${quedarse}:detection=peak`;
      return {
        args: (e) => ['-i', e[0], '-vn', '-af', filtro, '-c:a', 'libmp3lame', '-b:a', '192k', 'salida.mp3'],
        salida: 'salida.mp3',
        mime: 'audio/mpeg',
        nombre: `${S.nombreBase(archivos[0].name, 'audio')}-sin-silencios.mp3`,
        duracion: infos[0].duracion,
        aviso: () => 'Compara la duración del resultado con la del original. Si cortó voz suave, usa un umbral más bajo (-50 dB); si dejó pausas, súbelo (-30 dB).',
      };
    },
  });
})();
