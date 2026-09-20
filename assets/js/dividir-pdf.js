/* Dividir PDF con pdf-lib (y JSZip cuando el resultado son varios archivos). Todo en el navegador. */
(function () {
  'use strict';
  const S = window.Suite;
  const zona = document.getElementById('dividirZona');
  const entrada = document.getElementById('dividirEntrada');
  const panel = document.getElementById('dividirPanel');
  const resumen = document.getElementById('dividirResumen');
  const modoSel = document.getElementById('dividirModo');
  const campoRango = document.getElementById('dividirCampoRango');
  const campoCada = document.getElementById('dividirCampoCada');
  const boton = document.getElementById('dividirBoton');

  /** @type {{nombre:string, tamano:number, paginas:number, doc:Object}|null} */
  let actual = null;

  const pad = (n, ancho) => String(n).padStart(ancho, '0');

  const mostrarCampos = () => {
    const modo = modoSel.value;
    campoRango.hidden = modo !== 'rango';
    campoCada.hidden = modo !== 'cada';
  };

  const pintar = () => {
    panel.hidden = !actual;
    boton.disabled = !actual;
    if (actual) {
      resumen.textContent = `${actual.nombre} · ${actual.paginas} ${actual.paginas === 1 ? 'página' : 'páginas'} · ${S.tamano(actual.tamano)}`;
    }
  };

  const cargar = async (archivo) => {
    S.ocupado(true, 'Leyendo el PDF…');
    try {
      const bytes = await S.leer(archivo);
      let doc;
      try {
        doc = await PDFLib.PDFDocument.load(bytes);
      } catch (errorNormal) {
        try {
          doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
          S.aviso(`"${archivo.name}" está protegido con contraseña; se abrió igual, revisa que el resultado quede bien.`, 'error');
        } catch (_) {
          S.aviso(`"${archivo.name}" no se pudo abrir: está cifrado o dañado.`, 'error');
          return;
        }
      }
      actual = { nombre: archivo.name, tamano: archivo.size, paginas: doc.getPageCount(), doc };
      pintar();
    } finally {
      S.ocupado(false);
    }
  };

  /**
   * Valida y convierte «1-3, 5, 8-10» en índices de página base 0, en el orden escrito.
   * Devuelve { ok:true, indices } o { ok:false, mensaje }.
   */
  const analizarRango = (texto, total) => {
    const trozos = String(texto || '').split(',').map((t) => t.trim());
    if (!trozos.length || trozos.some((t) => t === '')) {
      return { ok: false, mensaje: 'Formato inválido: revisa las comas, no puede haber elementos vacíos.' };
    }
    const indices = [];
    for (const trozo of trozos) {
      const soloNumero = /^\d+$/.exec(trozo);
      const rango = /^(\d+)\s*-\s*(\d+)$/.exec(trozo);
      if (soloNumero) {
        const n = Number(trozo);
        if (n < 1 || n > total) {
          return { ok: false, mensaje: `La página ${n} no existe: el PDF tiene ${total} páginas.` };
        }
        indices.push(n - 1);
      } else if (rango) {
        const a = Number(rango[1]);
        const b = Number(rango[2]);
        if (a > b) {
          return { ok: false, mensaje: `El rango «${trozo}» está invertido: la página inicial es mayor que la final.` };
        }
        if (a < 1 || b > total) {
          return { ok: false, mensaje: `El rango «${trozo}» no existe: el PDF tiene ${total} páginas.` };
        }
        for (let i = a; i <= b; i++) indices.push(i - 1);
      } else {
        return { ok: false, mensaje: `«${trozo}» no es un número ni un rango válido (usa el formato 1-3, 5, 8-10).` };
      }
    }
    return { ok: true, indices };
  };

  const documentoDeIndices = async (origen, indices) => {
    const salida = await PDFLib.PDFDocument.create();
    const paginas = await salida.copyPages(origen, indices);
    paginas.forEach((p) => salida.addPage(p));
    return salida.save();
  };

  const dividirPorRango = async (nombreBase) => {
    const resultado = analizarRango(document.getElementById('dividirRango').value, actual.paginas);
    if (!resultado.ok) {
      S.aviso(resultado.mensaje, 'error');
      return;
    }
    const bytes = await documentoDeIndices(actual.doc, resultado.indices);
    S.descargar(bytes, nombreBase + '.pdf');
    S.aviso(`PDF creado con ${resultado.indices.length} páginas. Revisa tus descargas.`, 'ok');
    S.evento('pdf-creado', { herramienta: 'dividir-pdf', modo: 'rango', paginas: resultado.indices.length });
  };

  const empaquetarYDescargar = async (archivos, nombreBase) => {
    const zip = new JSZip();
    archivos.forEach((a) => zip.file(a.nombre, a.bytes));
    const blob = await zip.generateAsync({ type: 'blob' });
    S.descargar(blob, nombreBase + '.zip', 'application/zip');
    S.aviso(`ZIP creado con ${archivos.length} PDF. Revisa tus descargas.`, 'ok');
  };

  const dividirPorPagina = async (nombreBase) => {
    const total = actual.paginas;
    const ancho = Math.max(3, String(total).length);
    const archivos = [];
    for (let i = 0; i < total; i++) {
      const bytes = await documentoDeIndices(actual.doc, [i]);
      archivos.push({ nombre: `${nombreBase}-pag-${pad(i + 1, ancho)}.pdf`, bytes });
    }
    await empaquetarYDescargar(archivos, nombreBase);
    S.evento('pdf-creado', { herramienta: 'dividir-pdf', modo: 'pagina', archivos: archivos.length });
  };

  const dividirCadaN = async (nombreBase) => {
    const n = Number(document.getElementById('dividirCada').value);
    if (!Number.isInteger(n) || n < 1) {
      S.aviso('El número de páginas por archivo debe ser un entero de 1 o más.', 'error');
      return;
    }
    const total = actual.paginas;
    const numArchivos = Math.ceil(total / n);
    const ancho = Math.max(3, String(numArchivos).length);
    const archivos = [];
    for (let i = 0; i < numArchivos; i++) {
      const desde = i * n;
      const hasta = Math.min(desde + n, total);
      const indices = [];
      for (let p = desde; p < hasta; p++) indices.push(p);
      const bytes = await documentoDeIndices(actual.doc, indices);
      archivos.push({ nombre: `${nombreBase}-pag-${pad(i + 1, ancho)}.pdf`, bytes });
    }
    await empaquetarYDescargar(archivos, nombreBase);
    S.evento('pdf-creado', { herramienta: 'dividir-pdf', modo: 'cada', archivos: archivos.length });
  };

  const dividir = async () => {
    if (!actual) return;
    const nombreBase = S.nombreBase(document.getElementById('dividirNombre').value, 'documento');
    S.ocupado(true, 'Dividiendo el PDF…');
    try {
      const modo = modoSel.value;
      if (modo === 'rango') await dividirPorRango(nombreBase);
      else if (modo === 'pagina') await dividirPorPagina(nombreBase);
      else await dividirCadaN(nombreBase);
    } catch (error) {
      console.error(error);
      S.aviso('No se pudo dividir el PDF. Intenta con otra combinación de páginas.', 'error');
    } finally {
      S.ocupado(false);
    }
  };

  S.zona(zona, {
    input: entrada,
    aceptar: (f) => S.esPdf(f),
    mensajeVacio: 'Solo se aceptan archivos PDF.',
    alRecibir: (archivos) => cargar(archivos[0]),
  });
  document.getElementById('dividirQuitar').addEventListener('click', () => { actual = null; pintar(); });
  modoSel.addEventListener('change', mostrarCampos);
  boton.addEventListener('click', dividir);
  mostrarCampos();
})();
