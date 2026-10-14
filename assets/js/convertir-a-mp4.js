/* Convertir MOV, MKV, AVI, WebM y otros a MP4 (H.264 + AAC). Copia sin recodificar si ya es compatible. */
(function () {
  'use strict';
  const M = window.FFmpegMotor;
  const S = window.Suite;
  const calidad = document.getElementById('calidad');
  const rapido = document.getElementById('rapido');
  let usado = '';

  M.montar({
    aceptar: M.esVideo,
    comparar: true,
    mensajeVacio: 'Elige un video (MOV, MKV, AVI, WebM, WMV, FLV, 3GP…).',
    comando({ archivos, infos }) {
      const base = S.nombreBase(archivos[0].name, 'video');
      const ext = M.extension(archivos[0].name);
      return {
        args: async (e, ayudas) => {
          const log = await ayudas.info(0);
          const h264 = /Video: h264/.test(log);
          const audioOk = !/Stream #\d+:\d+.*: Audio/.test(log) || /Audio: (aac|mp3)/.test(log);
          if (rapido.checked && h264 && audioOk) {
            usado = 'copia';
            return ['-i', e[0], '-map', '0:v:0', '-map', '0:a:0?', '-c', 'copy', '-movflags', '+faststart', 'salida.mp4'];
          }
          usado = 'recodificado';
          return ['-i', e[0], '-map', '0:v:0', '-map', '0:a:0?', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', calidad.value, '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', 'salida.mp4'];
        },
        salida: 'salida.mp4',
        mime: 'video/mp4',
        nombre: ext === 'mp4' ? `${base}-convertido.mp4` : `${base}.mp4`,
        duracion: infos[0].duracion,
        aviso: () => (usado === 'copia'
          ? 'El video ya usaba H.264 con audio compatible: solo se cambió el contenedor a MP4, sin recodificar ni perder calidad.'
          : 'Se recodificó a H.264 + AAC para que se reproduzca en cualquier dispositivo.'),
      };
    },
  });
})();
