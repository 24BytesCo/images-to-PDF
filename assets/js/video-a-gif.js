/* Video a GIF animado con ffmpeg.wasm (paleta propia para que los colores no se vean sucios). */
(function () {
  'use strict';
  const M = window.FFmpegMotor;
  const S = window.Suite;
  const desde = document.getElementById('desde');
  const duracion = document.getElementById('duracion');
  const ancho = document.getElementById('ancho');
  const fps = document.getElementById('fps');
  const MAX = 30;
  const num = (el) => Number(String(el.value).replace(',', '.'));

  M.montar({
    aceptar: M.esVideo,
    comparar: true,
    mensajeVacio: 'Elige un video (MP4, MOV, WebM, MKV…).',
    alElegir(estado) {
      const d = estado.infos[0].duracion;
      desde.value = '0';
      duracion.value = String(d ? Math.min(5, Math.round(d * 10) / 10) : 5);
    },
    validar({ infos }) {
      const a = num(desde);
      const d = num(duracion);
      if (!Number.isFinite(a) || a < 0) return 'El inicio debe ser un número de segundos desde 0.';
      if (!Number.isFinite(d) || d <= 0) return 'La duración del GIF debe ser mayor que 0.';
      if (d > MAX) return `Un GIF de más de ${MAX} segundos sale enorme. Elige un tramo más corto (máximo ${MAX} s).`;
      const total = infos[0].duracion;
      if (total && a >= total) return `El inicio (${a} s) pasa de la duración del video (${Math.round(total * 10) / 10} s).`;
      return null;
    },
    comando({ archivos }) {
      const d = num(duracion);
      const filtro = `fps=${fps.value},scale=${ancho.value}:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse`;
      return {
        args: (e) => ['-ss', String(num(desde)), '-t', String(d), '-i', e[0], '-an', '-vf', filtro, '-loop', '0', 'salida.gif'],
        salida: 'salida.gif',
        mime: 'image/gif',
        nombre: `${S.nombreBase(archivos[0].name, 'video')}.gif`,
        duracion: d,
        aviso: (nuevo) => (nuevo > 10 * 1024 * 1024
          ? 'Este GIF pesa más de 10 MB y muchas apps no lo aceptan. Baja el ancho, los cuadros por segundo o la duración.'
          : ''),
      };
    },
  });
})();
