/* Girar 90°, voltear y enderezar con ángulo fino. Todo en el navegador. */
(function () {
  'use strict';
  const S = window.Suite;
  const I = window.Img;
  const $ = (id) => document.getElementById(id);
  let bitmap = null;
  let reducida = null; // copia pequeña para la vista previa
  let archivo = null;
  let giro = 0; // múltiplos de 90, en sentido horario
  let hFlip = false;
  let vFlip = false;

  /** Compone `fuente` con las transformaciones activas y devuelve un lienzo nuevo. */
  const componer = (fuente, fondo) => {
    const ang = ((giro + Number($('fino').value)) * Math.PI) / 180;
    const c = Math.abs(Math.cos(ang));
    const s = Math.abs(Math.sin(ang));
    const w = fuente.width * c + fuente.height * s;
    const h = fuente.width * s + fuente.height * c;
    // 90° exactos no deben dejar un píxel de sobra por el error de coma flotante.
    const ent = (v) => (Math.abs(v - Math.round(v)) < 0.01 ? Math.round(v) : Math.ceil(v));
    const lienzo = I.lienzo(ent(w), ent(h));
    const x = lienzo.getContext('2d');
    x.imageSmoothingQuality = 'high';
    if (fondo) { x.fillStyle = fondo; x.fillRect(0, 0, lienzo.width, lienzo.height); }
    x.translate(lienzo.width / 2, lienzo.height / 2);
    x.rotate(ang);
    x.scale(hFlip ? -1 : 1, vFlip ? -1 : 1);
    x.drawImage(fuente, -fuente.width / 2, -fuente.height / 2);
    return lienzo;
  };

  const fondoActual = () => ($('formato').value === 'image/jpeg' ? $('fondo').value : null);

  const pintar = () => {
    if (!bitmap) return;
    const v = componer(reducida, fondoActual());
    const dest = $('vista');
    dest.width = v.width;
    dest.height = v.height;
    dest.getContext('2d').drawImage(v, 0, 0);
    const k = bitmap.width / reducida.width;
    $('medida').textContent = `${Math.round(v.width * k)} × ${Math.round(v.height * k)} px`;
  };

  const guardar = async () => {
    const tipo = $('formato').value;
    S.ocupado(true, 'Procesando…');
    try {
      const lienzo = componer(bitmap, fondoActual());
      const blob = await I.aBlob(lienzo, tipo, 0.92);
      S.descargar(blob, `${S.nombreBase(archivo.name, 'imagen')}-girada.${I.EXT[tipo]}`, tipo);
      S.aviso('Listo. Revisa tus descargas.', 'ok');
    } finally {
      S.ocupado(false);
    }
  };

  $('izquierda').addEventListener('click', () => { giro = (giro + 270) % 360; pintar(); });
  $('derecha').addEventListener('click', () => { giro = (giro + 90) % 360; pintar(); });
  $('horizontal').addEventListener('click', () => {
    // Con la imagen girada 90°/270° el eje visual cambia: el volteo se aplica sobre lo que se ve.
    if (giro % 180 === 0) hFlip = !hFlip; else vFlip = !vFlip;
    pintar();
  });
  $('vertical').addEventListener('click', () => {
    if (giro % 180 === 0) vFlip = !vFlip; else hFlip = !hFlip;
    pintar();
  });
  $('fino').addEventListener('input', () => { $('finoValor').textContent = `${$('fino').value}°`; pintar(); });
  $('formato').addEventListener('change', pintar);
  $('fondo').addEventListener('input', pintar);
  $('guardar').addEventListener('click', guardar);

  I.unaImagen({
    zona: $('zona'), entrada: $('entrada'), panel: $('panel'), cambiar: $('cambiar'),
    alCargar: (b, f) => {
      bitmap = b;
      archivo = f;
      giro = 0; hFlip = false; vFlip = false;
      $('fino').value = 0;
      $('finoValor').textContent = '0°';
      const k = Math.min(1, 900 / Math.max(b.width, b.height));
      reducida = k < 1 ? I.escalar(b, b.width * k, b.height * k) : b;
      pintar();
    },
  });
})();
