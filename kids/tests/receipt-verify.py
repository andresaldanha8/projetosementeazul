import json
import subprocess
from pathlib import Path
import pdfplumber

root = Path(__file__).resolve().parents[2]
out = root / 'tmp/pdfs/receipts'
runtime = Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies'
renderer = runtime / 'native/poppler/Library/bin/pdftoppm.exe'
results = []
for case in ['pending', 'paid', 'cancelled']:
    file = out / (case + '.pdf')
    with pdfplumber.open(file) as pdf:
        assert len(pdf.pages) == 1
        page = pdf.pages[0]
        text = page.extract_text()
        compact = ' '.join(text.split())
        for expected in ['II Corrida Solidária Autismo Run', 'João Ávila da Conceição',
                         'São José de Alcântara Maria Vitória Gonçalves de Oliveira e Albuquerque',
                         '4-7 anos', 'America/Sao_Paulo, UTC-03:00', 'Emitido em', 'Data da inscrição']:
            assert expected in compact, (case, expected, text)
        assert 'RESPONSAVEL PRIVADO' not in text and '11987654321' not in text
        if case == 'pending':
            assert '001' in text and 'PENDENTE' in text
            assert 'Este comprovante confirma a inscrição e não comprova o pagamento.' in compact
        else:
            assert '1000' in text and 'CONFIRMADO (pago)' in text and 'PENDENTE' not in text
        if case == 'cancelled':
            assert 'INSCRIÇÃO CANCELADA' in text
        for char in page.chars:
            assert 0 <= char['x0'] < char['x1'] <= page.width
            assert 0 <= char['top'] < char['bottom'] <= page.height
    subprocess.run([str(renderer), '-scale-to', '1400', '-png', str(file), str(out / case)], check=True)
    results.append({'case': case, 'pages': 1, 'text_and_bounds_verified': True})
(root / 'kids/tests/receipt-pdf-results.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
print(json.dumps(results))
