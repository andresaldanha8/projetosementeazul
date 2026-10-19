import { useEffect, useRef, useState } from 'react';
import { kidsApi as api, downloadCompletePdf, downloadFilteredPdf } from './api';
import type { RegistrationFilters, Registration, ImageAuthorization } from './api';
const imageChoice = (value: ImageAuthorization) => ({ authorized: 'AUTORIZADO', not_authorized: 'NÃO AUTORIZADO', not_informed: 'Não informado', unavailable: 'Informação indisponível' })[value];
const bands = [{ value: '4-7', label: '4 a 7 anos' }, { value: '8-10', label: '8 a 10 anos' }, { value: '11-14', label: '11 a 14 anos' }];
const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const phone = (value: string) => {
 const digits=value.replace(/\D/g,'');
 const local=digits.length===13&&digits.startsWith('55')?digits.slice(2):digits;
 if(local.length===11)return `(${local.slice(0,2)}) ${local.slice(2,7)}-${local.slice(7)}`;
 if(local.length===10)return `(${local.slice(0,2)}) ${local.slice(2,6)}-${local.slice(6)}`;
 return value;
};

type AppliedList = { filters: RegistrationFilters; page: number; perPage: number; total: number };
export function KidsPage({ csrfToken }: { csrfToken: string | null }) {
 const [rows,setRows]=useState<Registration[]>([]), [search,setSearch]=useState(''), [payment,setPayment]=useState(''), [page,setPage]=useState(1), [total,setTotal]=useState(0);
 const [band,setBand]=useState('4-7'), [counts,setCounts]=useState<Record<string,number>>({}), [perPage,setPerPage]=useState(20);
 const [selected,setSelected]=useState<Registration|null>(null), [busy,setBusy]=useState(false), [loading,setLoading]=useState(false), [error,setError]=useState(''), [toast,setToast]=useState(''), [uncertain,setUncertain]=useState(false);
 const [loadFailed,setLoadFailed]=useState(false);
 const [exporting,setExporting]=useState<'complete'|'filtered'|null>(null), [exportError,setExportError]=useState('');
 const [applied,setApplied]=useState<AppliedList|null>(null), appliedRef=useRef<AppliedList|null>(null);
 function invalidateApplied(){appliedRef.current=null;setApplied(null);setExportError('');}
 const canExportFiltered=!!applied&&!loading&&!loadFailed&&applied.filters.band===band&&applied.filters.payment===payment&&applied.filters.search===search&&applied.page===page&&applied.perPage===perPage;
 const exportLock=useRef(false);
 async function exportPdf(kind:'complete'|'filtered'='complete') {
  if(exportLock.current)return;
  const selectedFilters=appliedRef.current;
  if(kind==='filtered'){
   if(!canExportFiltered||!selectedFilters)return;
   if(selectedFilters.total===0){setExportError('Nenhuma inscrição encontrada para os filtros selecionados');return;}
  }
  exportLock.current=true;setExporting(kind);setExportError('');
  try { if(kind==='filtered')await downloadFilteredPdf(csrfToken||'',selectedFilters!.filters);else await downloadCompletePdf(csrfToken||''); }
  catch(e){setExportError((e as Error).message);}
  finally{exportLock.current=false;setExporting(null);}
 }
 const lock=useRef(false), dialog=useRef<HTMLDialogElement>(null), generation=useRef(0), refreshing=useRef(false);
 async function load() {
  const g=++generation.current; refreshing.current=true; invalidateApplied();setLoading(true);setLoadFailed(false);setError('');setRows([]);setCounts({});setTotal(0);
  try {
   const data=await api('registrations.php',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken||''},body:JSON.stringify({search,payment,band,page,perPage})});
   if(g===generation.current){
    const lastPage=Math.max(1,Math.ceil(data.total/perPage));
    if(page>lastPage){setPage(lastPage);return;}
    setRows(data.registrations);setTotal(data.total);setCounts(data.counts);
    const result={filters:{search,payment,band},page,perPage,total:data.total};appliedRef.current=result;setApplied(result);
   }
  }
  catch(e){if(g===generation.current){setLoadFailed(true);setError((e as Error).message);}} finally {if(g===generation.current){refreshing.current=false;setLoading(false);}}
 }
 useEffect(()=>{invalidateApplied();setLoadFailed(false);setRows([]);setCounts({});setTotal(0);setLoading(true);refreshing.current=true;const t=setTimeout(load,250);return ()=>{clearTimeout(t);generation.current++;};},[search,payment,page,band,perPage]);
 useEffect(()=>{if(selected)dialog.current?.showModal();else dialog.current?.close();},[selected]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),3000);return()=>clearTimeout(t);},[toast]);
 async function reconcile() {
  if(!selected)return;
  const data=await api('registrations.php?id='+selected.id);
  const row=data.registrations[0]; if(!row)throw new Error('Inscrição indisponível.');
  setUncertain(false);
  if(row.pagamento==='CONFIRMADO'){setSelected(null);setToast('Pagamento confirmado');}
  else {setSelected(row);setError('Situação conferida. Revise os dados antes de confirmar novamente.');}
  await load();
 }
 async function confirm() {
  if(lock.current || !selected || uncertain)return;
  lock.current=true;setBusy(true);setError('');
  try {await api('payment.php?id='+selected.id,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken||''},body:JSON.stringify({expectedUpdatedAt:selected.atualizada_em,amountCents:Number(selected.valor_centavos)})});setSelected(null);setToast('Pagamento confirmado');await load();}
  catch(e){setUncertain(true);setError((e as Error).message);try{await reconcile();}catch{setError('Não foi possível conferir o pagamento. Confira a situação antes de tentar novamente.');}}
  finally{lock.current=false;setBusy(false);}
 }
 const btn='px-4 py-2 rounded-lg border border-slate-300 text-sm disabled:opacity-50';
 return <section>
  <h1 className="text-2xl font-bold text-slate-800 mb-2">Inscrições KIDS</h1><p className="text-sm text-slate-500 mb-6">Acompanhe os participantes e confirme os pagamentos.</p>
  <div className="flex flex-wrap items-center gap-3 mb-5">
   <button className={btn+' bg-white'} disabled={!!exporting||!csrfToken} aria-busy={exporting==='complete'} onClick={()=>void exportPdf('complete')}>{exporting==='complete'?'Gerando PDF…':'Baixar lista completa'} <span className="text-xs opacity-70">PDF</span></button>
   <span className="text-xs text-slate-500">Inclui todas as faixas etárias e situações de pagamento</span>
   <button className={btn+' bg-white'} disabled={!!exporting||!csrfToken||!canExportFiltered} aria-busy={exporting==='filtered'} onClick={()=>void exportPdf('filtered')}>{exporting==='filtered'?'Gerando PDF filtrado…':'Baixar lista filtrada'} <span className="text-xs opacity-70">PDF</span></button><span className="text-xs text-slate-500">Inclui os filtros aplicados à lista</span>
  </div>
  {exportError&&<p role="alert" className="text-rose-700 mb-4">{exportError}</p>}
  {toast&&<div role="status" className="fixed top-20 right-6 bg-emerald-700 text-white px-5 py-3 rounded-lg shadow-lg z-50">{toast}</div>}
  {error&&<p role="alert" className="text-rose-700 mb-4">{error}</p>}
  <div role="tablist" aria-label="Faixa etária" className="flex flex-wrap gap-2 mb-5">{bands.map((b,index)=><button key={b.value} id={'band-'+b.value} role="tab" aria-selected={band===b.value} aria-controls="kids-results" tabIndex={band===b.value?0:-1} onKeyDown={e=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(e.key)){e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?2:(index+(e.key==='ArrowRight'?1:2))%3;if(band!==bands[n].value||page!==1)invalidateApplied();setBand(bands[n].value);setPage(1);document.getElementById('band-'+bands[n].value)?.focus();}}} onClick={()=>{if(band!==b.value||page!==1)invalidateApplied();setBand(b.value);setPage(1);}} className={btn+(band===b.value?' bg-[#1a4b8c] border-[#1a4b8c] text-white':' bg-white text-slate-600')}>{b.label} <span className="ml-2 opacity-80">({counts[b.value]??(loadFailed?'—':'…')})</span></button>)}</div>
  <div className="flex flex-wrap gap-3 mb-3"><input aria-label="Buscar por criança, responsável ou número de peito" placeholder="Buscar por criança, responsável ou número de peito" className="border border-slate-300 bg-white rounded-lg px-3 py-2 flex-1 min-w-48" value={search} onChange={e=>{if(search!==e.target.value||page!==1)invalidateApplied();setSearch(e.target.value);setPage(1);}}/><select aria-label="Pagamento" className="border border-slate-300 bg-white rounded-lg px-3 py-2" value={payment} onChange={e=>{if(payment!==e.target.value||page!==1)invalidateApplied();setPayment(e.target.value);setPage(1);}}><option value="">Todos os pagamentos</option><option value="PENDENTE">PENDENTE</option><option value="CONFIRMADO">PAGO</option></select><button className={btn} onClick={()=>{if(!refreshing.current)void load();}} disabled={loading}>{loading?'Atualizando…':'Atualizar'}</button></div>
  <p className="text-sm text-slate-500 mb-4">Faixa etária: {bands.find(b=>b.value===band)?.label} · Pagamento: {payment==='CONFIRMADO'?'PAGO':payment||'Todos'}{search&&` · Busca: ${search}`}</p>
  <div id="kids-results" role="tabpanel" aria-labelledby={'band-'+band} aria-busy={loading} className="bg-white rounded-xl border border-slate-200 overflow-x-auto"><table className="w-full min-w-[1050px] text-sm text-left"><thead className="bg-slate-50 text-slate-500"><tr>{['Nº de peito','Participante','Responsável','Inscrição','Pagamento','Imagem','Ações'].map(x=><th key={x} className="p-4">{x}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.id} className="border-t border-slate-100"><td className="p-4 font-semibold">{String(r.numero_peito).padStart(3,'0')}</td><td className="p-4"><strong>{r.crianca_nome}</strong><div className="text-slate-500">{r.nascimento.split('-').reverse().join('/')} · {r.idade_inscricao} anos na inscrição<div>{r.divisao==='M'?'Masculino':'Feminino'}</div></div></td><td className="p-4">{r.responsavel_nome}<div className="text-slate-500">{r.vinculo} · {phone(r.telefone)}</div></td><td className="p-4">{money(Number(r.valor_centavos))}<div className="text-slate-500">Camisa {r.camisa} · {r.situacao==='REGISTRADA'?'Registrada':r.situacao==='CANCELADA'?'Cancelada':r.situacao}</div></td><td className="p-4"><span className={'px-2 py-1 rounded-full text-xs font-semibold '+(r.pagamento==='CONFIRMADO'?'bg-emerald-100 text-emerald-800':'bg-amber-100 text-amber-800')}>{r.pagamento==='CONFIRMADO'?'PAGO':'PENDENTE'}</span></td><td className="p-4"><strong>{imageChoice(r.imageAuthorization)}</strong></td><td className="p-4">{r.pagamento==='PENDENTE'&&r.situacao==='REGISTRADA'&&<button className={btn} onClick={async()=>{if(lock.current)return;lock.current=true;try{const data=await api('registrations.php?id='+r.id);const current=data.registrations[0];if(!current)throw new Error('Inscrição indisponível.');setError('');setUncertain(false);setSelected(current);}catch(e){setError((e as Error).message);}finally{lock.current=false;}}}>Confirmar pagamento</button>}</td></tr>)}</tbody></table>{!rows.length&&<p className="p-6 text-slate-500">{loading?'Carregando…':loadFailed?'Lista não atualizada. Tente novamente.':'Nenhuma inscrição encontrada.'}</p>}</div>
  <div className="flex flex-wrap gap-3 items-center justify-between mt-4 text-sm text-slate-600"><span>{loading?'Atualizando lista e contagens…':loadFailed?'Contagens indisponíveis.':`${total} ${total===1?'inscrição encontrada':'inscrições encontradas'} · Página ${page} de ${Math.max(1,Math.ceil(total/perPage))}`}</span><div className="flex flex-wrap gap-2"><select aria-label="Inscrições por página" className={btn+' bg-white'} value={perPage} onChange={e=>{if(perPage!==Number(e.target.value)||page!==1)invalidateApplied();setPerPage(Number(e.target.value));setPage(1);}}>{[10,20,50].map(n=><option key={n} value={n}>{n} por página</option>)}</select><button className={btn} disabled={loading||page<=1} onClick={()=>{invalidateApplied();setPage(page-1);}}>Anterior</button><button className={btn} disabled={loading||page*perPage>=total} onClick={()=>{invalidateApplied();setPage(page+1);}}>Próxima</button></div></div>
  <dialog ref={dialog} className="m-auto p-6 rounded-xl shadow-xl max-w-lg w-[calc(100%-2rem)] backdrop:bg-black/40" onCancel={e=>{if(busy)e.preventDefault();else setSelected(null);}} onClose={()=>{if(!busy)setSelected(null);}} aria-labelledby="kids-payment-title">
   <h2 id="kids-payment-title" className="font-semibold text-lg mb-5">{selected&&`Confirmar pagamento de ${money(Number(selected.valor_centavos))} da inscrição ${String(selected.numero_peito).padStart(3,'0')} — ${selected.crianca_nome}?`}</h2>
   {error&&<p role="alert" className="text-rose-700 mb-4">{error}</p>}
   <div className="flex justify-end gap-3"><button autoFocus className={btn} disabled={busy} onClick={()=>setSelected(null)}>Cancelar</button>{uncertain?<button className={btn} disabled={busy} onClick={async()=>{setBusy(true);try{await reconcile();}catch{setError('Conferência indisponível. Tente novamente.');}finally{setBusy(false);}}}>Conferir situação</button>:<button className={btn+' bg-[#1a4b8c] text-white'} disabled={busy||!csrfToken} onClick={confirm}>{busy?'Confirmando…':'Confirmar pagamento'}</button>}</div>
  </dialog>
 </section>;
}
