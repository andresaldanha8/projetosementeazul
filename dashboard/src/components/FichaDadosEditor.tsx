import type { AtualizacaoDadosInput, FichaDetalheApi, InteresseFichaApi } from '../services/painelApi';

export function criarRascunhoDados(ficha: FichaDetalheApi): AtualizacaoDadosInput {
  const c = ficha.crianca, r = ficha.responsavel, n = ficha.necessidades;
  return {
    expectedUpdatedAt: ficha.administrativo.updatedAt,
    child: {
      name: c.nome, socialName: c.nomeSocial ?? '', birthDate: c.nascimento,
      sex: c.sexo ?? '', rg: c.rg ?? '', cpf: c.cpf ?? '', neighborhood: c.bairro ?? '',
      phone: c.telefone ?? '', school: c.escola ?? '', hasDiagnosis: n.possuiDiagnostico,
    },
    schooling: { year: c.anoEscolar ?? '', grade: c.serieEscolar ?? '' },
    guardian: {
      name: r.nome, relationship: r.parentesco, birthDate: r.nascimento ?? '',
      phone: r.telefone ?? '', whatsapp: r.whatsapp ?? '', email: r.email ?? '',
    },
    interests: Array.from(new Set(n.interesses.map(i => i.codigo))),
    otherInterestDescription: n.outroInteresseDescricao ?? '', specificNeeds: n.necessidadesEspecificas ?? '',
  };
}

const optional = (value: string | null) => value?.trim() || null;
// Não remover caracteres inválidos de documentos/contatos antes do backend.
const contact = (value: string | null) => value === null || value.replace(/ /g, '') === '' ? null : value;

export function prepararDados(d: AtualizacaoDadosInput): AtualizacaoDadosInput {
  return {
    expectedUpdatedAt: d.expectedUpdatedAt,
    child: {
      name: d.child.name.trim(), socialName: optional(d.child.socialName), birthDate: d.child.birthDate,
      sex: optional(d.child.sex), rg: optional(d.child.rg), cpf: contact(d.child.cpf),
      neighborhood: optional(d.child.neighborhood), phone: contact(d.child.phone),
      school: optional(d.child.school), hasDiagnosis: d.child.hasDiagnosis,
    },
    schooling: { year: optional(d.schooling.year), grade: optional(d.schooling.grade) },
    guardian: {
      name: d.guardian.name.trim(), relationship: d.guardian.relationship.trim(),
      birthDate: optional(d.guardian.birthDate), phone: contact(d.guardian.phone),
      whatsapp: contact(d.guardian.whatsapp), email: optional(d.guardian.email),
    },
    interests: [...d.interests],
    otherInterestDescription: d.interests.includes('OUTRAS') ? optional(d.otherInterestDescription) : null,
    specificNeeds: optional(d.specificNeeds),
  };
}

export function validarRascunhoDados(d: AtualizacaoDadosInput): string[] {
  const errors: string[] = [];
  const required: [string, string | null][] = [
    ['Nome da criança', d.child.name], ['Nascimento da criança', d.child.birthDate],
    ['Nome do responsável', d.guardian.name], ['Parentesco', d.guardian.relationship],
  ];
  for (const [label, value] of required) if (!value?.trim()) errors.push(label + ': preenchimento obrigatório.');
  if (!d.guardian.phone?.trim() && !d.guardian.whatsapp?.trim()) errors.push('Responsável: informe telefone ou WhatsApp.');
  const limits: [string, string | null, number][] = [
    ['Nome da criança', d.child.name, 200], ['Nome social', d.child.socialName, 200],
    ['RG', d.child.rg, 30], ['Bairro', d.child.neighborhood, 150], ['Escola/Instituição', d.child.school, 200],
    ['Ano escolar', d.schooling.year, 50], ['Série escolar', d.schooling.grade, 50],
    ['Nome do responsável', d.guardian.name, 200], ['Parentesco', d.guardian.relationship, 100],
    ['E-mail', d.guardian.email, 254], ['Descrição de OUTRAS', d.otherInterestDescription, 255],
  ];
  for (const [label, value, max] of limits) {
    if (Array.from(value?.trim() ?? '').length > max) errors.push(label + ': máximo de ' + max + ' caracteres.');
  }
  const formats: [string, string | null, RegExp][] = [
    ['CPF', d.child.cpf, /^(?:[0-9]{11}|[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2})$/],
    ...([
      ['Telefone da criança', d.child.phone], ['Telefone do responsável', d.guardian.phone],
      ['WhatsApp do responsável', d.guardian.whatsapp],
    ] as [string, string | null][]).map(([label, value]): [string, string | null, RegExp] =>
      [label, value, /^(?:[0-9]{10,11}|\([0-9]{2}\) [0-9]{4,5}-[0-9]{4})$/]),
  ];
  for (const [label, value, pattern] of formats) {
    const text = value?.replace(/^ +| +$/g, '') ?? '';
    if (text && pattern.exec(text)?.[0] !== text) errors.push(label + ': use dígitos ou a máscara completa.');
  }
  const today = new Date().toISOString().slice(0, 10);
  for (const [label, value] of [
    ['Nascimento da criança', d.child.birthDate], ['Nascimento do responsável', d.guardian.birthDate],
  ] as [string, string | null][]) {
    if (!value) continue;
    const date = new Date(value + 'T00:00:00Z');
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) || !Number.isFinite(date.getTime())
      || date.toISOString().slice(0, 10) !== value || value > today) errors.push(label + ': informe uma data válida, não futura.');
  }
  if (d.child.sex && !['FEMININO', 'MASCULINO', 'OUTRO'].includes(d.child.sex)) errors.push('Sexo: selecione uma opção válida.');
  if (d.interests.includes('OUTRAS') && !d.otherInterestDescription?.trim()) errors.push('OUTRAS: informe a descrição.');
  return errors;
}

interface Props {
  secao: string;
  draft: AtualizacaoDadosInput;
  onChange: (draft: AtualizacaoDadosInput) => void;
  catalogo: InteresseFichaApi[] | null;
  associados: InteresseFichaApi[];
  disabled: boolean;
}

const inputClass = 'block mt-1 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700';

export function FichaDadosEditor({ secao, draft: d, onChange, catalogo, associados, disabled }: Props) {
  function field(label: string, value: string | null, change: (value: string) => void, type = 'text') {
    return <label className="block text-sm font-medium text-slate-700">{label}
      <input type={type} inputMode={label === 'CPF' ? 'numeric' : type === 'tel' ? 'tel' : undefined}
        aria-required={label.endsWith('*') || undefined}
        value={value ?? ''} onChange={event => change(event.target.value)} className={inputClass} />
    </label>;
  }
  function child<K extends keyof AtualizacaoDadosInput['child']>(key: K, value: AtualizacaoDadosInput['child'][K]) {
    onChange({ ...d, child: { ...d.child, [key]: value } });
  }
  function guardian(key: keyof AtualizacaoDadosInput['guardian'], value: string) {
    onChange({ ...d, guardian: { ...d.guardian, [key]: value } });
  }
  const options = new Map<string, InteresseFichaApi>();
  for (const item of catalogo ?? []) options.set(item.codigo, item);
  for (const item of associados) if (!options.has(item.codigo)) options.set(item.codigo, item);
  const activeCodes = new Set((catalogo ?? []).map(item => item.codigo));

  return <fieldset disabled={disabled} className="space-y-4">
    {secao === 'crianca' && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {field('Nome completo *', d.child.name, v => child('name', v))}
      {field('Nome social', d.child.socialName, v => child('socialName', v))}
      {field('Data de nascimento *', d.child.birthDate, v => child('birthDate', v), 'date')}
      <label className="block text-sm font-medium text-slate-700">Sexo
        <select value={d.child.sex ?? ''} onChange={e => child('sex', e.target.value)} className={inputClass}>
          <option value="">Não informado</option><option value="FEMININO">Feminino</option>
          <option value="MASCULINO">Masculino</option><option value="OUTRO">Outro</option>
          {d.child.sex && !['FEMININO', 'MASCULINO', 'OUTRO'].includes(d.child.sex)
            && <option value={d.child.sex}>{d.child.sex} (revisar)</option>}
        </select>
      </label>
      {field('RG', d.child.rg, v => child('rg', v))}
      {field('CPF', d.child.cpf, v => child('cpf', v))}
      {field('Bairro', d.child.neighborhood, v => child('neighborhood', v))}
      {field('Telefone com DDD', d.child.phone, v => child('phone', v), 'tel')}
      {field('Escola/Instituição', d.child.school, v => child('school', v))}
      {field('Ano escolar', d.schooling.year, v => onChange({ ...d, schooling: { ...d.schooling, year: v } }))}
      {field('Série escolar', d.schooling.grade, v => onChange({ ...d, schooling: { ...d.schooling, grade: v } }))}
    </div>}
    {secao === 'responsavel' && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {field('Nome do responsável *', d.guardian.name, v => guardian('name', v))}
      {field('Parentesco *', d.guardian.relationship, v => guardian('relationship', v))}
      {field('Data de nascimento', d.guardian.birthDate, v => guardian('birthDate', v), 'date')}
      {field('Telefone com DDD', d.guardian.phone, v => guardian('phone', v), 'tel')}
      {field('WhatsApp com DDD', d.guardian.whatsapp, v => guardian('whatsapp', v), 'tel')}
      {field('E-mail', d.guardian.email, v => guardian('email', v), 'email')}
      <p className="text-xs text-slate-500 sm:col-span-2">Informe pelo menos telefone ou WhatsApp. Use dígitos ou (11) 99999-9999.</p>
    </div>}
    {secao === 'necessidades' && <>
      <label className="block text-sm font-medium text-slate-700">Possui diagnóstico?
        <select value={d.child.hasDiagnosis === null ? '' : d.child.hasDiagnosis ? 'sim' : 'nao'}
          onChange={e => child('hasDiagnosis', e.target.value === '' ? null : e.target.value === 'sim')} className={inputClass}>
          <option value="">Não informado</option><option value="sim">Sim</option><option value="nao">Não</option>
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">Necessidades específicas
        <textarea rows={5} value={d.specificNeeds ?? ''} onChange={e => onChange({ ...d, specificNeeds: e.target.value })} className={inputClass} />
      </label>
      <fieldset disabled={catalogo === null} className="space-y-2">
        <legend className="text-sm font-medium text-slate-700 mb-2">Interesses</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...options.values()].map(item => <label key={item.codigo} className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" className="mt-1" checked={d.interests.includes(item.codigo)} onChange={e => {
              const interests = e.target.checked ? Array.from(new Set([...d.interests, item.codigo])) : d.interests.filter(c => c !== item.codigo);
              onChange({ ...d, interests, otherInterestDescription: interests.includes('OUTRAS') ? d.otherInterestDescription : '' });
            }} />
            <span>{item.nome}{catalogo !== null && !activeCodes.has(item.codigo)
              && <span className="block text-xs text-amber-700">Histórico/inativo — desmarcar remove da ficha</span>}</span>
          </label>)}
        </div>
        {catalogo !== null && options.size === 0 && <p className="text-sm text-slate-500">Nenhum interesse disponível.</p>}
      </fieldset>
      {d.interests.includes('OUTRAS') && field('Descrição de OUTRAS * (até 255 caracteres)', d.otherInterestDescription,
        v => onChange({ ...d, otherInterestDescription: v }))}
    </>}
  </fieldset>;
}
