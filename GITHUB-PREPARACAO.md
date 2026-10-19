# Preparação local para GitHub

Relatório sem valores de credenciais ou dados de inscrições. Nenhum commit, push, reescrita de histórico, conexão com produção ou execução de SQL foi realizado.

## Destino e estado

- Repositório configurado: `https://github.com/andresaldanha8/projetosementeazul.git`.
- Remoto: `origin`. Branch atual e destino proposto: `main`.
- `main` e `origin/main` coincidem nas referências locais. Não foi feito fetch, portanto isso não confirma o estado atual do servidor.
- Inspecionados 16 commits alcançáveis por `main` e 22 commits ao incluir referências auxiliares locais, além dos arquivos rastreados, não rastreados e ignorados relevantes.
- Não foi localizado AGENTS.md no projeto ou nos caminhos ancestrais acessíveis verificados. Foram lidos os ignores e guias de instalação/configuração KIDS. Nenhum arquivo foi adicionado ao staging nesta preparação.

## Resultado da inspeção

Os arquivos `.env.php`, `cadastro/api/config/.env.php` e `kids/config/database.local.php` contêm configuração privada e ficaram preservados no disco, ignorados e fora do índice. Nenhum deles estava rastreado no índice atual, portanto não foi necessário executar remoção do índice.

`kids/api/config.php` também fica apenas local, por conter dados preenchidos de PIX/favorecido/contato. Foi criado `kids/api/config.example.php` com placeholders e abertura pública desativada. Uma cópia nova do repositório precisa copiar esse modelo para `kids/api/config.php`, preencher localmente e preservar a configuração própria já existente na hospedagem. Nenhum arquivo preenchido ou configuração de produção foi alterado.

Os modelos `.env.php.example`, `cadastro/api/config/.env.php.example` e `kids/config/database.example.php` não contêm senhas ou identidades de banco reais. O modelo da raiz preserva os nomes das constantes usados pelo arquivo local, inclusive a constante de hash administrativo, sem fornecer um hash real.

Temporários, pacotes de saída, backups, dumps, sessões, cookies, logs, SQL administrativo privado, previews e evidências de testes foram excluídos da seleção por .gitignore. As cópias locais foram preservadas. A documentação histórica KIDS também fica local, pois reproduz configurações antigas preenchidas. Fontes de testes ficam incluídos, com dados fictícios. Dois testes de navegador passaram a consultar o PIX/contato do próprio ambiente em vez de conter seus valores reais.

Migrations 001 a 006 e SQLs legítimos de instalação, inventário e operação manual continuam elegíveis. Não há regra genérica para excluir todos os arquivos SQL. Dependências instaladas e builds continuam fora do Git conforme os ignores; devem ser reconstruídos ao preparar uma instalação.

Nenhum valor de senha/credencial dos três arquivos privados foi encontrado nos arquivos elegíveis ou nos blobs textuais examinados do histórico. A busca automatizada sinalizou comandos INSERT parametrizados, rótulos de interface, valores fictícios de testes e o hash fictício constante usado na verificação de tempo do login; esses sinais não representam dumps de produção ou credenciais administrativas reais.

As novas imagens do site foram inspecionadas visualmente: são artes de divulgação e apoio institucional, sem fichas de inscrição ou dados de participantes. A preparação não remove o conteúdo institucional já público do site. A análise por padrões não constitui prova absoluta de ausência de todo tipo de dado pessoal em binários e no conteúdo histórico.

## Histórico e revogação

Não foi confirmada credencial de produção no histórico de `main`, nem correspondência das credenciais privadas atuais em quaisquer referências locais examinadas. Não há indicação concreta, nesta inspeção, que imponha revogação das credenciais de produção por vazamento neste histórico.

Referências auxiliares locais de agentes/checkpoints contêm artefatos de ambientes de teste, incluindo sessões, logs, configurações e SQL administrativo gerado. Essas referências não fazem parte do histórico de `main` e não devem ser enviadas por mirror ou envio indiscriminado de refs. Não foram removidas nem reescritas. Se alguma credencial de teste tiver sido reutilizada fora do ambiente descartável, ela deve ser revogada nesse ambiente. Qualquer divulgação anterior desses arquivos fora deste repositório exige avaliação própria.

## Verificações executadas

- Busca por padrões de credenciais, chaves privadas, tokens, hashes, campos pessoais e dumps no conteúdo textual local e nos blobs alcançáveis pelas referências Git.
- Comparação sem impressão dos valores privados com os arquivos elegíveis e o histórico.
- Conferência de regras com git check-ignore, incluindo confirmação de que exemplos e SQLs legítimos não são ignorados.
- Nenhum arquivo privado atualmente rastreado encontrado com git ls-files -ci --exclude-standard.
- Sintaxe PHP dos quatro modelos e sintaxe JavaScript dos dois testes alterados aprovadas.
- git diff --check aprovado. Não foram executados os testes que conectam a bancos ou previews existentes.

## Arquivos propostos para o futuro commit

Lista completa abaixo, incluindo alterações que já estavam no diretório antes desta preparação. M = modificado, A = novo arquivo proposto, D = exclusão que já estava pendente. A lista é uma proposta para revisão, não staging ou autorização de commit/push.

<!-- manifest -->

Total: 163 arquivos.

```text
A .env.php.example
M .gitignore
A GITHUB-PREPARACAO.md
A cadastro/api/auth/credentials.php
M cadastro/api/auth/login.php
M cadastro/api/config/.env.php.example
M css/style.css
M dashboard/vite.config.ts
D img/PATR.jpeg
A img/flyercorrida1.jpeg
M img/flyercorrida2.jpeg
A img/patr01.jpeg
A img/patr02.jpeg
A img/patr03.jpeg
A img/patr04.jpeg
M index.html
A kids/.gitignore
A kids/.htaccess
A kids/admin-app/.htaccess
A kids/admin-app/index.html
A kids/admin-app/package-lock.json
A kids/admin-app/package.json
A kids/admin-app/pnpm-lock.yaml
A kids/admin-app/src/KidsAdminApp.tsx
A kids/admin-app/src/KidsPage.tsx
A kids/admin-app/src/api.ts
A kids/admin-app/src/index.css
A kids/admin-app/src/main.tsx
A kids/admin-app/tsconfig.json
A kids/admin-app/vite.config.ts
A kids/admin/api/.htaccess
A kids/admin/api/_bootstrap.php
A kids/admin/api/change-password.php
A kids/admin/api/export-filtered-pdf.php
A kids/admin/api/export-pdf.php
A kids/admin/api/login.php
A kids/admin/api/logout.php
A kids/admin/api/me.php
A kids/admin/api/payment.php
A kids/admin/api/registrations.php
A kids/admin/index.php
A kids/api/.htaccess
A kids/api/admin-auth.php
A kids/api/admin-session.php
A kids/api/admin.php
A kids/api/config.example.php
A kids/api/confirmations.php
A kids/api/create.php
A kids/api/database.php
A kids/api/domain.php
A kids/api/http.php
A kids/api/lookup.php
A kids/api/receipt.php
A kids/api/records.php
A kids/api/registration-query.php
A kids/api/session.php
A kids/config/.gitignore
A kids/config/.htaccess
A kids/config/database.example.php
A kids/docs/.htaccess
A kids/docs/ADMIN-SEPARACAO.md
A kids/docs/ADMIN-VALIDACAO.md
A kids/docs/ATUALIZACAO-IMAGEM.md
A kids/docs/CHECAGEM-FINAL.md
A kids/docs/CORRECAO-ADMIN-IMAGEM.md
A kids/docs/EXPORTACAO-FILTRADA-PDF.md
A kids/docs/EXPORTACAO-PDF.md
A kids/docs/INSTALACAO-INDEPENDENTE.md
A kids/docs/PREPARACAO-PRODUCAO.md
A kids/docs/PREVIEW-MANUAL.md
A kids/docs/PUBLICO.md
A kids/docs/README.md
A kids/docs/REORGANIZACAO.md
A kids/docs/REVISAO-APRESENTACAO-PDF.md
A kids/docs/REVISAO-TEXTOS-ADMIN.md
A kids/docs/VALIDACAO-1.1.md
A kids/docs/VALIDACAO-FLUXO-ADMIN.md
A kids/docs/VALIDACAO-REORGANIZACAO.md
A kids/docs/clear-test-registrations-manual.md
A kids/docs/comprovante-individual.md
A kids/index.html
A kids/kids.css
A kids/kids.js
A kids/lookup.js
A kids/migrations/.htaccess
A kids/migrations/001_kids.sql
A kids/migrations/002_lookup_limits.sql
A kids/migrations/003_payment_audit.sql
A kids/migrations/004_admin_login_limits.sql
A kids/migrations/005_independent_admin.sql
A kids/migrations/006_image_authorization.sql
A kids/ops/.htaccess
A kids/ops/Administrador-KIDS.ps1
A kids/ops/admin-account.php
A kids/ops/administrador-kids.sh
A kids/ops/build-install.cjs
A kids/ops/clear-test-registrations-manual.sql
A kids/ops/install-kids-empty.sql
A kids/ops/inventario-kids.sql
A kids/ops/package-image-admin-fix.py
A kids/ops/package.cjs
A kids/ops/prepare-first-admin.php
A kids/ops/refresh-pdf-packages.py
A kids/pdf/.htaccess
A kids/pdf/assets/logo.jpg
A kids/pdf/composer.json
A kids/pdf/composer.lock
A kids/pdf/receipt.php
A kids/pdf/report.php
A kids/tests/.gitignore
A kids/tests/.htaccess
A kids/tests/access.cjs
A kids/tests/admin-browser.cjs
A kids/tests/admin-flow.cjs
A kids/tests/admin-launcher-test.ps1
A kids/tests/admin-texts-browser.cjs
A kids/tests/admin_integration.php
A kids/tests/browser.cjs
A kids/tests/check-manual-local.php
A kids/tests/dedicated-browser.cjs
A kids/tests/dedicated_integration.php
A kids/tests/domain_test.php
A kids/tests/filtered-pdf-browser.cjs
A kids/tests/filtered-pdf-verify.py
A kids/tests/final-console.cjs
A kids/tests/final-copy.cjs
A kids/tests/final-flow.cjs
A kids/tests/fixtures/image-admin-before.js
A kids/tests/flow-control.php
A kids/tests/http-security.cjs
A kids/tests/image-authorization-browser.cjs
A kids/tests/image-authorization-cases.php
A kids/tests/image-contract-baseline.cjs
A kids/tests/image-contract-browser.cjs
A kids/tests/image-contract-integration.php
A kids/tests/independent-integration.php
A kids/tests/independent-package-verify.py
A kids/tests/independent-pdf-verify.py
A kids/tests/integration.php
A kids/tests/lookup.cjs
A kids/tests/manual-db.php
A kids/tests/manual-preview.cjs
A kids/tests/manual-ui.cjs
A kids/tests/new-entry.cjs
A kids/tests/open-manual-local.cjs
A kids/tests/pdf-browser.cjs
A kids/tests/pdf-presentation-verify.py
A kids/tests/pdf-presentation.php
A kids/tests/pdf-report-test.php
A kids/tests/pdf-verify.py
A kids/tests/pdf_display.py
A kids/tests/presentation.cjs
A kids/tests/receipt-browser.cjs
A kids/tests/receipt-integration.php
A kids/tests/receipt-verify.py
A kids/tests/refresh-repro.cjs
A kids/tests/release-backup.cjs
A kids/tests/release-clean.cjs
A kids/tests/release-clean.php
A kids/tests/release-closed-browser.cjs
A kids/tests/release-inventory.php
A kids/tests/resume.cjs
A kids/tests/steps.cjs
```
