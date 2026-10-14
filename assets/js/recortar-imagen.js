/* Recortar una imagen con un recuadro arrastrable y proporciones fijas. */
(function () {
  'use strict';
  const S = window.Suite;
  const I = window.Img;
  const $ = (id) => document.getElementById(id);
  const lienzo = $('lienzo');
  const ctx = lienzo.getContext('2d');
  const MIN = 8;
  let bitmap = null;
  let archivo = null;
  let k = 1; // px de vista por px de imagen
  let c = { x: 0, y: 0, w: 0, h: 0 }; // recorte en px de imagen
  let arrastre = null;

  const ratio = () => Number($('proporcion').value) || 0;
  const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

  const dibujar = () => {
    const W = lienzo.width;
    const H = lienzo.height;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(bitmap, 0, 0, W, H);
    const x = c.x * k; const y = c.y * k; const w = c.w * k; const h = c.h * k;
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.rect(x, y, w, h);
    ctx.fill('evenodd');
    ctx.restore();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 3; i++) {
      ctx.moveTo(x + (w * i) / 3, y); ctx.lineTo(x + (w * i) / 3, y + h);
      ctx.moveTo(x, y + (h * i) / 3); ctx.lineTo(x + w, y + (h * i) / 3);
    }
    ctx.stroke();
    ctx.fillStyle = '#d92d20';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([hx, hy]) => {
      ctx.beginPath();
      ctx.arc(hx, hy, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    $('medida').textContent = `${Math.round(c.w)} × ${Math.round(c.h)} px`;
  };

  /** Ajusta el recuadro a la proporción elegida, centrado y dentro de la imagen. */
  const aplicarProporcion = () => {
    const r = ratio();
    if (!r) { dibujar(); return; }
    const cx = c.x + c.w / 2;
    const cy = c.y + c.h / 2;
    let w = c.w;
    let h = w / r;
    if (h > c.h) { h = c.h; w = h * r; }
    w = Math.min(w, bitmap.width, bitmap.height * r);
    h = w / r;
    c = { w, h, x: limitar(cx - w / 2, 0, bitmap.width - w), y: limitar(cy - h / 2, 0, bitmap.height - h) };
    dibujar();
  };

  /** Recuadro entre el ancla y el puntero (en px de imagen), con proporción si hay. */
  const desdeAncla = (ancla, p) => {
    const r = ratio();
    let dx = p.x - ancla.x;
    let dy = p.y - ancla.y;
    const sx = dx < 0 ? -1 : 1;
    const sy = dy < 0 ? -1 : 1;
    let w = Math.abs(dx);
    let h = Math.abs(dy);
    const maxW = sx > 0 ? bitmap.width - ancla.x : ancla.x;
    const maxH = sy > 0 ? bitmap.height - ancla.y : ancla.y;
    w = Math.min(w, maxW);
    h = Math.min(h, maxH);
    if (r) {
      if (w / r > h) w = h * r; else h = w / r;
      if (w > maxW) { w = maxW; h = w / r; }
      if (h > maxH) { h = maxH; w = h * r; }
    }
    return { x: sx > 0 ? ancla.x : ancla.x - w, y: sy > 0 ? ancla.y : ancla.y - h, w, h };
  };

  const aImagen = (ev) => {
    const p = I.punto(ev, lienzo);
    return { x: limitar(p.x / k, 0, bitmap.width), y: limitar(p.y / k, 0, bitmap.height), vx: p.x, vy: p.y };
  };

  lienzo.addEventListener('pointerdown', (ev) => {
    if (!bitmap) return;
    lienzo.setPointerCapture(ev.pointerId);
    const p = aImagen(ev);
    const esquinas = [
      { x: c.x, y: c.y, ancla: { x: c.x + c.w, y: c.y + c.h } },
      { x: c.x + c.w, y: c.y, ancla: { x: c.x, y: c.y + c.h } },
      { x: c.x, y: c.y + c.h, ancla: { x: c.x + c.w, y: c.y } },
      { x: c.x + c.w, y: c.y + c.h, ancla: { x: c.x, y: c.y } },
    ];
    const toque = 18 / k;
    const e = esquinas.find((q) => Math.hypot(q.x - p.x, q.y - p.y) <= toque);
    if (e) arrastre = { tipo: 'esquina', ancla: e.ancla };
    else if (p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h) arrastre = { tipo: 'mover', dx: p.x - c.x, dy: p.y - c.y };
    else arrastre = { tipo: 'nuevo', ancla: { x: p.x, y: p.y } };
  });

  lienzo.addEventListener('pointermove', (ev) => {
    if (!arrastre) return;
    const p = aImagen(ev);
    if (arrastre.tipo === 'mover') {
      c.x = limitar(p.x - arrastre.dx, 0, bitmap.width - c.w);
      c.y = limitar(p.y - arrastre.dy, 0, bitmap.height - c.h);
    } else {
      const n = desdeAncla(arrastre.ancla, p);
      if (n.w >= MIN && n.h >= MIN) c = n;
    }
    dibujar();
  });
  const soltar = () => { arrastre = null; };
  lienzo.addEventListener('pointerup', soltar);
  lienzo.addEventListener('pointercancel', soltar);

  const recortar = async () => {
    const tipo = $('formato').value === 'original'
      ? (['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type) ? archivo.type : 'image/png')
      : $('formato').value;
    const w = Math.round(c.w);
    const h = Math.round(c.h);
    const salida = I.lienzo(w, h);
    const x = salida.getContext('2d');
    if (tipo === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); }
    x.drawImage(bitmap, Math.round(c.x), Math.round(c.y), w, h, 0, 0, w, h);
    const blob = await I.aBlob(salida, tipo, 0.92);
    S.descargar(blob, `${S.nombreBase(archivo.name, 'imagen')}-recorte.${I.EXT[tipo]}`, tipo);
    S.aviso('Listo. Revisa tus descargas.', 'ok');
  };

  $('proporcion').addEventListener('change', aplicarProporcion);
  $('recortar').addEventListener('click', recortar);
  I.unaImagen({
    zona: $('zona'), entrada: $('entrada'), panel: $('panel'), cambiar: $('cambiar'),
    alCargar: (b, f) => {
      bitmap = b;
      archivo = f;
      const maxW = Math.min(900, $('panel').clientWidth - 24 || 900);
      k = Math.min(1, maxW / b.width, 600 / b.height);
      lienzo.width = Math.round(b.width * k);
      lienzo.height = Math.round(b.height * k);
      const m = 0.1;
      c = { x: b.width * m, y: b.height * m, w: b.width * (1 - 2 * m), h: b.height * (1 - 2 * m) };
      $('proporcion').value = '0';
      dibujar();
    },
  });
})();
