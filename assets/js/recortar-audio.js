/* Recortar audio con ffmpeg.wasm: marcar inicio y fin escuchando, o escribiendo los segundos. */
(function () {
  'use strict';
  const M = window.FFmpegMotor;
  const S = window.Suite;
  const inicio = document.getElementById('inicio');
  const fin = document.getElementById('fin');
  const formato = document.getElementById('formato');
  const previa = document.getElementById('previa');
  const tramo = document.getElementById('tramo');
  const MIME = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav', flac: 'audio/flac' };
  let urlPrevia = null;

  const num = (el) => Number(String(el.value).replace(',', '.'));
  const pintarTramo = () => {
    const d = num(fin) - num(inicio);
    tramo.textContent = d > 0 ? `Tramo: ${d.toLocaleString('es-CO', { maximumFractionDigits: 1 })} s` : 'Revisa inicio y fin';
  };

  const ctl = M.montar({
    aceptar: M.esMedio,
    mensajeVacio: 'Elige un archivo de audio (MP3, WAV, M4A, OGG, FLAC…) o un video.',
    alElegir(estado) {
      if (urlPrevia) URL.revokeObjectURL(urlPrevia);
      urlPrevia = URL.createObjectURL(estado.archivos[0]);
      previa.src = urlPrevia;
      previa.hidden = false;
      const d = estado.infos[0].duracion;
      inicio.value = '0';
      fin.value = d ? String(Math.round(d * 10) / 10) : '';
      pintarTramo();
    },
    validar({ infos }) {
      const a = num(inicio);
      const b = num(fin);
      const d = infos[0].duracion;
      if (!Number.isFinite(a) || a < 0) return 'El inicio debe ser un número de segundos desde 0.';
      if (!Number.isFinite(b) || b <= a) return 'El fin debe ser mayor que el inicio.';
      if (d && b > d + 0.2) return `El fin (${b} s) pasa de la duración del audio (${Math.round(d * 10) / 10} s).`;
      return null;
    },
    comando({ archivos }) {
      const a = num(inicio);
      const d = num(fin) - a;
      const ext = M.extension(archivos[0].name);
      const igual = formato.value === 'igual' && M.esAudio(archivos[0]) && MIME[ext] && !/^video\//.test(archivos[0].type);
      const salidaExt = igual ? ext : 'mp3';
      const salida = `salida.${salidaExt}`;
      const codec = igual ? ['-c', 'copy'] : ['-c:a', 'libmp3lame', '-b:a', '192k'];
      return {
        args: (e) => ['-ss', String(a), '-t', String(d), '-i', e[0], '-vn', ...codec, salida],
        salida,
        mime: MIME[salidaExt],
        nombre: `${S.nombreBase(archivos[0].name, 'audio')}-recorte.${salidaExt}`,
        duracion: d,
      };
    },
  });

  document.getElementById('marcarInicio').addEventListener('click', () => {
    inicio.value = String(Math.round(previa.currentTime * 10) / 10);
    pintarTramo();
  });
  document.getElementById('marcarFin').addEventListener('click', () => {
    fin.value = String(Math.round(previa.currentTime * 10) / 10);
    pintarTramo();
  });
  [inicio, fin].forEach((el) => el.addEventListener('input', pintarTramo));
  document.getElementById('vaciar').addEventListener('click', () => {
    previa.removeAttribute('src');
    previa.hidden = true;
    ctl.mostrarError('');
  });
})();
