/* PDF → imágenes (JPG/PNG) con pdf.js. Todo en el navegador. */
(function () {
  'use strict';
  const S = window.Suite;
  const zona = document.getElementById('zona');
  const entrada = document.getElementById('entrada');
  const panel = document.getElementById('panel');
  const resumen = document.getElementById('resumen');
  const rejilla = document.getElementById('miniaturas');
  const LIMITE_PX = 16_000_000; // tope de un canvas para no reventar memoria en móviles

  window.pdfjsLib.GlobalWorkerOptions.workerSrc = '../assets/vendor/pdf.worker.min.js';

  let doc = null;
  let urlsMiniatura = [];

  const limpiarMiniaturas = () => {
    urlsMiniatura.forEach((u) => URL.revokeObjectURL(u));
    urlsMiniatura = [];
    rejilla.textContent = '';
  };

  const agregarMiniatura = (numeroPagina, blob) => {
    const url = URL.createObjectURL(blob);
    urlsMiniatura.push(url);
    const caja = document.createElement('div');
    caja.className = 'miniatura';
    caja.innerHTML = '<div class="miniatura-hoja"><img alt=""></div><div class="miniatura-pie"></div>';
    caja.querySelector('img').src = url;
    caja.querySelector('.miniatura-pie').textContent = `Página ${numeroPagina}`;
    rejilla.appendChild(caja);
  };

  const restablecer = () => {
    doc = null;
    limpiarMiniaturas();
    panel.hidden = true;
    entrada.value = '';
  };

  /** «1-3, 5» → [1,2,3,5]. Vacío → todas. Lanza Error con mensaje legible si algo no cuadra. */
  const parsearPaginas = (expresion, numPaginas) => {
    const texto = expresion.trim();
    if (!texto) return Array.from({ length: numPaginas }, (_, i) => i + 1);
    const partes = texto.split(',').map((s) => s.trim()).filter(Boolean);
    if (!partes.length) return Array.from({ length: numPaginas }, (_, i) => i + 1);
    const set = new Set();
    for (const parte of partes) {
      const rango = parte.match(/^(\d+)\s*-\s*(\d+)$/);
      if (rango) {
        let a = Number(rango[1]);
        let b = Number(rango[2]);
        if (a > b) [a, b] = [b, a];
        for (let n = a; n <= b; n++) set.add(n);
      } else if (/^\d+$/.test(parte)) {
        set.add(Number(parte));
      } else {
        throw new Error(`«${parte}» no es una página ni un rango válido.`);
      }
    }
    const paginas = Array.from(set).sort((a, b) => a - b);
    const fuera = paginas.filter((n) => n < 1 || n > numPaginas);
    if (fuera.length) {
      throw new Error(`Tu PDF tiene ${numPaginas} página(s); ${fuera.join(', ')} está(n) fuera de rango.`);
    }
    return paginas;
  };

  const cargar = async (archivos) => {
    const archivo = archivos[0];
    if (archivos.length > 1) S.aviso('Solo se procesa un PDF a la vez; se tomó el primero.', 'error');
    S.ocupado(true, 'Leyendo PDF…');
    try {
      const bytes = await S.leer(archivo);
      const tarea = window.pdfjsLib.getDocument({ data: new Uint8Array(bytes) });
      doc = await tarea.promise;
      limpiarMiniaturas();
      panel.hidden = false;
      resumen.textContent = `${archivo.name} · ${doc.numPages} ${doc.numPages === 1 ? 'página' : 'páginas'} · ${S.tamano(archivo.size)}`;
      document.getElementById('nombre').value = S.nombreBase(archivo.name);
    } catch (error) {
      doc = null;
      if (error && error.name === 'PasswordException') {
        S.aviso('Este PDF está protegido con contraseña. Quítale la protección antes de convertirlo.', 'error');
      } else if (error && error.name === 'InvalidPDFException') {
        S.aviso('Ese archivo no es un PDF válido o está corrupto.', 'error');
      } else {
        console.error(error);
        S.aviso('No se pudo leer el PDF. Prueba con otro archivo.', 'error');
      }
    } finally {
      S.ocupado(false);
    }
  };

  const convertir = async () => {
    if (!doc) return;
    const formato = document.getElementById('formato').value;
    const ppp = Number(document.getElementById('resolucion').value);
    const base = S.nombreBase(document.getElementById('nombre').value);
    const mime = formato === 'png' ? 'image/png' : 'image/jpeg';
    const calidad = formato === 'png' ? undefined : 0.88;
    const extension = formato === 'png' ? 'png' : 'jpg';

    let paginas;
    try {
      paginas = parsearPaginas(document.getElementById('paginas').value, doc.numPages);
    } catch (error) {
      S.aviso(error.message, 'error');
      return;
    }

    const lienzo = document.createElement('canvas');
    const ctx = lienzo.getContext('2d');
    const generadas = [];
    let recortada = false;

    S.ocupado(true, `Página 1 de ${paginas.length}…`);
    try {
      limpiarMiniaturas();
      for (let i = 0; i < paginas.length; i++) {
        const numeroPagina = paginas[i];
        S.ocupado(true, `Página ${i + 1} de ${paginas.length}…`);
        const pagina = await doc.getPage(numeroPagina);
        let escala = ppp / 72;
        let viewport = pagina.getViewport({ scale: escala });
        const pixeles = viewport.width * viewport.height;
        if (pixeles > LIMITE_PX) {
          escala *= Math.sqrt(LIMITE_PX / pixeles);
          viewport = pagina.getViewport({ scale: escala });
          recortada = true;
        }
        lienzo.width = Math.max(1, Math.round(viewport.width));
        lienzo.height = Math.max(1, Math.round(viewport.height));
        if (formato === 'jpg') {
          // Fondo blanco: sin esto las zonas transparentes salen negras en JPEG.
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, lienzo.width, lienzo.height);
        } else {
          ctx.clearRect(0, 0, lienzo.width, lienzo.height);
        }
        await pagina.render({ canvasContext: ctx, viewport }).promise;
        const blob = await new Promise((ok) => lienzo.toBlob(ok, mime, calidad));
        if (!blob) throw new Error('No se pudo generar la imagen de la página ' + numeroPagina);
        const nombreArchivo = `${base}-pag-${String(numeroPagina).padStart(3, '0')}.${extension}`;
        generadas.push({ nombre: nombreArchivo, blob, numeroPagina });
        agregarMiniatura(numeroPagina, blob);
        pagina.cleanup();
      }

      if (generadas.length === 1) {
        S.descargar(generadas[0].blob, generadas[0].nombre, mime);
      } else {
        S.ocupado(true, 'Armando el ZIP…');
        const zip = new window.JSZip();
        generadas.forEach((g) => zip.file(g.nombre, g.blob));
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        S.descargar(zipBlob, `${base}.zip`, 'application/zip');
      }

      const aviso = recortada
        ? 'Listo. En alguna página se redujo la resolución para no pasar el límite de memoria del navegador.'
        : 'Listo. Revisa tus descargas.';
      S.aviso(aviso, 'ok');
      S.evento('pdf-creado', { herramienta: 'pdf-a-imagenes', paginas: generadas.length });
    } catch (error) {
      console.error(error);
      S.aviso('No se pudieron convertir las páginas. Prueba con menos resolución o menos páginas.', 'error');
    } finally {
      S.ocupado(false);
    }
  };

  S.zona(zona, {
    input: entrada,
    aceptar: (f) => S.esPdf(f),
    mensajeVacio: 'Solo se acepta un archivo PDF.',
    alRecibir: cargar,
  });
  document.getElementById('quitar').addEventListener('click', restablecer);
  document.getElementById('convertir').addEventListener('click', convertir);
})();
