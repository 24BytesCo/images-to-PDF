/* Comprimir video (H.264 + AAC en MP4) con ffmpeg.wasm.
   Dos modos: por nivel de compresión, o por tamaño objetivo (a X MB para WhatsApp, Discord, correo). */
(function () {
  'use strict';
  const M = window.FFmpegMotor;
  const S = window.Suite;
  const nivel = document.getElementById('nivel');
  const resolucion = document.getElementById('resolucion');
  const aviso = document.getElementById('avisoLargo');
  const modo = document.getElementById('modo');
  const destino = document.getElementById('destino');
  const objetivo = document.getElementById('objetivoMb');
  const camposNivel = document.getElementById('camposNivel');
  const camposObjetivo = document.getElementById('camposObjetivo');
  const campoMb = document.getElementById('campoMb');
  const num = (el) => Number(String(el.value).replace(',', '.'));
  const AUDIO_KBPS = 64;

  const mostrar = () => {
    const porTamano = modo.value === 'objetivo';
    camposNivel.hidden = porTamano;
    camposObjetivo.hidden = !porTamano;
    campoMb.hidden = destino.value !== 'otro';
  };
  modo.addEventListener('change', mostrar);
  destino.addEventListener('change', mostrar);
  mostrar();

  const mb = () => (destino.value === 'otro' ? num(objetivo) : Number(destino.value));

  /** Bitrate de video (kbps) para que el archivo quepa en `mbObjetivo`, con 7 % de margen por contenedor. */
  const kbpsVideo = (mbObjetivo, segundos) => {
    const bitsTotales = mbObjetivo * 1024 * 1024 * 8 * 0.93;
    return Math.floor(bitsTotales / segundos / 1000 - AUDIO_KBPS);
  };

  M.montar({
    aceptar: M.esVideo,
    comparar: true,
    mensajeVacio: 'Elige un video (MP4, MOV, WebM, MKV, AVI…).',
    alElegir(estado) {
      const d = estado.infos[0].duracion;
      aviso.hidden = !(d && d > 300);
    },
    validar({ infos }) {
      if (modo.value !== 'objetivo') return null;
      const d = infos[0].duracion;
      const m = mb();
      if (!Number.isFinite(m) || m < 0.5) return 'Escribe un tamaño objetivo de al menos 0,5 MB.';
      if (!d) return 'No pude leer la duración de este video; sin ella no se puede calcular el tamaño objetivo. Usa el modo por nivel.';
      const k = kbpsVideo(m, d);
      if (k < 60) {
        const minimo = Math.ceil(((60 + AUDIO_KBPS) * 1000 * d) / 8 / 1024 / 1024 / 0.93);
        return `Para ${m} MB este video (${Math.round(d)} s) quedaría con una calidad inservible. Necesita al menos ~${minimo} MB, o recórtalo antes.`;
      }
      return null;
    },
    comando({ archivos, infos }) {
      const d = infos[0].duracion;
      const base = S.nombreBase(archivos[0].name, 'video');
      if (modo.value === 'objetivo') {
        const m = mb();
        const k = kbpsVideo(m, d);
        // A poco bitrate, menos resolución: así se ve mejor que estirar pocos bits sobre 1080 p.
        const alto = k < 250 ? 360 : k < 600 ? 480 : k < 1500 ? 720 : 1080;
        return {
          args: (e) => ['-i', e[0], '-vf', `scale=-2:'min(${alto},ih)'`, '-c:v', 'libx264', '-preset', 'veryfast',
            '-b:v', `${k}k`, '-maxrate', `${Math.round(k * 1.4)}k`, '-bufsize', `${k * 2}k`, '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', '-b:a', `${AUDIO_KBPS}k`, '-ac', '2', '-movflags', '+faststart', 'salida.mp4'],
          salida: 'salida.mp4',
          mime: 'video/mp4',
          nombre: `${base}-${String(m).replace('.', ',')}mb.mp4`,
          duracion: d,
          aviso: (nuevo, antes) => {
            const tope = m * 1024 * 1024;
            if (nuevo > tope) {
              return `Quedó en ${S.tamano(nuevo)}, un poco por encima de los ${m} MB pedidos (el cálculo de un solo paso no es exacto). Repite con un objetivo ~10 % menor.`;
            }
            return antes <= tope
              ? `Ojo: el original ya pesaba ${S.tamano(antes)}, dentro del objetivo. Puedes conservarlo tal cual.`
              : `Cabe en ${m} MB (calidad ajustada a ${alto} p).`;
          },
        };
      }
      const h = Number(resolucion.value);
      const vf = h ? `scale=-2:'min(${h},ih)'` : 'scale=trunc(iw/2)*2:trunc(ih/2)*2';
      return {
        args: (e) => ['-i', e[0], '-vf', vf, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', nivel.value,
          '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', 'salida.mp4'],
        salida: 'salida.mp4',
        mime: 'video/mp4',
        nombre: `${base}-comprimido.mp4`,
        duracion: d,
        aviso: (nuevo, antes) => (nuevo >= antes
          ? 'El resultado no pesa menos que el original: ese video ya venía muy comprimido. Prueba con compresión fuerte o una resolución menor, o conserva el original.'
          : ''),
      };
    },
  });
})();
