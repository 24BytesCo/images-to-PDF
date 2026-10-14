/* Marca de agua (texto o logo) en una o varias imágenes, con el mismo ajuste para todas. */
(function () {
  'use strict';
  const S = window.Suite;
  const I = window.Img;
  const $ = (id) => document.getElementById(id);
  const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
  let archivos = [];
  let primera = null; // ImageBitmap reducido de la primera foto
  let logo = null;    // ImageBitmap | HTMLImageElement
  let modo = 'texto';

  const luminosidad = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  };

  /** Dibuja la marca sobre un lienzo de w×h. Todo es relativo al ancho: la vista previa coincide con el resultado. */
  const marcar = (ctx, w, h) => {
    const pct = Number($('tamano').value) / 100;
    const ang = (Number($('angulo').value) * Math.PI) / 180;
    const mosaico = $('posicion').value === 'mosaico';
    let ancho;
    let alto;
    let pintar;
    if (modo === 'logo') {
      if (!logo) return;
      const lw = logo.naturalWidth || logo.width;
      const lh = logo.naturalHeight || logo.height;
      ancho = w * pct * (mosaico ? 0.6 : 1);
      alto = (ancho * lh) / lw;
      pintar = () => ctx.drawImage(logo, -ancho / 2, -alto / 2, ancho, alto);
    } else {
      const texto = $('texto').value.trim();
      if (!texto) return;
      let tam = w * pct * 0.35 * (mosaico ? 0.6 : 1);
      ctx.font = `700 ${tam}px system-ui, "Segoe UI", Roboto, Arial, sans-serif`;
      let medido = ctx.measureText(texto).width;
      const tope = w * 0.94;
      if (medido > tope) { tam *= tope / medido; medido = tope; ctx.font = `700 ${tam}px system-ui, "Segoe UI", Roboto, Arial, sans-serif`; }
      ancho = medido;
      alto = tam * 1.2;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const color = $('color').value;
      ctx.shadowColor = luminosidad(color) > 0.5 ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)';
      ctx.shadowBlur = tam * 0.12;
      ctx.fillStyle = color;
      pintar = () => ctx.fillText(texto, 0, 0);
    }
    ctx.save();
    ctx.globalAlpha = Number($('opacidad').value) / 100;
    if (mosaico) {
      const diag = Math.hypot(w, h);
      const px = ancho * 1.8;
      const py = alto * 3.2;
      ctx.translate(w / 2, h / 2);
      ctx.rotate(ang || -Math.PI / 8);
      let fila = 0;
      for (let yy = -diag; yy <= diag; yy += py, fila++) {
        for (let xx = -diag + (fila % 2 ? px / 2 : 0); xx <= diag; xx += px) {
          ctx.save();
          ctx.translate(xx, yy);
          pintar();
          ctx.restore();
        }
      }
    } else {
      const m = Math.max(w * 0.025, 6);
      const p = $('posicion').value;
      const cx = p[1] === 'l' ? m + ancho / 2 : p[1] === 'r' ? w - m - ancho / 2 : w / 2;
      const cy = p[0] === 't' ? m + alto / 2 : p[0] === 'b' ? h - m - alto / 2 : h / 2;
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      pintar();
    }
    ctx.restore();
  };

  const vista = () => {
    if (!primera) return;
    const v = $('vista');
    v.width = primera.width;
    v.height = primera.height;
    const x = v.getContext('2d');
    x.drawImage(primera, 0, 0);
    marcar(x, v.width, v.height);
  };

  const cargarLogo = async (f) => {
    if (f.type === 'image/svg+xml' || /\.svg$/i.test(f.name)) {
      const url = URL.createObjectURL(f);
      const img = new Image();
      await new Promise((ok, mal) => { img.onload = ok; img.onerror = mal; img.src = url; });
      return img;
    }
    return I.cargar(f);
  };

  const aplicar = async () => {
    if (modo === 'logo' && !logo) { S.aviso('Elige primero el archivo del logo.', 'error'); return; }
    S.ocupado(true, 'Aplicando marca…');
    const hechos = [];
    try {
      for (const f of archivos) {
        try {
          const b = await I.cargar(f);
          const l = I.lienzo(b.width, b.height);
          const x = l.getContext('2d');
          x.drawImage(b, 0, 0);
          b.close();
          marcar(x, l.width, l.height);
          const tipo = TIPOS.includes(f.type) ? f.type : 'image/jpeg';
          hechos.push({ blob: await I.aBlob(l, tipo, 0.92), nombre: `${S.nombreBase(f.name, 'foto')}-marca.${I.EXT[tipo]}` });
        } catch (error) {
          console.error(error);
          S.aviso(`No se pudo procesar ${f.name}.`, 'error');
        }
      }
      if (!hechos.length) return;
      await I.entregar(hechos, 'fotos-con-marca.zip');
      S.aviso('Listo. Revisa tus descargas.', 'ok');
    } finally {
      S.ocupado(false);
    }
  };

  const abrir = async (lista) => {
    archivos = lista;
    try {
      const b = await I.cargar(lista[0]);
      const k = Math.min(1, 900 / Math.max(b.width, b.height));
      primera = k < 1 ? I.escalar(b, b.width * k, b.height * k) : b;
      $('zona').hidden = true;
      $('panel').hidden = false;
      $('resumen').textContent = `${lista.length} ${lista.length === 1 ? 'foto' : 'fotos'} · vista previa de la primera`;
      vista();
    } catch (error) {
      console.error(error);
      S.aviso('No se pudo abrir la primera imagen.', 'error');
    }
  };

  S.zona($('zona'), {
    input: $('entrada'),
    aceptar: (f) => TIPOS.includes(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name),
    mensajeVacio: 'Solo se aceptan fotos JPG, PNG o WebP.',
    alRecibir: abrir,
  });
  const pestana = (m) => {
    modo = m;
    $('tab-texto').setAttribute('aria-pressed', String(m === 'texto'));
    $('tab-logo').setAttribute('aria-pressed', String(m === 'logo'));
    $('campoTexto').hidden = $('campoColor').hidden = m !== 'texto';
    $('campoLogo').hidden = m !== 'logo';
    vista();
  };
  $('tab-texto').addEventListener('click', () => pestana('texto'));
  $('tab-logo').addEventListener('click', () => pestana('logo'));
  $('logo').addEventListener('change', async () => {
    const f = $('logo').files[0];
    if (!f) return;
    try { logo = await cargarLogo(f); vista(); } catch (_) { S.aviso('No se pudo abrir el logo.', 'error'); }
  });
  [['tamano', 'tamanoValor', ' %'], ['opacidad', 'opacidadValor', ' %'], ['angulo', 'anguloValor', '°']].forEach(([id, out, suf]) => {
    $(id).addEventListener('input', () => { $(out).textContent = `${$(id).value}${suf}`; vista(); });
  });
  ['texto', 'color', 'posicion'].forEach((id) => $(id).addEventListener('input', vista));
  $('cambiar').addEventListener('click', () => { $('panel').hidden = true; $('zona').hidden = false; $('entrada').click(); });
  $('aplicar').addEventListener('click', aplicar);
})();
