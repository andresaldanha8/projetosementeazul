"""Validate every non-empty filtered PDF against every page of the matching listing."""
import json
from pathlib import Path
import pdfplumber
from pdf_display import display_phone

root=Path(__file__).resolve().parents[2]
result=json.loads((root/'kids/tests/filtered-pdf-results.json').read_text(encoding='utf-8'))
clean=lambda value: ''.join(str(value or '').split())
groups=['4-7','8-10','11-14']
verified=[]
for case in result['cases']:
    if not case.get('file'):
        assert case['total']==0
        verified.append({'case':case['label'],'rows':0,'no_pdf':True})
        continue
    expected=case['rows']
    if case['filters'] is None:
        expected=sorted(expected,key=lambda r:(groups.index(r['faixa']),int(r['numero_peito'])))
    values=[];texts=[]
    with pdfplumber.open(case['file']) as pdf:
        pages=len(pdf.pages)
        for n,page in enumerate(pdf.pages,1):
            text=page.extract_text();texts.append(text)
            assert f'Página {n} de {pages}' in text
            assert abs(page.width-841.89)<1 and abs(page.height-595.28)<1
            page_rows=[]
            for table in page.find_tables():
                cells=table.extract()
                if len(cells[0])!=9:continue
                for line,geometry in zip(cells[2:],table.rows[2:]):
                    assert len(line)==9 and line[0].isdigit()
                    assert geometry.bbox[3]<=564
                    values.append(line);page_rows.append(line)
            assert page_rows
            for char in page.chars:
                assert char['x0']>=25 and char['x1']<=page.width-25
        all_text=clean('\n'.join(texts))
    assert len(values)==case['total']==len(expected)
    for actual,row in zip(values,expected):
        want=[str(row['numero_peito']).zfill(3),row['crianca_nome'],row['idade_inscricao'],'Masculino' if row['divisao']=='M' else 'Feminino',row['responsavel_nome'],display_phone(row['telefone']),row['camisa'],'PAGO' if row['pagamento']=='CONFIRMADO' else 'PENDENTE','Registrada' if row['situacao']=='REGISTRADA' else 'Cancelada']
        assert list(map(clean,actual))==list(map(clean,want)),(case['label'],actual,want)
    active=[r for r in expected if r['situacao']=='REGISTRADA']
    totals={'Inscrições ativas (registradas)':len(active),'Pendentes ativas':sum(r['pagamento']=='PENDENTE' for r in active),'Pagas ativas':sum(r['pagamento']=='CONFIRMADO' for r in active),'Canceladas':len(expected)-len(active),'Total incluindo canceladas':len(expected)}
    for label,value in totals.items():assert clean(f'{label}: {value}') in all_text
    filters=case['filters']
    if filters is not None:
        assert clean('Lista filtrada de inscritos') in all_text
        payment='PAGO' if filters['payment']=='CONFIRMADO' else filters['payment'] or 'Todos'
        assert clean('Faixa: '+filters['band'].replace('-','–')+' anos') in all_text
        assert clean('Pagamento: '+payment) in all_text
        assert clean('Busca: '+('“'+filters['search']+'”' if filters['search'] else 'Sem busca')) in all_text
    else:
        assert clean('Lista completa de inscritos') in all_text and case['total']==74
    verified.append({'case':case['label'],'rows':len(values),'pages':pages,'totals_match':True,'all_cells_match':True})
summary={'verified':verified,'unchanged':result['unchanged'],'all_passed':True}
(root/'kids/tests/filtered-pdf-verify-results.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(summary,ensure_ascii=True))
