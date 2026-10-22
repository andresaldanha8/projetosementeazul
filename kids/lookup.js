(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const dialog = $('lookup-dialog');
  const form = $('lookup-form');
  let busy = false;
  let controller = null;
  let origin = null;
  const money = cents => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  function clearResult() {
    form.hidden = false; $('lookup-description').hidden = false; $('lookup-new').hidden = true;
    $('lookup-result').hidden = true;
    for (const id of ['lookup-number', 'lookup-child-name', 'lookup-status', 'lookup-payment']) {
      $(id).textContent = ''; delete $(id).dataset.status;
    }
    $('lookup-payment-options').replaceChildren();
  }
  function paymentOptions(row) {
    if (row.registration_status !== 'REGISTRADA' || row.payment_status !== 'PENDENTE' || !row.payment?.pix_payload) return;
    const payment = row.payment;
    const node = (tag, text, className) => {
      const el = document.createElement(tag); if (text) el.textContent = text; if (className) el.className = className; return el;
    };
    const area = node('div', '', 'kids-payment');
    area.append(node('p', `Pague ${money(payment.amount_cents)} via PIX`), node('p', payment.pix, 'kids-pix'), node('p', `Favorecido: ${payment.payee}`));
    const actions = node('div', '', 'kids-payment-actions');
    const copy = node('button', `Copiar PIX de ${money(payment.amount_cents)}`); copy.type = 'button';
    const status = node('p', '', 'kids-copy-feedback'); status.setAttribute('role', 'status');
    const manual = node('textarea', '', 'kids-manual'); manual.readOnly = true; manual.rows = 4; manual.value = payment.pix_payload; manual.hidden = true;
    manual.setAttribute('aria-label', 'PIX Copia e Cola da inscrição consultada para copiar manualmente');
    copy.addEventListener('click', async () => {
      try {
        if (!navigator.clipboard?.writeText) throw new Error();
        await navigator.clipboard.writeText(payment.pix_payload);
        status.textContent = 'PIX Copia e Cola copiado. O pagamento continua sujeito à conferência da organização.';
      } catch {
        if (!area.isConnected) return;
        manual.hidden = false; manual.focus(); manual.select();
        status.textContent = 'Selecione o código abaixo e use Copiar no seu dispositivo.';
      }
    });
    const whatsapp = node('a', 'ENVIAR COMPROVANTE', 'kids-payment-link');
    whatsapp.href = payment.whatsapp_url; whatsapp.target = '_blank'; whatsapp.rel = 'noopener noreferrer';
    actions.append(copy, whatsapp);
    area.append(actions, status, manual, node('p', 'Envie o comprovante pelo WhatsApp. O pagamento será confirmado pela organização.', 'kids-payment-note'));
    $('lookup-payment-options').append(area);
  }
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
    origin = document.activeElement; form.reset(); clearErrors(); feedback(''); clearResult(); contact();
    dialog.showModal(); $('lookup-name').focus();
  });
  $('lookup-close').addEventListener('click', () => dialog.close());
  $('lookup-new').addEventListener('click', () => {
    clearResult(); clearErrors(); feedback(''); dialog.scrollTop = 0; $('lookup-name').focus();
  });
  dialog.addEventListener('close', () => { controller?.abort(); controller = null; loading(false); clearResult(); origin?.focus(); });
  form.addEventListener('input', () => {
    controller?.abort(); controller = null; loading(false); clearResult(); feedback('');
  });
  // Keep Tab inside the dialog too, including when the browser would move to its chrome.
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const items = [...dialog.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')].filter(el => el.getClientRects().length);
    const first = items[0]; const last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
  });
  // Native showModal also makes the background inert and handles Escape.
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    clearErrors(); clearResult(); feedback('');
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
        $('lookup-child-name').textContent = row.child_name;
        $('lookup-status').textContent = row.registration_status === 'CANCELADA' ? 'Inscrição cancelada' : row.registration_status === 'REGISTRADA' ? 'Inscrição registrada' : row.registration_status;
        $('lookup-status').dataset.status = row.registration_status;
        $('lookup-payment').textContent = row.payment_status === 'PENDENTE' ? 'Pagamento pendente' : row.payment_status === 'CONFIRMADO' ? 'Pagamento confirmado' : row.payment_status;
        $('lookup-payment').dataset.status = row.payment_status;
        paymentOptions(row);
        feedback(''); form.hidden = true; $('lookup-description').hidden = true;
        $('lookup-new').hidden = false; $('lookup-result').hidden = false;
        dialog.scrollTop = 0; $('lookup-result').focus({ preventScroll: true });
      } else if (response.status === 429) feedback('Muitas consultas. Aguarde alguns minutos antes de tentar novamente.');
      else if (response.status === 409) feedback('Não foi possível identificar uma única inscrição. Fale com a organização para consultar.');
      else if ([400, 404].includes(response.status)) feedback('Não foi possível localizar uma inscrição com esses dados. Confira o preenchimento ou fale com a organização.');
      else if ([401, 403].includes(response.status)) feedback('Não foi possível autorizar a consulta. Atualize a página e tente novamente.');
      else feedback('Consulta temporariamente indisponível. Tente novamente mais tarde.');
    } catch {
      if (dialog.open && controller === requestController) { clearResult(); feedback('Consulta temporariamente indisponível. Verifique a conexão e tente novamente.'); }
    } finally {
      clearTimeout(timeout);
      if (controller === requestController) { controller = null; loading(false); }
    }
  });
})();
