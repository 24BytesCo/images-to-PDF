/* Fundido de entrada y de salida (afade) sobre un audio. */
(function () {
  'use strict';
  const M = window.FFmpegMotor;
  const S = window.Suite;
  const entrada = document.getElementById('fadeIn');
  const salida = document.getElementById('fadeOut');
  const num = (el) => Number(String(el.value).replace(',', '.'));

  M.montar({
    aceptar: M.esMedio,
    mensajeVacio: 'Elige un audio (MP3, WAV, M4A, OGG…) o un video.',
    validar({ infos }) {
      const a = num(entrada);
      const b = num(salida);
      const d = infos[0].duracion;
      if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0) return 'Los fundidos deben ser segundos, desde 0.';
      if (a === 0 && b === 0) return 'Pon al menos un fundido mayor que 0 (entrada o salida).';
      if (!d) return 'No pude leer la duración de este archivo; sin ella no se puede ubicar el fundido de salida.';
      if (a + b > d) return `Los dos fundidos suman ${a + b} s y el audio dura ${Math.round(d * 10) / 10} s. Redúcelos.`;
      return null;
    },
    comando({ archivos, infos }) {
      const a = num(entrada);
      const b = num(salida);
      const d = infos[0].duracion;
      const f = [];
      if (a > 0) f.push(`afade=t=in:st=0:d=${a}`);
      if (b > 0) f.push(`afade=t=out:st=${Math.max(0, Math.round((d - b) * 1000) / 1000)}:d=${b}`);
      return {
        args: (e) => ['-i', e[0], '-vn', '-af', f.join(','), '-c:a', 'libmp3lame', '-b:a', '192k', 'salida.mp3'],
        salida: 'salida.mp3',
        mime: 'audio/mpeg',
        nombre: `${S.nombreBase(archivos[0].name, 'audio')}-fundido.mp3`,
        duracion: d,
      };
    },
  });
})();
