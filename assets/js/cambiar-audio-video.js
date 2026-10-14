/* Poner, cambiar o mezclar el audio de un video con otro audio (música, voz en off). */
(function () {
  'use strict';
  const M = window.FFmpegMotor;
  const S = window.Suite;
  const modo = document.getElementById('modo');
  const ajuste = document.getElementById('ajuste');
  const volumen = document.getElementById('volumen');
  const campoVolumen = document.getElementById('campoVolumen');
  const lista = document.getElementById('lista');
  let usado = '';

  const mostrar = () => { campoVolumen.hidden = modo.value !== 'mezclar'; };
  modo.addEventListener('change', mostrar);
  mostrar();

  const aceptar = (f) => M.esVideo(f) || M.esAudio(f);
  // Un archivo es «video» si es de video y no de audio; los mp4 sin imagen se tratan como video igualmente.
  const esSoloAudio = (f) => /^audio\//.test(f.type) || ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'flac', 'wma', 'amr'].includes(M.extension(f.name));

  const pintarLista = (estado) => {
    lista.textContent = '';
    const v = estado.archivos.filter((f) => !esSoloAudio(f));
    const a = estado.archivos.filter(esSoloAudio);
    [['Video', v], ['Audio nuevo', a]].forEach(([titulo, fs]) => {
      const fila = document.createElement('div');
      fila.className = 'lista-item';
      fila.style.cursor = 'default';
      const n = document.createElement('span');
      n.className = 'lista-nombre';
      n.textContent = `${titulo}: ${fs.length ? fs.map((f) => f.name).join(', ') : 'falta elegirlo'}`;
      fila.appendChild(n);
      lista.appendChild(fila);
    });
  };

  M.montar({
    multiple: true,
    aceptar,
    mensajeVacio: 'Elige un video y un archivo de audio (MP3, WAV, M4A…).',
    pintarLista,
    validar({ archivos }) {
      const v = archivos.filter((f) => !esSoloAudio(f));
      const a = archivos.filter(esSoloAudio);
      if (!v.length) return 'Falta el video. Añade un MP4, MOV, WebM o MKV.';
      if (!a.length) return 'Falta el audio nuevo. Añade un MP3, WAV o M4A.';
      if (v.length > 1 || a.length > 1) return 'Deja solo un video y un audio: quita los archivos que sobren con «Vaciar».';
      return null;
    },
    comando({ archivos, infos }) {
      const iv = archivos.findIndex((f) => !esSoloAudio(f));
      const ia = archivos.findIndex(esSoloAudio);
      const ext = M.extension(archivos[iv].name);
      const copiar = ['mp4', 'm4v', 'mov'].includes(ext);
      const vol = Number(volumen.value);
      return {
        args: async (e, ayudas) => {
          const tiene = await ayudas.tieneAudio(iv);
          const mezclar = modo.value === 'mezclar' && tiene;
          usado = modo.value === 'mezclar' && !tiene ? 'sin-original' : modo.value;
          const entradaAudio = ajuste.value === 'repetir' ? ['-stream_loop', '-1', '-i', e[ia]] : ['-i', e[ia]];
          const video = copiar
            ? ['-c:v', 'copy']
            : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2'];
          const cola = ['-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', 'salida.mp4'];
          if (mezclar) {
            return ['-i', e[iv], ...entradaAudio,
              '-filter_complex', `[1:a]volume=${vol}[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=0[a]`,
              '-map', '0:v:0', '-map', '[a]', ...video, ...cola];
          }
          return ['-i', e[iv], ...entradaAudio, '-map', '0:v:0', '-map', '1:a:0', ...video, ...cola];
        },
        salida: 'salida.mp4',
        mime: 'video/mp4',
        nombre: `${S.nombreBase(archivos[iv].name, 'video')}-nuevo-audio.mp4`,
        duracion: infos[iv].duracion,
        aviso: () => (usado === 'sin-original'
          ? 'El video no tenía audio propio, así que se añadió el nuevo tal cual (no había nada que mezclar).'
          : ''),
      };
    },
  });
})();
