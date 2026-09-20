/* Utilidades compartidas por todas las herramientas. Sin dependencias. */
(function () {
  'use strict';

  const ocupadoEl = () => document.getElementById('ocupado');
  const avisoEl = () => document.getElementById('aviso');
  let temporizadorAviso = null;

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

    /** Descarga bytes o un Blob con el nombre dado. */
    descargar(contenido, nombre, tipo = 'application/pdf') {
      const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      const partes = location.pathname.split('/').filter(Boolean);
      Suite.evento('descarga', { herramienta: partes[partes.length - 1] || 'portada' });
    },

    ocupado(activo, texto = 'Procesando…') {
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
