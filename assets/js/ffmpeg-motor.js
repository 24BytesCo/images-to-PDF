/* Motor compartido de audio y video: ffmpeg.wasm (un solo hilo) con carga perezosa.
   - Los wrappers (@ffmpeg/ffmpeg 0.12.15) van en assets/vendor/ffmpeg/.
   - El núcleo (@ffmpeg/core 0.12.10, ~31 MB) NO va en el repo: se baja desde
     cdn.24bytes.pro/ffmpeg/0.12.10/ solo cuando alguien usa una herramienta.
   - Nada se sube: el archivo se procesa dentro del navegador.
   Para pruebas, window.CDN_FFMPEG (antes de cargar este script) cambia la URL del núcleo y
   window.FFMPEG_TOPE_MB el tope de tamaño. Producción no define ninguna. */
(function () {
  'use strict';
  const S = window.Suite;
  const VERSION_NUCLEO = '0.12.10';
  const CDN_POR_DEFECTO = `https://cdn.24bytes.pro/ffmpeg/${VERSION_NUCLEO}`;
  // Pesos reales del núcleo (sin comprimir): sirven para el progreso aunque el CDN comprima.
  const PESO_JS = 112059;
  const PESO_WASM = 32232419;
  /* Tope por archivo: 500 MB. El archivo vive varias veces en memoria a la vez (lectura del
     navegador, copia que viaja al worker y copia en el sistema de archivos virtual de ffmpeg) y
     el wasm tiene un techo de 2 GB de heap para el propio procesamiento. Con 500 MB el pico
     queda cerca de 1,5 GB; más allá, el navegador mata la pestaña sin avisar. */
  const TOPE_MB_POR_DEFECTO = 500;

  const cdn = () => String(window.CDN_FFMPEG || CDN_POR_DEFECTO).replace(/\/+$/, '');
  const topeBytes = () => Number(window.FFMPEG_TOPE_MB || TOPE_MB_POR_DEFECTO) * 1024 * 1024;

  const errorCon = (codigo, mensaje) => Object.assign(new Error(mensaje), { codigo });

  const cargarScript = (src) => new Promise((ok, mal) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = ok;
    s.onerror = () => mal(new Error(`No se pudo cargar ${src}`));
    document.head.appendChild(s);
  });

  /** Descarga una URL con progreso real y devuelve una blob: URL (lo que pide el worker de ffmpeg). */
  const aBlobUrl = async (url, tipo, pesoEsperado, alProgreso) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`);
    const trozos = [];
    let recibido = 0;
    const lector = r.body.getReader();
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      trozos.push(value);
      recibido += value.length;
      alProgreso(Math.min(recibido / pesoEsperado, 0.999));
    }
    return URL.createObjectURL(new Blob(trozos, { type: tipo }));
  };

  let promesaMotor = null;
  let ffmpeg = null;
  let ultimoLog = [];
  let manejadorLog = null;
  let manejadorProgreso = null;

  /** Carga (una vez) el motor. alEstado(texto, fraccion|null). */
  const cargar = (alEstado = () => {}) => {
    if (promesaMotor) return promesaMotor;
    promesaMotor = (async () => {
      try {
        alEstado('Cargando el motor de audio y video (solo la primera vez)…', 0);
        await cargarScript('/assets/vendor/ffmpeg/ffmpeg.js');
        const base = cdn();
        const coreURL = await aBlobUrl(`${base}/ffmpeg-core.js`, 'text/javascript', PESO_JS, () => {});
        const wasmURL = await aBlobUrl(`${base}/ffmpeg-core.wasm`, 'application/wasm', PESO_WASM,
          (f) => alEstado(`Descargando el motor (${Math.round(f * 100)} %)… solo la primera vez`, f));
        const ff = new window.FFmpegWASM.FFmpeg();
        ff.on('log', ({ message }) => {
          ultimoLog.push(message);
          if (ultimoLog.length > 60) ultimoLog.shift();
          if (manejadorLog) manejadorLog(message);
        });
        ff.on('progress', ({ progress }) => { if (manejadorProgreso) manejadorProgreso(progress); });
        await ff.load({ coreURL, wasmURL });
        ffmpeg = ff;
        return ff;
      } catch (error) {
        promesaMotor = null;
        ffmpeg = null;
        console.warn('Motor ffmpeg:', error);
        throw errorCon('motor',
          'No se pudo cargar el motor de audio y video (se descarga de cdn.24bytes.pro la primera vez). '
          + 'Revisa tu conexión y vuelve a intentarlo.');
      }
    })();
    return promesaMotor;
  };

  const cancelar = () => {
    if (ffmpeg) { try { ffmpeg.terminate(); } catch (_) { /* ya cerrado */ } }
    ffmpeg = null;
    promesaMotor = null;
  };

  const extension = (nombre) => {
    const m = /\.([A-Za-z0-9]{1,5})$/.exec(nombre || '');
    return m ? m[1].toLowerCase() : 'bin';
  };

  /** Mensaje entendible a partir del registro de ffmpeg cuando termina con error. */
  const explicar = () => {
    const log = ultimoLog.join('\n');
    if (/does not contain any stream|matches no streams|Stream map .* matches no/i.test(log)) {
      return 'Ese archivo no tiene pista de audio, así que no hay nada que extraer.';
    }
    if (/Invalid data found when processing input|moov atom not found|could not find codec/i.test(log)) {
      return 'No se pudo leer ese archivo: parece dañado o es un formato que el motor no reconoce.';
    }
    return 'ffmpeg no pudo procesar ese archivo. Prueba con otro formato o con un archivo más corto.';
  };

  const aSegundos = (t) => {
    const m = /(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(t);
    return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
  };

  /**
   * Ejecuta ffmpeg sobre uno o varios archivos.
   * opts: { archivos:File[], args:(entradas:string[])=>string[], salida:string, mime:string,
   *         duracion?:number (de la salida, para el progreso), alProgreso(f), alEstado(t,f) }
   * Devuelve un Blob con el resultado.
   */
  const ejecutar = async (opts) => {
    const ff = await cargar(opts.alEstado);
    ultimoLog = [];
    const entradas = opts.archivos.map((f, i) => `entrada${i}.${extension(f.name)}`);
    let ultimo = 0;
    const avanzar = (f) => {
      if (f > ultimo) { ultimo = Math.min(f, 0.99); if (opts.alProgreso) opts.alProgreso(ultimo); }
    };
    manejadorLog = (linea) => {
      if (opts.duracion > 0 && /time=/.test(linea)) {
        const t = aSegundos(linea.slice(linea.indexOf('time=') + 5));
        if (t != null) avanzar(t / opts.duracion);
      }
    };
    manejadorProgreso = (f) => { if (!(opts.duracion > 0) && f > 0 && f <= 1) avanzar(f); };
    try {
      opts.alEstado('Preparando el archivo…', null);
      for (let i = 0; i < opts.archivos.length; i++) {
        await ff.writeFile(entradas[i], new Uint8Array(await opts.archivos[i].arrayBuffer()));
      }
      opts.alEstado('Procesando…', 0);
      const codigo = await ff.exec(opts.args(entradas));
      if (codigo !== 0) throw errorCon('ffmpeg', explicar());
      const datos = await ff.readFile(opts.salida);
      if (!datos || !datos.length) throw errorCon('ffmpeg', explicar());
      if (opts.alProgreso) opts.alProgreso(1);
      return new Blob([datos.buffer], { type: opts.mime });
    } catch (error) {
      if (error && /terminate/i.test(error.message || '')) throw errorCon('cancelado', 'Proceso cancelado.');
      throw error;
    } finally {
      manejadorLog = null;
      manejadorProgreso = null;
      if (ffmpeg) {
        for (const n of [...entradas, opts.salida]) { try { await ffmpeg.deleteFile(n); } catch (_) { /* no existe */ } }
      }
    }
  };

  /** Duración y dimensiones leyendo los metadatos con el propio navegador (sin ffmpeg). */
  const sonda = (archivo) => new Promise((resolver) => {
    const el = document.createElement('video');
    const url = URL.createObjectURL(archivo);
    const fin = (datos) => { URL.revokeObjectURL(url); el.removeAttribute('src'); el.load(); resolver(datos); };
    const t = setTimeout(() => fin({ duracion: null, ancho: 0, alto: 0 }), 8000);
    el.preload = 'metadata';
    el.muted = true;
    el.onloadedmetadata = () => {
      clearTimeout(t);
      fin({
        duracion: Number.isFinite(el.duration) ? el.duration : null,
        ancho: el.videoWidth || 0,
        alto: el.videoHeight || 0,
      });
    };
    el.onerror = () => { clearTimeout(t); fin({ duracion: null, ancho: 0, alto: 0 }); };
    el.src = url;
  });

  const tiempo = (s) => {
    if (!Number.isFinite(s)) return '';
    const m = Math.floor(s / 60);
    const r = Math.round(s - m * 60);
    return `${m}:${String(r).padStart(2, '0')}`;
  };

  const EXT_AUDIO = ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'flac', 'wma', 'amr'];
  const EXT_VIDEO = ['mp4', 'm4v', 'mov', 'webm', 'mkv', 'avi', '3gp', 'mpg', 'mpeg', 'ts', 'wmv', 'flv'];
  const esAudio = (f) => /^audio\//.test(f.type) || EXT_AUDIO.includes(extension(f.name));
  const esVideo = (f) => /^video\//.test(f.type) || EXT_VIDEO.includes(extension(f.name));
  const esMedio = (f) => esAudio(f) || esVideo(f);

  const validarTamano = (archivo) => {
    if (archivo.size > topeBytes()) {
      return `«${archivo.name}» pesa ${S.tamano(archivo.size)} y el tope de esta herramienta es `
        + `${S.tamano(topeBytes())} por archivo: el navegador no tiene memoria para más. `
        + 'Recórtalo o comprímelo antes y vuelve a intentarlo.';
    }
    return null;
  };

  const CSS = `
.ff-error{margin-top:16px;padding:12px 14px;border-radius:12px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-weight:600}
.ff-progreso,.ff-resultado{margin-top:18px;padding:14px;border:1px solid var(--linea);border-radius:14px;background:#f8fafc}
.ff-fila{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}
.ff-estado{font-weight:600;min-width:0}
.ff-progreso progress{width:100%;height:12px;margin-top:10px;accent-color:var(--acento)}
.ff-resultado audio,.ff-resultado video,.ff-resultado img{display:block;width:100%;max-width:100%;margin-top:12px;border-radius:10px;background:#000}
.ff-resultado audio{background:transparent}
.ff-resultado img{height:auto;max-height:420px;object-fit:contain}
.ff-aviso{margin-top:12px;color:var(--gris);font-size:14px}
.ff-rango{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media (max-width:480px){.ff-rango{grid-template-columns:1fr}}
.ff-previa{display:block;width:100%;margin-top:14px;max-height:340px;border-radius:10px;background:#000}
audio.ff-previa{background:transparent}
.ff-previa[hidden]{display:none}
`;
  const inyectarEstilos = () => {
    if (document.getElementById('ff-estilos')) return;
    const st = document.createElement('style');
    st.id = 'ff-estilos';
    st.textContent = CSS;
    document.head.appendChild(st);
  };

  /**
   * Monta una herramienta de un archivo (o varios) sobre la estructura estándar:
   * #zona, #entrada, #panel, #resumen, #vaciar, #ejecutar, #salida.
   * cfg: { aceptar, mensajeVacio, multiple, textoBoton, textoTrabajando,
   *        alElegir(infos), lista?(archivos, infos, pintarResumen), comando(ctx) -> {args, salida, mime, nombre, duracion?, aviso?},
   *        validar?(ctx) -> string|null }
   * Devuelve { estado } para que cada herramienta lea los archivos elegidos.
   */
  const montar = (cfg) => {
    inyectarEstilos();
    const $ = (id) => document.getElementById(id);
    const zona = $('zona');
    const entrada = $('entrada');
    const panel = $('panel');
    const resumen = $('resumen');
    const boton = $('ejecutar');
    const salida = $('salida');
    salida.innerHTML = '<div class="ff-error" role="alert" hidden></div>'
      + '<div class="ff-progreso" hidden aria-live="polite"><div class="ff-fila">'
      + '<span class="ff-estado"></span>'
      + '<button class="boton boton-secundario boton-pequeno ff-cancelar" type="button">Cancelar</button></div>'
      + '<progress max="100" value="0"></progress></div>'
      + '<div class="ff-resultado" hidden></div>';
    const elError = salida.querySelector('.ff-error');
    const elProgreso = salida.querySelector('.ff-progreso');
    const elEstado = salida.querySelector('.ff-estado');
    const elBarra = salida.querySelector('progress');
    const elResultado = salida.querySelector('.ff-resultado');
    let urlResultado = null;

    const estado = { archivos: [], infos: [], trabajando: false };

    const mostrarError = (texto) => {
      elError.textContent = texto;
      elError.hidden = !texto;
    };
    const limpiarResultado = () => {
      if (urlResultado) { URL.revokeObjectURL(urlResultado); urlResultado = null; }
      elResultado.hidden = true;
      elResultado.textContent = '';
    };
    const estadoUI = (texto, fraccion) => {
      elEstado.textContent = texto;
      if (fraccion == null) elBarra.removeAttribute('value');
      else elBarra.value = Math.round(fraccion * 100);
    };

    const pintar = () => {
      panel.hidden = estado.archivos.length === 0;
      const peso = estado.archivos.reduce((s, a) => s + a.size, 0);
      const dur = estado.infos.reduce((s, i) => s + (i.duracion || 0), 0);
      resumen.textContent = estado.archivos.length === 1
        ? `${estado.archivos[0].name} · ${S.tamano(peso)}${dur ? ` · ${tiempo(dur)}` : ''}`
        : `${estado.archivos.length} archivos · ${S.tamano(peso)}${dur ? ` · ${tiempo(dur)}` : ''}`;
      if (cfg.pintarLista) cfg.pintarLista(estado, pintar);
    };

    const recibir = async (lista) => {
      mostrarError('');
      limpiarResultado();
      const nuevos = [];
      for (const f of lista) {
        const problema = validarTamano(f);
        if (problema) { mostrarError(problema); S.aviso('Archivo demasiado grande para procesarlo aquí.', 'error'); continue; }
        nuevos.push(f);
      }
      if (!nuevos.length) return;
      const infos = await Promise.all(nuevos.map(sonda));
      if (cfg.multiple) {
        estado.archivos.push(...nuevos);
        estado.infos.push(...infos);
      } else {
        estado.archivos = [nuevos[0]];
        estado.infos = [infos[0]];
      }
      pintar();
      if (cfg.alElegir) cfg.alElegir(estado);
    };

    const vaciar = () => {
      estado.archivos = [];
      estado.infos = [];
      mostrarError('');
      limpiarResultado();
      pintar();
    };

    const ejecutarTodo = async () => {
      if (estado.trabajando || !estado.archivos.length) return;
      const ctx = { archivos: estado.archivos, infos: estado.infos };
      const problema = cfg.validar ? cfg.validar(ctx) : null;
      if (problema) { mostrarError(problema); return; }
      const orden = cfg.comando(ctx);
      mostrarError('');
      limpiarResultado();
      estado.trabajando = true;
      boton.disabled = true;
      elProgreso.hidden = false;
      estadoUI('Preparando…', null);
      try {
        const blob = await ejecutar({
          archivos: estado.archivos,
          args: orden.args,
          salida: orden.salida,
          mime: orden.mime,
          duracion: orden.duracion,
          alEstado: estadoUI,
          alProgreso: (f) => estadoUI(`Procesando… ${Math.round(f * 100)} %`, f),
        });
        urlResultado = URL.createObjectURL(blob);
        const tag = orden.mime.startsWith('video/') ? 'video' : orden.mime.startsWith('image/') ? 'img' : 'audio';
        const previa = document.createElement(tag);
        previa.src = urlResultado;
        if (tag !== 'img') { previa.controls = true; if (tag === 'video') previa.playsInline = true; }
        else previa.alt = 'Vista previa del resultado';
        const origen = estado.archivos.reduce((s, a) => s + a.size, 0);
        const info = document.createElement('p');
        info.className = 'ff-fila';
        const txt = document.createElement('span');
        txt.className = 'ff-estado';
        txt.textContent = `Listo: ${orden.nombre} · ${S.tamano(blob.size)}`
          + (cfg.comparar ? ` (antes ${S.tamano(origen)})` : '');
        const descarga = document.createElement('button');
        descarga.type = 'button';
        descarga.className = 'boton';
        descarga.id = 'descargar';
        descarga.textContent = 'Descargar';
        descarga.addEventListener('click', () => S.descargar(blob, orden.nombre, orden.mime));
        info.append(txt, descarga);
        elResultado.append(info, previa);
        if (orden.aviso) {
          const a = document.createElement('p');
          a.className = 'ff-aviso';
          a.textContent = orden.aviso(blob.size, origen) || '';
          if (a.textContent) elResultado.appendChild(a);
        }
        elResultado.hidden = false;
        S.aviso('Listo. Pulsa Descargar para guardarlo.', 'ok');
      } catch (error) {
        if (error.codigo === 'cancelado') mostrarError('Proceso cancelado. Cuando quieras, vuelve a intentarlo.');
        else {
          console.warn('Herramienta ffmpeg:', error);
          mostrarError(error.codigo ? error.message : 'No se pudo procesar el archivo. Prueba con otro.');
        }
      } finally {
        estado.trabajando = false;
        boton.disabled = false;
        elProgreso.hidden = true;
      }
    };

    S.zona(zona, {
      input: entrada,
      aceptar: cfg.aceptar,
      mensajeVacio: cfg.mensajeVacio,
      alRecibir: recibir,
    });
    salida.querySelector('.ff-cancelar').addEventListener('click', cancelar);
    $('vaciar').addEventListener('click', vaciar);
    boton.addEventListener('click', ejecutarTodo);
    return { estado, pintar, mostrarError };
  };

  window.FFmpegMotor = { cargar, cancelar, ejecutar, sonda, montar, tiempo, extension, esAudio, esVideo, esMedio, validarTamano, VERSION_NUCLEO };
})();
