/* Recortar un video entre dos instantes: rápido (copiando) o preciso (recodificando). */
(function () {
  'use strict';
  const M = window.FFmpegMotor;
  const S = window.Suite;
  const inicio = document.getElementById('inicio');
  const fin = document.getElementById('fin');
  const modo = document.getElementById('modo');
  const previa = document.getElementById('previa');
  const tramo = document.getElementById('tramo');
  let urlPrevia = null;

  const num = (el) => Number(String(el.value).replace(',', '.'));
  const redondear = (x) => Math.round(x * 10) / 10;
  const pintarTramo = () => {
    const d = num(fin) - num(inicio);
    tramo.textContent = d > 0 ? `Tramo: ${d.toLocaleString('es-CO', { maximumFractionDigits: 1 })} s` : 'Revisa inicio y fin';
  };
  const COPIABLES = { mp4: 'mp4', m4v: 'mp4', mov: 'mp4', webm: 'webm', mkv: 'mkv' };
  const MIME = { mp4: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska' };

  const ctl = M.montar({
    aceptar: M.esVideo,
    comparar: true,
    mensajeVacio: 'Elige un video (MP4, MOV, WebM, MKV, AVI…).',
    alElegir(estado) {
      if (urlPrevia) URL.revokeObjectURL(urlPrevia);
      urlPrevia = URL.createObjectURL(estado.archivos[0]);
      previa.src = urlPrevia;
      previa.hidden = false;
      const d = estado.infos[0].duracion;
      inicio.value = '0';
      fin.value = d ? String(redondear(d)) : '';
      pintarTramo();
    },
    validar({ infos }) {
      const a = num(inicio);
      const b = num(fin);
      const d = infos[0].duracion;
      if (!Number.isFinite(a) || a < 0) return 'El inicio debe ser un número de segundos desde 0.';
      if (!Number.isFinite(b) || b <= a) return 'El fin debe ser mayor que el inicio.';
      if (d && b > d + 0.2) return `El fin (${b} s) pasa de la duración del video (${redondear(d)} s).`;
      return null;
    },
    comando({ archivos }) {
      const a = num(inicio);
      const d = redondear(num(fin) - a);
      const ext = M.extension(archivos[0].name);
      const copia = modo.value === 'rapido' && COPIABLES[ext];
      const base = S.nombreBase(archivos[0].name, 'video');
      if (copia) {
        const e2 = COPIABLES[ext];
        return {
          args: (e) => ['-ss', String(a), '-t', String(d), '-i', e[0], '-map', '0:v:0', '-map', '0:a:0?', '-c', 'copy',
            '-avoid_negative_ts', 'make_zero', `salida.${e2}`],
          salida: `salida.${e2}`,
          mime: MIME[e2],
          nombre: `${base}-recorte.${e2}`,
          duracion: d,
          aviso: () => 'Recorte rápido: el inicio se ajusta al fotograma clave anterior, así que puede haber hasta unos segundos de más al principio.',
        };
      }
      return {
        args: (e) => ['-ss', String(a), '-t', String(d), '-i', e[0], '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
          '-map', '0:v:0', '-map', '0:a:0?', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', 'salida.mp4'],
        salida: 'salida.mp4',
        mime: 'video/mp4',
        nombre: `${base}-recorte.mp4`,
        duracion: d,
        aviso: () => (modo.value === 'rapido'
          ? `Este formato (.${ext}) no admite el recorte rápido: se recortó con precisión y se guardó como MP4.`
          : ''),
      };
    },
  });

  document.getElementById('marcarInicio').addEventListener('click', () => {
    inicio.value = String(redondear(previa.currentTime));
    pintarTramo();
  });
  document.getElementById('marcarFin').addEventListener('click', () => {
    fin.value = String(redondear(previa.currentTime));
    pintarTramo();
  });
  [inicio, fin].forEach((el) => el.addEventListener('input', pintarTramo));
  document.getElementById('vaciar').addEventListener('click', () => {
    previa.removeAttribute('src');
    previa.hidden = true;
    ctl.mostrarError('');
  });
})();
