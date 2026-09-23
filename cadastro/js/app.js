'use strict';

(() => {
  const form = document.getElementById('registration-form');
  const steps = [...document.querySelectorAll('.step')];
  const back = document.getElementById('back');
  const next = document.getElementById('next');
  const get = id => document.getElementById(id);
  let current = 0;
  let authenticatedUser = null;
  let loginPending = false;
  let passwordChangePending = false;
  // Estado de submissão idempotente (em memória apenas)
  let submissionIdempotencyKey = null;
  let submissionInProgress = false;
  let submissionPayloadSnapshot = null;

  function showLogin() {
    get('panel-link').hidden = true;
    authenticatedUser = null;
    get('registration').hidden = true;
    get('success').hidden = true;
    get('current-user').hidden = true;
    get('current-user-name').textContent = '';
    get('current-user-role').textContent = '';
    // esconder painel de troca de senha e limpar seus estados
    const pc = get('password-change-panel'); if (pc) pc.hidden = true;
    const perr = get('password-change-error'); if (perr) { perr.hidden = true; perr.textContent = ''; }
    const pstatus = get('password-change-status'); if (pstatus) pstatus.textContent = '';
    get('login-panel').hidden = false;
  }

  function showUser(user) {
    get('panel-link').hidden = false;
    authenticatedUser = user;
    get('current-user-name').textContent = user.nome;
    get('current-user-role').textContent = user.perfil === 'ADMINISTRADOR' ? 'Administrador' : 'Cadastrador';
    get('current-user').hidden = false;
    get('login-panel').hidden = true;
    // garantir painel de troca escondido para usuário liberado
    const pc = get('password-change-panel'); if (pc) pc.hidden = true;
    get('registration').hidden = false;
  }

  function showPasswordChange(user) {
    get('panel-link').hidden = true;
    authenticatedUser = user;
    // preencher current-user como showUser
    get('current-user-name').textContent = user.nome;
    get('current-user-role').textContent = user.perfil === 'ADMINISTRADOR' ? 'Administrador' : 'Cadastrador';
    get('login-panel').hidden = true;
    get('registration').hidden = true;
    get('success').hidden = true;
    get('current-user').hidden = false;
    const pc = get('password-change-panel'); if (pc) pc.hidden = false;
    // limpar status/erro ao abrir
    const perr = get('password-change-error'); if (perr) { perr.hidden = true; perr.textContent = ''; }
    const pstatus = get('password-change-status'); if (pstatus) pstatus.textContent = '';
    // focar primeiro campo
    const first = get('current-password'); if (first) first.focus();
  }

  function hidePassword() {
    get('login-password').type = 'password';
    get('toggle-password').textContent = 'Mostrar';
    get('toggle-password').setAttribute('aria-label', 'Mostrar senha');
    get('toggle-password').setAttribute('aria-pressed', 'false');
  }

  get('toggle-password').addEventListener('click', () => {
    if (get('login-password').type === 'text') return hidePassword();
    get('login-password').type = 'text';
    get('toggle-password').textContent = 'Ocultar';
    get('toggle-password').setAttribute('aria-label', 'Ocultar senha');
    get('toggle-password').setAttribute('aria-pressed', 'true');
  });

  get('login-form').addEventListener('input', () => { get('login-error').hidden = true; });
  get('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (loginPending) return;
    loginPending = true;
    get('login-submit').disabled = true;
    get('login-submit').textContent = 'Entrando…';
    get('login-form').setAttribute('aria-busy', 'true');
    get('login-error').hidden = true;
    get('login-status').textContent = 'Verificando acesso…';
    try {
      const user = await window.authService.login(get('login-name').value.trim(), get('login-password').value);
      // Se a conta requer troca obrigatória, apresentar o painel de troca
      try { get('login-form').reset(); } catch (e) {}
      if (window.authService.requiresPasswordChange && window.authService.requiresPasswordChange() === true) {
        // limpar senha de login por segurança
        get('login-password').value = '';
        hidePassword();
        showPasswordChange(user);
      } else {
        showUser(user);
        showStep(0);
      }
    } catch (error) {
      get('login-error').textContent = error.message;
      get('login-error').hidden = false;
      get('login-password').focus();
    } finally {
      get('login-password').value = '';
      hidePassword();
      loginPending = false;
      get('login-submit').disabled = false;
      get('login-submit').textContent = 'Entrar';
      get('login-form').removeAttribute('aria-busy');
      get('login-status').textContent = '';
    }
  });

  get('logout').addEventListener('click', async () => {
    if (get('logout').disabled) return;
    get('logout').disabled = true;
    get('logout-error').hidden = true;
    // A ficha local é limpa antes de encerrar a sessão.
    // limpar e esconder painel de troca de senha por segurança
    const pc = get('password-change-panel'); if (pc) pc.hidden = true;
    const cp = get('current-password'); if (cp) cp.value = '';
    const np = get('new-password'); if (np) np.value = '';
    const cf = get('confirm-new-password'); if (cf) cf.value = '';
    const perr = get('password-change-error'); if (perr) { perr.hidden = true; perr.textContent = ''; }
    const pstatus = get('password-change-status'); if (pstatus) pstatus.textContent = '';
    resetRegistration();
    get('registration').hidden = true;
    try {
      await window.authService.logout();
      showLogin();
      get('login-form').reset();
      hidePassword();
      get('login-error').hidden = true;
      get('login-title').focus();
    } catch {
      get('logout-error').textContent = 'Não foi possível encerrar a sessão. Tente sair novamente.';
      get('logout-error').hidden = false;
    } finally {
      get('logout').disabled = false;
    }
  });

  function updateRecordChild() {
    const input = get('child-name');
    const name = input.value.trim();
    const visible = Boolean(name) && input.validity.valid;
    get('record-child-name').textContent = visible ? name : '';
    get('record-child').hidden = !visible;
  }

  function today() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function displayDate(value) {
    return value ? value.split('-').reverse().join('/') : '';
  }

  function updateDates() {
    const date = today();
    get('child-birth').max = date;
    get('guardian-birth').max = date;
    get('authorization-date').dateTime = date;
    get('authorization-date').textContent = displayDate(date);
    calculateAge();
  }

  function calculateAge() {
    const value = get('child-birth').value;
    get('age').value = '';
    if (!value || value > today() || !get('child-birth').validity.valid) return;
    const [year, month, day] = value.split('-').map(Number);
    const now = new Date();
    let age = now.getFullYear() - year;
    if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) age--;
    get('age').value = String(age);
  }

  function mask(value, type) {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (type === 'cpf') return digits.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3}\.\d{3})(\d)/, '$1.$2').replace(/(\.\d{3})(\d)/, '$1-$2');
    if (!digits) return '';
    if (digits.length <= 2) return `(${digits}`;
    const number = digits.slice(2);
    const split = number.length > 8 ? 5 : 4;
    return `(${digits.slice(0, 2)}) ${number.slice(0, split)}${number.length > split ? '-' + number.slice(split) : ''}`;
  }

  function clearError(input) {
    input.removeAttribute('aria-invalid');
    const error = get(`${input.id}-error`);
    if (error) { error.textContent = ''; error.hidden = true; }
  }

  function setError(input, message) {
    input.setAttribute('aria-invalid', 'true');
    const error = get(`${input.id}-error`);
    if (error) { error.textContent = message; error.hidden = false; }
  }

  function validateStep(index) {
    updateDates();
    const inputs = [...steps[index].querySelectorAll('input, textarea')];
    inputs.forEach(clearError);
    for (const input of inputs) {
      if (input.disabled) continue;
      const value = input.value.trim();
      if (input.required && (input.type === 'checkbox' ? !input.checked : !value)) {
        setError(input, input.type === 'checkbox' ? 'A concordância do responsável é obrigatória para continuar.' : 'Preencha este campo.');
      } else if (input.type === 'date' && (input.validity.badInput || (value && !input.validity.valid))) {
        setError(input, value > today() ? 'A data de nascimento não pode ser futura.' : 'Informe uma data válida.');
      } else if (input.type === 'email' && value && input.validity.typeMismatch) {
        setError(input, 'Informe um e-mail válido, como nome@exemplo.com.');
      } else if (input.dataset.mask && value) {
        const count = value.replace(/\D/g, '').length;
        if (input.dataset.mask === 'cpf' && count !== 11) setError(input, 'Informe os 11 dígitos do CPF.');
        if (input.dataset.mask === 'phone' && count !== 10 && count !== 11) setError(input, 'Informe o número com DDD: 10 ou 11 dígitos.');
      }
    }
    if (index === 1 && !get('guardian-phone').value.trim() && !get('whatsapp').value.trim()) {
      setError(get('guardian-phone'), 'Preencha Telefone ou WhatsApp para contato.');
      setError(get('whatsapp'), 'Preencha WhatsApp ou Telefone para contato.');
    }
    return !steps[index].querySelector('[aria-invalid="true"]');
  }

  function renderReview() {
    const data = new FormData(form);
    const groups = [
      ['Criança/Adolescente', [['Nome completo', 'childName'], ['Nome social (se houver)', 'socialName'], ['Data de nascimento', 'childBirth'], ['Idade', 'age'], ['Sexo', 'sex'], ['RG', 'rg'], ['CPF', 'cpf'], ['Bairro', 'neighborhood'], ['Telefone', 'childPhone'], ['Escola/Instituição de ensino', 'school'], ['Possui diagnóstico?', 'diagnosis'], ['Ano', 'year'], ['Série', 'grade']]],
      ['Responsável', [['Nome completo', 'guardianName'], ['Parentesco com a criança', 'relationship'], ['Data de nascimento', 'guardianBirth'], ['Telefone', 'guardianPhone'], ['WhatsApp', 'whatsapp'], ['E-mail', 'email']]],
      ['Necessidades e Interesses', [['Quais atividades do Projeto Semente Azul são de interesse da criança/adolescente?', 'interests'], ...(get('other-interest').checked ? [['Outras — especificação', 'otherDescription']] : []), ['Existe alguma necessidade específica que a equipe do projeto deve conhecer?', 'needs']]]
    ];
    get('review').replaceChildren();
    for (const [index, [title, fields]] of groups.entries()) {
      const section = document.createElement('section');
      section.className = 'review-section';
      const heading = document.createElement('h3');
      heading.textContent = title;
      const header = document.createElement('header');
      header.className = 'review-heading';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'review-edit';
      edit.textContent = 'Editar';
      edit.setAttribute('aria-label', `Editar ${title}`);
      edit.addEventListener('click', () => showStep(index));
      header.append(heading, edit);
      const list = document.createElement('dl');
      for (const [label, name] of fields) {
        const row = document.createElement('div');
        const term = document.createElement('dt');
        const description = document.createElement('dd');
        term.textContent = label;
        let value = name === 'interests' ? data.getAll(name).join(', ') : String(data.get(name) || '').trim();
        if (name === 'childBirth' || name === 'guardianBirth') value = displayDate(value);
        description.textContent = value || 'Não informado';
        row.append(term, description);
        list.append(row);
      }
      section.append(header, list);
      get('review').append(section);
    }
    // Inserir/atualizar identificação do responsável que autorizou
    try {
      const guardianName = String(data.get('guardianName') || '').trim();
      const authFieldset = document.querySelector('.authorization');
      if (authFieldset) {
        let authDiv = authFieldset.querySelector('#authorized-by');
        const consent = authFieldset.querySelector('.consent');
        if (!authDiv) {
          authDiv = document.createElement('div');
          authDiv.id = 'authorized-by';
          authDiv.className = 'authorized-by';
          if (consent) authFieldset.insertBefore(authDiv, consent);
          else authFieldset.insertBefore(authDiv, authFieldset.firstChild);
        }
        authDiv.replaceChildren();
        const label = document.createElement('p');
        label.className = 'auth-label';
        label.textContent = 'Responsável que autorizou';
        const nameP = document.createElement('p');
        nameP.className = 'auth-name';
        nameP.textContent = guardianName || 'Não informado';
        authDiv.append(label, nameP);
      }
    } catch (e) {
      // não bloquear renderização se algo falhar aqui
      console.error('Erro ao renderizar responsável que autorizou', e);
    }
  }

  function showStep(index) {
    current = index;
    updateRecordChild();
    steps.forEach((step, i) => { step.hidden = i !== index; });
    document.querySelectorAll('.progress li').forEach((item, i) => {
      item.classList.toggle('complete', i < index);
      if (i === index) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    get('step-count').textContent = `Etapa ${index + 1} de 4`;
    back.hidden = index === 0;
    next.textContent = index === 3 ? 'Enviar cadastro' : 'Continuar';
    updateDates();
    if (index === 3) renderReview();
    const title = steps[index].querySelector('h2');
    title.focus({ preventScroll: true });
    get('registration').scrollIntoView({ block: 'start', behavior: 'instant' });
  }

  form.addEventListener('input', event => {
    const input = event.target;
    if (input.dataset.mask) {
      const position = input.selectionStart;
      const digitCount = input.value.slice(0, position).replace(/\D/g, '').length;
      input.value = mask(input.value, input.dataset.mask);
      let cursor = 0, seen = 0;
      while (cursor < input.value.length && seen < digitCount) {
        if (/\d/.test(input.value[cursor])) seen++;
        cursor++;
      }
      input.setSelectionRange(cursor, cursor);
    }
    clearError(input);
    if (input.id === 'child-name') updateRecordChild();
    if (input.id === 'child-birth') calculateAge();
    if (input.id === 'guardian-phone' || input.id === 'whatsapp') {
      clearError(get('guardian-phone')); clearError(get('whatsapp'));
    }
  });

  get('other-interest').addEventListener('change', () => {
    const selected = get('other-interest').checked;
    get('other-field').hidden = !selected;
    get('other-description').disabled = !selected;
  });
  back.addEventListener('click', () => showStep(Math.max(0, current - 1)));
  form.addEventListener('submit', event => {
    event.preventDefault();
    // Submissão real com idempotência.
    if (!authenticatedUser) return;
    if (current < 3) {
      if (validateStep(current)) showStep(current + 1);
      else steps[current].querySelector('[aria-invalid="true"]').focus();
      return;
    }

    for (let index = 0; index < steps.length; index++) {
      if (!validateStep(index)) {
        showStep(index);
        steps[index].querySelector('[aria-invalid="true"]').focus();
        return;
      }
    }

    // Montar payload conforme contrato público. Normalizações mínimas aqui.
    function trimOrNull(v) { if (typeof v !== 'string') return null; const t = v.trim(); return t === '' ? null : t; }
    function digitsOrNull(v) { if (!v) return null; const d = String(v).replace(/\D/g, ''); return d === '' ? null : d; }
    function mapSex(v) { if (!v) return null; const s = String(v).trim().toUpperCase(); if (s === 'FEMININO' || s === 'MASCULINO' || s === 'OUTRO') return s; return null; }
    function mapDiagnosis(v) { if (!v) return null; const s = String(v).trim().toLowerCase(); if (s === 'sim') return true; if (s === 'não' || s === 'nao') return false; return null; }
    const interestMap = {
      'Atividades recreativas': 'ATIVIDADES_RECREATIVAS',
      'Esporte': 'ESPORTE',
      'Cultura': 'CULTURA',
      'Música': 'MUSICA',
      'Dança': 'DANCA',
      'Artes': 'ARTES',
      'Oficinas': 'OFICINAS',
      'Passeios/eventos': 'PASSEIOS_EVENTOS',
      'Apoio pedagógico': 'APOIO_PEDAGOGICO',
      'Outras': 'OUTRAS'
    };

    const formData = new FormData(form);
    const rawInterests = formData.getAll('interests').map(v => String(v || ''));
    const interests = Array.from(new Set(rawInterests.map(v => interestMap[v] || null).filter(Boolean)));

    const payload = {
      child: {
        name: trimOrNull(formData.get('childName')),
        socialName: trimOrNull(formData.get('socialName')),
        birthDate: trimOrNull(formData.get('childBirth')),
        sex: mapSex(formData.get('sex')),
        rg: trimOrNull(formData.get('rg')),
        cpf: digitsOrNull(formData.get('cpf')),
        neighborhood: trimOrNull(formData.get('neighborhood')),
        phone: digitsOrNull(formData.get('childPhone')),
        school: trimOrNull(formData.get('school')),
        hasDiagnosis: mapDiagnosis(formData.get('diagnosis'))
      },
      schooling: {
        year: trimOrNull(formData.get('year')),
        grade: trimOrNull(formData.get('grade'))
      },
      guardian: {
        name: trimOrNull(formData.get('guardianName')),
        relationship: trimOrNull(formData.get('relationship')),
        birthDate: trimOrNull(formData.get('guardianBirth')),
        phone: digitsOrNull(formData.get('guardianPhone')),
        whatsapp: digitsOrNull(formData.get('whatsapp')),
        email: trimOrNull(formData.get('email'))
      },
      interests,
      otherInterestDescription: trimOrNull(formData.get('otherDescription')),
      specificNeeds: trimOrNull(formData.get('needs')),
      consent: Boolean(formData.get('consent'))
    };

    // helper para exibir erro na UI de registro
    function showRegistrationError(msg) {
      let el = get('registration-error');
      if (!el) {
        el = document.createElement('p');
        el.id = 'registration-error';
        el.className = 'error';
        el.setAttribute('role', 'alert');
        form.parentNode.insertBefore(el, form);
      }
      el.textContent = String(msg || 'Erro no envio.');
      el.hidden = false;
    }

    // Proteger contra envio concorrente
    if (submissionInProgress) return;

    if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
      showRegistrationError('Geração de Idempotency-Key não disponível no seu navegador. Atualize o navegador.');
      return;
    }

    // Se ainda não houver chave para a tentativa lógica atual, criar uma.
    if (submissionIdempotencyKey === null) {
      submissionIdempotencyKey = crypto.randomUUID();
      submissionPayloadSnapshot = JSON.stringify(payload);
    } else {
      // Se já existe snapshot, garantir que o payload não mudou.
      const currentSnapshot = JSON.stringify(payload);
      if (submissionPayloadSnapshot !== null && submissionPayloadSnapshot !== currentSnapshot) {
        showRegistrationError('Os dados foram alterados desde a última tentativa de envio. Verifique antes de reenviar.');
        return;
      }
    }

    // Iniciar envio
    submissionInProgress = true;
    const prevNextText = next.textContent;
    next.disabled = true;
    next.textContent = 'Enviando...';
    next.setAttribute('aria-busy', 'true');

    (async () => {
      let result;
      try {
        result = await window.authService.createFicha(payload, submissionIdempotencyKey);
      } catch (e) {
        // Erro inesperado ao chamar authService
        showRegistrationError('Não foi possível confirmar o envio. Verifique sua conexão e tente novamente.');
        submissionInProgress = false;
        next.disabled = false;
        next.textContent = prevNextText;
        next.removeAttribute('aria-busy');
        return;
      }

      // Rede
      if (result && result.networkError) {
        showRegistrationError('Não foi possível confirmar o envio. Verifique sua conexão e tente novamente.');
        submissionInProgress = false;
        next.disabled = false;
        next.textContent = prevNextText;
        next.removeAttribute('aria-busy');
        return;
      }

      const status = result && typeof result.status === 'number' ? result.status : 0;
      const body = result && result.body ? result.body : null;

      // Tratar códigos conforme especificação
      if (status === 201 && body && body.ok === true && body.cadastro && body.cadastro.numero) {
        // Sucesso definitivo
        const psa = String(body.cadastro.numero);
        // mostrar tela de sucesso real
        const eyebrow = document.querySelector('#success .eyebrow'); if (eyebrow) eyebrow.textContent = 'Cadastro enviado';
        get('success-title').textContent = 'Cadastro enviado com sucesso!';
        let psaEl = get('psa-number');
        if (!psaEl) {
          psaEl = document.createElement('p'); psaEl.id = 'psa-number';
          get('success').appendChild(psaEl);
        }
        psaEl.textContent = `Nº do cadastro: ${psa}`;
        // limpar estado de idempotência
        submissionIdempotencyKey = null;
        submissionPayloadSnapshot = null;
        submissionInProgress = false;
        next.disabled = false;
        next.textContent = prevNextText;
        next.removeAttribute('aria-busy');
        get('registration').hidden = true;
        get('success').hidden = false;
        get('success-title').focus({ preventScroll: true });
        get('success').scrollIntoView({ block: 'start', behavior: 'instant' });
        return;
      }

      if (status === 200 && body && body.ok === true && body.replayed === true && body.cadastro && body.cadastro.numero) {
        // Replay tratado como sucesso
        const psa = String(body.cadastro.numero);
        const eyebrow = document.querySelector('#success .eyebrow'); if (eyebrow) eyebrow.textContent = 'Cadastro reenviado';
        get('success-title').textContent = 'Cadastro enviado (replay detectado)';
        let psaEl = get('psa-number');
        if (!psaEl) { psaEl = document.createElement('p'); psaEl.id = 'psa-number'; get('success').appendChild(psaEl); }
        psaEl.textContent = `Nº do cadastro: ${psa}`;
        submissionIdempotencyKey = null;
        submissionPayloadSnapshot = null;
        submissionInProgress = false;
        next.disabled = false;
        next.textContent = prevNextText;
        next.removeAttribute('aria-busy');
        get('registration').hidden = true;
        get('success').hidden = false;
        get('success-title').focus({ preventScroll: true });
        get('success').scrollIntoView({ block: 'start', behavior: 'instant' });
        return;
      }

      if (status === 409) {
        showRegistrationError('Os dados deste cadastro foram alterados após uma tentativa de envio. Verifique as informações antes de tentar novamente.');
        // preservar chave e snapshot
        submissionInProgress = false;
        next.disabled = false;
        next.textContent = prevNextText;
        next.removeAttribute('aria-busy');
        return;
      }

      if (status === 202) {
        showRegistrationError('O envio ainda está sendo processado. Aguarde alguns segundos e tente novamente.');
        submissionInProgress = false;
        next.disabled = false;
        next.textContent = prevNextText;
        next.removeAttribute('aria-busy');
        return;
      }

      if (status === 400) {
        const msg = body && (body.mensagem || body.message) ? String(body.mensagem || body.message) : 'Dados inválidos. Verifique e tente novamente.';
        showRegistrationError(msg);
        submissionInProgress = false;
        next.disabled = false;
        next.textContent = prevNextText;
        next.removeAttribute('aria-busy');
        return;
      }

      if (status === 401) {
        showRegistrationError('Sessão expirada. Faça login novamente.');
        submissionInProgress = false;
        next.disabled = false;
        next.textContent = prevNextText;
        next.removeAttribute('aria-busy');
        return;
      }

      if (status === 403) {
        showRegistrationError('Requisição não autorizada. Verifique seu perfil/permissões.');
        submissionInProgress = false;
        next.disabled = false;
        next.textContent = prevNextText;
        next.removeAttribute('aria-busy');
        return;
      }

      // 5xx ou outros
      showRegistrationError('Não foi possível confirmar o envio. Verifique sua conexão e tente novamente.');
      submissionInProgress = false;
      next.disabled = false;
      next.textContent = prevNextText;
      next.removeAttribute('aria-busy');
      return;
    })();
  });
  function resetRegistration() {
    form.reset();
    form.querySelectorAll('input, textarea').forEach(clearError);
    get('other-field').hidden = true;
    get('other-description').disabled = true;
    get('review').replaceChildren();
    const authDiv = document.getElementById('authorized-by');
    if (authDiv && authDiv.parentNode) authDiv.parentNode.removeChild(authDiv);
    get('success').hidden = true;
    updateRecordChild();
    updateDates();

    // LIMPEZA DE IDEMPOTÊNCIA (estado em memória)
    try {
      submissionIdempotencyKey = null;
      submissionPayloadSnapshot = null;
      submissionInProgress = false;
    } catch (e) {
      // não bloquear o fluxo em caso improvável de erro
      console.error('Erro ao limpar estado de idempotência', e);
    }

    // Restaurar estado do botão de avanço/submit
    try {
      if (next) {
        next.disabled = false;
        next.removeAttribute('aria-busy');
        // garantir texto coerente com etapa inicial
        next.textContent = 'Continuar';
      }
    } catch (e) {
      console.error('Erro ao restaurar botão de envio', e);
    }

    // Remover possível mensagem de erro de submissão
    const regErr = get('registration-error');
    if (regErr) { regErr.textContent = ''; regErr.hidden = true; }
  }
  get('restart').addEventListener('click', () => {
    if (!authenticatedUser) return;
    resetRegistration();
    get('registration').hidden = false;
    showStep(0);
  });
  get('child-name').addEventListener('change', updateRecordChild);
  updateRecordChild();
  updateDates();
  function clearPasswordChangeUI(keepNewPasswords = false) {
    const cp = get('current-password'); if (cp) cp.value = '';
    const np = get('new-password'); if (np && !keepNewPasswords) np.value = '';
    const cf = get('confirm-new-password'); if (cf && !keepNewPasswords) cf.value = '';
    const perr = get('password-change-error'); if (perr) { perr.hidden = true; perr.textContent = ''; }
    const pstatus = get('password-change-status'); if (pstatus) pstatus.textContent = '';
    const submit = get('password-change-submit'); if (submit) { submit.disabled = false; submit.textContent = 'Alterar senha'; }
    passwordChangePending = false;
  }
  // esconder/limpar erro ao digitar
  const pcForm = get('password-change-form');
  if (pcForm) pcForm.addEventListener('input', () => { const perr = get('password-change-error'); if (perr) perr.hidden = true; get('password-change-status').textContent = ''; });
  if (pcForm) pcForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (passwordChangePending) return;
    passwordChangePending = true;
    const submit = get('password-change-submit'); if (submit) { submit.disabled = true; submit.textContent = 'Alterando…'; }
    const currentPassword = get('current-password').value;
    const newPassword = get('new-password').value;
    const confirmNew = get('confirm-new-password').value;
    const errEl = get('password-change-error');
    const statusEl = get('password-change-status');
    if (errEl) { errEl.hidden = true; errEl.textContent = ''; }
    if (statusEl) statusEl.textContent = 'Atualizando sua senha…';
    // validações locais
    if (newPassword !== confirmNew) {
      if (errEl) { errEl.textContent = 'As novas senhas não coincidem.'; errEl.hidden = false; }
      if (submit) { submit.disabled = false; submit.textContent = 'Alterar senha'; }
      passwordChangePending = false;
      return;
    }
    if (!newPassword || newPassword.length < 10) {
      if (errEl) { errEl.textContent = 'A nova senha deve ter pelo menos 10 caracteres.'; errEl.hidden = false; }
      if (submit) { submit.disabled = false; submit.textContent = 'Alterar senha'; }
      passwordChangePending = false;
      return;
    }
    try {
      const result = await window.authService.changePassword(currentPassword, newPassword);
      // sucesso: limpar campos e seguir para área de cadastro
      clearPasswordChangeUI();
      const updatedUser = result || authenticatedUser;
      authenticatedUser = updatedUser;
      const pc = get('password-change-panel'); if (pc) pc.hidden = true;
      showUser(updatedUser);
      showStep(0);
      const title = get('title-1'); if (title) title.focus({ preventScroll: true });
    } catch (error) {
      const msg = error && error.message ? String(error.message) : 'Erro ao alterar a senha.';
      // Exibir a mensagem de erro e mantê-la visível.
      if (errEl) { errEl.textContent = msg; errEl.hidden = false; }
      // Determinar se é um erro relacionado à credencial atual (validação)
      const credIssue = /Senha atual|atual incorreta|diferente da senha atual/i.test(msg);
      // Em casos de erro de credencial: limpar apenas a senha atual, manter nova/confirmação.
      if (credIssue) {
        const cp = get('current-password'); if (cp) cp.value = '';
      } else {
        // Erros técnicos/sessão/rede/outros: limpar todos os campos de senha,
        // mas NÃO apagar a mensagem de erro exibida.
        const cp = get('current-password'); if (cp) cp.value = '';
        const np = get('new-password'); if (np) np.value = '';
        const cf = get('confirm-new-password'); if (cf) cf.value = '';
      }
    } finally {
      passwordChangePending = false;
      const submit2 = get('password-change-submit'); if (submit2) { submit2.disabled = false; submit2.textContent = 'Alterar senha'; }
      if (get('password-change-status')) get('password-change-status').textContent = '';
    }
  });
  // A ficha inicia hidden no HTML: nenhum flash antes da verificação da sessão.
  // Arquivos continuam acessíveis no navegador; proteção real será server-side.
  async function initializeAuth() {
    showLogin();
    try {
      const user = await window.authService.getCurrentUser();
      if (!user) {
        // permanecer no login
        get('login-submit').disabled = false;
        return;
      }
      if (window.authService.requiresPasswordChange && window.authService.requiresPasswordChange() === true) {
        showPasswordChange(user);
      } else {
        showUser(user);
        showStep(0);
      }
      get('login-submit').disabled = false;
    } catch {
      get('login-error').textContent = 'Não foi possível verificar o acesso. Atualize a página.';
      get('login-error').hidden = false;
    }
  }
  initializeAuth();
})();
