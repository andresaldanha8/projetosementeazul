import { useState, useMemo, useEffect } from 'react';
import painelApi, { type FichaListApi } from '../services/painelApi';
import { BadgeSituacao } from '../components/BadgeSituacao';

const SITUACOES = ['Ativo', 'Aguardando documentação', 'Acompanhamento', 'Encerrado'] as const;
type SituacaoLabel = typeof SITUACOES[number];

const SITUACAO_LABEL_TO_TOKEN: Record<SituacaoLabel, string> = {
  'Ativo': 'ATIVO',
  'Aguardando documentação': 'AGUARDANDO_DOCUMENTACAO',
  'Acompanhamento': 'ACOMPANHAMENTO',
  'Encerrado': 'ENCERRADO',
};

const SEXO_MAP: Record<string, string> = {
  'FEMININO': 'Feminino',
  'MASCULINO': 'Masculino',
  'OUTRO': 'Outro',
};

interface FichasPageProps {
  onVerFicha: (id: string) => void;
}

export function FichasPage({ onVerFicha }: FichasPageProps) {
  const [busca, setBusca] = useState('');
  const [situacaoFiltro, setSituacaoFiltro] = useState<SituacaoLabel | ''>('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fichas, setFichas] = useState<FichaListApi[]>([]);
  const [total, setTotal] = useState(0);

  // debounced search term to avoid firing on every keystroke
  const [debouncedBusca, setDebouncedBusca] = useState(busca);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedBusca(busca.trim()), 300);
    return () => clearTimeout(id);
  }, [busca]);

  // fetch data whenever filters change (debounced search included)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await painelApi.getFichas({
          q: debouncedBusca || undefined,
          situacao: situacaoFiltro ? (SITUACAO_LABEL_TO_TOKEN[situacaoFiltro as SituacaoLabel] as any) : undefined,
          data_inicio: dataInicio || undefined,
          data_fim: dataFim || undefined,
          page: 1,
          per_page: 50,
        });

        if (cancelled) return;

        setTotal(res.total);
        setFichas(res.fichas);
      } catch (err: any) {
        if (cancelled) return;
        if (err && err.name === 'AuthError') {
          setError('Sessão inválida ou expirada. Faça login.');
        } else {
          setError('Erro ao carregar fichas. Tente novamente.');
        }
        setFichas([]);
        setTotal(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [debouncedBusca, situacaoFiltro, dataInicio, dataFim]);

  // Map API fichas to the shape expected by the table (compatible with mock)
  const fichasForTable = useMemo(() => {
    return fichas.map(f => {
      const criancaGenero = f.criancaSexo ? (SEXO_MAP[f.criancaSexo] ?? f.criancaSexo) : '—';
      const criancaNascimento = f.criancaNascimento ?? '';
      const dataCadastroYmd = (f.createdAt && f.createdAt.length >= 10) ? f.createdAt.slice(0, 10) : '';

      return {
        id: String(f.id),
        nCadastro: f.numero,
        crianca: {
          nome: f.criancaNome,
          dataNascimento: criancaNascimento,
          genero: criancaGenero,
        },
        responsavel: {
          nome: f.responsavelNome ?? '—',
          parentesco: f.responsavelParentesco ?? '—',
        },
        administrativo: {
          situacao: ((): any => {
            // map token to UI label expected by BadgeSituacao
            switch (f.situacao) {
              case 'ATIVO': return 'Ativo';
              case 'AGUARDANDO_DOCUMENTACAO': return 'Aguardando documentação';
              case 'ACOMPANHAMENTO': return 'Acompanhamento';
              case 'ENCERRADO': return 'Encerrado';
              default: return '—';
            }
          })(),
          dataCadastro: dataCadastroYmd,
          cadastradoPor: f.cadastradoPor ?? '—',
        }
      };
    });
  }, [fichas]);

  const limparFiltros = () => {
    setBusca('');
    setSituacaoFiltro('');
    setDataInicio('');
    setDataFim('');
  };

  const temFiltros = busca || situacaoFiltro || dataInicio || dataFim;

  function formatYmdToDmy(ymd: string) {
    if (!ymd || ymd.length < 10) return '—';
    const [y, m, d] = ymd.slice(0,10).split('-');
    return `${d}/${m}/${y}`;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-800">Fichas de Cadastro</h1>
            <p className="text-slate-500 text-sm mt-1">
              {loading ? 'Carregando...' : `${total} ${total === 1 ? 'ficha encontrada' : 'fichas encontradas'}`}
            </p>
          </div>
      </div>

      {/* Busca + Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
        {/* Campo de busca */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por Nº de cadastro (ex: PSA-000001), nome da criança, responsável ou CPF..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a4b8c]/30 focus:border-[#1a4b8c] text-slate-700 placeholder:text-slate-400 transition-all"
          />
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Situação</label>
            <select
              value={situacaoFiltro}
              onChange={e => setSituacaoFiltro(e.target.value as SituacaoLabel | '')}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a4b8c]/30 focus:border-[#1a4b8c] text-slate-700 bg-white transition-all min-w-[180px]"
            >
              <option value="">Todas as situações</option>
              {SITUACOES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Data de cadastro — de</label>
            <input
              type="date"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a4b8c]/30 focus:border-[#1a4b8c] text-slate-700 bg-white transition-all"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Até</label>
            <input
              type="date"
              value={dataFim}
              onChange={e => setDataFim(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a4b8c]/30 focus:border-[#1a4b8c] text-slate-700 bg-white transition-all"
            />
          </div>

          {temFiltros && (
            <button
              onClick={limparFiltros}
              className="text-xs font-medium text-slate-500 hover:text-[#1a4b8c] flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 hover:border-[#1a4b8c]/30 transition-all mt-auto"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <p className="text-slate-500 font-medium">Carregando fichas…</p>
          </div>
        ) : error ? (
          <div className="py-20 text-center">
            <p className="text-slate-500 font-medium">{error}</p>
            <p className="text-slate-400 text-sm mt-1">Tente recarregar a página ou refazer a busca.</p>
          </div>
        ) : fichasForTable.length === 0 ? (
          <div className="py-20 text-center">
            <svg className="mx-auto mb-3 text-slate-300" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <p className="text-slate-500 font-medium">Nenhuma ficha encontrada</p>
            <p className="text-slate-400 text-sm mt-1">Tente ajustar os filtros ou o termo de busca.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left border-b border-slate-200">
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Nº Cadastro</th>
                  <th className="px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Criança / Adolescente</th>
                  <th className="px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Responsável</th>
                  <th className="px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Situação</th>
                  <th className="px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell whitespace-nowrap">Data cadastro</th>
                  <th className="px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden xl:table-cell">Cadastrador</th>
                  <th className="px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fichasForTable.map(f => (
                  <tr key={f.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="font-mono-data text-xs text-[#1a4b8c] font-medium bg-blue-50 px-2 py-0.5 rounded">
                        {f.nCadastro}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-800">{f.crianca.nome}</p>
                      <p className="text-slate-400 text-xs mt-0.5">
                        Nasc. {formatYmdToDmy(f.crianca.dataNascimento)}{' · '}{f.crianca.genero}
                      </p>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <p className="text-slate-700">{f.responsavel.nome}</p>
                      <p className="text-slate-400 text-xs mt-0.5">{f.responsavel.parentesco}</p>
                    </td>
                    <td className="px-4 py-4">
                      <BadgeSituacao situacao={f.administrativo.situacao} />
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <p className="text-slate-600 font-mono-data text-xs">
                        {formatYmdToDmy(f.administrativo.dataCadastro)}
                      </p>
                    </td>
                    <td className="px-4 py-4 hidden xl:table-cell">
                      <p className="text-slate-500 text-xs">{f.administrativo.cadastradoPor}</p>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => onVerFicha(f.id)}
                        className="text-[#1a4b8c] hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#1a4b8c]/25 hover:bg-[#1a4b8c] transition-all whitespace-nowrap opacity-80 group-hover:opacity-100"
                      >
                        Ver ficha
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
