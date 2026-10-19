"""Check replacement ZIPs for standalone runtime, private tooling and no local credentials."""
import hashlib
import json
import re
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[2]
results = []
for name, prefix in [('kids-runtime-20261018.zip', ''), ('kids-release-20261018.zip', 'upload/')]:
    with zipfile.ZipFile(root / 'output' / name) as archive:
        names = archive.namelist()
        assert not any('database.local.php' in n or '.env' in n or n.startswith('shared-review/cadastro/') for n in names)
        assert not any('/tests/' in n or '/node_modules/' in n or '/fixtures/' in n for n in names)
        if prefix == '':
            assert all(n.startswith('kids/') for n in names)
            assert not any('/ops/' in n or n.endswith('.sql') for n in names)
        assert archive.read(prefix + 'kids/config/.htaccess').strip() == b'Require all denied'
        assert archive.read(prefix + 'kids/config/database.example.php') == (root / 'kids/config/database.example.php').read_bytes()
        config = archive.read(prefix + 'kids/api/config.php')
        assert b"'public_open' => false" in config and b"'declaration_version' => 'KIDS-2026-v2'" in config
        for path in names:
            if path.startswith(prefix + 'kids/') and '/vendor/' not in path:
                assert archive.read(path) == (root / path.removeprefix(prefix)).read_bytes(), path
                if path.endswith(('.php', '.js', '.html', '.css')):
                    data = archive.read(path)
                    assert not re.search(rb'cad_usuarios|cadastro/api|MANUAL-LOCAL-TEST|KidsTeste!2026', data), path
        if prefix:
            installer = archive.read('operations/install-kids-empty.sql')
            assert installer == (root / 'kids/ops/install-kids-empty.sql').read_bytes()
            assert b'CREATE TABLE kids_administradores' in installer
            assert b'fk_kids_auditoria_administrador' in installer
            assert not re.search(rb'INSERT\s+INTO\s+kids_administradores|CREATE\s+DATABASE|^USE\s|^DROP\s', installer, re.I | re.M)
            for filename in ['admin-account.php', 'prepare-first-admin.php', 'Administrador-KIDS.ps1', 'administrador-kids.sh']:
                assert archive.read('operations/' + filename) == (root / 'kids/ops' / filename).read_bytes()
            for migration in sorted((root / 'kids/migrations').glob('*.sql')):
                assert archive.read('operations/migrations-alternativa/' + migration.name) == migration.read_bytes()
            assert not any('admin-password.php' in n or 'inventario-destino.sql' in n or n.startswith('operations/sql/') for n in names)
            for entry in json.loads(archive.read('MANIFEST.json'))['files']:
                data = archive.read(entry['path'])
                assert len(data) == entry['bytes'] and hashlib.sha256(data).hexdigest() == entry['sha256']
        results.append({'zip': name, 'files': len(names), 'runtime_matches_source': True,
                        'independent_identity_and_connection': True, 'production_closed': True,
                        'no_credentials_accounts_or_fixtures': True})
(root / 'kids/tests/independent-package-results.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
print(json.dumps(results))
