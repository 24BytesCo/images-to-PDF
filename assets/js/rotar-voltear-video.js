/* Girar 90°/180° o voltear un video, con vista previa en vivo. */
(function () {
  'use strict';
  const M = window.FFmpegMotor;
  const S = window.Suite;
  const accion = document.getElementById('accion');
  const previa = document.getElementById('previa');
  let urlPrevia = null;

  const FILTROS = {
    derecha: { vf: 'transpose=1', css: 'rotate(90deg)', sufijo: 'girado-derecha' },
    izquierda: { vf: 'transpose=2', css: 'rotate(-90deg)', sufijo: 'girado-izquierda' },
    '180': { vf: 'transpose=1,transpose=1', css: 'rotate(180deg)', sufijo: 'girado-180' },
    horizontal: { vf: 'hflip', css: 'scaleX(-1)', sufijo: 'espejo' },
    vertical: { vf: 'vflip', css: 'scaleY(-1)', sufijo: 'volteado' },
  };

  const pintarPrevia = () => {
    const a = accion.value;
    previa.style.transform = FILTROS[a].css;
    // Al girar 90° el cuadro se hace alto: se reduce para que no se salga del recuadro.
    previa.style.maxHeight = (a === 'derecha' || a === 'izquierda') ? '240px' : '';
    previa.style.margin = (a === 'derecha' || a === 'izquierda') ? '60px auto' : '';
  };
  accion.addEventListener('change', pintarPrevia);

  const ctl = M.montar({
    aceptar: M.esVideo,
    mensajeVacio: 'Elige un video (MP4, MOV, WebM, MKV…).',
    alElegir(estado) {
      if (urlPrevia) URL.revokeObjectURL(urlPrevia);
      urlPrevia = URL.createObjectURL(estado.archivos[0]);
      previa.src = urlPrevia;
      previa.hidden = false;
      pintarPrevia();
    },
    comando({ archivos, infos }) {
      const f = FILTROS[accion.value];
      return {
        args: (e) => ['-i', e[0], '-map', '0:v:0', '-map', '0:a:0?',
          '-vf', `${f.vf},scale=trunc(iw/2)*2:trunc(ih/2)*2`,
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
          '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', 'salida.mp4'],
        salida: 'salida.mp4',
        mime: 'video/mp4',
        nombre: `${S.nombreBase(archivos[0].name, 'video')}-${f.sufijo}.mp4`,
        duracion: infos[0].duracion,
      };
    },
  });
  document.getElementById('vaciar').addEventListener('click', () => {
    previa.removeAttribute('src');
    previa.hidden = true;
    ctl.mostrarError('');
  });
})();
