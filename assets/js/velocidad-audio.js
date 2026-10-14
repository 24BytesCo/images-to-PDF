/* Acelerar o ralentizar un audio, con o sin cambio de tono (atempo / asetrate). */
(function () {
  'use strict';
  const M = window.FFmpegMotor;
  const S = window.Suite;
  const factor = document.getElementById('factor');
  const tono = document.getElementById('tono');
  const num = (el) => Number(String(el.value).replace(',', '.'));

  /** atempo solo admite 0,5–2 por etapa en algunas versiones: se encadena. */
  const cadenaTempo = (f) => {
    const etapas = [];
    let r = f;
    while (r > 2) { etapas.push(2); r /= 2; }
    while (r < 0.5) { etapas.push(0.5); r /= 0.5; }
    etapas.push(Math.round(r * 10000) / 10000);
    return etapas.map((x) => `atempo=${x}`).join(',');
  };

  document.querySelectorAll('[data-factor]').forEach((b) => {
    b.addEventListener('click', () => { factor.value = b.dataset.factor; });
  });

  M.montar({
    aceptar: M.esMedio,
    mensajeVacio: 'Elige un audio (MP3, WAV, M4A, OGG…) o un video.',
    validar() {
      const f = num(factor);
      if (!Number.isFinite(f) || f < 0.25 || f > 4) return 'La velocidad debe estar entre 0,25× y 4×.';
      return null;
    },
    comando({ archivos, infos }) {
      const f = num(factor);
      const filtro = tono.value === 'mantener'
        ? cadenaTempo(f)
        : `aresample=44100,asetrate=${Math.round(44100 * f)},aresample=44100`;
      const d = infos[0].duracion;
      return {
        args: (e) => ['-i', e[0], '-vn', '-af', filtro, '-c:a', 'libmp3lame', '-b:a', '192k', 'salida.mp3'],
        salida: 'salida.mp3',
        mime: 'audio/mpeg',
        nombre: `${S.nombreBase(archivos[0].name, 'audio')}-${String(f).replace('.', ',')}x.mp3`,
        duracion: d ? d / f : null,
      };
    },
  });
})();
