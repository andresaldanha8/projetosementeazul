"""Inspect real endpoint downloads from the standalone integration, then render pages."""
import json
import subprocess
from pathlib import Path
import pdfplumber

root = Path(__file__).resolve().parents[2]
runtime = Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies'
renderer = runtime / 'native/poppler/Library/bin/pdftoppm.exe'
target = root / 'tmp/pdfs/independent'
target.mkdir(parents=True, exist_ok=True)
result = []
clean = lambda value: ''.join(str(value or '').split())
for kind in ['completa', 'filtrada']:
    file = root / f'output/pdf/kids-independente-{kind}-001.pdf'
    rows, text = [], []
    with pdfplumber.open(file) as pdf:
        pages = len(pdf.pages)
        for n, page in enumerate(pdf.pages, 1):
            content = page.extract_text()
            text.append(content)
            assert f'Página {n} de {pages}' in content
            for char in page.chars:
                assert 25 <= char['x0'] <= char['x1'] <= page.width - 25
                assert 24 <= char['top'] <= char['bottom'] <= 588
            for table in page.extract_tables():
                if len(table[0]) == 9:
                    rows.extend(row for row in table[2:] if row[0].isdigit())
    assert len(rows) == 1
    expected = ['001', 'João Independente Fictício', '7', 'Masculino', 'Responsável Fictícia',
                '(93) 99999-0001', 'P', 'PAGO', 'Registrada']
    assert list(map(clean, rows[0])) == list(map(clean, expected)), rows
    content = '\n'.join(text)
    for label in ['1 inscrição', 'Inscrições ativas (registradas): 1', 'Pendentes ativas: 0',
                  'Pagas ativas: 1', 'Canceladas: 0', 'Total incluindo canceladas: 1']:
        assert label in content
    assert '1 inscrições' not in content
    if kind == 'filtrada':
        assert 'Filtros aplicados' in content and 'Pagamento: PAGO' in content and '001' in content
    subprocess.run([str(renderer), '-scale-to', '1500', '-png', str(file), str(target / file.stem)], check=True)
    result.append({'kind': kind, 'pages': pages, 'rows': 1, 'all_cells_and_totals_match': True, 'rendered': True})
(root / 'kids/tests/independent-pdf-results.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(result))
