/* Paleta de colores dominantes y cuentagotas. Todo en el navegador. */
(function () {
  'use strict';
  const S = window.Suite;
  const I = window.Img;
  const $ = (id) => document.getElementById(id);
  const lienzo = $('lienzo');
  let muestraPx = null; // Uint8ClampedArray RGBA de una versión reducida
  let colores = [];     // [{r,g,b,n}]

  const hex = (c) => `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  const hsl = ({ r, g, b }) => {
    const a = [r, g, b].map((v) => v / 255);
    const mx = Math.max(...a);
    const mn = Math.min(...a);
    const l = (mx + mn) / 2;
    const d = mx - mn;
    let h = 0;
    let s = 0;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (mx === a[0]) h = ((a[1] - a[2]) / d) % 6;
      else if (mx === a[1]) h = (a[2] - a[0]) / d + 2;
      else h = (a[0] - a[1]) / d + 4;
      h = (h * 60 + 360) % 360;
    }
    return `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
  };

  /**
   * Colores dominantes: histograma de 4 bits por canal, elección voraz del color más lejano de
   * los ya elegidos (ponderado por frecuencia) y dos pasadas de reasignación. Así un detalle
   * pequeño pero distinto (un logo verde en una foto roja) no se pierde ante tonos repetidos.
   */
  const dominantes = (px, n) => {
    const cubos = new Map();
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 128) continue;
      const clave = ((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4);
      const c = cubos.get(clave) || { r: 0, g: 0, b: 0, n: 0 };
      c.r += px[i]; c.g += px[i + 1]; c.b += px[i + 2]; c.n++;
      cubos.set(clave, c);
    }
    const bins = [...cubos.values()].map((c) => ({ r: c.r / c.n, g: c.g / c.n, b: c.b / c.n, n: c.n }));
    if (!bins.length) return [];
    const dist = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
    const elegidos = [bins.reduce((m, c) => (c.n > m.n ? c : m), bins[0])];
    while (elegidos.length < n) {
      let mejor = null;
      let puntaje = 0;
      for (const c of bins) {
        const d = Math.min(...elegidos.map((e) => dist(c, e)));
        const p = d >= 36 ? Math.sqrt(c.n) * d : 0;
        if (p > puntaje) { puntaje = p; mejor = c; }
      }
      if (!mejor) break;
      elegidos.push(mejor);
    }
    let centros = elegidos.map((c) => ({ r: c.r, g: c.g, b: c.b }));
    let grupos = [];
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      grupos = centros.map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
      for (const c of bins) {
        let k = 0;
        let mejor = Infinity;
        centros.forEach((m, i) => { const d = dist(c, m); if (d < mejor) { mejor = d; k = i; } });
        const g = grupos[k];
        g.r += c.r * c.n; g.g += c.g * c.n; g.b += c.b * c.n; g.n += c.n;
      }
      centros = centros.map((m, i) => (grupos[i].n ? { r: grupos[i].r / grupos[i].n, g: grupos[i].g / grupos[i].n, b: grupos[i].b / grupos[i].n } : m));
    }
    return centros
      .map((m, i) => ({ r: Math.round(m.r), g: Math.round(m.g), b: Math.round(m.b), n: grupos[i].n }))
      .filter((c) => c.n > 0)
      .sort((a, b) => b.n - a.n);
  };

  const copiar = async (texto) => {
    const ok = await I.copiar(texto);
    S.aviso(ok ? `Copiado: ${texto.length > 60 ? `${texto.slice(0, 57)}…` : texto}` : 'No se pudo copiar.', ok ? 'ok' : 'error');
  };

  const elegir = (c) => {
    $('elegidoMuestra').style.background = hex(c);
    $('cHex').textContent = hex(c).toUpperCase();
    $('cRgb').textContent = `rgb(${c.r}, ${c.g}, ${c.b})`;
    $('cHsl').textContent = hsl(c);
  };

  const pintarPaleta = () => {
    colores = dominantes(muestraPx, Number($('cuantos').value));
    const cont = $('muestras');
    cont.textContent = '';
    colores.forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'muestra';
      b.setAttribute('aria-label', `Copiar ${hex(c)}`);
      const caja = document.createElement('span');
      caja.className = 'muestra-color';
      caja.style.background = hex(c);
      const code = document.createElement('code');
      code.textContent = hex(c).toUpperCase();
      b.append(caja, code);
      b.addEventListener('click', () => { elegir(c); copiar(hex(c).toUpperCase()); });
      cont.appendChild(b);
    });
    if (colores.length) elegir(colores[0]);
  };

  lienzo.addEventListener('click', (ev) => {
    const p = I.punto(ev, lienzo);
    const d = lienzo.getContext('2d', { willReadFrequently: true })
      .getImageData(Math.min(lienzo.width - 1, Math.max(0, Math.floor(p.x))), Math.min(lienzo.height - 1, Math.max(0, Math.floor(p.y))), 1, 1).data;
    const c = { r: d[0], g: d[1], b: d[2] };
    elegir(c);
    copiar(hex(c).toUpperCase());
  });

  $('cuantos').addEventListener('change', pintarPaleta);
  $('cHex').addEventListener('click', () => copiar($('cHex').textContent));
  $('cRgb').addEventListener('click', () => copiar($('cRgb').textContent));
  $('cHsl').addEventListener('click', () => copiar($('cHsl').textContent));
  $('copiarHex').addEventListener('click', () => copiar(colores.map((c) => hex(c).toUpperCase()).join(', ')));
  $('copiarCss').addEventListener('click', () => copiar(`:root {\n${colores.map((c, i) => `  --color-${i + 1}: ${hex(c)};`).join('\n')}\n}`));
  $('bajar').addEventListener('click', async () => {
    const ancho = 160;
    const l = I.lienzo(ancho * colores.length, 220);
    const x = l.getContext('2d');
    colores.forEach((c, i) => {
      x.fillStyle = hex(c);
      x.fillRect(i * ancho, 0, ancho, 220);
      x.fillStyle = (c.r * 299 + c.g * 587 + c.b * 114) / 1000 > 150 ? '#0f172a' : '#ffffff';
      x.font = '700 22px ui-monospace, Menlo, monospace';
      x.textAlign = 'center';
      x.fillText(hex(c).toUpperCase(), i * ancho + ancho / 2, 200);
    });
    S.descargar(await I.aBlob(l, 'image/png'), 'paleta-de-colores.png', 'image/png');
  });

  I.unaImagen({
    zona: $('zona'), entrada: $('entrada'), panel: $('panel'), cambiar: $('cambiar'),
    alCargar: (b) => {
      const k = Math.min(1, Math.max(280, Math.min(900, $('panel').clientWidth - 24 || 900)) / b.width, 600 / b.height);
      lienzo.width = Math.max(1, Math.round(b.width * k));
      lienzo.height = Math.max(1, Math.round(b.height * k));
      const x = lienzo.getContext('2d', { willReadFrequently: true });
      x.drawImage(b, 0, 0, lienzo.width, lienzo.height);
      const m = I.lienzo(Math.max(1, Math.round(b.width * Math.min(1, 120 / Math.max(b.width, b.height)))),
        Math.max(1, Math.round(b.height * Math.min(1, 120 / Math.max(b.width, b.height)))));
      const mx = m.getContext('2d', { willReadFrequently: true });
      mx.drawImage(b, 0, 0, m.width, m.height);
      muestraPx = mx.getImageData(0, 0, m.width, m.height).data;
      pintarPaleta();
    },
  });
})();
