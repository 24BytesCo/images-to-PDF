/* Formulario de contacto de la portada (FormSubmit por AJAX). */
(function () {
  'use strict';
  const form = document.getElementById('contactoForm');
  if (!form) return;
  const estado = document.getElementById('contactoEstado');
  const decir = (texto, tipo) => { estado.textContent = texto; estado.dataset.tipo = tipo || ''; };

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const datos = new FormData(form);
    if (datos.get('_honey')) return;
    datos.append('_subject', 'Mensaje desde 24Bytes PDF');
    const boton = form.querySelector('button[type=submit]');
    boton.disabled = true;
    decir('Enviando…');
    try {
      const r = await fetch(form.dataset.endpoint, { method: 'POST', headers: { Accept: 'application/json' }, body: datos });
      if (!r.ok) throw new Error(String(r.status));
      form.reset();
      decir('Recibido. Te respondo pronto.', 'ok');
    } catch (_) {
      decir('No se pudo enviar. Escríbeme a alexis.dorado@24bytes.pro.', 'error');
    } finally {
      boton.disabled = false;
    }
  });
})();
