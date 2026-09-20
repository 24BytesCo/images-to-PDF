/* Imágenes → PDF con jsPDF. Todo en el navegador. */
(function () {
  'use strict';
  const S = window.Suite;
  const zona = document.getElementById('zona');
  const entrada = document.getElementById('entrada');
  const panel = document.getElementById('panel');
  const rejilla = document.getElementById('miniaturas');
  const resumen = document.getElementById('resumen');
  const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];

  /** @type {{nombre:string, tamano:number, url:string, ancho:number, alto:number, tipo:string}[]} */
  let imagenes = [];

  const medir = (url) => new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => ok({ ancho: img.naturalWidth, alto: img.naturalHeight, img });
    img.onerror = () => mal(new Error('imagen ilegible'));
    img.src = url;
  });

  const aDataUrl = (archivo) => new Promise((ok, mal) => {
    const lector = new FileReader();
    lector.onload = () => ok(lector.result);
    lector.onerror = () => mal(lector.error);
    lector.readAsDataURL(archivo);
  });

  const pintar = () => {
    panel.hidden = imagenes.length === 0;
    const peso = imagenes.reduce((s, i) => s + i.tamano, 0);
    resumen.textContent = `${imagenes.length} ${imagenes.length === 1 ? 'imagen' : 'imágenes'} · ${S.tamano(peso)}`;
    rejilla.textContent = '';
    imagenes.forEach((im, i) => {
      const caja = document.createElement('div');
      caja.className = 'miniatura';
      caja.draggable = true;
      caja.innerHTML = '<div class="miniatura-hoja"><img alt=""></div><div class="miniatura-pie"></div>';
      caja.querySelector('img').src = im.url;
      caja.querySelector('.miniatura-pie').textContent = `${i + 1}. ${im.nombre}`;
      const quitar = document.createElement('button');
      quitar.type = 'button';
      quitar.className = 'quitar';
      quitar.setAttribute('aria-label', `Quitar ${im.nombre}`);
      quitar.textContent = '×';
      quitar.addEventListener('click', (ev) => { ev.stopPropagation(); imagenes.splice(i, 1); pintar(); });
      caja.appendChild(quitar);
      rejilla.appendChild(caja);
    });
  };

  const recibir = async (archivos) => {
    S.ocupado(true, 'Leyendo imágenes…');
    try {
      for (const archivo of archivos) {
        try {
          const url = await aDataUrl(archivo);
          const { ancho, alto } = await medir(url);
          imagenes.push({ nombre: archivo.name, tamano: archivo.size, url, ancho, alto, tipo: archivo.type });
        } catch (_) {
          S.aviso(`No se pudo leer ${archivo.name}.`, 'error');
        }
      }
      pintar();
    } finally {
      S.ocupado(false);
    }
  };

  /** WebP (y cualquier otra cosa) se pasa por canvas a JPEG: jsPDF solo entiende JPEG y PNG. */
  const paraPdf = async (im) => {
    if (im.tipo === 'image/jpeg') return { datos: im.url, formato: 'JPEG' };
    if (im.tipo === 'image/png') return { datos: im.url, formato: 'PNG' };
    const { img } = await medir(im.url);
    const lienzo = document.createElement('canvas');
    lienzo.width = im.ancho;
    lienzo.height = im.alto;
    const ctx = lienzo.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, im.ancho, im.alto);
    ctx.drawImage(img, 0, 0);
    return { datos: lienzo.toDataURL('image/jpeg', 0.92), formato: 'JPEG' };
  };

  const crear = async () => {
    if (!imagenes.length) return;
    const formato = document.getElementById('formato').value;
    const orientacionFija = document.getElementById('orientacion').value;
    const margen = Number(document.getElementById('margen').value) || 0;
    const nombre = S.nombreBase(document.getElementById('nombre').value) + '.pdf';
    S.ocupado(true, 'Creando el PDF…');
    try {
      const { jsPDF } = window.jspdf;
      let pdf = null;
      for (const im of imagenes) {
        const apaisada = im.ancho > im.alto;
        const orientacion = orientacionFija === 'auto' ? (apaisada ? 'landscape' : 'portrait') : orientacionFija;
        // «Ajustar» usa el tamaño de la imagen en mm a 96 ppp, más el margen.
        const medidas = formato === 'ajustar'
          ? [im.ancho * 0.2646 + margen * 2, im.alto * 0.2646 + margen * 2]
          : formato;
        const orient = formato === 'ajustar' ? (medidas[0] > medidas[1] ? 'landscape' : 'portrait') : orientacion;
        if (!pdf) pdf = new jsPDF({ unit: 'mm', format: medidas, orientation: orient, compress: true });
        else pdf.addPage(medidas, orient);
        const anchoPag = pdf.internal.pageSize.getWidth();
        const altoPag = pdf.internal.pageSize.getHeight();
        const cajaAncho = anchoPag - margen * 2;
        const cajaAlto = altoPag - margen * 2;
        const escala = Math.min(cajaAncho / im.ancho, cajaAlto / im.alto);
        const w = im.ancho * escala;
        const h = im.alto * escala;
        const { datos, formato: fmt } = await paraPdf(im);
        pdf.addImage(datos, fmt, (anchoPag - w) / 2, (altoPag - h) / 2, w, h, undefined, 'FAST');
      }
      pdf.save(nombre);
      S.aviso('PDF creado. Revisa tus descargas.', 'ok');
      S.evento('descarga', { herramienta: 'imagenes-a-pdf' });
    } catch (error) {
      console.error(error);
      S.aviso('No se pudo crear el PDF. Prueba con menos imágenes o más pequeñas.', 'error');
    } finally {
      S.ocupado(false);
    }
  };

  S.zona(zona, {
    input: entrada,
    aceptar: (f) => TIPOS.includes(f.type),
    mensajeVacio: 'Solo se aceptan imágenes JPG, PNG o WebP.',
    alRecibir: recibir,
  });
  S.ordenable(rejilla, '.miniatura', (desde, hasta) => {
    const [movida] = imagenes.splice(desde, 1);
    imagenes.splice(hasta, 0, movida);
    pintar();
  });
  const porNombre = (dir) => () => {
    imagenes.sort((a, b) => dir * a.nombre.localeCompare(b.nombre, 'es', { numeric: true, sensitivity: 'base' }));
    pintar();
  };
  document.getElementById('ordenAsc').addEventListener('click', porNombre(1));
  document.getElementById('ordenDesc').addEventListener('click', porNombre(-1));
  document.getElementById('vaciar').addEventListener('click', () => { imagenes = []; pintar(); });
  document.getElementById('crear').addEventListener('click', crear);
})();
