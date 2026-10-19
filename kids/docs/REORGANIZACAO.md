# Organização física KIDS

> Banco e autenticação deste relatório foram substituídos por [INSTALACAO-INDEPENDENTE.md](INSTALACAO-INDEPENDENTE.md). As referências abaixo a conexão/usuários compartilhados são históricas. Não sincronizar o preview antigo com as APIs novas.

Checagem funcional posterior da administração e integração pública: [VALIDACAO-FLUXO-ADMIN.md](VALIDACAO-FLUXO-ADMIN.md).

Para homologação manual, use exclusivamente [PREVIEW-MANUAL.md](PREVIEW-MANUAL.md): `node kids/tests/manual-preview.cjs`. Os runners abaixo são ferramentas de testes isolados e não substituem o preview manual preservado.

Inscrições reais continuam bloqueadas: api/config.php mantém public_open=false e declaração nula. Não houve execução de SQL no banco existente. Os testes criam bancos MariaDB descartáveis. PDF e publicação não fazem parte desta mudança.

## Estrutura e mapeamento

| Antes | Agora |
| --- | --- |
| cadastro/api/kids/*.php | kids/api/*.php |
| cadastro/api/kids/migrations/ | kids/migrations/ |
| cadastro/api/kids/tests/ | kids/tests/ |
| cadastro/api/kids/*.md | kids/docs/ (relatórios anteriores preservados em history/) |
| kids/README.md | kids/docs/PUBLICO.md |
| dashboard/src/kidsAdmin/ | kids/admin-app/src/ |
| dashboard/kids-admin.html | kids/admin-app/index.html |
| build administrativo no dashboard | kids/admin/dist/ |
| cadastro/kids-registrations.html e dois endpoints KIDS de painel | removidos, HTTP 404; sem compatibilidade |

Formulário e assets públicos continuam na raiz de kids/. O shell kids/admin/index.php consome admin/dist/index.html. A API pública usa /kids/api/. O dashboard compila apenas sua própria entrada. O CSS inicial da administração foi preservado em admin-app/src/index.css; alterações futuras não dependem do CSS de atendimentos.

## Dependências compartilhadas

- cadastro/api/config/config.php: conexão PDO; credenciais permanecem na configuração privada já existente, sem cópia para kids/.
- cadastro/api/auth/credentials.php: verificação de login/senha, usada pelos dois logins.
- cadastro/api/auth/helpers.php: consulta de usuários, validação de estado/auth_version, CSRF e representação pública da identidade.
- Tabela cad_usuarios compartilhada: nenhuma duplicação de usuários ou senhas. Troca de senha altera a identidade compartilhada e revoga sessões por auth_version.
- /img/logo.png e /favicon.ico permanecem assets do site.

As sessões continuam separadas: PSA_KIDS_PUBLIC em /kids/api/, PSA_KIDS_ADMIN em /kids/admin/ e PSA_CADASTRO_SESSION em /cadastro/. Armazenamento privado da sessão administrativa permanece separado. A mudança de caminho da sessão pública exige uma nova sessão no navegador; não migra cookies ou confirmações de previews anteriores. Consulta por nome/telefone continua disponível. A mudança física também muda a chave do diretório privado de sessões administrativas, exigindo novo login.

## Build independente

Na raiz do projeto (Windows; Node/npm no PATH):

```powershell
npm.cmd --prefix kids/admin-app ci --ignore-scripts
npm.cmd --prefix kids/admin-app run build
npm.cmd --prefix kids/admin-app run typecheck
$env:PANEL_BASE_URL='/dashboard'
npm.cmd --prefix dashboard run build
```

Saída KIDS: kids/admin/dist/. Não exige dashboard/dist/. Dependências locais instaladas em kids/admin-app/node_modules; package-lock.json permite npm ci independente. pnpm-lock.yaml preserva o manifesto anterior. Build e runtime KIDS não importam código do dashboard.

## Testes e preview isolado

```powershell
C:/xampp/php/php.exe kids/tests/domain_test.php
C:/xampp/php/php.exe kids/tests/integration.php C:/xampp/mysql/bin --preview
# Outro terminal: formulário público aberto SOMENTE na cópia descartável
node kids/tests/browser.cjs
node kids/tests/lookup.cjs
node kids/tests/new-entry.cjs
# Administração com inscrições fechadas, fixtures fictícias:
C:/xampp/php/php.exe kids/tests/dedicated_integration.php C:/xampp/mysql/bin --preview
node kids/tests/dedicated-browser.cjs
node kids/tests/http-security.cjs
```

Endereço atual em kids/tests/dedicated-preview.json (home_url/admin_url); portas variam. Credenciais somente fictícias: admin.teste / KidsTeste!2026. O runner aplica migrations apenas ao banco novo e isolado, em ordem nominal. Mover migrations não exige reaplicar SQL. Nomes e bytes dos SQLs foram preservados.

Para encerrar um preview, criar o arquivo indicado por stop no JSON correspondente. Os arquivos JSON de previews são estado local, não configuração de produção. O PHP embutido é destinado apenas a loopback e não interpreta .htaccess. O teste http-security.cjs sobe Apache isolado com cópias das regras para verificar 403 reais sem expor arquivos privados ou acessar banco.

## Publicação futura

Incluir formulário/assets, kids/.htaccess, API pública e helpers, shell/endpoints administrativos e kids/admin/dist/ com seus assets. Preservar as dependências compartilhadas existentes. Excluir kids/tests/, kids/docs/, kids/migrations/, kids/admin-app/, node_modules, .git, IDE, previews, logs, cookies, sessões e configurações privadas locais. Migrations ficam em pacote operacional separado, sem reaplicação automática. Não substituir o .env.php do destino.

Os diretórios tests, docs, migrations e admin-app têm Require all denied. Arquivos internos de api/ e _bootstrap.php têm bloqueio HTTP específico. Exigir Apache 2.4 com AllowOverride autorizado (ou regras equivalentes em outro servidor); não presumir que .htaccess funciona em Nginx/PHP embutido. SQL e registros existentes não são tocados pela reorganização.

Resultados desta execução ficam em kids/tests/*-results.json. Capturas e documentos anteriores foram mantidos; referências antigas dentro de history/ e nomes de caminhos em testes de ausência são intencionais. Limites: HTTP de loopback, fixtures e esquema mínimo de atendimentos; sem validação de HTTPS ou hospedagem de produção.
