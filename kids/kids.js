(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const form = $('kids-form');
  const storageKey = 'kids.pending.v1';
  const entryUrl = new URL(window.location.href);
  const newEntry = entryUrl.searchParams.get('nova') === '1';
  if (newEntry) {
    entryUrl.searchParams.delete('nova');
    history.replaceState(history.state, '', entryUrl.pathname + entryUrl.search + entryUrl.hash);
  }
  const state = { info: null, busy: false, refreshing: null, pending: null, payload: null, expired: false, lastRefresh: 0, ready: false, serverOffset: 0, view: newEntry ? 'form' : null, newEntry, registrations: 0, draftActive: false };
  const fields = ['child_name', 'birth_date', 'division', 'guardian_name', 'relationship', 'phone', 'accepted'];
  const money = cents => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  try { state.pending = JSON.parse(sessionStorage.getItem(storageKey) || 'null'); } catch { /* Storage may be unavailable. Keep memory-only recovery. */ }
  if (state.pending && (!/^[a-f0-9]{64}$/.test(state.pending.key) || !/^[a-f0-9]{64}$/.test(state.pending.hash))) state.pending = null;
  // Only choice/version metadata, never registration personal data, is saved for retry.
  $('image_authorized').checked = state.pending?.image_authorized === true;
  function savePending() {
    try { if (state.pending) sessionStorage.setItem(storageKey, JSON.stringify(state.pending)); else sessionStorage.removeItem(storageKey); } catch { /* Confirmations remain recoverable through the cookie. */ }
  }
  function message(text, error = false, focus = false) {
    $('message').hidden = !text; $('message').textContent = text; $('message').dataset.error = String(error);
    if (focus) $('message').focus();
  }
  async function api(path, options = {}) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 18000);
    try {
      const response = await fetch('/kids/api/' + path, { credentials: 'same-origin', cache: 'no-store', ...options, signal: controller.signal });
      let data; try { data = await response.json(); } catch { throw new Error('unavailable'); }
      return { status: response.status, data };
    } finally { clearTimeout(timer); }
  }
  function localDate() {
    const date = new Date(Date.now() + state.serverOffset);
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: state.info?.event.timezone || 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    return Object.fromEntries(parts.map(p => [p.type, p.value]));
  }
  function ageFor(birth) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return null;
    const [year, month, day] = birth.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
    const today = localDate();
    return Number(today.year) - year - (Number(today.month) < month || (Number(today.month) === month && Number(today.day) < day) ? 1 : 0);
  }
  function ageHint() {
    const age = ageFor($('birth_date').value);
    $('age-hint').textContent = age === null ? 'Idade e faixa calculadas ao preencher.' : age < 4 || age > 14 ? 'Idade fora da faixa permitida: de 4 a 14 anos.' : `${age} anos · faixa ${age <= 7 ? '4–7' : age <= 10 ? '8–10' : '11–14'} anos. Conferida pelo servidor.`;
  }
  function available() {
    return state.ready && !state.expired && state.info?.public_open && state.info.declaration_version && state.info.declaration_text && Date.now() + state.serverOffset < Date.parse(state.info.event.closes_at);
  }
  function updateViews() {
    const confirmation = state.view === 'confirmation';
    $('form-panel').hidden = confirmation;
    $('confirmations-section').hidden = !confirmation;
    $('back-to-confirmations').hidden = confirmation || !state.registrations;
    $('back-to-confirmations').disabled = state.busy || state.submitting || Boolean(state.pending);
    $('availability-panel').hidden = confirmation && $('availability-panel').dataset.kind === 'open';
  }
  function showView(view, focus = false) {
    state.view = view;
    updateViews();
    if (focus) {
      const target = view === 'confirmation' ? $('confirmations-title') : $('child_name');
      target.focus();
    }
  }
  function applyNewEntry() {
    if (!state.newEntry || state.pending) return false;
    state.newEntry = false;
    state.draftActive = true;
    form.reset(); clearErrors(); ageHint(); message('');
    showView('form', true);
    return true;
  }
  function controls() {
    for (const fieldset of form.querySelectorAll('fieldset')) fieldset.disabled = state.busy || (Boolean(state.pending) && Boolean(state.payload));
    $('accepted').disabled = !state.info?.declaration_text || !state.info?.declaration_version || !state.info?.public_open || state.busy || Boolean(state.payload && state.pending);
    $('image_authorized').disabled = !state.info?.image_authorization_text || !state.info?.image_authorization_version || !state.info?.public_open || state.busy || Boolean(state.payload && state.pending) || Boolean(state.pending && Object.hasOwn(state.pending,'image_authorized'));
    $('submit').disabled = state.busy || state.submitting || state.expired || !state.ready || (!state.pending && !available());
    $('submit').textContent = state.busy ? 'Conferindo inscrição…' : state.pending ? 'Recuperar / repetir envio' : 'Concluir inscrição';
    $('another').disabled = state.busy || Boolean(state.pending) || !available();
    form.setAttribute('aria-busy', String(state.busy));
    updateViews();
  }
  function metadata(info) {
    state.serverOffset = Date.parse(info.event.server_now) - Date.now();
    $('event-name').textContent = info.event.name;
    $('event-summary').hidden = false;
    $('event-price').textContent = money(info.event.amount_cents);
    $('event-shirt').textContent = `Camisa ${info.event.shirt_size} incluída`;
    $('form-shirt').textContent = `Camisa ${info.event.shirt_size} incluída`;
    $('form-shirt').hidden = false;
    const deadline = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', { timeZone: info.event.timezone, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(info.event.closes_at)).map(part => [part.type, part.value]));
    $('event-deadline').textContent = `Inscrições até ${deadline.day}/${deadline.month}, às ${deadline.hour}h${deadline.minute === '00' ? '' : deadline.minute}`;
    $('declaration-text').textContent = info.declaration_text || 'Texto em preparação — ainda não aprovado pela organização. O aceite e as inscrições permanecem indisponíveis.';
    $('image-authorization-text').textContent = info.image_authorization_text || 'Autorização de imagem indisponível.';
    if (info.declaration_version?.startsWith('TEST')) $('declaration-text').textContent = 'PROVISÓRIO · SOMENTE TESTE · NÃO APROVADO\n' + (info.declaration_text || 'Declaração pendente.');
    $('support').href = 'https://wa.me/' + info.event.whatsapp;
    $('support').target = '_blank'; $('support').rel = 'noopener noreferrer'; $('support').hidden = false;
    $('availability').textContent = state.expired ? 'Sessão anterior indisponível. Se já se inscreveu, fale com a organização antes de repetir.' : !info.public_open || !info.declaration_version || !info.declaration_text ? 'Inscrições ainda não abertas. Envio bloqueado enquanto a declaração aguarda aprovação.' : Date.now() + state.serverOffset >= Date.parse(info.event.closes_at) ? 'Inscrições encerradas. As confirmações desta sessão continuam disponíveis abaixo.' : 'Inscrições disponíveis. Preencha os dados abaixo.';
    $('availability-panel').dataset.kind = state.expired ? 'expired' : !info.public_open || !info.declaration_version || !info.declaration_text || Date.now() + state.serverOffset >= Date.parse(info.event.closes_at) ? 'closed' : 'open';
    $('retry').hidden = true;
    ageHint(); controls();
  }
  function node(tag, text, className) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
  const receiptDownloads = new Set();
  function receiptAction(row) {
    const area = node('div', undefined, 'kids-receipt');
    const button = node('button', 'Baixar comprovante'); button.type = 'button';
    const feedback = node('p', ''); feedback.setAttribute('role', 'status');
    button.addEventListener('click', async () => {
      if (receiptDownloads.has(row.reference)) return;
      receiptDownloads.add(row.reference);
      button.disabled = true; button.textContent = 'Gerando comprovante…';
      area.setAttribute('aria-busy', 'true'); feedback.textContent = '';
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 60000);
      try {
        const response = await fetch('/kids/api/receipt.php?reference=' + encodeURIComponent(row.reference), { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        if (!response.ok || !response.headers.get('Content-Type')?.includes('application/pdf')) throw new Error();
        const blob = await response.blob();
        if ((await blob.slice(0, 5).text()) !== '%PDF-') throw new Error();
        const url = URL.createObjectURL(blob); const link = node('a');
        link.href = url; link.download = `autismo-run-kids-comprovante-${row.number}.pdf`;
        document.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        feedback.textContent = 'Comprovante gerado.';
      } catch {
        feedback.textContent = 'Não foi possível baixar o comprovante. Tente novamente. Se a sessão expirou, fale com a organização.';
      } finally {
        clearTimeout(timer); receiptDownloads.delete(row.reference);
        button.disabled = false; button.textContent = 'Baixar comprovante'; area.setAttribute('aria-busy', 'false');
      }
    });
    area.append(button, feedback); return area;
  }
  function renderCards(rows) {
    const initial = state.view === null;
    const focusWasInCards = $('cards').contains(document.activeElement);
    state.registrations = rows.length;
    const cards = $('cards'); cards.replaceChildren();
    document.querySelector('.kids-return-note').hidden = rows.length === 0;
    for (const row of rows) {
      const card = node('article', undefined, 'kids-card'); card.dataset.reference = row.reference;
      card.dataset.cancelled = String(row.registration_status === 'CANCELADA');
      const top = node('div', undefined, 'kids-card-top'); const title = node('div');
      title.append(node('p', row.registration_status === 'CANCELADA' ? 'Inscrição cancelada' : 'Inscrição registrada', 'kids-card-label'), node('h3', row.child_name));
      const bib = node('div', undefined, 'kids-bib'); bib.append(node('small', 'Número de peito'), node('span', row.number)); top.append(title, bib);
      const body = node('div', undefined, 'kids-card-body'); const details = node('div', undefined, 'kids-details');
      for (const text of [`${row.category} anos · ${row.division === 'M' ? 'Masculino' : 'Feminino'}`, `Camisa ${row.shirt_size}`, money(row.amount_cents)]) details.append(node('span', text));
      const status = row.payment_status === 'PENDENTE' ? 'Pagamento pendente' : row.payment_status === 'CONFIRMADO' ? 'Pagamento confirmado' : `Situação do pagamento: ${row.payment_status}`;
      const statusLabel = node('p', status, 'kids-payment-status'); statusLabel.dataset.status = row.payment_status;
      body.append(details, statusLabel);
      if (row.payment_status === 'PENDENTE' && row.registration_status !== 'CANCELADA') {
        const payment = node('div', undefined, 'kids-payment'); const event = state.info.event;
        payment.append(node('p', `Pague ${money(row.amount_cents)} via PIX`), node('p', event.pix, 'kids-pix'), node('p', `Favorecido: ${event.payee}`));
        const actions = node('div', undefined, 'kids-payment-actions'); const copy = node('button', 'Copiar chave PIX'); copy.type = 'button';
        const feedback = node('div', '', 'kids-copy-feedback'); feedback.setAttribute('role', 'status');
        const manual = node('input', undefined, 'kids-manual'); manual.readOnly = true; manual.value = event.pix; manual.hidden = true; manual.setAttribute('aria-label', 'Chave PIX para copiar manualmente');
        copy.addEventListener('click', async () => {
          try { if (!navigator.clipboard?.writeText) throw new Error(); await navigator.clipboard.writeText(event.pix); feedback.textContent = 'Chave PIX copiada.'; }
          catch { manual.hidden = false; manual.focus(); manual.select(); feedback.textContent = 'Selecione a chave abaixo e use Copiar no seu dispositivo.'; }
        });
        const whatsapp = node('a', 'ENVIAR COMPROVANTE', 'kids-payment-link');
        const text = `Olá! Fiz a inscrição de ${row.child_name} na corrida KIDS do Projeto Semente Azul. Número da inscrição: ${row.number}. Vou enviar o comprovante do pagamento de ${money(row.amount_cents).replace(/\u00a0/g, ' ')} para conferência.`;
        whatsapp.href = `https://wa.me/${event.whatsapp}?text=${encodeURIComponent(text)}`; whatsapp.target = '_blank'; whatsapp.rel = 'noopener noreferrer';
        actions.append(copy, whatsapp, receiptAction(row)); payment.append(actions, feedback, manual, node('p', 'Anexe o comprovante manualmente na conversa. Abrir o WhatsApp não confirma o pagamento; a equipe fará a conferência.', 'kids-payment-note')); body.append(payment);
      } else {
        body.append(receiptAction(row));
      }
      card.append(top, body); cards.append(card);
    }
    if (initial) showView(state.pending || !rows.length ? 'form' : 'confirmation', rows.length > 0 && !state.pending);
    else {
      updateViews();
      if (focusWasInCards && state.view === 'confirmation') $('confirmations-title').focus({ preventScroll: true });
    }
  }
  function readPayload() {
    const payload = { child_name: $('child_name').value.trim(), birth_date: $('birth_date').value, division: $('division').value, guardian_name: $('guardian_name').value.trim(), relationship: $('relationship').value.trim(), phone: $('phone').value.replace(/\D/g, ''), declaration_version: state.pending?.declaration_version || state.info.declaration_version, accepted: $('accepted').checked };
    if (!state.pending || Object.hasOwn(state.pending,'image_authorized')) {
      payload.image_authorized = $('image_authorized').checked;
      payload.image_authorization_version = state.pending?.image_authorization_version || state.info.image_authorization_version;
    }
    return payload;
  }
  async function fingerprint(payload) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
    return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
  }
  function randomKey() { return [...crypto.getRandomValues(new Uint8Array(32))].map(x => x.toString(16).padStart(2, '0')).join(''); }
  function clearErrors() { for (const field of fields) { $(field + '-error').textContent = ''; $(field).removeAttribute('aria-invalid'); } }
  function validate() {
    clearErrors(); const errors = {};
    for (const field of ['child_name', 'guardian_name', 'relationship']) if (!$(field).value.trim()) errors[field] = 'Preencha este campo.';
    const age = ageFor($('birth_date').value);
    if (age === null || age < 4 || age > 14) errors.birth_date = 'Informe uma data válida para uma criança de 4 a 14 anos.';
    if (!$('division').value) errors.division = 'Selecione a categoria.';
    if (!/^[+()\d .-]+$/.test($('phone').value) || !/^\d{10,15}$/.test($('phone').value.replace(/\D/g, ''))) errors.phone = 'Informe o telefone com DDD, de 10 a 15 dígitos.';
    if (!$('accepted').checked) errors.accepted = 'Leia e aceite a declaração para continuar.';
    for (const [field, text] of Object.entries(errors)) { $(field + '-error').textContent = text; $(field).setAttribute('aria-invalid', 'true'); }
    if (Object.keys(errors).length) { $(Object.keys(errors)[0]).focus(); return false; }
    return true;
  }
  async function finish(reference, rows, fromRecovery) {
    state.pending = null; state.payload = null; savePending();
    state.pendingMessage = '';
    state.draftActive = false;
    form.reset(); clearErrors(); ageHint();
    renderCards(rows); controls();
    if (applyNewEntry()) {
      message('O envio anterior foi confirmado. Você pode iniciar a próxima inscrição; as anteriores continuam salvas.');
      return;
    }
    showView('confirmation', true);
    message(fromRecovery ? 'Inscrição recuperada. Confira os dados no cartão. Não é necessário enviar de novo.' : 'Inscrição registrada. Confira os dados no cartão.');
    $('confirmations-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function refresh(force = false) {
    if (state.refreshing) return state.refreshing;
    if (state.busy || (!force && Date.now() - state.lastRefresh < 15000)) return false;
    if (!state.ready) {
      $('availability').textContent = 'Consultando inscrições…';
      $('availability-panel').dataset.kind = 'loading';
      $('retry').hidden = true;
    }
    state.refreshing = (async () => {
      let metadataLoaded = false;
      try {
        const session = await api('session.php');
        if (session.status !== 200 || !session.data.event) throw new Error();
        const previousGeneration = state.info?.session_generation || state.pending?.generation;
        if (previousGeneration && previousGeneration !== session.data.session_generation) state.expired = true;
        if (state.info && !state.pending) {
          if (state.info.declaration_version !== session.data.declaration_version || state.info.declaration_text !== session.data.declaration_text) $('accepted').checked = false;
          if (state.info.image_authorization_version !== session.data.image_authorization_version || state.info.image_authorization_text !== session.data.image_authorization_text) $('image_authorized').checked = false;
        }
        state.info = session.data; state.ready = false; metadata(state.info);
        metadataLoaded = true;
        if (state.expired) { message('A sessão expirou ou foi substituída. Se já houve um envio, contate a organização; não repita a inscrição.', true); return false; }
        const response = await api('confirmations.php', { headers: state.pending ? { 'Idempotency-Key': state.pending.key } : {} });
        if (response.status === 401) { state.expired = true; throw new Error(); }
        if (response.status !== 200 || !Array.isArray(response.data.registrations)) throw new Error();
        state.ready = true; state.lastRefresh = Date.now(); renderCards(response.data.registrations); metadata(state.info);
        $('recovery-message').hidden = true;
        if (state.pending && response.data.pending_reference) await finish(response.data.pending_reference, response.data.registrations, true);
        else if (state.pending) message(state.pendingMessage || 'O último envio ainda não foi confirmado. Resolva essa tentativa antes de iniciar outra: repita os mesmos dados com a mesma chave ou fale com a organização.', true);
        else applyNewEntry();
        return true;
      } catch {
        state.ready = false; controls();
        $('availability').textContent = state.expired ? 'Sessão expirada. Se já se inscreveu, contate a organização antes de repetir.' : 'Serviço temporariamente indisponível.';
        $('availability-panel').dataset.kind = state.expired ? 'expired' : 'unavailable';
        $('retry').hidden = state.expired;
        if (!state.info) { $('event-summary').hidden = true; $('form-shirt').hidden = true; }
        message('');
        if (metadataLoaded || state.pending || $('cards').childElementCount) {
          $('recovery-message').hidden = false;
          $('recovery-message').textContent = state.pending ? 'Há um envio com resultado incerto. Não faça uma nova inscrição. Tente recuperar as confirmações antes de repetir o envio.' : $('cards').childElementCount ? 'Não foi possível atualizar suas inscrições. Os cartões já recuperados continuam disponíveis; tente novamente.' : 'Não foi possível consultar suas inscrições. Tente novamente antes de enviar um novo cadastro.';
          document.querySelector('.kids-return-note').hidden = !$('cards').childElementCount;
        }
        // Erros nunca trocam a etapa nem escondem um rascunho/tentativa pendente.
        updateViews();
        if (state.view !== 'confirmation' && state.pending) message($('recovery-message').textContent, true);
        return false;
      }
    })();
    try { return await state.refreshing; } finally { state.refreshing = null; }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (state.busy || state.submitting || state.expired) return;
    state.submitting = true; controls();
    try {
    if (state.pending) { if (!await refresh(true) || !state.pending) return; }
    else if (!available() || !validate()) return;
    const payload = state.payload || readPayload();
    let hash;
    try { hash = await fingerprint(payload); } catch { message('Este navegador precisa de uma conexão segura para registrar a inscrição. Use HTTPS ou contate a organização.', true, true); return; }
    if (state.pending && state.pending.hash !== hash) { message('Existe um envio anterior com resultado incerto. Preserve os dados originais ou contate a organização antes de tentar uma nova inscrição.', true, true); return; }
    if (!state.pending) { state.pending = { key: randomKey(), hash, generation: state.info.session_generation, image_authorized: payload.image_authorized, image_authorization_version: payload.image_authorization_version, declaration_version: payload.declaration_version }; savePending(); }
    state.payload = payload; state.busy = true; controls(); message('Registrando. Aguarde a confirmação do servidor.');
    try {
      const response = await api('create.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': state.info.csrf_token, 'Idempotency-Key': state.pending.key }, body: JSON.stringify(payload) });
      if ((response.status === 200 || response.status === 201) && response.data.ok && response.data.registration) {
        const list = await api('confirmations.php');
        if (list.status !== 200) throw new Error();
        await finish(response.data.registration.reference, list.data.registrations, false);
      } else if ([400, 413, 415].includes(response.status)) {
        state.pending = null; state.payload = null; savePending();
        message('Confira os dados preenchidos e a declaração. O servidor recusou este envio; seus campos foram mantidos.', true, true);
      } else if (response.status === 401) {
        state.expired = true; message('A sessão expirou. Se já houve um envio, fale com a organização antes de repetir. Seus dados continuam no formulário.', true, true);
      } else if (response.status === 429) {
        state.pendingMessage = 'Muitas tentativas em pouco tempo. Aguarde pelo menos um minuto e recupere as confirmações antes de repetir.';
        message(state.pendingMessage, true, true);
      } else if (response.status === 403 || response.status === 503) {
        state.pendingMessage = response.status === 503 ? 'Inscrições ainda não disponíveis. Seus dados foram mantidos.' : 'Envio não autorizado ou prazo encerrado. Confira a sessão e as confirmações antes de qualquer nova tentativa.';
        message(state.pendingMessage, true, true);
      } else if (response.status === 409) {
        state.pendingMessage = 'Esta tentativa já foi usada com outros dados. Recupere as confirmações ou fale com a organização; não faça outro envio.';
        message(state.pendingMessage, true, true);
      } else throw new Error();
    } catch { message('A conexão falhou ou o resultado ainda é incerto. Não faça uma nova inscrição. Vamos recuperar as confirmações; se necessário, repita este mesmo envio.', true, true); }
    finally { state.busy = false; controls(); if (state.pending) await refresh(true); }
    } finally { state.submitting = false; controls(); }
  });
  for (const field of fields) {
    $(field).addEventListener(field === 'accepted' || field === 'division' ? 'change' : 'input', () => {
      $(field + '-error').textContent = ''; $(field).removeAttribute('aria-invalid');
      if (field === 'birth_date') ageHint();
    });
  }
  $('another').addEventListener('click', () => {
    if (state.pending || !available()) return;
    if (!state.draftActive) { form.reset(); clearErrors(); ageHint(); state.draftActive = true; }
    message('');
    showView('form', true);
  });
  $('back-to-confirmations').addEventListener('click', () => {
    if (state.pending || state.busy || state.submitting) return;
    message(''); showView('confirmation', true);
  });
  $('retry').addEventListener('click', () => { if (!state.busy) refresh(true); });
  let resumeTimer;
  const resume = () => { if (document.visibilityState !== 'visible') return; clearTimeout(resumeTimer); resumeTimer = setTimeout(() => { if (state.view === 'confirmation') $('confirmations-title').focus({ preventScroll: true }); ageHint(); refresh(); }, 200); };
  document.addEventListener('visibilitychange', resume); window.addEventListener('pageshow', resume); window.addEventListener('focus', resume);
  refresh(true);
})();
