/* Generador de códigos QR (qrcode-generator, MIT) con PNG y SVG. Todo en el navegador. */
(function () {
  'use strict';
  const S = window.Suite;
  const I = window.Img;
  const $ = (id) => document.getElementById(id);
  const lienzo = $('lienzo');
  let tipo = 'texto';
  let logo = null;
  let ultimo = null; // { n, oscuro(r,c), margen }

  if (window.qrcode) window.qrcode.stringToBytes = (s) => Array.from(new TextEncoder().encode(s));

  const contenido = () => {
    if (tipo === 'wifi') {
      const esc = (v) => v.replace(/([\;,:"])/g, '\\$1');
      const ssid = $('ssid').value;
      if (!ssid) return '';
      const seg = $('seguridad').value;
      return `WIFI:T:${seg === 'nopass' ? 'nopass' : seg};S:${esc(ssid)};${seg === 'nopass' ? '' : `P:${esc($('clave').value)};`};`;
    }
    if (tipo === 'whatsapp') {
      const num = $('telefono').value.replace(/\D/g, '');
      if (!num) return '';
      const msg = $('mensaje').value.trim();
      return `https://wa.me/${num}${msg ? `?text=${encodeURIComponent(msg)}` : ''}`;
    }
    return $('texto').value;
  };

  const generar = () => {
    const dato = contenido();
    const estado = $('estado');
    const botones = [$('bajarPng'), $('bajarSvg')];
    if (!dato.trim()) {
      estado.textContent = 'Escribe el contenido para generar el código.';
      botones.forEach((b) => { b.disabled = true; });
      lienzo.getContext('2d').clearRect(0, 0, lienzo.width, lienzo.height);
      ultimo = null;
      return;
    }
    const nivel = logo ? 'H' : $('nivel').value;
    let qr;
    try {
      qr = window.qrcode(0, nivel);
      qr.addData(dato);
      qr.make();
    } catch (_) {
      estado.textContent = 'Ese contenido es demasiado largo para un código QR con esta corrección de errores. Acórtalo o baja el nivel.';
      botones.forEach((b) => { b.disabled = true; });
      ultimo = null;
      return;
    }
    const n = qr.getModuleCount();
    const margen = 4;
    const tamano = Number($('tamano').value);
    const modulo = Math.max(1, Math.floor(tamano / (n + margen * 2)));
    const lado = modulo * (n + margen * 2);
    lienzo.width = lado;
    lienzo.height = lado;
    const x = lienzo.getContext('2d');
    x.fillStyle = $('claro').value;
    x.fillRect(0, 0, lado, lado);
    x.fillStyle = $('oscuro').value;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) if (qr.isDark(r, c)) x.fillRect((c + margen) * modulo, (r + margen) * modulo, modulo, modulo);
    }
    ultimo = { n, modulo, margen, lado, oscuro: (r, c) => qr.isDark(r, c) };
    if (logo) {
      const lw = logo.naturalWidth || logo.width;
      const lh = logo.naturalHeight || logo.height;
      const caja = lado * 0.22;
      const k = Math.min(caja / lw, caja / lh);
      const w = lw * k;
      const h = lh * k;
      const pad = modulo * 1.5;
      x.fillStyle = $('claro').value;
      x.fillRect((lado - w) / 2 - pad, (lado - h) / 2 - pad, w + pad * 2, h + pad * 2);
      x.drawImage(logo, (lado - w) / 2, (lado - h) / 2, w, h);
    }
    estado.textContent = `Código de ${n} × ${n} módulos · ${lado} × ${lado} px. Pruébalo con la cámara de tu celular antes de imprimirlo.`;
    botones.forEach((b) => { b.disabled = false; });
  };

  const svg = () => {
    const { n, margen } = ultimo;
    const t = n + margen * 2;
    let d = '';
    for (let r = 0; r < n; r++) {
      let c = 0;
      while (c < n) {
        if (ultimo.oscuro(r, c)) {
          let fin = c;
          while (fin < n && ultimo.oscuro(r, fin)) fin++;
          d += `M${c + margen} ${r + margen}h${fin - c}v1h-${fin - c}z`;
          c = fin;
        } else c++;
      }
    }
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" width="${Number($('tamano').value)}" height="${Number($('tamano').value)}" shape-rendering="crispEdges">`
      + `<rect width="${t}" height="${t}" fill="${$('claro').value}"/><path d="${d}" fill="${$('oscuro').value}"/></svg>\n`;
  };

  document.querySelectorAll('.pestana').forEach((b) => b.addEventListener('click', () => {
    tipo = b.dataset.tipo;
    document.querySelectorAll('.pestana').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
    ['texto', 'wifi', 'whatsapp'].forEach((t) => { $(`f-${t}`).hidden = t !== tipo; });
    generar();
  }));
  ['texto', 'ssid', 'clave', 'seguridad', 'telefono', 'mensaje', 'oscuro', 'claro', 'nivel', 'tamano']
    .forEach((id) => $(id).addEventListener('input', generar));
  $('logo').addEventListener('change', async () => {
    const f = $('logo').files[0];
    logo = null;
    if (f) {
      try {
        if (f.type === 'image/svg+xml' || /\.svg$/i.test(f.name)) {
          const img = new Image();
          await new Promise((ok, mal) => { img.onload = ok; img.onerror = mal; img.src = URL.createObjectURL(f); });
          logo = img;
        } else logo = await I.cargar(f);
      } catch (_) { S.aviso('No se pudo abrir el logo.', 'error'); }
    }
    generar();
  });
  $('bajarPng').addEventListener('click', async () => {
    if (ultimo) S.descargar(await I.aBlob(lienzo, 'image/png'), 'codigo-qr.png', 'image/png');
  });
  $('bajarSvg').addEventListener('click', () => {
    if (!ultimo) return;
    if (logo) S.aviso('El SVG no incluye el logo: descarga el PNG si lo necesitas.');
    S.descargar(new Blob([svg()], { type: 'image/svg+xml' }), 'codigo-qr.svg', 'image/svg+xml');
  });
  generar();
})();
