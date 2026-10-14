/* Censurar zonas de una imagen: pixelar, difuminar o tapar. El resultado es definitivo. */
(function () {
  'use strict';
  const S = window.Suite;
  const I = window.Img;
  const $ = (id) => document.getElementById(id);
  const lienzo = $('lienzo');
  let bitmap = null;
  let reducida = null; // lo que se ve y sobre lo que se previsualiza
  let archivo = null;
  let k = 1; // px de vista por px de imagen
  let zonas = []; // en px de imagen
  let arrastre = null;

  /** Aplica el efecto sobre `r` (coordenadas del lienzo destino). `s` = escala de ese lienzo respecto a la imagen. */
  const censurar = (dest, fuente, r, s) => {
    const x = dest.getContext('2d');
    const rx = Math.round(r.x * s); const ry = Math.round(r.y * s);
    const rw = Math.max(1, Math.round(r.w * s)); const rh = Math.max(1, Math.round(r.h * s));
    const efecto = $('efecto').value;
    if (efecto === 'tapar') { x.fillStyle = '#000'; x.fillRect(rx, ry, rw, rh); return; }
    const lado = Math.max(bitmap.width, bitmap.height);
    const bloque = Math.max(2, (Number($('intensidad').value) * lado * s) / 160);
    if (efecto === 'pixelar') {
      const t = I.lienzo(Math.ceil(rw / bloque), Math.ceil(rh / bloque));
      const tx = t.getContext('2d');
      tx.imageSmoothingEnabled = true;
      const f = fuente.width / dest.width; // fuente y destino tienen la misma proporción
      tx.drawImage(fuente, rx * f, ry * f, rw * f, rh * f, 0, 0, t.width, t.height);
      x.imageSmoothingEnabled = false;
      x.drawImage(t, 0, 0, t.width, t.height, rx, ry, rw, rh);
      x.imageSmoothingEnabled = true;
      return;
    }
    // Difuminar: filtro nativo si existe; si no (Safari), reducción y ampliación suave.
    x.save();
    x.beginPath();
    x.rect(rx, ry, rw, rh);
    x.clip();
    if ('filter' in x) {
      x.filter = `blur(${bloque * 0.8}px)`;
      x.drawImage(fuente, 0, 0, dest.width, dest.height);
    } else {
      const t = I.lienzo(Math.max(1, rw / bloque), Math.max(1, rh / bloque));
      t.getContext('2d').drawImage(dest, rx, ry, rw, rh, 0, 0, t.width, t.height);
      x.imageSmoothingQuality = 'high';
      x.drawImage(t, 0, 0, t.width, t.height, rx, ry, rw, rh);
    }
    x.restore();
  };

  const dibujar = () => {
    const x = lienzo.getContext('2d');
    x.clearRect(0, 0, lienzo.width, lienzo.height);
    x.drawImage(reducida, 0, 0, lienzo.width, lienzo.height);
    zonas.forEach((z) => censurar(lienzo, reducida, z, k));
    if (arrastre && arrastre.rect) {
      const r = arrastre.rect;
      x.strokeStyle = '#d92d20';
      x.lineWidth = 2;
      x.setLineDash([6, 4]);
      x.strokeRect(r.x * k, r.y * k, r.w * k, r.h * k);
      x.setLineDash([]);
    }
    $('cuenta').textContent = zonas.length
      ? `${zonas.length} ${zonas.length === 1 ? 'zona marcada' : 'zonas marcadas'}.`
      : 'Arrastra sobre la imagen para marcar una zona.';
    $('deshacer').disabled = $('limpiar').disabled = $('guardar').disabled = zonas.length === 0;
  };

  const punto = (ev) => {
    const p = I.punto(ev, lienzo);
    return { x: Math.min(bitmap.width, Math.max(0, p.x / k)), y: Math.min(bitmap.height, Math.max(0, p.y / k)) };
  };

  lienzo.addEventListener('pointerdown', (ev) => {
    if (!bitmap) return;
    lienzo.setPointerCapture(ev.pointerId);
    arrastre = { ini: punto(ev), rect: null };
  });
  lienzo.addEventListener('pointermove', (ev) => {
    if (!arrastre) return;
    const p = punto(ev);
    const a = arrastre.ini;
    arrastre.rect = { x: Math.min(a.x, p.x), y: Math.min(a.y, p.y), w: Math.abs(p.x - a.x), h: Math.abs(p.y - a.y) };
    dibujar();
  });
  const soltar = () => {
    if (arrastre && arrastre.rect && arrastre.rect.w * k > 6 && arrastre.rect.h * k > 6) zonas.push(arrastre.rect);
    arrastre = null;
    dibujar();
  };
  lienzo.addEventListener('pointerup', soltar);
  lienzo.addEventListener('pointercancel', () => { arrastre = null; dibujar(); });

  const guardar = async () => {
    S.ocupado(true, 'Aplicando…');
    try {
      const l = I.lienzo(bitmap.width, bitmap.height);
      l.getContext('2d').drawImage(bitmap, 0, 0);
      zonas.forEach((z) => censurar(l, bitmap, z, 1));
      const tipo = archivo.type === 'image/png' || archivo.type === 'image/webp' ? archivo.type : 'image/jpeg';
      const blob = await I.aBlob(l, tipo, 0.95);
      S.descargar(blob, `${S.nombreBase(archivo.name, 'imagen')}-censurada.${I.EXT[tipo]}`, tipo);
      S.aviso('Listo. La zona censurada no se puede recuperar en el archivo descargado.', 'ok');
    } finally {
      S.ocupado(false);
    }
  };

  $('deshacer').addEventListener('click', () => { zonas.pop(); dibujar(); });
  $('limpiar').addEventListener('click', () => { zonas = []; dibujar(); });
  $('guardar').addEventListener('click', guardar);
  $('efecto').addEventListener('change', () => {
    $('campoIntensidad').hidden = $('efecto').value === 'tapar';
    dibujar();
  });
  $('intensidad').addEventListener('input', () => { $('intensidadValor').textContent = $('intensidad').value; dibujar(); });

  I.unaImagen({
    zona: $('zona'), entrada: $('entrada'), panel: $('panel'), cambiar: $('cambiar'),
    alCargar: (b, f) => {
      bitmap = b;
      archivo = f;
      zonas = [];
      const maxW = Math.min(900, $('panel').clientWidth - 24 || 900);
      k = Math.min(1, maxW / b.width, 650 / b.height);
      lienzo.width = Math.round(b.width * k);
      lienzo.height = Math.round(b.height * k);
      reducida = I.escalar(b, lienzo.width, lienzo.height);
      dibujar();
    },
  });
})();
