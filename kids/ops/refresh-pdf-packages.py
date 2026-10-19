"""Rebuild the two existing publication ZIPs and verify their runtime payload."""
import hashlib
import json
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[2]
release = root / 'output/kids-release-20261018'
source = (root / 'kids/pdf/report.php').read_bytes()
results = []
for name, base, report in [
    ('kids-release-20261018.zip', release, 'upload/kids/pdf/report.php'),
    ('kids-runtime-20261018.zip', release / 'upload', 'kids/pdf/report.php'),
]:
    target = root / 'output' / name
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
        for file in sorted(base.rglob('*')):
            if file.is_file():
                archive.write(file, file.relative_to(base).as_posix())
    with zipfile.ZipFile(target) as archive:
        assert archive.testzip() is None
        assert archive.read(report) == source
        prefix = 'upload/' if base == release else ''
        config = archive.read(prefix + 'kids/api/config.php')
        assert b"'public_open' => false" in config
        assert b"'declaration_version' => 'KIDS-2026-v2'" in config
        assert b'MANUAL-LOCAL-TEST' not in config
        assert not any('/tests/' in f or '/.env' in f or '/previews/' in f for f in archive.namelist())
        if base == release:
            manifest = json.loads(archive.read('MANIFEST.json'))
            for entry in manifest['files']:
                data = archive.read(entry['path'])
                assert len(data) == entry['bytes']
                assert hashlib.sha256(data).hexdigest() == entry['sha256']
            assert archive.read('.htaccess') == b'Require all denied\n'
    results.append({'zip': name, 'bytes': target.stat().st_size,
                    'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                    'report_matches_source': True, 'production_closed': True})
(root / 'kids/tests/pdf-package-results.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
print(json.dumps(results, indent=2))
