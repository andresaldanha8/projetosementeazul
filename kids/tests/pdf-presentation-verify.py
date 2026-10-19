"""Verify display changes against immutable fixtures and render every example page."""
import json
import subprocess
from pathlib import Path
import pdfplumber

root = Path(__file__).resolve().parents[2]
runtime = Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies'
renderer = runtime / 'native/poppler/Library/bin/pdftoppm.exe'
cases = json.loads((root / 'kids/tests/pdf-presentation-expected.json').read_text(encoding='utf-8'))
out = root / 'tmp/pdfs/presentation'
out.mkdir(parents=True, exist_ok=True)
clean = lambda value: ''.join(str(value).split())
results = []
for case in cases:
    file = root / 'output/pdf' / case['file']
    cells, texts = [], []
    with pdfplumber.open(file) as pdf:
        for n, page in enumerate(pdf.pages, 1):
            text = page.extract_text()
            texts.append(text)
            assert f'Página {n} de {len(pdf.pages)}' in text
            for char in page.chars:
                assert 25 <= char['x0'] <= char['x1'] <= page.width - 25
                assert 24 <= char['top'] <= char['bottom'] <= 588
            for table in page.extract_tables():
                if len(table[0]) == 9:
                    cells.extend(row for row in table[2:] if row[0].isdigit())
        pages = len(pdf.pages)
    assert len(cells) == len(case['rows'])
    for actual, row in zip(cells, case['rows']):
        phone = '(93) 99999-0001' if row['numero_peito'] == 1 else '(11) 3333-0002'
        expected = [str(row['numero_peito']).zfill(3), row['crianca_nome'], row['idade_inscricao'],
                    'Masculino' if row['divisao'] == 'M' else 'Feminino', row['responsavel_nome'],
                    phone, row['camisa'], 'PAGO' if row['pagamento'] == 'CONFIRMADO' else 'PENDENTE',
                    'Registrada' if row['situacao'] == 'REGISTRADA' else 'Cancelada']
        assert list(map(clean, actual)) == list(map(clean, expected)), (actual, expected)
    text = '\n'.join(texts)
    quantity = len(case['rows'])
    assert f'{quantity} '+('inscrição' if quantity == 1 else 'inscrições') in text
    assert '1 inscrições' not in text
    for label, key in [('Inscrições ativas (registradas)', 'active'), ('Pendentes ativas', 'pending'),
                       ('Pagas ativas', 'paid'), ('Canceladas', 'cancelled'), ('Total incluindo canceladas', 'all')]:
        assert f'{label}: {case["totals"][key]}' in text
    if case['filters']:
        assert 'Filtros aplicados' in text and 'Pagamento: Todos' in text and 'Fictício' in text
    subprocess.run([str(renderer), '-scale-to', '1500', '-png', str(file), str(out / file.stem)], check=True)
    results.append({'file': case['file'], 'rows': quantity, 'pages': pages, 'all_cells_and_totals_match': True})
(root / 'kids/tests/pdf-presentation-results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(results))
