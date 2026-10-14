/* Subir, bajar o normalizar el volumen de un audio con ffmpeg.wasm. */
(function () {
  'use strict';
  const M = window.FFmpegMotor;
  const S = window.Suite;
  const modo = document.getElementById('modo');
  const db = document.getElementById('db');
  const campoDb = document.getElementById('campoDb');
  const formato = document.getElementById('formato');
  const num = (el) => Number(String(el.value).replace(',', '.'));

  const mostrar = () => { campoDb.hidden = modo.value !== 'ganancia'; };
  modo.addEventListener('change', mostrar);
  mostrar();

  const FORMATOS = {
    mp3: { codec: ['-c:a', 'libmp3lame', '-b:a', '192k'], mime: 'audio/mpeg' },
    wav: { codec: ['-c:a', 'pcm_s16le'], mime: 'audio/wav' },
  };

  M.montar({
    aceptar: M.esMedio,
    mensajeVacio: 'Elige un audio (MP3, WAV, M4A, OGG…) o un video.',
    validar() {
      if (modo.value === 'ganancia') {
        const g = num(db);
        if (!Number.isFinite(g) || g === 0) return 'Escribe cuántos dB subir (número positivo) o bajar (negativo).';
        if (g < -40 || g > 30) return 'Usa un valor entre -40 y +30 dB.';
      }
      return null;
    },
    comando({ archivos, infos }) {
      const f = FORMATOS[formato.value];
      const g = num(db);
      // Normalizar: loudnorm trabaja a 192 kHz internamente, de ahí el aresample final.
      const filtro = modo.value === 'normalizar'
        ? 'loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100'
        : `volume=${g}dB${g > 0 ? ',alimiter=limit=0.97' : ''}`;
      const salida = `salida.${formato.value}`;
      return {
        args: (e) => ['-i', e[0], '-vn', '-af', filtro, ...f.codec, salida],
        salida,
        mime: f.mime,
        nombre: `${S.nombreBase(archivos[0].name, 'audio')}-${modo.value === 'normalizar' ? 'normalizado' : 'volumen'}.${formato.value}`,
        duracion: infos[0].duracion,
        aviso: () => (modo.value === 'ganancia' && g > 0
          ? 'Se añadió un limitador para que los picos no saturen. Si suena aplastado, sube menos dB.'
          : ''),
      };
    },
  });
})();
