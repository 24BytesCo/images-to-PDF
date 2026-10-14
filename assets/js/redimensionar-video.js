/* Cambiar la proporción (9:16, 1:1, 4:5, 16:9) o el tamaño de un video, con fondo desenfocado, barras o recorte. */
(function () {
  'use strict';
  const M = window.FFmpegMotor;
  const S = window.Suite;
  const proporcion = document.getElementById('proporcion');
  const ajuste = document.getElementById('ajuste');
  const lado = document.getElementById('lado');
  const campoAjuste = document.getElementById('campoAjuste');
  const par = (n) => Math.max(2, Math.round(n / 2) * 2);

  const RAZON = { vertical: [9, 16], cuadrado: [1, 1], retrato: [4, 5], horizontal: [16, 9] };
  const mostrar = () => { campoAjuste.hidden = proporcion.value === 'igual'; };
  proporcion.addEventListener('change', mostrar);
  mostrar();

  M.montar({
    aceptar: M.esVideo,
    comparar: true,
    mensajeVacio: 'Elige un video (MP4, MOV, WebM, MKV…).',
    comando({ archivos, infos }) {
      const corto = Number(lado.value);
      let vf;
      let etiqueta;
      if (proporcion.value === 'igual') {
        vf = `scale=w='if(gt(iw,ih),-2,min(${corto},iw))':h='if(gt(iw,ih),min(${corto},ih),-2)'`;
        etiqueta = `${corto}p`;
      } else {
        const [rw, rh] = RAZON[proporcion.value];
        // El lado corto del lienzo mide «corto»; el largo sale de la proporción.
        const w = rw <= rh ? corto : par((corto * rw) / rh);
        const h = rw <= rh ? par((corto * rh) / rw) : corto;
        etiqueta = `${rw}x${rh}`;
        if (ajuste.value === 'recortar') {
          vf = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1`;
        } else if (ajuste.value === 'barras') {
          vf = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`;
        } else {
          vf = `split[a][b];[a]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},boxblur=20:4[f];`
            + `[b]scale=${w}:${h}:force_original_aspect_ratio=decrease[p];[f][p]overlay=(W-w)/2:(H-h)/2,setsar=1`;
        }
      }
      return {
        args: (e) => ['-i', e[0], '-map', '0:v:0', '-map', '0:a:0?', '-vf', vf,
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
          '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', 'salida.mp4'],
        salida: 'salida.mp4',
        mime: 'video/mp4',
        nombre: `${S.nombreBase(archivos[0].name, 'video')}-${etiqueta}.mp4`,
        duracion: infos[0].duracion,
        aviso: () => (infos[0].duracion > 300
          ? 'Con un video largo el fondo desenfocado tarda bastante en el navegador; si hace falta, elige «barras» o «recortar», que son más rápidas.'
          : ''),
      };
    },
  });
})();
