/* Extraer fotogramas de un video a JPG: uno en un instante, o uno cada N segundos en un ZIP. */
(function () {
  'use strict';
  const M = window.FFmpegMotor;
  const S = window.Suite;
  const modo = document.getElementById('modo');
  const instante = document.getElementById('instante');
  const cada = document.getElementById('cada');
  const desde = document.getElementById('desde');
  const hasta = document.getElementById('hasta');
  const calidad = document.getElementById('calidad');
  const previa = document.getElementById('previa');
  const campoUno = document.getElementById('campoUno');
  const campoVarios = document.getElementById('campoVarios');
  const MAX_FOTOGRAMAS = 150;
  let urlPrevia = null;

  const num = (el) => Number(String(el.value).replace(',', '.'));
  const redondear = (x) => Math.round(x * 10) / 10;
  const mostrar = () => {
    campoUno.hidden = modo.value !== 'uno';
    campoVarios.hidden = modo.value !== 'varios';
  };
  modo.addEventListener('change', mostrar);
  mostrar();

  const cargarJSZip = () => new Promise((ok, mal) => {
    if (window.JSZip) { ok(); return; }
    const s = document.createElement('script');
    s.src = '../assets/vendor/jszip.min.js';
    s.onload = ok;
    s.onerror = () => mal(new Error('No se pudo cargar el compresor ZIP.'));
    document.head.appendChild(s);
  });

  const ctl = M.montar({
    aceptar: M.esVideo,
    mensajeVacio: 'Elige un video (MP4, MOV, WebM, MKV…).',
    alElegir(estado) {
      if (urlPrevia) URL.revokeObjectURL(urlPrevia);
      urlPrevia = URL.createObjectURL(estado.archivos[0]);
      previa.src = urlPrevia;
      previa.hidden = false;
      const d = estado.infos[0].duracion;
      instante.value = '0';
      desde.value = '0';
      hasta.value = d ? String(redondear(d)) : '';
    },
    validar({ infos }) {
      const d = infos[0].duracion;
      if (modo.value === 'uno') {
        const t = num(instante);
        if (!Number.isFinite(t) || t < 0) return 'El instante debe ser un número de segundos desde 0.';
        if (d && t > d) return `El instante (${t} s) pasa de la duración del video (${redondear(d)} s).`;
        return null;
      }
      const a = num(desde);
      const b = num(hasta);
      const n = num(cada);
      if (!Number.isFinite(n) || n < 0.1) return 'Escribe cada cuántos segundos sacar un fotograma (mínimo 0,1).';
      if (!Number.isFinite(a) || a < 0 || !Number.isFinite(b) || b <= a) return 'Revisa «desde» y «hasta»: el segundo debe ser mayor.';
      if (d && b > d + 0.2) return `«Hasta» (${b} s) pasa de la duración del video (${redondear(d)} s).`;
      const cuantos = Math.floor((b - a) / n) + 1;
      if (cuantos > MAX_FOTOGRAMAS) return `Eso son ${cuantos} fotogramas; el máximo es ${MAX_FOTOGRAMAS}. Sube el intervalo o acorta el tramo.`;
      return null;
    },
    comando({ archivos }) {
      const base = S.nombreBase(archivos[0].name, 'video');
      const q = calidad.value;
      if (modo.value === 'uno') {
        const t = num(instante);
        return {
          args: (e) => ['-ss', String(t), '-i', e[0], '-an', '-frames:v', '1', '-q:v', q, '-update', '1', 'foto.jpg'],
          salida: 'foto.jpg',
          mime: 'image/jpeg',
          nombre: `${base}-${String(t).replace('.', ',')}s.jpg`,
        };
      }
      const a = num(desde);
      const d = num(hasta) - a;
      const n = num(cada);
      const hechos = [];
      return {
        args: async (e) => {
          await cargarJSZip();
          return ['-ss', String(a), '-t', String(d), '-i', e[0], '-an', '-vf', `select='isnan(prev_selected_t)+gte(t-prev_selected_t,${n})'`, '-vsync', '0', '-q:v', q, 'cuadro-%03d.jpg'];
        },
        salida: 'cuadro-001.jpg',
        mime: 'application/zip',
        nombre: `${base}-fotogramas.zip`,
        duracion: d,
        limpiar: hechos,
        async recoger(ff) {
          const nombres = (await ff.listDir('/'))
            .map((x) => x.name)
            .filter((x) => /^cuadro-\d+\.jpg$/.test(x))
            .sort();
          if (!nombres.length) throw Object.assign(new Error('No se pudo sacar ningún fotograma de ese tramo.'), { codigo: 'ffmpeg' });
          const zip = new window.JSZip();
          for (const nombre of nombres) {
            zip.file(`${base}-${nombre.slice(7)}`, await ff.readFile(nombre));
            hechos.push(nombre);
          }
          const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
          for (const nombre of nombres) { try { await ff.deleteFile(nombre); } catch (_) { /* ya no está */ } }
          return blob;
        },
        aviso: () => 'El ZIP contiene un JPG por cada intervalo, numerados en orden.',
      };
    },
  });

  document.getElementById('marcarInstante').addEventListener('click', () => {
    instante.value = String(redondear(previa.currentTime));
  });
  document.getElementById('vaciar').addEventListener('click', () => {
    previa.removeAttribute('src');
    previa.hidden = true;
    ctl.mostrarError('');
  });
})();
