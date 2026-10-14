/* Utilidades compartidas por todas las herramientas. Sin dependencias. */
(function () {
  'use strict';

  const ocupadoEl = () => document.getElementById('ocupado');
  const avisoEl = () => document.getElementById('aviso');
  let temporizadorAviso = null;


  /* ---- Espera con apoyo al proyecto ------------------------------------------------
     Panel EN LA PÁGINA (sin popup), al final de .herramienta y junto al hueco de anuncio normal.
     Mientras dura, la herramienta queda inerte y la descarga espera (una sola vez por operación)
     al mínimo del sitio (espera.minimo_seg, o window.SUITE_ESPERA_MIN_MS en pruebas).
     No toca ni refresca anuncios. Sin <script id="suite-config"> o con espera.activa=false
     no hace nada. */
  const configEspera = (() => {
    try {
      const el = document.getElementById('suite-config');
      const c = el ? JSON.parse(el.textContent) : null;
      if (!c || !c.espera || !c.espera.activa) return null;
      return Object.assign({ minimo_seg: 10, cafe_url: '' }, c.espera);
    } catch (_) { return null; }
  })();
  const E = { op: null, el: null, previo: null, inertes: [] };
  const herramienta = () => {
    const partes = location.pathname.split('/').filter(Boolean);
    return partes[partes.length - 1] || 'portada';
  };
  const minimoMs = () => {
    const forzado = window.SUITE_ESPERA_MIN_MS;
    if (forzado != null && Number.isFinite(Number(forzado)) && Number(forzado) >= 0) return Number(forzado);
    return Math.max(0, Number(configEspera.minimo_seg) || 0) * 1000;
  };
  const fraccionEspera = (op) => {
    const t = performance.now() - op.inicio;
    if (op.real == null) return 0.9 * (1 - Math.exp(-3 * t / Math.max(op.min, 2000)));
    return 0.95 * Math.min(op.real, op.min > 0 ? t / op.min : 1);
  };
  const pintarEspera = () => {
    const op = E.op;
    if (!op || !E.el || !op.visible) return;
    const f = Math.max(op.mostrado || 0, Math.min(fraccionEspera(op), 0.95));
    op.mostrado = f;
    const pct = Math.round(f * 100);
    E.el.querySelector('.espera-relleno').style.transform = `scaleX(${f.toFixed(3)})`;
    const barra = E.el.querySelector('[role="progressbar"]');
    if (barra.getAttribute('aria-valuenow') !== String(pct)) barra.setAttribute('aria-valuenow', String(pct));
    const falta = op.min - (performance.now() - op.inicio);
    const txt = falta > 0 ? `Faltan ${Math.ceil(falta / 1000)} s` : 'Terminando…';
    const tiempo = E.el.querySelector('.espera-tiempo');
    if (tiempo.textContent !== txt) tiempo.textContent = txt;
  };
  const crearEspera = () => {
    const cfg = configEspera;
    const el = document.createElement('section');
    el.className = 'espera';
    el.hidden = true;
    const cafe = cfg.cafe_url
      ? `<a class="boton espera-cafe" href="${String(cfg.cafe_url).replace(/"/g, '&quot;')}" target="_blank" rel="noopener">Invítame un café</a>` : '';
    el.innerHTML = '<h2 class="espera-titulo">Procesando tu archivo</h2>'
      + '<div class="espera-barra" role="progressbar" aria-label="Progreso" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">'
      + '<span class="espera-relleno"></span></div>'
      + '<p class="espera-tiempo"></p>'
      + '<p class="espera-estado" aria-live="polite"></p>'
      + '<div class="espera-porque"><h3>¿Por qué te mostramos esto?</h3>'
      + '<p>Estas herramientas son gratuitas y de código abierto. Mantenerlas cuesta dinero: dominios, servidores, bases de datos. '
      + 'Este aviso —y, cuando haya, un anuncio— nos ayuda a pagarlo. Tus archivos nunca salen de tu equipo.</p></div>'
      + cafe;
    (document.querySelector('.herramienta') || document.querySelector('main') || document.body).appendChild(el);
    const a = el.querySelector('.espera-cafe');
    if (a) a.addEventListener('click', () => Suite.evento('cafe_clic', { herramienta: herramienta() }));
    return el;
  };
  const mostrarEspera = () => {
    const op = E.op;
    if (!op || op.visible) return;
    op.visible = true;
    if (!E.el) E.el = crearEspera();
    E.el.querySelector('.espera-estado').textContent = op.texto;
    E.el.hidden = false;
    pintarEspera();
    const reducido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    try { E.el.scrollIntoView({ behavior: reducido ? 'auto' : 'smooth', block: 'center' }); } catch (_) { /* sin scroll */ }
    Suite.evento('espera_mostrada', { herramienta: herramienta() });
  };
  /** Deja inerte lo que hay en la herramienta (menos el propio panel). */
  const congelar = () => {
    const raiz = document.querySelector('.herramienta');
    if (!raiz) return;
    E.inertes = Array.from(raiz.children).filter((h) => h !== E.el && !h.inert);
    E.inertes.forEach((h) => { h.inert = true; h.classList.add('espera-congelado'); });
  };
  const descongelar = () => {
    E.inertes.forEach((h) => { h.inert = false; h.classList.remove('espera-congelado'); });
    E.inertes = [];
  };
  const abrirEspera = (texto) => {
    const op = { inicio: performance.now(), min: minimoMs(), real: null, texto, gate: null, pendiente: false, visible: false, mostrado: 0 };
    E.op = op;
    E.previo = document.activeElement;
    congelar();
    // Un retardo corto evita el parpadeo en procesos instantáneos y en errores inmediatos.
    op.retardo = setTimeout(mostrarEspera, 120);
    op.reloj = setInterval(pintarEspera, 100);
  };
  const cerrarEspera = () => {
    const op = E.op;
    if (!op) return;
    clearTimeout(op.retardo);
    clearInterval(op.reloj);
    E.op = null;
    descongelar();
    if (E.el) E.el.hidden = true;
    try { if (E.previo && E.previo.focus && document.contains(E.previo)) E.previo.focus({ preventScroll: true }); } catch (_) { /* sin foco */ }
  };

  const Suite = {
    /** Tamaño legible: 1.4 MB */
    tamano(bytes) {
      if (!Number.isFinite(bytes)) return '';
      const u = ['B', 'KB', 'MB', 'GB'];
      let i = 0;
      let n = bytes;
      while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
      return `${n.toLocaleString('es-CO', { maximumFractionDigits: n < 10 && i > 0 ? 1 : 0 })} ${u[i]}`;
    },

    /** Nombre de archivo sin extensión y sin caracteres raros. */
    nombreBase(nombre, porDefecto = 'documento') {
      const limpio = String(nombre || '').replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]+/g, ' ').trim();
      return limpio || porDefecto;
    },

    leer(archivo) {
      return archivo.arrayBuffer();
    },

    /** Descarga bytes o un Blob con el nombre dado. Si hay una espera en curso, la descarga
        aguarda (una sola vez por operación) a que pase el mínimo y entonces cierra el modal. */
    descargar(contenido, nombre, tipo = 'application/pdf') {
      const op = configEspera ? E.op : null;
      if (!op) { Suite._bajar(contenido, nombre, tipo); return; }
      op.pendiente = true;
      if (!op.gate) {
        op.gate = Suite.esperarMinimo().then(() => { if (E.op === op) cerrarEspera(); });
      }
      op.gate.then(() => Suite._bajar(contenido, nombre, tipo));
    },

    _bajar(contenido, nombre, tipo) {
      const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      Suite.evento('descarga', { herramienta: herramienta() });
    },

    /** Promesa que se cumple cuando ha pasado el mínimo de la espera en curso (ya, si no hay). */
    esperarMinimo() {
      const op = configEspera ? E.op : null;
      if (!op) return Promise.resolve();
      const resto = op.min - (performance.now() - op.inicio);
      return resto <= 0 ? Promise.resolve() : new Promise((ok) => setTimeout(ok, resto));
    },

    /** Avance real 0–1 del proceso en curso (opcional: sin él la barra avanza por tiempo). */
    progreso(p) {
      const op = configEspera ? E.op : null;
      if (!op || !Number.isFinite(p)) return;
      op.real = Math.max(op.real || 0, Math.min(1, Math.max(0, p)));
      pintarEspera();
    },

    /** Activa o cierra el estado «procesando». Con espera activa muestra el modal; cerrar no lo
        quita si hay una descarga aguardando su turno (el modal lo cierra la propia compuerta). */
    ocupado(activo, texto = 'Procesando…') {
      if (configEspera) {
        if (activo) {
          if (!E.op) abrirEspera(texto);
          E.op.texto = texto;
          if (E.op.visible && E.el) E.el.querySelector('.espera-estado').textContent = texto;
        } else if (E.op && !E.op.pendiente) {
          cerrarEspera();
        }
        return;
      }
      const el = ocupadoEl();
      if (!el) return;
      document.getElementById('ocupadoTexto').textContent = texto;
      el.hidden = !activo;
    },

    /** Mensaje breve abajo. tipo: '' | 'error' | 'ok' */
    aviso(texto, tipo = '') {
      const el = avisoEl();
      if (!el) return;
      el.textContent = texto;
      el.dataset.tipo = tipo;
      el.hidden = false;
      clearTimeout(temporizadorAviso);
      temporizadorAviso = setTimeout(() => { el.hidden = true; }, tipo === 'error' ? 7000 : 4000);
    },

    /**
     * Convierte un elemento en zona de carga: clic, teclado, arrastrar y soltar.
     * opciones: { input, aceptar(archivo) -> bool, alRecibir(archivos[]) }
     */
    zona(elemento, opciones) {
      const input = opciones.input;
      const entregar = (lista) => {
        const archivos = Array.from(lista || []).filter((f) => (opciones.aceptar ? opciones.aceptar(f) : true));
        if (!archivos.length) {
          Suite.aviso(opciones.mensajeVacio || 'Ese tipo de archivo no sirve para esta herramienta.', 'error');
          return;
        }
        opciones.alRecibir(archivos);
      };
      elemento.setAttribute('role', 'button');
      elemento.setAttribute('tabindex', '0');
      elemento.addEventListener('click', () => input.click());
      elemento.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); input.click(); }
      });
      ['dragenter', 'dragover'].forEach((t) => elemento.addEventListener(t, (ev) => {
        ev.preventDefault();
        elemento.classList.add('zona-activa');
      }));
      ['dragleave', 'drop'].forEach((t) => elemento.addEventListener(t, (ev) => {
        ev.preventDefault();
        elemento.classList.remove('zona-activa');
      }));
      elemento.addEventListener('drop', (ev) => entregar(ev.dataTransfer.files));
      input.addEventListener('change', () => { entregar(input.files); input.value = ''; });
    },

    esPdf(archivo) {
      return archivo.type === 'application/pdf' || /\.pdf$/i.test(archivo.name);
    },

    /** Ordenar arrastrando dentro de un contenedor. alMover(desde, hasta). */
    ordenable(contenedor, selectorItem, alMover) {
      let origen = null;
      contenedor.addEventListener('dragstart', (ev) => {
        const item = ev.target.closest(selectorItem);
        if (!item) return;
        origen = item;
        item.classList.add('arrastrando');
        ev.dataTransfer.effectAllowed = 'move';
        ev.dataTransfer.setData('text/plain', '');
      });
      contenedor.addEventListener('dragend', () => {
        if (origen) origen.classList.remove('arrastrando');
        origen = null;
      });
      contenedor.addEventListener('dragover', (ev) => {
        if (!origen) return;
        ev.preventDefault();
      });
      contenedor.addEventListener('drop', (ev) => {
        if (!origen) return;
        ev.preventDefault();
        ev.stopPropagation();
        const destino = ev.target.closest(selectorItem);
        if (!destino || destino === origen) return;
        const items = Array.from(contenedor.querySelectorAll(selectorItem));
        alMover(items.indexOf(origen), items.indexOf(destino));
      });
    },

    /** Evento de analítica si hay medición cargada; si no, no hace nada. */
    evento(nombre, datos) {
      try { if (window.umami) window.umami.track(nombre, datos || {}); } catch (_) { /* sin medición */ }
    },
  };

  window.Suite = Suite;
})();
