/* Comprimir PDF: cada página se vuelve a dibujar como foto JPEG (pdf.js → canvas)
   y se arma un PDF nuevo con jsPDF. Todo en el navegador. Ver la explicación en
   tools/ui/comprimir-pdf.html sobre por qué esto no siempre reduce el tamaño. */
(function () {
  'use strict';
  const S = window.Suite;
  const zona = document.getElementById('zona');
  const entrada = document.getElementById('entrada');
  const panel = document.getElementById('panel');
  const resumen = document.getElementById('resumen');
  const resultado = document.getElementById('resultado');
  const LIMITE_PX = 16_000_000;
  const PUNTOS_A_MM = 25.4 / 72;

  const NIVELES = {
    ligero: { ppp: 150, calidad: 0.82 },
    medio: { ppp: 110, calidad: 0.68 },
    fuerte: { ppp: 85, calidad: 0.5 },
  };

  window.pdfjsLib.GlobalWorkerOptions.workerSrc = '../assets/vendor/pdf.worker.min.js';

  let doc = null;
  let archivoOriginal = null;

  const restablecer = () => {
    doc = null;
    archivoOriginal = null;
    panel.hidden = true;
    resultado.hidden = true;
    entrada.value = '';
  };

  const ocultarResultado = () => {
    resultado.hidden = true;
    document.getElementById('descargarComprimido').hidden = true;
    document.getElementById('descargarDeTodasFormas').hidden = true;
    document.getElementById('avisoPeor').hidden = true;
  };

  const cargar = async (archivos) => {
    const archivo = archivos[0];
    if (archivos.length > 1) S.aviso('Solo se procesa un PDF a la vez; se tomó el primero.', 'error');
    S.ocupado(true, 'Leyendo PDF…');
    try {
      const bytes = await S.leer(archivo);
      doc = await window.pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
      archivoOriginal = archivo;
      panel.hidden = false;
      ocultarResultado();
      resumen.textContent = `${archivo.name} · ${doc.numPages} ${doc.numPages === 1 ? 'página' : 'páginas'} · ${S.tamano(archivo.size)}`;
      document.getElementById('nombre').value = S.nombreBase(archivo.name);
    } catch (error) {
      doc = null;
      if (error && error.name === 'PasswordException') {
        S.aviso('Este PDF está protegido con contraseña. Quítale la protección antes de comprimirlo.', 'error');
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

  const comprimir = async () => {
    if (!doc || !archivoOriginal) return;
    const nivel = NIVELES[document.getElementById('nivel').value] || NIVELES.medio;
    const base = S.nombreBase(document.getElementById('nombre').value);
    ocultarResultado();
    S.ocupado(true, `Página 1 de ${doc.numPages}…`);
    const lienzo = document.createElement('canvas');
    const ctx = lienzo.getContext('2d');
    let pdf = null;
    try {
      for (let numeroPagina = 1; numeroPagina <= doc.numPages; numeroPagina++) {
        S.ocupado(true, `Página ${numeroPagina} de ${doc.numPages}…`);
        const pagina = await doc.getPage(numeroPagina);
        // Tamaño físico real de la página (ya con la rotación aplicada) para conservarlo en el PDF nuevo.
        const base1 = pagina.getViewport({ scale: 1 });
        const anchoMM = Math.abs(base1.width) * PUNTOS_A_MM;
        const altoMM = Math.abs(base1.height) * PUNTOS_A_MM;
        const orientacion = anchoMM >= altoMM ? 'landscape' : 'portrait';

        let escala = nivel.ppp / 72;
        let viewport = pagina.getViewport({ scale: escala });
        if (viewport.width * viewport.height > LIMITE_PX) {
          escala *= Math.sqrt(LIMITE_PX / (viewport.width * viewport.height));
          viewport = pagina.getViewport({ scale: escala });
        }
        lienzo.width = Math.max(1, Math.round(viewport.width));
        lienzo.height = Math.max(1, Math.round(viewport.height));
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, lienzo.width, lienzo.height);
        await pagina.render({ canvasContext: ctx, viewport }).promise;
        const datosJpeg = lienzo.toDataURL('image/jpeg', nivel.calidad);

        const { jsPDF } = window.jspdf;
        if (!pdf) pdf = new jsPDF({ unit: 'mm', format: [anchoMM, altoMM], orientation: orientacion, compress: true });
        else pdf.addPage([anchoMM, altoMM], orientacion);
        pdf.addImage(datosJpeg, 'JPEG', 0, 0, anchoMM, altoMM, undefined, 'FAST');
        pagina.cleanup();
      }

      const blobNuevo = pdf.output('blob');
      const tamanoOriginal = archivoOriginal.size;
      const tamanoNuevo = blobNuevo.size;
      const mejora = tamanoOriginal > 0 ? (1 - tamanoNuevo / tamanoOriginal) * 100 : 0;
      const nombreArchivo = `${base}-comprimido.pdf`;

      document.getElementById('cifraOriginal').textContent = S.tamano(tamanoOriginal);
      document.getElementById('cifraNueva').textContent = S.tamano(tamanoNuevo);
      resultado.hidden = false;

      if (tamanoNuevo < tamanoOriginal) {
        resultado.dataset.tipo = 'mejor';
        document.getElementById('cifraPorcentaje').textContent = `-${mejora.toFixed(0)}%`;
        document.getElementById('cifraPorcentajeEtq').textContent = 'Más liviano';
        document.getElementById('descargarComprimido').hidden = false;
        document.getElementById('descargarComprimido').onclick = () => S.descargar(blobNuevo, nombreArchivo, 'application/pdf');
        S.descargar(blobNuevo, nombreArchivo, 'application/pdf');
        S.aviso(`Listo: ${mejora.toFixed(0)}% más liviano. Revisa tus descargas.`, 'ok');
      } else {
        resultado.dataset.tipo = 'peor';
        document.getElementById('cifraPorcentaje').textContent = `+${(-mejora).toFixed(0)}%`;
        document.getElementById('cifraPorcentajeEtq').textContent = 'Más pesado';
        document.getElementById('avisoPeor').hidden = false;
        const botonForzar = document.getElementById('descargarDeTodasFormas');
        botonForzar.hidden = false;
        botonForzar.onclick = () => S.descargar(blobNuevo, nombreArchivo, 'application/pdf');
        S.aviso('El PDF comprimido quedó más pesado que el original. No se descargó solo: revisa el resultado.', 'error');
      }
      S.evento('pdf-creado', { herramienta: 'comprimir-pdf', nivel: document.getElementById('nivel').value });
    } catch (error) {
      console.error(error);
      S.aviso('No se pudo comprimir el PDF. Prueba con un nivel más fuerte o menos páginas.', 'error');
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
  document.getElementById('comprimir').addEventListener('click', comprimir);
})();
