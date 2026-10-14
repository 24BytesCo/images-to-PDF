/* Grabadora de voz: MediaRecorder graba en el navegador; el MP3 se genera con ffmpeg.wasm. */
(function () {
  'use strict';
  const M = window.FFmpegMotor;
  const S = window.Suite;
  M.inyectarEstilos();
  const $ = (id) => document.getElementById(id);
  const btnGrabar = $('grabar');
  const btnPausa = $('pausar');
  const btnParar = $('detener');
  const elTiempo = $('tiempo');
  const medidor = $('nivel');
  const elError = $('errorGrabadora');
  const bloqueResultado = $('resultado');
  const previa = $('previa');
  const btnMp3 = $('convertir');
  const btnOriginal = $('descargarOriginal');
  const calidad = $('calidad');
  const limpiar = $('limpiarAudio');
  const estadoConv = $('estadoConv');
  const salida = $('salida');

  let flujo = null;
  let grabador = null;
  let trozos = [];
  let blobGrabado = null;
  let urlPrevia = null;
  let reloj = null;
  let acumulado = 0;
  let inicioTramo = 0;
  let ctxAudio = null;
  let raf = 0;

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const falla = (t) => { elError.textContent = t; elError.hidden = !t; };
  const transcurrido = () => acumulado + (grabador && grabador.state === 'recording' ? (Date.now() - inicioTramo) / 1000 : 0);

  const elegirMime = () => {
    const c = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    return c.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
  };

  const liberar = () => {
    cancelAnimationFrame(raf);
    clearInterval(reloj);
    if (flujo) flujo.getTracks().forEach((t) => t.stop());
    if (ctxAudio) { try { ctxAudio.close(); } catch (_) { /* ya cerrado */ } }
    flujo = null;
    ctxAudio = null;
    medidor.value = 0;
  };

  const pintarBotones = (estado) => {
    btnGrabar.hidden = estado !== 'reposo';
    btnPausa.hidden = estado === 'reposo';
    btnParar.hidden = estado === 'reposo';
    btnPausa.textContent = estado === 'pausado' ? 'Reanudar' : 'Pausar';
  };

  const iniciarMedidor = () => {
    ctxAudio = new (window.AudioContext || window.webkitAudioContext)();
    const an = ctxAudio.createAnalyser();
    an.fftSize = 512;
    ctxAudio.createMediaStreamSource(flujo).connect(an);
    const datos = new Uint8Array(an.fftSize);
    const paso = () => {
      an.getByteTimeDomainData(datos);
      let pico = 0;
      for (const v of datos) pico = Math.max(pico, Math.abs(v - 128));
      medidor.value = Math.min(100, Math.round((pico / 128) * 140));
      raf = requestAnimationFrame(paso);
    };
    paso();
  };

  const grabar = async () => {
    falla('');
    if (!window.MediaRecorder || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      falla('Este navegador no permite grabar audio. Prueba con una versión reciente de Chrome, Edge, Firefox o Safari.');
      return;
    }
    try {
      flujo = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: limpiar.checked, noiseSuppression: limpiar.checked, autoGainControl: limpiar.checked },
      });
    } catch (error) {
      const nombre = error && error.name;
      falla(nombre === 'NotFoundError'
        ? 'No se encontró ningún micrófono conectado.'
        : 'No hay permiso para usar el micrófono. Permítelo en el candado de la barra de direcciones y vuelve a intentarlo.');
      return;
    }
    if (blobGrabado) { blobGrabado = null; bloqueResultado.hidden = true; salida.textContent = ''; }
    trozos = [];
    const mime = elegirMime();
    grabador = new MediaRecorder(flujo, mime ? { mimeType: mime } : undefined);
    grabador.ondataavailable = (ev) => { if (ev.data && ev.data.size) trozos.push(ev.data); };
    grabador.onstop = () => {
      acumulado = transcurrido();
      const total = acumulado;
      liberar();
      blobGrabado = new Blob(trozos, { type: grabador.mimeType || mime || 'audio/webm' });
      if (urlPrevia) URL.revokeObjectURL(urlPrevia);
      urlPrevia = URL.createObjectURL(blobGrabado);
      previa.src = urlPrevia;
      bloqueResultado.hidden = false;
      elTiempo.textContent = fmt(total);
      pintarBotones('reposo');
      bloqueResultado.dataset.duracion = String(total);
    };
    acumulado = 0;
    inicioTramo = Date.now();
    grabador.start(250);
    iniciarMedidor();
    reloj = setInterval(() => { elTiempo.textContent = fmt(transcurrido()); }, 250);
    pintarBotones('grabando');
  };

  const pausar = () => {
    if (!grabador) return;
    if (grabador.state === 'recording') {
      acumulado = transcurrido();
      grabador.pause();
      pintarBotones('pausado');
    } else if (grabador.state === 'paused') {
      inicioTramo = Date.now();
      grabador.resume();
      pintarBotones('grabando');
    }
  };

  const parar = () => {
    if (grabador && grabador.state !== 'inactive') {
      if (grabador.state === 'recording') acumulado = transcurrido();
      grabador.stop();
    }
  };

  const extensionDe = (mime) => (/mp4/.test(mime) ? 'm4a' : /ogg/.test(mime) ? 'ogg' : 'webm');

  const nombre = () => {
    const d = new Date();
    const z = (n) => String(n).padStart(2, '0');
    return `grabacion-${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}`;
  };

  const convertir = async () => {
    if (!blobGrabado) return;
    falla('');
    btnMp3.disabled = true;
    const ext = extensionDe(blobGrabado.type);
    const archivo = new File([blobGrabado], `grabacion.${ext}`, { type: blobGrabado.type });
    const kbps = calidad.value;
    const duracion = Number(bloqueResultado.dataset.duracion) || null;
    estadoConv.hidden = false;
    try {
      const mp3 = await M.ejecutar({
        archivos: [archivo],
        args: (e) => ['-i', e[0], '-vn', '-c:a', 'libmp3lame', '-b:a', `${kbps}k`, ...(kbps === '64' ? ['-ac', '1'] : []), 'salida.mp3'],
        salida: 'salida.mp3',
        mime: 'audio/mpeg',
        duracion,
        alEstado: (t) => { estadoConv.textContent = t; },
        alProgreso: (f) => { estadoConv.textContent = `Convirtiendo a MP3… ${Math.round(f * 100)} %`; },
      });
      estadoConv.textContent = `Listo: ${S.tamano(mp3.size)}`;
      salida.textContent = '';
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'boton';
      b.id = 'descargar';
      b.textContent = 'Descargar MP3';
      const nom = `${nombre()}.mp3`;
      b.addEventListener('click', () => S.descargar(mp3, nom, 'audio/mpeg'));
      salida.appendChild(b);
      S.aviso('MP3 listo. Pulsa Descargar MP3.', 'ok');
    } catch (error) {
      console.warn('Grabadora:', error);
      falla(error.codigo ? error.message : 'No se pudo convertir la grabación a MP3. Descarga el original e inténtalo de nuevo.');
      estadoConv.hidden = true;
    } finally {
      btnMp3.disabled = false;
    }
  };

  btnGrabar.addEventListener('click', grabar);
  btnPausa.addEventListener('click', pausar);
  btnParar.addEventListener('click', parar);
  btnMp3.addEventListener('click', convertir);
  btnOriginal.addEventListener('click', () => {
    if (blobGrabado) S.descargar(blobGrabado, `${nombre()}.${extensionDe(blobGrabado.type)}`, blobGrabado.type);
  });
  pintarBotones('reposo');
})();
