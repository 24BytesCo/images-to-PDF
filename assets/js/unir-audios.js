/* Unir varios audios en un solo MP3 con ffmpeg.wasm, en el orden de la lista. */
(function () {
  'use strict';
  const M = window.FFmpegMotor;
  const S = window.Suite;
  const lista = document.getElementById('lista');

  const pintarLista = (estado, repintar) => {
    lista.textContent = '';
    estado.archivos.forEach((f, i) => {
      const fila = document.createElement('div');
      fila.className = 'lista-item';
      fila.style.cursor = 'default';
      const nombre = document.createElement('span');
      nombre.className = 'lista-nombre';
      nombre.textContent = `${i + 1}. ${f.name}`;
      const meta = document.createElement('span');
      meta.className = 'lista-meta';
      const d = estado.infos[i].duracion;
      meta.textContent = `${S.tamano(f.size)}${d ? ` · ${M.tiempo(d)}` : ''}`;
      fila.append(nombre, meta);
      const mover = (texto, etiqueta, delta) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'quitar';
        b.textContent = texto;
        b.setAttribute('aria-label', `${etiqueta} ${f.name}`);
        b.disabled = i + delta < 0 || i + delta >= estado.archivos.length;
        b.addEventListener('click', () => {
          [estado.archivos[i], estado.archivos[i + delta]] = [estado.archivos[i + delta], estado.archivos[i]];
          [estado.infos[i], estado.infos[i + delta]] = [estado.infos[i + delta], estado.infos[i]];
          repintar();
        });
        return b;
      };
      const quitar = document.createElement('button');
      quitar.type = 'button';
      quitar.className = 'quitar';
      quitar.textContent = '×';
      quitar.setAttribute('aria-label', `Quitar ${f.name}`);
      quitar.addEventListener('click', () => {
        estado.archivos.splice(i, 1);
        estado.infos.splice(i, 1);
        repintar();
      });
      fila.append(mover('↑', 'Subir', -1), mover('↓', 'Bajar', 1), quitar);
      lista.appendChild(fila);
    });
  };

  M.montar({
    multiple: true,
    aceptar: M.esMedio,
    mensajeVacio: 'Elige archivos de audio (MP3, WAV, M4A, OGG, FLAC…).',
    pintarLista,
    validar({ archivos }) {
      if (archivos.length < 2) return 'Añade al menos dos audios para unirlos.';
      const total = archivos.reduce((s, f) => s + f.size, 0);
      if (total > (window.FFMPEG_TOPE_MB || 500) * 1024 * 1024) {
        return `Entre todos pesan ${S.tamano(total)}, más que el tope de la herramienta. Quita alguno o recórtalos antes.`;
      }
      return null;
    },
    comando({ archivos, infos }) {
      const n = archivos.length;
      // Cada pista se normaliza (44,1 kHz, estéreo) para que concat acepte orígenes distintos.
      const norm = archivos.map((_, i) => `[${i}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}]`);
      const union = `${archivos.map((_, i) => `[a${i}]`).join('')}concat=n=${n}:v=0:a=1[salida]`;
      return {
        args: (e) => [...e.flatMap((x) => ['-i', x]), '-filter_complex', `${norm.join(';')};${union}`,
          '-map', '[salida]', '-c:a', 'libmp3lame', '-b:a', '192k', 'unido.mp3'],
        salida: 'unido.mp3',
        mime: 'audio/mpeg',
        nombre: 'audios-unidos.mp3',
        duracion: infos.reduce((s, i) => s + (i.duracion || 0), 0),
      };
    },
  });
})();
