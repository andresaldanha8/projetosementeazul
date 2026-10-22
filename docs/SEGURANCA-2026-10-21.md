# Correcao local de seguranca — 21/10/2026

**Estado atual apos manutencao autorizada:** Node.js **24.22.1**, npm **12.1.0**, pnpm **10.19.0**; PHP **8.2.35 x64 TS VS16**, confirmado no terminal e via HTTP no Apache **2.4.58 x64** existente. Nenhuma migracao do XAMPP, atualizacao de banco ou publicacao foi realizada. Detalhes e rollback na ultima secao deste documento.

## Producao: declaracao do fornecedor

O responsavel informou que a Hostinger declarou PHP **8.2.34** em producao, com protecao contra CVE-2026-109618 e CVE-2026-109619 por medidas do ambiente gerenciado. A atualizacao oficial sera automatica, sem prazo confirmado.

Esta e uma **declaracao do fornecedor, repassada pelo responsavel**, nao uma verificacao independente, prova de backport ou runtime oficialmente atualizado. As medidas tecnicas e sua cobertura nao foram fornecidas. A versao numerica e anterior a 8.2.35. Manter pendente a confirmacao do pacote corrigido, reinicio dos workers e eventual referencia de backport; controles de ambiente nao equivalem automaticamente a corrigir as falhas do runtime. Nenhuma alteracao ou publicacao na Hostinger foi realizada.

Fontes: https://www.php.net/archive/2026.php e https://nodejs.org/en/blog/vulnerability/october-2026-security-releases

## Dependencias e instalacao reproduzivel

- Dashboard: pnpm **10.19.0**, `dashboard/pnpm-lock.yaml`. Instalacao existente tem metadados pnpm e este era seu unico lock. Usar `pnpm.cmd install --frozen-lockfile --ignore-scripts` em dashboard.
- KIDS admin: npm **12.1.0**, `kids/admin-app/package-lock.json`. A documentacao de reorganizacao estabelece `npm ci`; a instalacao local tambem tinha residuos pnpm. O pnpm-lock historico divergente foi removido; `npm ci` recriou node_modules. Usar `npm.cmd ci --ignore-scripts` em kids/admin-app. Se uma politica npm bloquear o tarball opcional oficial do Tailwind, revisar a origem antes de autorizar a excecao somente para essa instalacao; nao alterar a politica global.
- PDF: Composer, `kids/pdf/composer.lock` preservado; Dompdf 3.1.6. `composer --no-plugins --no-scripts install` instala o lock. Nao houve alerta no diagnostico e nenhuma atualizacao desnecessaria foi feita.
- Node requerido pelos dois manifests: linha 24, **>=24.22.1 <25**. O campo engines registra o requisito; nao atualiza nem impede sozinho um runtime antigo.
- Atualizacoes respeitam os majors existentes, sem audit fix --force. Vite resolvido em **8.3.5**; locks revisados pelo audit. Servidores dev e preview limitados a **127.0.0.1**. Nao e necessario acesso pela rede para os fluxos locais existentes.
- Comandos de validacao: dashboard `pnpm.cmd run build` e `pnpm.cmd exec tsc --noEmit`; KIDS `npm.cmd run build` e `npm.cmd run typecheck`. Auditorias: `pnpm.cmd audit --json` e `npm.cmd audit --package-lock-only --ignore-scripts --json`.

## Procedimento da manutencao compartilhada

Primeiro executar `powershell -NoProfile -File ops/backup-local-runtime.ps1`. O backup fica fora da raiz do site, no TEMP privado do usuario, inclui php.ini, configuracoes Apache/XAMPP, npmrc existentes e inventario do PATH/versoes. Nao publicar nem compartilhar o backup: configuracoes podem conter segredos. Preservar esse diretorio em local privado duravel antes de qualquer troca. Nao exportar inscricoes para testes.

### Node.js na linha 24

1. Destino minimo: **24.22.1 x64** (ou posterior corrigida na linha 24). Fonte oficial: https://nodejs.org/en/blog/release/v24.22.1/ e https://nodejs.org/dist/v24.22.1/ . Conferir SHA-256 com SHASUMS256.txt oficial; no MSI conferir tambem assinatura digital.
2. Registrar `node --version`, `npm --version`, `pnpm --version`, `where.exe node`, `where.exe npm` e `npm list -g --depth=0` em arquivo privado. Preservar instalador da versao anterior para recuperacao temporaria; nao restaurar versao vulneravel como solucao permanente.
3. Validar primeiro o ZIP portatil em diretorio temporario, usando caminho absoluto ou PATH apenas da sessao. Nao copiar node.exe isolado por cima da instalacao existente. Validar npm/pnpm e os builds/locks com a nova versao.
4. Em janela de manutencao local, encerrar apenas processos de desenvolvimento conhecidos e IDEs que prendam os binarios. Executar o MSI x64 oficial e manter as opcoes de instalacao/PATH revisadas. Nao instalar ferramentas opcionais sem necessidade.
5. Abrir terminal novo e conferir caminho/versoes, gerenciadores declarados e instalacao pelos locks. Validar ambos os builds e auditorias. Se npm mudar com o MSI, provisionar a versao declarada ou revisar explicitamente packageManager apos validar; nao regenerar locks inadvertidamente com outro gerenciador.

### PHP do XAMPP

Inventario local: **PHP 8.2.12 x64 Thread Safe, VS2019**, modulo Apache `php8apache2_4.dll`; httpd-xampp.conf carrega php8ts.dll, libpq.dll e libsqlite3.dll de C:/xampp/php e PHPINIDir aponta para essa pasta.

1. Preferir **PHP 8.2.35 x64 TS VS16**, ou patch posterior corrigido da mesma linha, para reduzir mudancas de compatibilidade. Fonte: https://www.php.net/downloads.php?os=windows . Confirmar disponibilidade do pacote 8.2 e seu SHA-256 oficial antes de baixar. A pagina XAMPP Windows consultada ainda oferece 8.2.12: reinstalar esse pacote nao corrige estas CVEs (https://www.apachefriends.org/download.html).
2. Antes da troca, backup privado das configuracoes pelo script; preservar tambem uma copia integral de C:/xampp/php fora da raiz publica para rollback. Nao substituir DLLs em uso. Nao mexer em C:/xampp/mysql/data, htdocs ou servicos de banco. Nao copiar DLLs antigas de extensoes para o PHP novo.
3. Extrair o ZIP oficial em pasta separada. Criar php.ini a partir do modelo novo e portar somente configuracoes necessarias: timezone, session.save_path, upload_tmp_dir, memory_limit/post_max_size/upload_max_filesize, extensoes e certificados CA. Usar extensoes do proprio pacote, extension_dir correto e conferir dependencias VC++ x64. Preservar limites de memoria; nao usar memory_limit=-1 como substituto da correcao.
4. Habilitar/verificar PDO MySQL, curl, mbstring, DOM e demais extensoes realmente usadas (`php -m`, `php --ini`, `composer check-platform-reqs` no modulo PDF). Testar CLI e PHP embutido somente em 127.0.0.1 com bancos sinteticos novos. Depois validar Apache em instancia separada/porta livre e webroot sintetico, ajustando **todos** LoadFile/LoadModule/PHPINIDir para a nova pasta. `httpd -t` verifica sintaxe, mas nao comprova sozinho o funcionamento do modulo.
5. Somente apos aprovacao dos testes e backup integral, parar o Apache local em janela combinada, trocar a pasta PHP como unidade ou ajustar os caminhos para a pasta nova, testar configuracao e reiniciar Apache. Nao sobrescrever a pasta parcialmente nem copiar DLLs aleatorias para System32/Apache.
6. Confirmar versao CLI e **versao do modulo web** por diagnostico privado local, nunca phpinfo publico; conferir logs, cadastro, consulta, login, PDF e outros projetos que compartilhem XAMPP. Se falhar, parar Apache e restaurar pasta/configuracao de forma consistente. O PHP 8.2 chega ao fim de suporte em 31/12/2026; planejar migracao separada para linha suportada.

## Testes e publicacao

Resultado da etapa de dependencias: ambos os locks JavaScript com **zero avisos** em suas auditorias; Vite 8.3.5, PostCSS 8.5.31, Nanoid 3.3.20 e source-map-js 1.2.2. Builds e verificacoes TypeScript aprovados nos dois paineis, inclusive com Node **24.22.1 portatil**, SHA-256 conferido contra o manifesto oficial; outputs adicionais isolados em tmp/security-build/. Naquela etapa a instalacao compartilhada ainda estava em Node 24.20.0 / PHP 8.2.12. A manutencao posterior esta registrada abaixo.

Cadastro: **12 verificacoes** de integracao aprovadas (login invalido/valido, sessao, CSRF, consentimento, criacao, idempotencia, auditoria, indicadores do dashboard e logout). KIDS: **90 verificacoes** da suite independente aprovadas, incluindo testes reais HTTP e navegador, cadastro, consulta, login/troca de senha/revogacao, pagamento sintetico e exportacao PDF. Consulta/PIX adicional aprovada em 1024 e 320px, com falhas de rede, limite 429, resposta atrasada, clipboard/fallback e valores persistidos. PDF completo (3 paginas) e filtrado (1 pagina): conteudo, totais e limites de pagina aprovados, com renderizacao para revisao visual. Nenhum dado real foi acessado.

O teste de navegador antigo esperava capitalizacao anterior dos estados e um controle de detalhes ja retirado da interface. As expectativas foram alinhadas a apresentacao atual; a verificacao de proveniencia da escolha permanece nos casos de API. Nenhum comportamento funcional foi alterado para fazer o teste passar.

Backup inicial de configuracoes executado em diretorio privado TEMP fora do site, prefixo `sementeazul-runtime-backup-`. Antes da substituicao posterior foram concluidos backups integrais e inventario em diretorio privado duravel, conforme registro abaixo.

Testes usam MariaDB com datadir novo, portas efemeras em localhost, contas ficticias e configuracoes privadas geradas apenas no clone. O teste cadastro/tests/isolated.php usa schema minimo sintetico: exercita endpoints reais, nao valida o schema de producao. A suite KIDS independente usa instalador/migrations em bancos descartaveis. Nao acessar bancos/previews existentes.

Nenhum arquivo precisa ser publicado para corrigir ferramentas de build locais. Caso se decida distribuir os novos bundles, publicar futuramente somente os arquivos compilados de dashboard/dist/ e kids/admin/dist/, de forma consistente com seus index.html e caminhos base. Conferir PANEL_BASE_URL=/dashboard no build de destino quando servido sob esse prefixo; a configuracao atual permite selecionar essa base. Nao enviar node_modules, fontes admin-app, locks, docs, ops, testes ou backups. Nao incluir alteracoes funcionais preexistentes no workspace sem revisao separada. Atualizar os bundles nao corrige PHP na Hostinger.

## Manutencao dos runtimes executada em 21/10/2026

### Origem e instalacao

- Node instalado pelo **MSI x64 24.22.1 oficial**, SHA-256 conferido contra `https://nodejs.org/dist/v24.22.1/SHASUMS256.txt`, assinatura Authenticode valida **OpenJS Foundation**. A primeira tentativa silenciosa retornou 1603 por falta de privilegio administrativo (erro 1730); a repeticao com elevacao UAC terminou com **codigo 0**, sem reinicio do Windows. O npm 12.1.0, pnpm 10.19.0 e as versoes dos pacotes globais existentes foram preservados.
- PHP instalado como pacote completo oficial **php-8.2.35-Win32-vs16-x64.zip**, catalogo `https://downloads.php.net/~windows/releases/releases.json`, SHA-256 **cfa6000be835931961e40740bd3b51111700061d6655ddbfe5a2125807947457**. Arquitetura x64, Thread Safe, VS16, mesma linha PHP 8.2. Nao foi necessario migrar XAMPP, trocar Apache nem redistribuir DLLs no System32 ou no diretorio bin do Apache.
- O php.ini foi composto a partir do modelo novo com as diretivas ativas anteriores. Comparacao automatizada de `ini_get_all()` nao encontrou alteracoes nos valores preexistentes, exceto a normalizacao esperada do caminho extension_dir. Inclui limites, timezone, certificados, sessoes e temporarios. Os arquivos auxiliares nao binarios existentes foram preservados; nenhuma DLL antiga foi copiada para a instalacao nova.
- O Apache precisou carregar explicitamente **brotlicommon.dll, brotlidec.dll, libssh2.dll e nghttp2.dll do pacote PHP novo**, antes do PHP, em `C:/xampp/apache/conf/extra/httpd-xampp.conf`. A dependencia faltante brotlidec.dll foi identificada pelo analisador de dependencias antes da ativacao. A configuracao completa retornou `Syntax OK`; a requisicao HTTP privada retornou PHP 8.2.35, SAPI **apache2handler**, x64 TS, php.ini em C:/xampp/php/php.ini.

### Preservacao e servicos

Diretorio privado de manutencao, fora do site: **C:/Users/Usuario/AppData/Local/SementeAzul/runtime-maintenance-20261021/**. Contem instaladores/catalogos oficiais, logs, backups de configuracoes, inventario e evidencias HTTP. Nao publicar nem compartilhar seu conteudo indiscriminadamente.

Antes da troca foram verificados por hash os **2022 arquivos do PHP original** e **1992 arquivos da instalacao Node original** nas respectivas copias de rollback. Configuracoes Apache, php.ini, XAMPP, npmrc existentes e PATH foram copiados para subpastas `sementeazul-runtime-backup-*`. O diretorio original PHP inteiro tambem foi mantido em **C:/xampp/php-8.2.12-rollback-20261021/**. A configuracao Apache anterior a ativacao fica em **httpd-xampp-before-activation.conf** no diretorio privado de manutencao.

As **39 extensoes CLI anteriormente ativas** foram preservadas; Apache apresenta essas extensoes e apache2handler (40). Incluem PDO MySQL, mysqli, curl, mbstring, DOM, OpenSSL, zip, fileinfo e PDO SQLite. Duas DLLs Oracle **anteriormente desativadas** (`php_oci8_19.dll`, `php_pdo_oci.dll`) nao acompanham o pacote oficial novo: seus arquivos foram preservados na pasta antiga e no backup, mas nao foram copiados/ativados no runtime novo. Se algum outro projeto vier a precisar de Oracle, instalar antes builds oficiais compativeis e validar com Instant Client em ambiente de teste; nao reutilizar essas DLLs antigas por tentativa.

Apache e MariaDB estavam **parados**, sem servicos Windows registrados para eles; por isso nao houve interrupcao ou reinicio de banco. As instancias Apache de teste escutaram apenas localhost, usaram webroots ficticios e foram encerradas ao final. Os processos Node ativos eram internos do Codex com executaveis proprios e nao foram encerrados. Nenhum projeto em htdocs ou arquivo de banco existente foi alterado.

### Validacao posterior

- Novo processo PowerShell: `node --version` = **v24.22.1**, `php --version` = **8.2.35**, npm **12.1.0**, pnpm **10.19.0**. Caminhos ativos: C:/Program Files/nodejs/node.exe e C:/xampp/php/php.exe.
- Apache existente: configuracao completa aceita; HTTP privado confirma **8.2.35/apache2handler**, ini correto e extensoes exigidas. A instancia temporaria foi encerrada, preservando o estado inicial parado do Apache principal.
- Cadastro: **12 checks aprovados** em datadir novo e schema sintetico minimo, incluindo login, CSRF, criacao, consentimento, idempotencia, auditoria, indicadores e logout.
- KIDS: **90 checks aprovados** com PHP atualizado, incluindo HTTP, navegador, cadastro, consulta, administracao, senha/sessao, pagamento sintetico e PDFs. Consulta/PIX extra aprovada em 1024 e 320px. Bloqueios .htaccess: **20 checks aprovados** em Apache isolado (19 caminhos negados e um publico permitido); a tentativa inicial no sandbox nao abriu a porta, a execucao fora dele passou.
- Builds de dashboard e KIDS e TypeScript aprovados. Permanece apenas um aviso do Vite sobre uso futuro de configLoader native/__dirname no dashboard; nao bloqueia o build atual.
- `composer --no-plugins --no-scripts check-platform-reqs` aprovado com PHP 8.2.35 e extensoes exigidas. PDFs sinteticos completo (3 paginas) e filtrado (1 pagina) verificados em conteudo, totais, limites e renderizacao. Nenhum dado real foi utilizado.

### Rollback preparado

Se ocorrer problema, interromper somente as instancias locais PHP/Apache que estejam usando estes binarios; nao parar MariaDB nem processos internos do Codex. Conferir caminhos absolutos antes de qualquer rename/move.

Para PHP: com Apache/PHP parados, preservar a pasta nova com outro nome dentro de C:/xampp, restaurar a pasta **php-8.2.12-rollback-20261021** para **C:/xampp/php**, e restaurar **httpd-xampp-before-activation.conf** para **C:/xampp/apache/conf/extra/httpd-xampp.conf**. Validar `httpd -t` antes de iniciar apenas o Apache necessario. Isso restaura runtime/configuracao como conjunto; nao sobrescrever DLLs individualmente. A copia privada integral e alternativa de recuperacao.

Para Node: a copia integral **rollback/nodejs-24.20.0/** e o inventario/configuracoes estao no diretorio privado. Se for necessario reverter a instalacao registrada do Windows, usar o MSI oficial assinado da versao anterior em manutencao administrativa (nao apenas trocar node.exe); conferir os pacotes globais e PATH com o inventario. Preservar primeiro a instalacao atual. Versoes antigas vulneraveis sao apenas recuperacao temporaria, nao estado final seguro.

Pendencias: futuro suporte Oracle somente se solicitado/necessario; planejar migracao do PHP antes do fim de suporte 8.2 em 31/12/2026. A declaracao da Hostinger e a atualizacao de producao continuam exatamente como registradas na primeira secao, fora desta manutencao. Nenhum arquivo foi publicado.
