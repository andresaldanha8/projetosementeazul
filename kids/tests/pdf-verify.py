"""Compare every extracted PDF table row with the read-only database snapshot."""
import json
import re
from collections import Counter
from pathlib import Path
import pdfplumber
from pdf_display import display_phone

root = Path(__file__).resolve().parents[2]
expected = json.loads((root / 'kids/tests/pdf-expected.json').read_text(encoding='utf-8'))
groups = ['4-7', '8-10', '11-14']
rows = sorted(expected['rows'], key=lambda r: (groups.index(r['faixa']), int(r['numero_peito'])))
clean = lambda s: ''.join(str(s or '').split())
extracted, texts, per_page = [], [], []
with pdfplumber.open(root / 'output/pdf/kids-lista-completa-exemplo.pdf') as pdf:
    count = len(pdf.pages)
    for n, page in enumerate(pdf.pages, 1):
        assert abs(page.width - 841.89) < 1 and abs(page.height - 595.28) < 1
        text = page.extract_text()
        texts.append(text)
        assert f'Página {n} de {count}' in text
        assert 'Criança' in text and 'Responsável' in text and 'Pagamento' in text
        assert len(page.images) == (1 if n == 1 else 0)
        found = []
        for table in page.find_tables():
            values = table.extract()
            band = values[0][0].split(' anos')[0].replace('–', '-')
            assert band in groups
            for cells, geometry in zip(values[2:], table.rows[2:]):
                assert len(cells) == 9 and re.fullmatch(r'\d{3,}', cells[0])
                assert geometry.bbox[1] >= 25 and geometry.bbox[3] <= 564
                extracted.append((band, cells))
                found.append(cells[0])
        assert found, 'No header-only or blank page'
        for char in page.chars:
            assert char['x0'] >= 25 and char['x1'] <= page.width - 25
            assert char['top'] >= 24 and char['bottom'] <= 588
        per_page.append({'page': n, 'band': band, 'numbers': found})
assert len(extracted) == len(rows)
for (band, cells), row in zip(extracted, rows):
    want = [str(row['numero_peito']).zfill(3), row['crianca_nome'], row['idade_inscricao'],
            'Masculino' if row['divisao'] == 'M' else 'Feminino', row['responsavel_nome'],
            display_phone(row['telefone']), row['camisa'], 'PAGO' if row['pagamento'] == 'CONFIRMADO' else 'PENDENTE', 'Registrada' if row['situacao'] == 'REGISTRADA' else 'Cancelada']
    assert band == row['faixa']
    assert list(map(clean, cells)) == list(map(clean, want)), (cells, want)
text = '\n'.join(texts)
active = [r for r in rows if r['situacao'] == 'REGISTRADA']
totals = {'all': len(rows), 'active': len(active), 'pending': sum(r['pagamento'] == 'PENDENTE' for r in active),
          'paid': sum(r['pagamento'] == 'CONFIRMADO' for r in active), 'cancelled': len(rows)-len(active)}
for label, value in [('Inscrições ativas (registradas)', totals['active']), ('Pendentes ativas', totals['pending']),
                     ('Pagas ativas', totals['paid']), ('Canceladas', totals['cancelled']), ('Total incluindo canceladas', totals['all'])]:
    assert f'{label}: {value}' in text
for name in expected['excludedOtherEdition']:
    assert clean(name) not in clean(text)
for forbidden in ['owner_hash', 'auth_version', 'declaracao_versao', 'inscricao_id', 'estado_anterior', '17/10/2017', '10/10/2020']:
    assert forbidden not in text
numbers = [cells[0] for _, cells in extracted]
assert '001' in numbers and '1000' in numbers and len(set(numbers)) == len(numbers)

# Auxiliary layout document: long accented names, raw markup, both cancelled payment states, persisted age.
with pdfplumber.open(root / 'kids/tests/pdf-pages/layout-cases.pdf') as pdf:
    layout = '\n'.join(p.extract_text() for p in pdf.pages)
    assert 'Álvaro' in layout and 'Açucena' in layout and 'João' in layout and '<img' in layout
    assert '01/01/2035 09:00:00 (Brasília)' in layout
    assert 'Canceladas: 2' in layout
    for page in pdf.pages:
        for char in page.chars:
            assert char['x0'] >= 25 and char['x1'] <= page.width-25
        for table in page.find_tables():
            for cells in table.extract()[2:]:
                assert len(cells) == 9 and cells[-1] in ['Registrada', 'Cancelada']
    first = pdf.pages[0].extract_tables()[0]
    assert first[-1][0] == '1000' and first[-1][2] == '7'

result = {'rows': len(rows), 'pages': count, 'bands': dict(Counter(r['faixa'] for r in rows)),
          'totals': totals, 'per_page': per_page, 'all_cells_match': True,
          'all_page_headers_and_footers': True, 'no_split_rows_or_out_of_page_text': True,
          'logo_present': True, 'long_names_accents_and_cancelled_states': True}
(root / 'kids/tests/pdf-verify-results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({k: v for k, v in result.items() if k != 'per_page'}, ensure_ascii=True))
