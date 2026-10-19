# Atualização manual — declaração e imagem

> Roteiro da entrega anterior. Para corrigir a apresentação na produção já instalada e aberta, seguir somente [CORRECAO-ADMIN-IMAGEM.md](CORRECAO-ADMIN-IMAGEM.md). Não repetir a migration nem substituir config.php nesta correção.

Preparada localmente em 18/10/2026. A instalação KIDS independente na Hostinger foi informada pelo responsável; não foi acessada nesta etapa. Nenhum SQL remoto, publicação, limpeza de banco ou alteração do administrador foi realizado. Projeto e ZIPs permanecem com `public_open=false`.

## Banco existente já instalado (Hostinger)

1. Fazer backup privado do banco KIDS e dos arquivos a substituir pelos meios habituais do responsável. Manter inscrições fechadas.
2. No phpMyAdmin, selecionar **u330320079_kids** e confirmar que é o banco KIDS já instalado com a migration 005. Não selecionar atendimentos.
3. Importar **somente `operations/migrations-alternativa/006_image_authorization.sql`** do release (no projeto: `kids/migrations/006_image_authorization.sql`). Aplicar uma única vez. São quatro colunas nullable adicionadas a `kids_inscricoes`; não há UPDATE, preenchimento retroativo ou alteração de administradores/contador.
4. Conferir as quatro colunas novas. Nos registros anteriores, todas devem ser NULL: **Não informado**, sem presumir autorização. Se as colunas já existirem ou ocorrer erro, parar e conferir o esquema; não repetir o ALTER às cegas.
5. Substituir os dez arquivos de runtime abaixo, usando a pasta `upload/` do release. Enviar primeiro os assets compilados e, por último, o HTML que os referencia. Manter administração sem operações durante a troca para evitar mistura de versões. A lista exata com hashes também está em `operations/ARQUIVOS-ATUALIZACAO-IMAGEM.json`.
6. Preservar **kids/config/database.local.php** do destino, conexão, credenciais e administrador. Não executar ferramentas de provisionamento/reset. Nenhum arquivo de atendimentos deve ser substituído.
7. Conferir a página pública fechada e a coluna Imagem na administração. Não abrir inscrições nesta atualização. Testes com inscrições novas foram feitos somente em clone local isolado; não cadastrar fixtures na produção para reproduzi-los.

**Não importar `install-kids-empty.sql` neste banco existente. Não reaplicar migrations 001–005.** O instalador consolidado serve exclusivamente para outro banco vazio; já incorpora 001–006. A alternativa para esse outro banco vazio é aplicar somente 001, 002, 003, 004, 005 e 006 em ordem, sem importar também o consolidado.

## Arquivos a substituir na Hostinger

- `kids/index.html`
- `kids/kids.js`
- `kids/api/config.php`
- `kids/api/domain.php`
- `kids/api/session.php`
- `kids/api/create.php`
- `kids/admin/api/registrations.php`
- `kids/admin/dist/index.html`
- `kids/admin/dist/assets/index-rnqPml0X.js`
- `kids/admin/dist/assets/index-UlaFfeC_.css`

Não é necessário substituir o renderizador, os endpoints ou as dependências de PDF. Os assets antigos do build podem permanecer durante a conferência; não apagar arquivos desconhecidos. Não enviar SQLs, ferramentas operacionais, exemplos, evidências, configuração preenchida ou o ZIP completo para a pasta pública.

## Comportamento e registro

Declaração obrigatória: versão `KIDS-2026-v2`, com o texto fornecido pelo responsável e sem autorização de imagem. Caixa de imagem: independente, opcional, desmarcada por padrão, versão `KIDS-IMAGEM-2026-v1`, com o texto fornecido e aviso “Opcional. A recusa não impede a inscrição.”

Novas inscrições registram `imagem_autorizada` (1 autorizado, 0 não autorizado), `imagem_autorizacao_versao`, `imagem_autorizacao_texto` e `imagem_registrada_em` (UTC com microssegundos). O texto é o configurado no servidor, não um texto arbitrário enviado pelo navegador. Omissão do campo opcional equivale a não autorizar para uma inscrição nova e não bloqueia o registro. Registros antigos permanecem NULL/Não informado. O aceite obrigatório continua exigido. Um aceite positivo de imagem exige a versão atual apresentada.

A administração mostra Autorizado, Não autorizado e Não informado e permite expandir o registro de texto, versão e horário em Brasília. Consulta pública e cartões de confirmação não recebem essa escolha. Os PDFs continuam com os mesmos campos e layout.

Escolha e versão integram o hash idempotente; repetir a mesma tentativa não duplica inscrição, e mudar a escolha com a mesma chave retorna conflito. O formato antigo sem os campos opcionais continua aceito para replay. No navegador, dados pessoais não são gravados em sessionStorage; a tentativa guarda somente chave/hash, geração e metadados de versão/escolha. Após falha, o mesmo envio preserva a escolha. Ao iniciar outra inscrição, ambos os aceites voltam desmarcados. Qualquer alteração futura do texto exige nova versão; se o texto/versão mudar durante um formulário sem tentativa pendente, o aceite correspondente é desmarcado para nova escolha explícita.

## Validação executada

Resultados atuais: 90 verificações de integração, 10 cenários no navegador e 21 verificações de domínio. Evidências em `kids/tests/independent-results.json` e `image-authorization-browser-results.json`. O runner cria datadir novo, usuário limitado e webroot isolado sem arquivos de atendimentos. Compara instalação consolidada com rota incremental e comprova que um registro anterior à 006 mantém seus dados e fica Não informado.

Cobertura de API: autorização sim/não/omitida, ausência do aceite obrigatório, versão positiva inválida, snapshot de texto/versão/data, idempotência e conflito de escolha, privacidade da consulta/cartões, listagem administrativa e independência dos PDFs. Navegador real: caixa desmarcada, recusa sem bloqueio, novo formulário, resposta perdida após commit, falha antes do commit com reload e reenvio, apresentação administrativa dos três estados e seção opcional a 320px. Build/typecheck administrativo e lint também executados. PDFs reais exportados pelo clone foram comparados/renderizados; nenhum código de PDF foi alterado.

Os bancos/previews anteriores e o arquivo local privado de conexão não são usados por essa suíte. As contas que o runner cria/redefine existem apenas em seu datadir novo descartável; nenhum administrador instalado foi alterado. A senha MySQL não deve ser enviada ao chat nem incluída em ZIPs.
