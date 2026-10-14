/* SVG a PNG/JPG/WebP rasterizando en un lienzo, a la escala que se pida. */
(function () {
  'use strict';
  const S = window.Suite;
  const I = window.Img;
  const $ = (id) => document.getElementById(id);
  let texto = '';     // SVG normalizado (con width/height)
  let base = { w: 0, h: 0 };
  let nombre = 'imagen';
  let urlPrevia = '';

  const num = (v) => {
    const n = parseFloat(String(v || '').replace(',', '.'));
    return Number.isFinite(n) && n > 0 && !/%/.test(String(v)) ? n : 0;
  };

  /** Valida el SVG, calcula su tamaño base y devuelve el texto con width/height explícitos. */
  const normalizar = (codigo) => {
    const doc = new DOMParser().parseFromString(codigo, 'image/svg+xml');
    const raiz = doc.documentElement;
    if (!raiz || raiz.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) throw new Error('SVG no válido');
    let w = num(raiz.getAttribute('width'));
    let h = num(raiz.getAttribute('height'));
    const vb = (raiz.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    if ((!w || !h) && vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
      if (w && !h) h = (w * vb[3]) / vb[2];
      else if (h && !w) w = (h * vb[2]) / vb[3];
      else { w = vb[2]; h = vb[3]; }
    }
    if (!w || !h) { w = w || 300; h = h || 150; }
    if (!raiz.getAttribute('xmlns')) raiz.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    if (!raiz.getAttribute('viewBox')) raiz.setAttribute('viewBox', `0 0 ${w} ${h}`);
    raiz.setAttribute('width', String(w));
    raiz.setAttribute('height', String(h));
    return { texto: new XMLSerializer().serializeToString(doc), w, h };
  };

  const medidas = () => {
    const modo = $('escala').value;
    const k = modo === 'ancho' ? Math.max(1, Number($('ancho').value) || 1) / base.w : Number(modo);
    return { w: Math.max(1, Math.round(base.w * k)), h: Math.max(1, Math.round(base.h * k)) };
  };

  const cargarImagen = (svgTexto) => new Promise((ok, mal) => {
    const url = URL.createObjectURL(new Blob([svgTexto], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => ok({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('No se pudo dibujar el SVG')); };
    img.src = url;
  });

  const pintar = () => {
    if (!texto) return;
    $('campoAncho').hidden = $('escala').value !== 'ancho';
    $('campoFondo').hidden = $('fondoModo').value !== 'color';
    const m = medidas();
    $('medida').textContent = `${m.w} × ${m.h} px`;
    $('convertir').disabled = m.w > 8000 || m.h > 8000;
    if (m.w > 8000 || m.h > 8000) $('medida').textContent += ' (máximo 8000 px)';
  };

  const cargar = async (codigo, nombreArchivo) => {
    try {
      const n = normalizar(codigo);
      const { img, url } = await cargarImagen(n.texto);
      texto = n.texto;
      base = { w: n.w, h: n.h };
      if (nombreArchivo) nombre = S.nombreBase(nombreArchivo, 'imagen');
      if (urlPrevia) URL.revokeObjectURL(urlPrevia);
      urlPrevia = url;
      $('previa').src = img.src;
      $('panel').hidden = false;
      pintar();
    } catch (error) {
      texto = '';
      $('panel').hidden = true;
      S.aviso('Ese contenido no es un SVG válido.', 'error');
    }
  };

  const convertir = async () => {
    const m = medidas();
    const tipo = $('formato').value;
    S.ocupado(true, 'Convirtiendo…');
    try {
      const { img, url } = await cargarImagen(texto);
      const l = I.lienzo(m.w, m.h);
      const x = l.getContext('2d');
      const modo = $('fondoModo').value;
      const fondo = modo === 'blanco' || (tipo === 'image/jpeg' && modo === 'transparente') ? '#ffffff'
        : modo === 'color' ? $('fondo').value : null;
      if (fondo) { x.fillStyle = fondo; x.fillRect(0, 0, m.w, m.h); }
      x.drawImage(img, 0, 0, m.w, m.h);
      URL.revokeObjectURL(url);
      const blob = await I.aBlob(l, tipo, 0.95);
      S.descargar(blob, `${nombre}-${m.w}x${m.h}.${I.EXT[tipo]}`, tipo);
      S.aviso('Listo. Revisa tus descargas.', 'ok');
    } catch (error) {
      console.error(error);
      S.aviso('No se pudo convertir ese SVG.', 'error');
    } finally {
      S.ocupado(false);
    }
  };

  S.zona($('zona'), {
    input: $('entrada'),
    aceptar: (f) => f.type === 'image/svg+xml' || /\.svg$/i.test(f.name),
    mensajeVacio: 'Solo se aceptan archivos SVG.',
    alRecibir: async (archivos) => cargar(await archivos[0].text(), archivos[0].name),
  });
  let temporizador = null;
  $('codigo').addEventListener('input', () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => { if ($('codigo').value.trim()) { nombre = 'imagen'; cargar($('codigo').value.trim(), null); } }, 300);
  });
  ['escala', 'ancho', 'fondoModo'].forEach((id) => $(id).addEventListener('input', pintar));
  $('convertir').addEventListener('click', convertir);
  const tab = (archivo) => {
    $('vista-archivo').hidden = !archivo;
    $('vista-codigo').hidden = archivo;
    $('tab-archivo').setAttribute('aria-pressed', String(archivo));
    $('tab-codigo').setAttribute('aria-pressed', String(!archivo));
  };
  $('tab-archivo').addEventListener('click', () => tab(true));
  $('tab-codigo').addEventListener('click', () => tab(false));
})();
