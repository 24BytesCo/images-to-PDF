/* Redimensionar una imagen: píxeles, porcentaje o medidas habituales. */
(function () {
  'use strict';
  const S = window.Suite;
  const I = window.Img;
  const $ = (id) => document.getElementById(id);
  const MAX_LADO = 16000;
  const MAX_AREA = 100e6;
  let bitmap = null;
  let archivo = null;
  let modo = 'px';

  const num = (el) => Math.round(Number(el.value) || 0);

  /** Tamaño final según el modo activo. */
  const calcular = () => {
    const w0 = bitmap.width;
    const h0 = bitmap.height;
    if (modo === 'pct') {
      const k = Number($('pct').value) / 100;
      return { w: Math.max(1, Math.round(w0 * k)), h: Math.max(1, Math.round(h0 * k)) };
    }
    if (modo === 'pre') {
      const [pw, ph] = $('preajuste').value.split('x').map(Number);
      const k = Math.min(pw / w0, ph / h0);
      return { w: Math.max(1, Math.round(w0 * k)), h: Math.max(1, Math.round(h0 * k)) };
    }
    return { w: num($('ancho')), h: num($('alto')) };
  };

  const valido = (t) => t.w >= 1 && t.h >= 1 && t.w <= MAX_LADO && t.h <= MAX_LADO && t.w * t.h <= MAX_AREA;

  const pintar = () => {
    if (!bitmap) return;
    const t = calcular();
    const el = $('resultado');
    if (!valido(t)) {
      el.textContent = 'medida no válida (máximo 16 000 px por lado y 100 megapíxeles)';
      $('aplicar').disabled = true;
      return;
    }
    $('aplicar').disabled = false;
    el.textContent = `${t.w} × ${t.h} px`;
  };

  const ligar = (origen) => {
    // Mantiene la proporción al editar un lado.
    if ($('proporcion').value !== '1' || !bitmap) return;
    const r = bitmap.width / bitmap.height;
    if (origen === 'ancho') $('alto').value = Math.max(1, Math.round(num($('ancho')) / r));
    else $('ancho').value = Math.max(1, Math.round(num($('alto')) * r));
  };

  const salida = () => {
    const f = $('formato').value;
    if (f !== 'original') return f;
    return ['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type) ? archivo.type : 'image/png';
  };

  const aplicar = async () => {
    const t = calcular();
    if (!valido(t)) return;
    const tipo = salida();
    S.ocupado(true, 'Redimensionando…');
    try {
      const lienzo = I.escalar(bitmap, t.w, t.h);
      let final = lienzo;
      if (tipo === 'image/jpeg') {
        final = I.lienzo(t.w, t.h);
        const x = final.getContext('2d');
        x.fillStyle = '#fff';
        x.fillRect(0, 0, t.w, t.h);
        x.drawImage(lienzo, 0, 0);
      }
      const blob = await I.aBlob(final, tipo, Number($('calidad').value) / 100);
      S.descargar(blob, `${S.nombreBase(archivo.name, 'imagen')}-${t.w}x${t.h}.${I.EXT[tipo]}`, tipo);
      S.aviso('Listo. Revisa tus descargas.', 'ok');
    } catch (error) {
      console.error(error);
      S.aviso('No se pudo redimensionar: la medida es demasiado grande para este equipo.', 'error');
    } finally {
      S.ocupado(false);
    }
  };

  document.querySelectorAll('.pestana').forEach((b) => b.addEventListener('click', () => {
    modo = b.dataset.modo;
    document.querySelectorAll('.pestana').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
    ['px', 'pct', 'pre'].forEach((m) => { $(`modo-${m}`).hidden = m !== modo; });
    pintar();
  }));
  $('ancho').addEventListener('input', () => { ligar('ancho'); pintar(); });
  $('alto').addEventListener('input', () => { ligar('alto'); pintar(); });
  $('proporcion').addEventListener('change', () => { ligar('ancho'); pintar(); });
  $('pct').addEventListener('input', () => { $('pctValor').textContent = `${$('pct').value} %`; pintar(); });
  $('preajuste').addEventListener('change', pintar);
  $('calidad').addEventListener('input', () => { $('calidadValor').textContent = `${$('calidad').value} %`; });
  $('aplicar').addEventListener('click', aplicar);

  I.unaImagen({
    zona: $('zona'), entrada: $('entrada'), panel: $('panel'), cambiar: $('cambiar'),
    alCargar: (b, f) => {
      bitmap = b;
      archivo = f;
      $('original').textContent = `Original: ${b.width} × ${b.height} px · ${S.tamano(f.size)}`;
      $('ancho').value = b.width;
      $('alto').value = b.height;
      pintar();
    },
  });
})();
