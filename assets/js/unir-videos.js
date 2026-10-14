/* Unir varios videos en uno solo (MP4), en el orden de la lista, normalizando tamaño, fps y audio. */
(function () {
  'use strict';
  const M = window.FFmpegMotor;
  const S = window.Suite;
  const lista = document.getElementById('lista');
  const tamano = document.getElementById('tamano');
  const MAX_VIDEOS = 10;

  const par = (n) => Math.max(2, Math.round(n / 2) * 2);

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
      const inf = estado.infos[i];
      meta.textContent = `${S.tamano(f.size)}${inf.duracion ? ` · ${M.tiempo(inf.duracion)}` : ''}${inf.ancho ? ` · ${inf.ancho}×${inf.alto}` : ''}`;
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
    aceptar: M.esVideo,
    mensajeVacio: 'Elige videos (MP4, MOV, WebM, MKV…).',
    pintarLista,
    validar({ archivos, infos }) {
      if (archivos.length < 2) return 'Añade al menos dos videos para unirlos.';
      if (archivos.length > MAX_VIDEOS) return `Son demasiados videos a la vez (máximo ${MAX_VIDEOS}): el navegador se queda sin memoria. Únelos en dos tandas.`;
      const total = archivos.reduce((s, f) => s + f.size, 0);
      if (total > M.topeBytes()) {
        return `Entre todos pesan ${S.tamano(total)}, más que el tope de la herramienta (${S.tamano(M.topeBytes())}). Quita alguno o comprímelos antes.`;
      }
      if (infos.some((i) => !i.duracion)) return 'No pude leer la duración de alguno de los videos. Revisa que no estén dañados.';
      return null;
    },
    comando({ archivos, infos }) {
      let w;
      let h;
      if (tamano.value === 'primero') {
        w = par(infos[0].ancho || 1280);
        h = par(infos[0].alto || 720);
        // Un 4K sería lento y pesado en wasm: se limita a 1080 p conservando la proporción.
        const k = Math.min(1, 1920 / Math.max(w, h), 1080 / Math.min(w, h));
        w = par(w * k);
        h = par(h * k);
      } else {
        [w, h] = tamano.value.split('x').map(Number);
      }
      const total = infos.reduce((s, i) => s + i.duracion, 0);
      return {
        args: async (e, ayudas) => {
          const partes = [];
          const pares = [];
          for (let i = 0; i < e.length; i++) {
            partes.push(`[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p[v${i}]`);
            if (await ayudas.tieneAudio(i)) {
              partes.push(`[${i}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo,asetpts=PTS-STARTPTS[a${i}]`);
            } else {
              // Sin pista de audio: se rellena con silencio de la misma duración para que concat no falle.
              partes.push(`anullsrc=r=44100:cl=stereo,atrim=duration=${infos[i].duracion},asetpts=PTS-STARTPTS[a${i}]`);
            }
            pares.push(`[v${i}][a${i}]`);
          }
          partes.push(`${pares.join('')}concat=n=${e.length}:v=1:a=1[v][a]`);
          return [...e.flatMap((x) => ['-i', x]), '-filter_complex', partes.join(';'), '-map', '[v]', '-map', '[a]',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k',
            '-movflags', '+faststart', 'unido.mp4'];
        },
        salida: 'unido.mp4',
        mime: 'video/mp4',
        nombre: 'videos-unidos.mp4',
        duracion: total,
      };
    },
  });
})();
