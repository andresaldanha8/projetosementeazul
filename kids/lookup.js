(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const dialog = $('lookup-dialog');
  const form = $('lookup-form');
  let busy = false;
  let controller = null;
  let origin = null;
  function feedback(text, kind = 'error') {
    $('lookup-message').hidden = !text; $('lookup-message').textContent = text; $('lookup-message').dataset.kind = kind;
  }
  function contact() {
    const href = $('support').getAttribute('href');
    if (href && href.startsWith('https://wa.me/')) $('lookup-support').href = href;
  }
  function loading(value) {
    busy = value; form.setAttribute('aria-busy', String(value));
    $('lookup-submit').disabled = value;
    $('lookup-submit').textContent = value ? 'Consultando…' : 'Consultar situação';
  }
  function clearErrors() {
    for (const name of ['name', 'phone']) { $('lookup-' + name).removeAttribute('aria-invalid'); $('lookup-' + name + '-error').textContent = ''; }
  }
  $('lookup-open').addEventListener('click', () => {
    origin = document.activeElement; form.reset(); clearErrors(); feedback(''); $('lookup-result').hidden = true; contact();
    dialog.showModal(); $('lookup-name').focus();
  });
  $('lookup-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { controller?.abort(); controller = null; loading(false); origin?.focus(); });
  // Keep Tab inside the dialog too, including when the browser would move to its chrome.
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const items = [...dialog.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])')].filter(el => el.getClientRects().length);
    const first = items[0]; const last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
  });
  // Native showModal also makes the background inert and handles Escape.
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    clearErrors(); $('lookup-result').hidden = true; feedback('');
    const name = $('lookup-name').value.trim(); const phone = $('lookup-phone').value;
    let firstError = null;
    if (!name) { $('lookup-name-error').textContent = 'Informe o nome completo.'; $('lookup-name').setAttribute('aria-invalid', 'true'); firstError = $('lookup-name'); }
    if (!/^[+()\d .-]+$/.test(phone) || !/^\d{10,15}$/.test(phone.replace(/\D/g, ''))) { $('lookup-phone-error').textContent = 'Informe o telefone com DDD usado na inscrição.'; $('lookup-phone').setAttribute('aria-invalid', 'true'); firstError ||= $('lookup-phone'); }
    if (firstError) { firstError.focus(); return; }
    loading(true); feedback('Consultando situação…', 'loading');
    const requestController = new AbortController(); controller = requestController;
    const timeout = setTimeout(() => requestController.abort(), 18000);
    try {
      // Uma sessão atual/nova basta para CSRF e limitação; não é a sessão da inscrição buscada.
      const sessionResponse = await fetch('/kids/api/session.php', { credentials: 'same-origin', cache: 'no-store', signal: requestController.signal });
      const session = await sessionResponse.json();
      if (!sessionResponse.ok || !session.csrf_token) throw new Error();
      if (session.event?.whatsapp) $('lookup-support').href = 'https://wa.me/' + session.event.whatsapp;
      const response = await fetch('/kids/api/lookup.php', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: requestController.signal,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrf_token },
        body: JSON.stringify({ child_name: name, phone }),
      });
      const data = await response.json();
      if (!dialog.open || controller !== requestController) return;
      if (response.status === 200 && data.ok && data.registration) {
        const row = data.registration;
        $('lookup-number').textContent = row.number;
        $('lookup-status').textContent = row.registration_status === 'CANCELADA' ? 'Inscrição cancelada' : row.registration_status === 'REGISTRADA' ? 'Inscrição registrada' : row.registration_status;
        $('lookup-status').dataset.status = row.registration_status;
        $('lookup-payment').textContent = row.payment_status === 'PENDENTE' ? 'Pagamento pendente' : row.payment_status === 'CONFIRMADO' ? 'Pagamento confirmado' : row.payment_status;
        $('lookup-payment').dataset.status = row.payment_status;
        feedback(''); $('lookup-result').hidden = false; $('lookup-result').focus();
      } else if (response.status === 429) feedback('Muitas consultas. Aguarde alguns minutos antes de tentar novamente.');
      else if (response.status === 409) feedback('Não foi possível identificar uma única inscrição. Fale com a organização para consultar.');
      else if ([400, 404].includes(response.status)) feedback('Não foi possível localizar uma inscrição com esses dados. Confira o preenchimento ou fale com a organização.');
      else if ([401, 403].includes(response.status)) feedback('Não foi possível autorizar a consulta. Atualize a página e tente novamente.');
      else feedback('Consulta temporariamente indisponível. Tente novamente mais tarde.');
    } catch {
      if (dialog.open && controller === requestController) feedback('Consulta temporariamente indisponível. Verifique a conexão e tente novamente.');
    } finally {
      clearTimeout(timeout);
      if (controller === requestController) { controller = null; loading(false); }
    }
  });
})();
