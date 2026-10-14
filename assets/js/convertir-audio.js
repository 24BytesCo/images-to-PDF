/* Convertir audio entre WAV, MP3, OGG y M4A con ffmpeg.wasm. */
(function () {
  'use strict';
  const M = window.FFmpegMotor;
  const S = window.Suite;
  const formato = document.getElementById('formato');

  const FORMATOS = {
    mp3: { codec: ['-c:a', 'libmp3lame', '-b:a', '192k'], mime: 'audio/mpeg' },
    wav: { codec: ['-c:a', 'pcm_s16le'], mime: 'audio/wav' },
    ogg: { codec: ['-c:a', 'libvorbis', '-q:a', '5'], mime: 'audio/ogg' },
    m4a: { codec: ['-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart'], mime: 'audio/mp4' },
  };

  M.montar({
    aceptar: M.esMedio,
    mensajeVacio: 'Elige un archivo de audio (MP3, WAV, OGG, M4A, FLAC, AAC…).',
    comando({ archivos, infos }) {
      const f = FORMATOS[formato.value];
      const salida = `salida.${formato.value}`;
      return {
        args: (e) => ['-i', e[0], '-vn', ...f.codec, salida],
        salida,
        mime: f.mime,
        nombre: `${S.nombreBase(archivos[0].name, 'audio')}.${formato.value}`,
        duracion: infos[0].duracion,
        aviso: formato.value === 'wav'
          ? () => 'WAV no comprime: ocupa mucho más que el original. Úsalo solo si lo necesitas sin pérdida.'
          : null,
      };
    },
  });
})();
