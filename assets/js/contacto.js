/* Formulario de contacto de la portada: envía al endpoint propio de 24bytes.pro (correo por Resend). */
(function () {
  'use strict';
  const form = document.getElementById('contactoForm');
  if (!form) return;
  const estado = document.getElementById('contactoEstado');
  const decir = (texto, tipo) => { estado.textContent = texto; estado.dataset.tipo = tipo || ''; };

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const datos = Object.fromEntries(new FormData(form));
    const boton = form.querySelector('button[type=submit]');
    boton.disabled = true;
    decir('Enviando…');
    try {
      const r = await fetch(form.dataset.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      if (r.status === 429) {
        decir('Ya recibí varios mensajes tuyos. Si es urgente, escríbeme a alexis.dorado@24bytes.pro.', 'error');
        return;
      }
      if (!r.ok) throw new Error(String(r.status));
      form.reset();
      decir('Recibido. Te respondo pronto.', 'ok');
      if (window.Suite) window.Suite.evento('contacto');
    } catch (_) {
      decir('No se pudo enviar. Escríbeme a alexis.dorado@24bytes.pro.', 'error');
    } finally {
      boton.disabled = false;
    }
  });
})();
