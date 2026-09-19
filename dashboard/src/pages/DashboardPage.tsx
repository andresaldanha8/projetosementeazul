import { BadgeSituacao } from '../components/BadgeSituacao';
import painelApi, { IndicadoresFront, FichaFront } from '../services/painelApi';
import { useEffect, useState } from 'react';

interface DashboardPageProps {
  onVerFicha: (id: string) => void;
  onIrFichas: () => void;
}

function KpiCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-2`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
        <span className="text-white text-base font-bold font-display">{value}</span>
      </div>
      <div>
        <p className="text-2xl font-display font-bold text-slate-800">{value}</p>
        <p className="text-sm text-slate-500 font-medium mt-0.5">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export function DashboardPage({ onVerFicha, onIrFichas }: DashboardPageProps) {
  const [indicadores, setIndicadores] = useState<IndicadoresFront | null>(null);
  const [recentes, setRecentes] = useState<FichaFront[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([painelApi.getIndicadores(), painelApi.getFichasRecentes()])
      .then(([inds, fichas]) => {
        if (!mounted) return;
        setIndicadores(inds);
        setRecentes(fichas);
      })
      .catch((err: any) => {
        if (!mounted) return;
        if (err && err.name === 'AuthError') {
          setError('Sessão inválida ou expirada. Faça login.');
        } else {
          setError('Erro ao carregar dados do painel.');
        }
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Visão geral do módulo de cadastros · <span className="font-mono-data text-xs">Atualizado em {new Date().toLocaleDateString('pt-BR')}</span></p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total de fichas" value={loading ? '—' : indicadores?.total ?? '—'} color="bg-[#1a4b8c]" />
        <KpiCard label="Ativos" value={loading ? '—' : indicadores?.ativos ?? '—'} color="bg-emerald-600" />
        <KpiCard label="Aguardando doc." value={loading ? '—' : indicadores?.aguardando ?? '—'} color="bg-amber-500" />
        <KpiCard label="Em acompanhamento" value={loading ? '—' : indicadores?.acompanhamento ?? '—'} color="bg-blue-500" />
      </div>

      {/* Fichas recentes */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-display font-bold text-slate-800 text-base">Fichas mais recentes</h2>
            <p className="text-xs text-slate-400 mt-0.5">Últimos registros adicionados ao sistema</p>
          </div>
          <button
            onClick={onIrFichas}
            className="text-[#1a4b8c] hover:text-[#123568] text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            Ver todas
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Nº Cadastro</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Criança / Adolescente</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Responsável</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Situação</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Data</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-6 text-center text-slate-500">Carregando...</td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={6} className="px-6 py-6 text-center text-rose-600">{error}</td>
                </tr>
              )}
              {!loading && !error && recentes.map(f => (
                <tr key={f.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-3.5">
                    <span className="font-mono-data text-xs text-[#1a4b8c] font-medium">{f.nCadastro}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-slate-800 text-sm">{f.criancaNome}</p>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <p className="text-slate-600 text-sm">{f.responsavelNome}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <BadgeSituacao situacao={f.situacao} />
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <span className="text-slate-500 text-xs font-mono-data">
                      {formatDate(f.createdAt)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      onClick={() => onVerFicha(String(f.id))}
                      className="text-[#1a4b8c] hover:text-[#123568] text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#1a4b8c]/20 hover:bg-[#1a4b8c]/5 transition-all whitespace-nowrap"
                    >
                      Ver ficha
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

function formatDate(raw: string) {
  // Deterministic: only accept YYYY-MM-DD and return DD/MM/YYYY; otherwise return '—'
  const m = raw && raw.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return '—';
}
