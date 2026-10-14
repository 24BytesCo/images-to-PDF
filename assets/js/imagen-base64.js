/* Imagen a Base64 y Base64 a imagen, en el navegador. */
(function () {
  'use strict';
  const S = window.Suite;
  const I = window.Img;
  const $ = (id) => document.getElementById(id);
  const EXT = { ...I.EXT, 'image/svg+xml': 'svg', 'image/x-icon': 'ico', 'image/avif': 'avif' };
  let uri = '';
  let mime = '';
  let nombreAprox = 'imagen';
  let decodificada = null; // { blob, ext }

  /* ---- Imagen a Base64 ---- */
  const formatear = () => {
    const modo = $('salida').value;
    const puro = uri.slice(uri.indexOf(',') + 1);
    if (modo === 'puro') return puro;
    if (modo === 'html') return `<img src="${uri}" alt="">`;
    if (modo === 'css') return `background-image: url("${uri}");`;
    return uri;
  };

  const leerArchivo = (archivo) => new Promise((ok, mal) => {
    const lector = new FileReader();
    lector.onload = () => ok(lector.result);
    lector.onerror = () => mal(lector.error);
    lector.readAsDataURL(archivo);
  });

  const mostrarA = async (archivo) => {
    try {
      uri = await leerArchivo(archivo);
      if (archivo.type === '' ) uri = uri.replace(/^data:[^;,]*/, 'data:image/png');
      nombreAprox = S.nombreBase(archivo.name, 'imagen');
      $('zona').hidden = true;
      $('resultado-a').hidden = false;
      const pesoBase64 = uri.length - uri.indexOf(',') - 1;
      $('info-a').textContent = `${archivo.name} · original ${S.tamano(archivo.size)} · Base64 ${S.tamano(pesoBase64)} (≈ 33 % más)`;
      $('texto-a').value = formatear();
    } catch (error) {
      console.error(error);
      S.aviso('No se pudo leer esa imagen.', 'error');
    }
  };

  S.zona($('zona'), {
    input: $('entrada'),
    aceptar: (f) => f.type.startsWith('image/') || /\.(svg|ico|avif|jpe?g|png|webp|gif|bmp)$/i.test(f.name),
    mensajeVacio: 'Solo se aceptan imágenes.',
    alRecibir: (archivos) => mostrarA(archivos[0]),
  });
  $('salida').addEventListener('change', () => { if (uri) $('texto-a').value = formatear(); });
  $('copiar').addEventListener('click', async () => {
    const ok = await I.copiar($('texto-a').value);
    S.aviso(ok ? 'Copiado al portapapeles.' : 'No se pudo copiar: selecciona el texto y cópialo a mano.', ok ? 'ok' : 'error');
  });
  $('bajar-txt').addEventListener('click', () => {
    S.descargar(new Blob([$('texto-a').value], { type: 'text/plain' }), `${nombreAprox}-base64.txt`, 'text/plain');
  });
  $('otra').addEventListener('click', () => { $('resultado-a').hidden = true; $('zona').hidden = false; $('entrada').click(); });

  /* ---- Base64 a imagen ---- */
  const MAGIA = [
    ['image/png', [0x89, 0x50, 0x4e, 0x47]], ['image/jpeg', [0xff, 0xd8, 0xff]], ['image/gif', [0x47, 0x49, 0x46, 0x38]],
    ['image/webp', [0x52, 0x49, 0x46, 0x46]], ['image/bmp', [0x42, 0x4d]], ['image/x-icon', [0, 0, 1, 0]],
  ];

  const decodificar = () => {
    let t = $('texto-b').value.trim();
    $('bajar-img').disabled = true;
    $('caja-b').hidden = true;
    decodificada = null;
    if (!t) { $('info-b').textContent = ''; return; }
    let tipo = '';
    const m = /^data:([^;,]*)(;[^,]*)?,/i.exec(t);
    if (m) { tipo = m[1].toLowerCase(); t = t.slice(m[0].length); }
    t = t.replace(/^url\(["']?|["']?\)$/g, '').replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    try {
      const bin = atob(t.replace(/=+$/, ''));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const detectado = MAGIA.find(([, mg]) => mg.every((b, i) => bytes[i] === b));
      const esSvg = /<svg[\s>]/i.test(bin.slice(0, 600));
      tipo = detectado ? detectado[0] : esSvg ? 'image/svg+xml' : tipo;
      if (!tipo.startsWith('image/')) throw new Error('no es una imagen');
      const blob = new Blob([bytes], { type: tipo });
      decodificada = { blob, ext: EXT[tipo] || 'img' };
      const url = URL.createObjectURL(blob);
      const img = $('previa-b');
      const viejo = img.src;
      img.onload = () => {
        $('info-b').textContent = `${tipo.replace('image/', '').toUpperCase()} · ${img.naturalWidth} × ${img.naturalHeight} px · ${S.tamano(bytes.length)}`;
      };
      img.src = url;
      if (viejo.startsWith('blob:')) URL.revokeObjectURL(viejo);
      $('caja-b').hidden = false;
      $('bajar-img').disabled = false;
    } catch (_) {
      $('info-b').textContent = 'Eso no parece un Base64 de imagen válido. Revisa que esté completo.';
    }
  };

  $('texto-b').addEventListener('input', decodificar);
  $('bajar-img').addEventListener('click', () => {
    if (decodificada) S.descargar(decodificada.blob, `imagen-decodificada.${decodificada.ext}`, decodificada.blob.type);
  });

  /* ---- Pestañas ---- */
  const cambiar = (a) => {
    $('vista-a').hidden = !a;
    $('vista-b').hidden = a;
    $('tab-a').setAttribute('aria-pressed', String(a));
    $('tab-b').setAttribute('aria-pressed', String(!a));
  };
  $('tab-a').addEventListener('click', () => cambiar(true));
  $('tab-b').addEventListener('click', () => cambiar(false));
})();
