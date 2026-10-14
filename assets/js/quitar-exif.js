/* Inspecciona y elimina metadatos (EXIF, GPS, XMP, IPTC, comentarios) sin recomprimir la imagen. */
(function () {
  'use strict';
  const S = window.Suite;
  const I = window.Img;
  const $ = (id) => document.getElementById(id);
  const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
  let fotos = []; // { archivo, bytes, tipo, hallazgos[], conGps, orientacion }

  const texto = (u8, ini, fin) => {
    let s = '';
    for (let i = ini; i < fin && u8[i] !== 0; i++) s += String.fromCharCode(u8[i]);
    return s;
  };

  /** Lee un bloque TIFF (el contenido de un EXIF) y devuelve lo relevante. */
  const leerTiff = (u8, base) => {
    const r = { hallazgos: [], gps: null, orientacion: 1 };
    if (base + 8 > u8.length) return r;
    const le = u8[base] === 0x49;
    const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const u16 = (o) => v.getUint16(o, le);
    const u32 = (o) => v.getUint32(o, le);
    if (u16(base + 2) !== 42) return r;
    const tam = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1 };
    const ifd = (off) => {
      const sal = {};
      const o = base + off;
      if (o + 2 > u8.length) return sal;
      const n = u16(o);
      for (let i = 0; i < n; i++) {
        const e = o + 2 + i * 12;
        if (e + 12 > u8.length) break;
        const tag = u16(e);
        const tipo = u16(e + 2);
        const cant = u32(e + 4);
        const bytes = (tam[tipo] || 1) * cant;
        const dato = bytes <= 4 ? e + 8 : base + u32(e + 8);
        if (dato + bytes > u8.length) continue;
        if (tipo === 2) sal[tag] = texto(u8, dato, dato + cant).trim();
        else if (tipo === 3) sal[tag] = u16(dato);
        else if (tipo === 4) sal[tag] = u32(e + 8);
        else if (tipo === 5) {
          const a = [];
          for (let j = 0; j < cant; j++) a.push(u32(dato + j * 8) / (u32(dato + j * 8 + 4) || 1));
          sal[tag] = a;
        }
      }
      return sal;
    };
    const p = ifd(u32(base + 4));
    if (p[0x010f] || p[0x0110]) r.hallazgos.push(`Cámara: ${[p[0x010f], p[0x0110]].filter(Boolean).join(' ')}`);
    if (p[0x0131]) r.hallazgos.push(`Programa: ${p[0x0131]}`);
    if (p[0x0112]) r.orientacion = p[0x0112];
    let fecha = p[0x0132];
    if (p[0x8769] != null) {
      const ex = ifd(p[0x8769]);
      if (ex[0x9003]) fecha = ex[0x9003];
      if (ex[0xa431]) r.hallazgos.push(`Número de serie del cuerpo: ${ex[0xa431]}`);
    }
    if (fecha) r.hallazgos.push(`Fecha de captura: ${fecha}`);
    if (p[0x8825] != null) {
      const g = ifd(p[0x8825]);
      const grados = (a) => (a && a.length === 3 ? a[0] + a[1] / 60 + a[2] / 3600 : null);
      let lat = grados(g[2]);
      let lon = grados(g[4]);
      if (lat != null && lon != null) {
        if (g[1] === 'S') lat = -lat;
        if (g[3] === 'W') lon = -lon;
        r.gps = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      } else {
        r.gps = 'ubicación presente';
      }
    }
    return r;
  };

  const analizarJpeg = (u8) => {
    const r = { hallazgos: [], gps: null, orientacion: 1, otros: false };
    let o = 2;
    while (o + 4 <= u8.length && u8[o] === 0xff) {
      const m = u8[o + 1];
      if (m === 0xda || m === 0xd9) break;
      const len = (u8[o + 2] << 8) | u8[o + 3];
      const ini = o + 4;
      if (m === 0xe1 && texto(u8, ini, ini + 5) === 'Exif') {
        const t = leerTiff(u8, ini + 6);
        r.hallazgos.push(...t.hallazgos);
        r.gps = t.gps;
        r.orientacion = t.orientacion;
        r.exif = true;
      } else if (m === 0xe1) { r.otros = true; r.hallazgos.push('Datos XMP (editor o programa)'); }
      else if (m === 0xed) { r.otros = true; r.hallazgos.push('Datos IPTC (autor, palabras clave)'); }
      else if (m === 0xfe) { r.otros = true; r.hallazgos.push('Comentario incrustado'); }
      o += 2 + len;
    }
    return r;
  };

  const trozos = (u8) => { // PNG: [{tipo, ini, fin}]
    const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const sal = [];
    let o = 8;
    while (o + 12 <= u8.length) {
      const len = v.getUint32(o);
      sal.push({ tipo: texto(u8, o + 4, o + 8), ini: o, fin: o + 12 + len });
      o += 12 + len;
    }
    return sal;
  };
  const PNG_FIJOS = ['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'sBIT', 'pHYs', 'bKGD', 'hIST', 'acTL', 'fcTL', 'fdAT'];

  const analizarPng = (u8) => {
    const r = { hallazgos: [], gps: null, orientacion: 1 };
    for (const t of trozos(u8)) {
      if (PNG_FIJOS.includes(t.tipo)) continue;
      if (t.tipo === 'eXIf') {
        const x = leerTiff(u8, t.ini + 8);
        r.hallazgos.push(...x.hallazgos);
        r.gps = x.gps;
      } else if (t.tipo === 'tEXt' || t.tipo === 'iTXt' || t.tipo === 'zTXt') {
        r.hallazgos.push(`Texto incrustado: ${texto(u8, t.ini + 8, t.ini + 40)}`);
      } else if (t.tipo === 'tIME') {
        r.hallazgos.push('Fecha de última modificación');
      }
    }
    return r;
  };

  const analizarWebp = (u8) => {
    const r = { hallazgos: [], gps: null, orientacion: 1 };
    const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let o = 12;
    while (o + 8 <= u8.length) {
      const id = texto(u8, o, o + 4);
      const len = v.getUint32(o + 4, true);
      if (id === 'EXIF') {
        let ini = o + 8;
        if (texto(u8, ini, ini + 4) === 'Exif') ini += 6;
        const x = leerTiff(u8, ini);
        r.hallazgos.push(...x.hallazgos);
        r.gps = x.gps;
      } else if (id === 'XMP ') {
        r.hallazgos.push('Datos XMP (editor o programa)');
      }
      o += 8 + len + (len & 1);
    }
    return r;
  };

  /** Devuelve los bytes sin metadatos. Para JPG con orientación ≠ 1 hay que hornearla en los píxeles. */
  const limpiarJpeg = (u8) => {
    const partes = [u8.subarray(0, 2)];
    let o = 2;
    while (o + 4 <= u8.length && u8[o] === 0xff) {
      const m = u8[o + 1];
      if (m === 0xda) { partes.push(u8.subarray(o)); o = u8.length; break; }
      const len = (u8[o + 2] << 8) | u8[o + 3];
      const ini = o + 4;
      const quitar = m === 0xe1 || m === 0xed || m === 0xfe
        || (m >= 0xe3 && m <= 0xef)
        || (m === 0xe2 && texto(u8, ini, ini + 3) === 'MPF');
      if (!quitar) partes.push(u8.subarray(o, o + 2 + len));
      o += 2 + len;
    }
    return new Blob(partes, { type: 'image/jpeg' });
  };

  const limpiarPng = (u8) => {
    const partes = [u8.subarray(0, 8)];
    for (const t of trozos(u8)) if (PNG_FIJOS.includes(t.tipo)) partes.push(u8.subarray(t.ini, t.fin));
    return new Blob(partes, { type: 'image/png' });
  };

  const limpiarWebp = (u8) => {
    const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const partes = [];
    let total = 4;
    let o = 12;
    while (o + 8 <= u8.length) {
      const id = texto(u8, o, o + 4);
      const len = v.getUint32(o + 4, true);
      const fin = o + 8 + len + (len & 1);
      if (id !== 'EXIF' && id !== 'XMP ') {
        let pieza = u8.slice(o, Math.min(fin, u8.length));
        if (id === 'VP8X') pieza[8] &= ~0x0c; // apaga las banderas de EXIF y XMP
        partes.push(pieza);
        total += pieza.length;
      }
      o = fin;
    }
    const cab = new Uint8Array(12);
    cab.set([0x52, 0x49, 0x46, 0x46]);
    new DataView(cab.buffer).setUint32(4, total, true);
    cab.set([0x57, 0x45, 0x42, 0x50], 8);
    return new Blob([cab, ...partes], { type: 'image/webp' });
  };

  const analizar = (u8, tipo) => {
    if (tipo === 'image/jpeg') return analizarJpeg(u8);
    if (tipo === 'image/png') return analizarPng(u8);
    return analizarWebp(u8);
  };

  const pintar = () => {
    $('panel').hidden = fotos.length === 0;
    $('zona').hidden = fotos.length > 0;
    const conGps = fotos.filter((f) => f.info.gps).length;
    $('resumen').textContent = `${fotos.length} ${fotos.length === 1 ? 'foto' : 'fotos'}`
      + (conGps ? ` · ${conGps} con ubicación` : '');
    const lista = $('lista');
    lista.textContent = '';
    fotos.forEach((f, i) => {
      const caja = document.createElement('div');
      caja.className = 'exif-item';
      const cab = document.createElement('div');
      cab.className = 'exif-cab';
      const nombre = document.createElement('span');
      nombre.className = 'lista-nombre';
      nombre.textContent = f.archivo.name;
      const quitar = document.createElement('button');
      quitar.type = 'button';
      quitar.className = 'quitar';
      quitar.setAttribute('aria-label', `Quitar ${f.archivo.name}`);
      quitar.textContent = '×';
      quitar.addEventListener('click', () => { fotos.splice(i, 1); pintar(); });
      cab.append(nombre, quitar);
      caja.appendChild(cab);
      const items = [...f.info.hallazgos];
      if (f.info.gps) items.unshift(`Ubicación GPS: ${f.info.gps}`);
      if (items.length) {
        const ul = document.createElement('ul');
        ul.className = 'exif-datos';
        for (const t of items) {
          const li = document.createElement('li');
          li.textContent = t;
          if (t.startsWith('Ubicación GPS')) li.className = 'exif-gps';
          ul.appendChild(li);
        }
        caja.appendChild(ul);
      } else {
        const p = document.createElement('p');
        p.className = 'exif-limpio';
        p.textContent = 'No se encontraron metadatos.';
        caja.appendChild(p);
      }
      lista.appendChild(caja);
    });
  };

  const recibir = async (archivos) => {
    for (const archivo of archivos) {
      try {
        const bytes = new Uint8Array(await archivo.arrayBuffer());
        const tipo = TIPOS.includes(archivo.type) ? archivo.type
          : (bytes[0] === 0xff ? 'image/jpeg' : bytes[0] === 0x89 ? 'image/png' : 'image/webp');
        fotos.push({ archivo, bytes, tipo, info: analizar(bytes, tipo) });
      } catch (error) {
        console.error(error);
        S.aviso(`No se pudo leer ${archivo.name}.`, 'error');
      }
    }
    pintar();
  };

  const limpiar = async () => {
    if (!fotos.length) return;
    S.ocupado(true, 'Limpiando…');
    const hechos = [];
    try {
      for (const f of fotos) {
        let blob;
        if (f.tipo === 'image/jpeg' && f.info.orientacion > 1) {
          // La orientación vive en el EXIF: al quitarlo la foto se vería de lado. Se hornea en los píxeles.
          const bitmap = await I.cargar(f.archivo);
          const l = I.lienzo(bitmap.width, bitmap.height);
          l.getContext('2d').drawImage(bitmap, 0, 0);
          bitmap.close();
          blob = await I.aBlob(l, 'image/jpeg', 0.95);
        } else if (f.tipo === 'image/jpeg') blob = limpiarJpeg(f.bytes);
        else if (f.tipo === 'image/png') blob = limpiarPng(f.bytes);
        else blob = limpiarWebp(f.bytes);
        hechos.push({ blob, nombre: `${S.nombreBase(f.archivo.name, 'foto')}-sin-metadatos.${I.EXT[f.tipo]}` });
      }
      await I.entregar(hechos, 'fotos-sin-metadatos.zip');
      S.aviso('Listo. Las copias no llevan datos ocultos.', 'ok');
    } catch (error) {
      console.error(error);
      S.aviso('No se pudo limpiar alguna foto.', 'error');
    } finally {
      S.ocupado(false);
    }
  };

  S.zona($('zona'), {
    input: $('entrada'),
    aceptar: (f) => TIPOS.includes(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name),
    mensajeVacio: 'Solo se aceptan fotos JPG, PNG o WebP.',
    alRecibir: recibir,
  });
  $('vaciar').addEventListener('click', () => { fotos = []; pintar(); });
  $('limpiar').addEventListener('click', limpiar);
})();
