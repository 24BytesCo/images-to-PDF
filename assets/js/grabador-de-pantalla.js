/* Grabador de pantalla: getDisplayMedia + MediaRecorder; el MP4 se genera con ffmpeg.wasm. */
(function () {
  'use strict';
  const M = window.FFmpegMotor;
  const S = window.Suite;
  M.inyectarEstilos();
  const $ = (id) => document.getElementById(id);
  const btnGrabar = $('grabar');
  const btnParar = $('detener');
  const elTiempo = $('tiempo');
  const elError = $('errorGrabadora');
  const bloque = $('resultado');
  const previa = $('previa');
  const btnMp4 = $('convertir');
  const btnOriginal = $('descargarOriginal');
  const chkSistema = $('sistema');
  const chkMicro = $('micro');
  const calidad = $('calidad');
  const estadoConv = $('estadoConv');
  const salida = $('salida');
  const aviso = $('avisoPantalla');

  let flujo = null;
  let extra = null;
  let ctx = null;
  let grabador = null;
  let trozos = [];
  let blobGrabado = null;
  let urlPrevia = null;
  let reloj = null;
  let inicio = 0;
  let duracion = 0;

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const falla = (t) => { elError.textContent = t; elError.hidden = !t; };

  const soportado = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia && window.MediaRecorder);
  if (!soportado) {
    falla('Este navegador no puede grabar la pantalla (en celulares casi ninguno puede). Usa Chrome, Edge o Firefox en un computador.');
    btnGrabar.disabled = true;
  }

  const elegirMime = () => {
    const c = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    return c.find((m) => MediaRecorder.isTypeSupported(m)) || '';
  };

  const liberar = () => {
    clearInterval(reloj);
    [flujo, extra].forEach((f) => f && f.getTracks().forEach((t) => t.stop()));
    if (ctx) { try { ctx.close(); } catch (_) { /* ya cerrado */ } }
    flujo = null;
    extra = null;
    ctx = null;
  };

  const pintarBotones = (grabando) => {
    btnGrabar.hidden = grabando;
    btnParar.hidden = !grabando;
    chkSistema.disabled = grabando;
    chkMicro.disabled = grabando;
  };

  const detener = () => {
    if (grabador && grabador.state !== 'inactive') grabador.stop();
  };

  const grabar = async () => {
    falla('');
    let pantalla;
    try {
      pantalla = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: chkSistema.checked });
    } catch (error) {
      falla(error && error.name === 'NotAllowedError'
        ? 'No elegiste qué compartir (o el navegador lo bloqueó). Pulsa Grabar y escoge una pantalla, ventana o pestaña.'
        : 'No se pudo iniciar la captura de pantalla en este navegador.');
      return;
    }
    let pistas = [...pantalla.getVideoTracks()];
    const audios = [];
    if (pantalla.getAudioTracks().length) audios.push(new MediaStream(pantalla.getAudioTracks()));
    if (chkMicro.checked) {
      try {
        extra = await navigator.mediaDevices.getUserMedia({ audio: true });
        audios.push(extra);
      } catch (_) {
        aviso.textContent = 'No se pudo usar el micrófono (sin permiso o sin dispositivo): se graba sin él.';
        aviso.hidden = false;
      }
    }
    if (audios.length === 1) {
      pistas = pistas.concat(audios[0].getAudioTracks());
    } else if (audios.length > 1) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const destino = ctx.createMediaStreamDestination();
      audios.forEach((a) => ctx.createMediaStreamSource(a).connect(destino));
      pistas = pistas.concat(destino.stream.getAudioTracks());
    }
    flujo = pantalla;
    const entrada = new MediaStream(pistas);
    pantalla.getVideoTracks()[0].addEventListener('ended', detener);
    if (blobGrabado) { blobGrabado = null; bloque.hidden = true; salida.textContent = ''; }
    trozos = [];
    const mime = elegirMime();
    grabador = new MediaRecorder(entrada, mime ? { mimeType: mime } : undefined);
    grabador.ondataavailable = (ev) => { if (ev.data && ev.data.size) trozos.push(ev.data); };
    grabador.onstop = () => {
      duracion = (Date.now() - inicio) / 1000;
      liberar();
      blobGrabado = new Blob(trozos, { type: grabador.mimeType || mime || 'video/webm' });
      if (urlPrevia) URL.revokeObjectURL(urlPrevia);
      urlPrevia = URL.createObjectURL(blobGrabado);
      previa.src = urlPrevia;
      bloque.hidden = false;
      elTiempo.textContent = fmt(duracion);
      pintarBotones(false);
    };
    inicio = Date.now();
    grabador.start(500);
    reloj = setInterval(() => { elTiempo.textContent = fmt((Date.now() - inicio) / 1000); }, 250);
    pintarBotones(true);
  };

  const nombre = () => {
    const d = new Date();
    const z = (n) => String(n).padStart(2, '0');
    return `pantalla-${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}`;
  };
  const extensionDe = (mime) => (/mp4/.test(mime) ? 'mp4' : 'webm');

  const convertir = async () => {
    if (!blobGrabado) return;
    falla('');
    btnMp4.disabled = true;
    estadoConv.hidden = false;
    const archivo = new File([blobGrabado], `grabacion.${extensionDe(blobGrabado.type)}`, { type: blobGrabado.type });
    const crf = calidad.value;
    try {
      const mp4 = await M.ejecutar({
        archivos: [archivo],
        args: async (e, ayudas) => {
          const audio = await ayudas.tieneAudio(0);
          return ['-i', e[0], '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', crf,
            '-pix_fmt', 'yuv420p', ...(audio ? ['-c:a', 'aac', '-b:a', '128k'] : ['-an']), '-movflags', '+faststart', 'salida.mp4'];
        },
        salida: 'salida.mp4',
        mime: 'video/mp4',
        duracion,
        alEstado: (t) => { estadoConv.textContent = t; },
        alProgreso: (f) => { estadoConv.textContent = `Convirtiendo a MP4… ${Math.round(f * 100)} %`; },
      });
      estadoConv.textContent = `Listo: ${S.tamano(mp4.size)}`;
      salida.textContent = '';
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'boton';
      b.id = 'descargar';
      b.textContent = 'Descargar MP4';
      b.addEventListener('click', () => S.descargar(mp4, `${nombre()}.mp4`, 'video/mp4'));
      salida.appendChild(b);
      S.aviso('MP4 listo. Pulsa Descargar MP4.', 'ok');
    } catch (error) {
      console.warn('Grabador:', error);
      falla(error.codigo ? error.message : 'No se pudo convertir la grabación a MP4. Descarga el original (WebM) e inténtalo de nuevo.');
      estadoConv.hidden = true;
    } finally {
      btnMp4.disabled = false;
    }
  };

  btnGrabar.addEventListener('click', grabar);
  btnParar.addEventListener('click', detener);
  btnMp4.addEventListener('click', convertir);
  btnOriginal.addEventListener('click', () => {
    if (blobGrabado) S.descargar(blobGrabado, `${nombre()}.${extensionDe(blobGrabado.type)}`, blobGrabado.type);
  });
  pintarBotones(false);
})();
