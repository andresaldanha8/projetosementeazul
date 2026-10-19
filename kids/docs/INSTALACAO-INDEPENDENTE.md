> Banco KIDS já instalado: seguir [ATUALIZACAO-IMAGEM.md](ATUALIZACAO-IMAGEM.md) e importar somente a migration 006. Não reaplicar o instalador consolidado.

# Instalação manual KIDS em banco exclusivo

Preparado em 18/10/2026. Nenhuma conexão à Hostinger, SQL remoto ou publicação foi executada. Produção continua com inscrições fechadas. Este guia substitui as instruções anteriores de conexão/usuários compartilhados.

## Arquivos exatos

- SQL para banco vazio: `kids/ops/install-kids-empty.sql` no projeto; `operations/install-kids-empty.sql` no ZIP release.
- Modelo: `kids/config/database.example.php` (também em `upload/kids/config/` no release).
- Arquivo que o responsável criará e preencherá: `kids/config/database.local.php`. Não é fornecido preenchido, não entra no Git/ZIPs e não substitui configurações de atendimentos.

## 1. Conferir o material e o destino

Use os ZIPs regenerados `kids-release-20261018.zip` e `kids-runtime-20261018.zip`, que substituem os anteriores. O release contém runtime em `upload/`, SQL e ferramentas privadas em `operations/`, além do manifesto. O runtime contém apenas `kids/`, sem instalador, configuração preenchida ou contas.

No phpMyAdmin da Hostinger, selecione **u330320079_kids** e confira que está vazio. O usuário MySQL exclusivo é **u330320079_kids**. A senha será preenchida apenas pelo responsável no arquivo privado. Não enviar senha para chat, histórico de comandos, capturas ou relatórios. Não selecionar o banco de atendimentos e não exportar/importar seus usuários ou dados.

Pré-requisitos: PHP 8.2 ou superior compatível com o vendor entregue, extensões PDO MySQL, mbstring e DOM; MySQL/MariaDB com InnoDB, utf8mb4 e REGEXP_REPLACE compatível com a consulta pública. Validado localmente em MariaDB 10.4; a versão/configuração reais do destino ainda devem ser conferidas. Apache/LiteSpeed deve respeitar os bloqueios `.htaccess`. O temporário PHP deve permitir sessões/arquivos privados. A hospedagem e o HTTPS ainda não foram testados.

## 2. Importar o instalador uma única vez

Com **u330320079_kids** selecionado e vazio, importe **operations/install-kids-empty.sql** pela aba Importar. O arquivo não contém CREATE DATABASE, USE, DROP ou GRANT: opera no banco selecionado. Cria sete tabelas KIDS, índices/chaves estrangeiras e a edição com próximo número 1. Não cria administrador, inscrição fictícia ou senha padrão.

Confira: `kids_eventos`, `kids_inscricoes`, `kids_idempotencia`, `kids_consulta_limites`, `kids_auditoria`, `kids_admin_login_limites` e `kids_administradores`. Administradores/inscrições devem estar vazios; `kids_eventos.proximo_numero` deve ser 1. Inventário somente leitura: `operations/inventario-kids.sql`.

**Não executar as migrations 001 a 006 depois deste import.** O instalador já incorpora essas mudanças. Se ocorrer erro, pare e confira o banco/objetos criados. DDL pode ter commit implícito; não há rollback integral garantido. Não repetir o import às cegas e não limpar banco com dados para tentar novamente.

Rota alternativa, apenas para outro banco vazio que NÃO recebeu o instalador: executar individualmente, nesta ordem, `001_kids.sql`, `002_lookup_limits.sql`, `003_payment_audit.sql`, `004_admin_login_limits.sql`, `005_independent_admin.sql`, `006_image_authorization.sql`. Os quatro arquivos históricos foram preservados byte a byte. No release ficam em `operations/migrations-alternativa/`. Escolha uma rota, nunca ambas.

A migration 005 não converte identidades antigas. Instalação existente com auditoria exige plano específico e reconciliação explícita antes dessa FK; não presumir que IDs de sistemas diferentes representam a mesma pessoa. Nenhuma migração de usuários/dados de atendimentos faz parte desta entrega.

## 3. Preparar a configuração própria

Copie localmente `kids/config/database.example.php` para `kids/config/database.local.php`. Preserve o código PHP de proteção e preencha o array:

| Campo | Preencher |
| --- | --- |
| `host` | Host MySQL informado no painel Hostinger; não presumir o valor |
| `port` | Porta do provedor (modelo: inteiro 3306) |
| `database` | `u330320079_kids` |
| `username` | `u330320079_kids` |
| `password` | Senha MySQL, preenchida privadamente pelo responsável |

Salve em PHP UTF-8 sem BOM. Não colocar senha no modelo, código do evento, chat ou manifesto. Aspas simples/barras invertidas na senha precisam de escape correto na string PHP; confira a sintaxe com `php -l CAMINHO/database.local.php`, sem exibir o conteúdo. Restrinja leitura ao proprietário/processo PHP (por exemplo, 600 quando compatível com a hospedagem).

O runtime lê exclusivamente esse arquivo e cria seu próprio PDO. Configuração ausente/inválida ou conexão recusada resultam em indisponibilidade genérica, sem fallback. O usuário MySQL deve acessar somente o banco KIDS. Enviar também `kids/config/.htaccess` e `kids/api/.htaccess`, sem remover o guard PHP. Não disponibilizar cópias `.bak`, `.txt`, ZIPs, SQLs ou editores na pasta pública.

## 4. Criar o primeiro administrador sem instalador web

A senha administrativa KIDS é independente da senha MySQL. Escolha login/nome novos, sem copiar conta de atendimentos. Login: 3 a 100 caracteres ASCII minúsculos, números, ponto, hífen ou sublinhado, começando por letra/número. Senha inicial: 12 a 72 bytes. Não há senha padrão. Primeiro login exige troca; somente o hash é armazenado.

### Opção A: gerar SQL local e importar manualmente, sem SSH

Mantenha `Administrador-KIDS.ps1` e `prepare-first-admin.php` juntos em pasta privada do computador, fora do site, repositórios e pastas sincronizadas. Use Windows PowerShell 5.1 ou PowerShell 7 e PHP local com mbstring. Substitua caminhos e identidade:

```powershell
powershell -NoProfile -File C:\pasta-privada\Administrador-KIDS.ps1 -Php C:\xampp\php\php.exe -Modo prepare-first-sql -ArquivoSql C:\pasta-privada\primeiro-admin-kids.sql -Login LOGIN_ESCOLHIDO -Nome "NOME ESCOLHIDO"
```

O wrapper pede a senha duas vezes com entrada oculta e transmite-a ao PHP somente por stdin, sem argumentos/histórico ou arquivo de senha. **Não conecta a banco algum.** Gera SQL privado com identidade/hash, sem senha em texto. Esse arquivo não é fixture do instalador nem entra nos pacotes.

No phpMyAdmin, ainda com **u330320079_kids** selecionado, importe o SQL privado depois do instalador. Confira `administradores_criados_deve_ser_1 = 1` e exatamente um administrador. Zero significa que já existe conta: pare, não force substituição. O script não altera administradores existentes. Exclua o SQL privado após verificar acesso, sem enviá-lo à pasta pública, chat ou suporte; o hash também é sensível.

### Opção B: CLI por SSH

Se houver SSH, guarde `admin-account.php` e `administrador-kids.sh` fora de `public_html`. Runtime/configuração KIDS devem estar no destino e o instalador já importado:

```bash
bash /pasta-privada/administrador-kids.sh /caminho/absoluto/public_html u330320079_kids create-first LOGIN_ESCOLHIDO "NOME ESCOLHIDO"
```

O wrapper pede confirmação oculta da senha; o PHP verifica o banco selecionado, exige tabela administrativa vazia e serializa tentativas concorrentes. Não inserir senha em comando e não ativar `set -x`, transcrições ou gravações. Depois, remover as ferramentas do servidor ou mantê-las exclusivamente em diretório privado. Não há URL de instalação e nenhum script operacional é incluído no runtime.

Recuperação futura autorizada por SSH: usar `reset-password` no lugar de `create-first`, para login KIDS ativo existente. Incrementa `auth_version`, exige nova troca e revoga apenas sessões KIDS. Não cria contas adicionais nem muda perfil/ativação.

## 5. Runtime e primeiro acesso

Quando a publicação manual for autorizada em etapa posterior, usar somente `upload/kids/` do release (ou `kids/` do runtime), preservando o arquivo privado preenchido no destino. Não enviar `operations/`, `shared-review/`, manifesto, SQLs, dumps, exemplos, testes ou ZIPs à pasta pública. `shared-review/` tem referências opcionais de home/CSS/assets; não é necessário aplicá-las para o backend independente. Não substituir arquivos/configurações de atendimentos ou seu dashboard.

O formulário usa logo/favicon/estilos do site existente; conexão, autenticação, inscrições e PDFs não dependem de PHP ou tabelas de atendimentos. A administração tem build próprio em `kids/admin/dist/`, e os recursos do PDF estão no KIDS.

Entre em `/kids/admin/` por HTTPS e faça a troca obrigatória. Sessões KIDS da versão compartilhada são invalidadas pelo escopo V2. Mantidos CSRF próprio, cookie HttpOnly/SameSite=Strict/Secure em HTTPS, inatividade de 30 minutos, duração de 8 horas e limites persistentes (8 por login/20 por origem a cada 15 minutos). Ativo, perfil e `auth_version` são reconsultados na tabela KIDS. A FK da auditoria impede excluir administradores referenciados; para revogar acesso, inativar ou incrementar a versão.

Preserve `kids/api/config.php` com `public_open=false` e declaração KIDS-2026-v2. Instalar banco/criar administrador não abre inscrições. Abertura exige decisão posterior e texto aprovado.

## Validação local

`tests/independent-integration.php` cria datadir novo e duas bases locais vazias: uma recebe o instalador; outra, somente as migrations alternativas. Os esquemas foram comparados. Webroot sem pasta de atendimentos; usuário de runtime restrito ao banco de teste, com acesso à outra base explicitamente recusado.

Exercitados provisionamento CLI/SQL offline, login/troca, CSRF, limites, expiração/revogação, inscrição HTTP 001, idempotência, consulta, listagem, pagamento, auditoria/FKs e downloads completo/filtrado. A abertura de teste existe somente no clone descartável; fonte/pacotes continuam fechados. PDFs reais dos endpoints foram renderizados e conferidos. Evidências: `kids/tests/independent-results.json`, `independent-pdf-results.json`, `http-security-results.json` e `independent-package-results.json`.

O preview manual antigo e seu banco não foram limpos, convertidos ou sincronizados com o backend novo. Esta entrega usa ambiente separado. Runners históricos que pressupõem identidade/conexão compartilhadas não homologam a arquitetura independente. Para repetir a validação atual: `node kids/ops/build-install.cjs` e `C:/xampp/php/php.exe kids/tests/independent-integration.php C:/xampp/mysql/bin`. Não executar suítes antigas sobre o preview preservado.
