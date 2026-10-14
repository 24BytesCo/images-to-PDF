/* Cámara lenta o rápida: cambia la velocidad del video (setpts) y del audio (atempo, mismo tono). */
(function () {
  'use strict';
  const M = window.FFmpegMotor;
  const S = window.Suite;
  const factor = document.getElementById('factor');
  const audio = document.getElementById('audio');
  const aviso = document.getElementById('avisoLenta');
  const num = (el) => Number(String(el.value).replace(',', '.'));

  const cadenaTempo = (f) => {
    const etapas = [];
    let r = f;
    while (r > 2) { etapas.push(2); r /= 2; }
    while (r < 0.5) { etapas.push(0.5); r /= 0.5; }
    etapas.push(Math.round(r * 10000) / 10000);
    return etapas.map((x) => `atempo=${x}`).join(',');
  };

  const mostrar = () => { aviso.hidden = !(num(factor) < 1); };
  factor.addEventListener('change', mostrar);
  mostrar();

  M.montar({
    aceptar: M.esVideo,
    mensajeVacio: 'Elige un video (MP4, MOV, WebM, MKV…).',
    comando({ archivos, infos }) {
      const f = num(factor);
      const d = infos[0].duracion;
      return {
        args: async (e, ayudas) => {
          const conAudio = audio.value === 'conservar' && await ayudas.tieneAudio(0);
          return ['-i', e[0], '-vf', `setpts=PTS/${f},scale=trunc(iw/2)*2:trunc(ih/2)*2`,
            ...(conAudio ? ['-af', cadenaTempo(f), '-c:a', 'aac', '-b:a', '128k'] : ['-an']),
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', 'salida.mp4'];
        },
        salida: 'salida.mp4',
        mime: 'video/mp4',
        nombre: `${S.nombreBase(archivos[0].name, 'video')}-${String(f).replace('.', ',')}x.mp4`,
        duracion: d ? d / f : null,
      };
    },
  });
})();
