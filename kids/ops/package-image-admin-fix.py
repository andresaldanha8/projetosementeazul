"""Produce a four-file hotfix; never include registration-opening or private configuration."""
import hashlib
import json
import re
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[2]
html = (root / 'kids/admin/dist/index.html').read_text(encoding='utf-8')
assets = re.findall(r'(?:src|href)="(/kids/admin/dist/assets/[^\"]+)"', html)
files = ['kids/admin/api/registrations.php', 'kids/admin/dist/index.html'] + [f.lstrip('/') for f in assets]
assert len(files) == 4 and len(set(files)) == 4
assert all('/config' not in f and not f.endswith('.sql') for f in files)
manifest = {'purpose': 'admin-image-presentation-only', 'preserve': ['kids/api/config.php', 'kids/config/database.local.php'],
            'files': [{'path': f, 'sha256': hashlib.sha256((root / f).read_bytes()).hexdigest()} for f in files]}
target = root / 'output/kids-image-admin-fix-20261018.zip'
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
    for f in files:
        archive.write(root / f, f)
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None and set(archive.namelist()) == set(files)
    for f in files:
        assert archive.read(f) == (root / f).read_bytes()
(root / 'output/kids-image-admin-fix-20261018-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(json.dumps({'zip': target.name, 'files': files, 'production_configuration_included': False}))
