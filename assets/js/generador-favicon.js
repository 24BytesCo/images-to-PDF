/* Favicon completo (ICO + PNG + manifest) desde una imagen, en un ZIP. */
(function () {
  'use strict';
  const S = window.Suite;
  const I = window.Img;
  const $ = (id) => document.getElementById(id);
  const PNGS = [
    ['favicon-16x16.png', 16], ['favicon-32x32.png', 32], ['apple-touch-icon.png', 180],
    ['android-chrome-192x192.png', 192], ['android-chrome-512x512.png', 512],
  ];
  const ICO = [16, 32, 48];
  let fuente = null; // ImageBitmap o HTMLImageElement (SVG)
  let nombre = 'favicon';

  const dim = (f) => ({ w: f.naturalWidth || f.width, h: f.naturalHeight || f.height });

  /** Dibuja la fuente en un cuadrado de `n` px con las opciones elegidas. */
  const cuadrado = (n) => {
    const l = I.lienzo(n, n);
    const x = l.getContext('2d');
    x.imageSmoothingQuality = 'high';
    const r = Number($('esquinas').value) * n;
    x.save();
    if (r > 0) {
      x.beginPath();
      x.roundRect(0, 0, n, n, r);
      x.clip();
    }
    if ($('fondoModo').value === 'color') { x.fillStyle = $('fondo').value; x.fillRect(0, 0, n, n); }
    const { w, h } = dim(fuente);
    const k = $('ajuste').value === 'cover' ? Math.max(n / w, n / h) : Math.min(n / w, n / h);
    x.drawImage(fuente, (n - w * k) / 2, (n - h * k) / 2, w * k, h * k);
    x.restore();
    return l;
  };

  const pintar = () => {
    if (!fuente) return;
    $('campoFondo').hidden = $('fondoModo').value !== 'color';
    const cont = $('previas');
    cont.textContent = '';
    [[16, '16'], [32, '32'], [48, '48'], [96, '180 (iPhone)']].forEach(([n, etiqueta]) => {
      const fig = document.createElement('figure');
      const c = cuadrado(n);
      c.style.width = `${n}px`;
      const cap = document.createElement('figcaption');
      cap.textContent = `${etiqueta} px`;
      fig.append(c, cap);
      cont.appendChild(fig);
    });
  };

  /** ICO con imágenes PNG incrustadas (válido desde Windows Vista y en todos los navegadores). */
  const armarIco = async () => {
    const pngs = [];
    for (const n of ICO) pngs.push(new Uint8Array(await (await I.aBlob(cuadrado(n), 'image/png')).arrayBuffer()));
    const cab = 6 + 16 * pngs.length;
    const total = cab + pngs.reduce((s, p) => s + p.length, 0);
    const buf = new Uint8Array(total);
    const v = new DataView(buf.buffer);
    v.setUint16(2, 1, true);
    v.setUint16(4, pngs.length, true);
    let off = cab;
    pngs.forEach((p, i) => {
      const e = 6 + i * 16;
      buf[e] = ICO[i] === 256 ? 0 : ICO[i];
      buf[e + 1] = buf[e];
      v.setUint16(e + 4, 1, true);
      v.setUint16(e + 6, 32, true);
      v.setUint32(e + 8, p.length, true);
      v.setUint32(e + 12, off, true);
      buf.set(p, off);
      off += p.length;
    });
    return new Blob([buf], { type: 'image/x-icon' });
  };

  const generar = async () => {
    S.ocupado(true, 'Generando favicons…');
    try {
      const zip = new window.JSZip();
      zip.file('favicon.ico', await armarIco());
      for (const [archivo, n] of PNGS) zip.file(archivo, await I.aBlob(cuadrado(n), 'image/png'));
      zip.file('site.webmanifest', JSON.stringify({
        name: '', short_name: '',
        icons: [
          { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
        theme_color: '#ffffff', background_color: '#ffffff', display: 'standalone',
      }, null, 2));
      zip.file('pegar-en-head.html', [
        '<link rel="icon" href="/favicon.ico" sizes="48x48">',
        '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
        '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
        '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
        '<link rel="manifest" href="/site.webmanifest">',
        '',
      ].join('\n'));
      const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      S.descargar(blob, `${nombre}-favicons.zip`, 'application/zip');
      S.aviso('Listo. Sube los archivos a la raíz de tu sitio y pega el código en el head.', 'ok');
    } catch (error) {
      console.error(error);
      S.aviso('No se pudo generar el paquete.', 'error');
    } finally {
      S.ocupado(false);
    }
  };

  const cargarSvg = (archivo) => new Promise((ok, mal) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      if (!img.naturalWidth) { mal(new Error('svg sin tamaño')); return; }
      ok(img);
    };
    img.onerror = () => mal(new Error('svg no válido'));
    img.src = url;
  });

  const esSvg = (f) => f.type === 'image/svg+xml' || /\.svg$/i.test(f.name);

  S.zona($('zona'), {
    input: $('entrada'),
    aceptar: (f) => I.esImagen(f) || esSvg(f),
    mensajeVacio: 'Solo se aceptan imágenes PNG, JPG, WebP o SVG.',
    alRecibir: async (archivos) => {
      const f = archivos[0];
      try {
        fuente = esSvg(f) ? await cargarSvg(f) : await I.cargar(f);
        nombre = S.nombreBase(f.name, 'favicon');
        $('zona').hidden = true;
        $('panel').hidden = false;
        pintar();
        const { w, h } = dim(fuente);
        if (Math.min(w, h) < 512 && !esSvg(f)) S.aviso(`La imagen mide ${w} × ${h} px: los iconos grandes (512 px) saldrán algo borrosos.`);
      } catch (error) {
        console.error(error);
        S.aviso('No se pudo abrir esa imagen.', 'error');
      }
    },
  });
  ['ajuste', 'esquinas', 'fondoModo', 'fondo'].forEach((id) => $(id).addEventListener('input', pintar));
  $('cambiar').addEventListener('click', () => { $('panel').hidden = true; $('zona').hidden = false; $('entrada').click(); });
  $('generar').addEventListener('click', generar);
})();
