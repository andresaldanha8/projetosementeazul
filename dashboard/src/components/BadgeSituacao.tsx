import type { Situacao } from '../data/mockData';

const config: Record<Situacao, { label: string; className: string }> = {
  'Ativo': {
    label: 'Ativo',
    className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  },
  'Aguardando documentação': {
    label: 'Aguardando doc.',
    className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  },
  'Acompanhamento': {
    label: 'Acompanhamento',
    className: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  },
  'Encerrado': {
    label: 'Encerrado',
    className: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
  },
};

export function BadgeSituacao({ situacao, full }: { situacao: Situacao; full?: boolean }) {
  const c = config[situacao];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${c.className}`}>
      {full ? situacao : c.label}
    </span>
  );
}
