# Checagem final KIDS — preview manual preservado

Parecer: **apto para avançar à definição e implementação da exportação PDF**, dentro do ambiente validado. Não foram encontrados bloqueios funcionais no percurso executado. Isso não garante ausência absoluta de defeitos e não substitui validação de hospedagem/produção. Nenhuma exportação foi implementada.

## Ambiente e preservação

Utilizado exclusivamente http://127.0.0.1:51179 e seu banco isolado existente, datadir kids-dedicated-3cde8194389b/db. O comando `node kids/tests/manual-preview.cjs` reutilizou a instância ativa. Não houve criação de outro banco, migração, reset, exclusão de dados ou acesso a produção. A configuração fonte kids/api/config.php continua com public_open=false e declaração nula.

Inscrição 1064, pagamento CONFIRMADO e uma auditoria: fingerprint do registro completo e auditoria idêntico antes/depois. A checagem adicionou registros fictícios sem apagar os anteriores.

## Percurso executado pelas interfaces

| Etapa | Resultado |
| --- | --- |
| Página inicial → Inscrever criança — KIDS | Formulário vazio, campos e categoria vazios, aceite desmarcado |
| Preenchimento e conclusão | Criança fictícia com nascimento em 17/10/2017, 9 anos na data fixa do preview, faixa 8–10, categoria Feminina, camisa P e R$ 60,00; retorno 201 e número 1065 |
| Confirmação pública | Uma confirmação, formulário oculto, PENDENTE, PIX e link WhatsApp; nenhuma mensagem externa enviada |
| Página inicial → administração | Botão normal do rodapé, login admin.teste, faixa 8–10, Atualizar e busca pelo número |
| Correspondência | Número 1065/id 74; todos os dados de criança/responsável/nascimento/idade/faixa/categoria/camisa/valor/situação correspondem entre formulário, linha SQL lida e API/lista; uma única inscrição |
| Cancelar pagamento | Zero requisições de pagamento e snapshot de registros/contadores/idempotência/auditoria inalterado |
| Confirmar pagamento | Duas ativações síncronas do botão produziram uma requisição; toast visível e somente a linha 74 passou a CONFIRMADO/PAGO |
| Atualizar após pagamento | POST real a /kids/admin/api/registrations.php, resposta 200, mesmos filtros e PAGO persistido |
| Auditoria | Uma entrada: usuário fictício 1, inscrição 74, PENDENTE → CONFIRMADO, UTC 2026-10-18 01:57:51.069319 |
| Retomar confirmação original | Atualização pelo comportamento existente de retorno: confirmado em verde, sem bloco PIX ou envio de comprovante |
| Consulta em sessão nova | Mesmo número 1065 e CONFIRMADO; resposta contém apenas number, registration_status e payment_status |
| Privacidade/permissões | Consulta não recupera confirmações da sessão original; identidade administrativa anônima e listagem recusada com 401; login KIDS não abre sessão de atendimentos |
| Inscrever outra criança | Formulário vazio/aceite desmarcado; confirmação anterior preservada |
| Voltar ao início → inscrição | Formulário vazio, parâmetro nova consumido; registro anterior permanece único e pago |
| Resposta perdida após commit | Inscrição 1066 recuperada com uma única requisição de criação, uma linha e um avanço do número |
| Falha de rede antes do envio | Inscrição 1067 criada ao repetir a mesma tentativa com a mesma chave idempotente; uma linha e um avanço do número |
| CSRF administrativo ausente | Requisição recusada com 403 sem alteração de registros, contadores ou auditoria |

Registro principal: **Crianca Ficticia Checagem Final 79135188**, número **1065**, id **74**, faixa **8–10**. Registros adicionais de recuperação: **1066/id 75** (resposta perdida) e **1067/id 76** (falha antes do envio); permanecem PENDENTE. Nenhum dado foi apagado para passar nos testes.

## Defeito encontrado e correção mínima

Na revisão visual da confirmação paga, o aviso superior ainda dizia “Confira o número de peito e as orientações para pagamento”, embora o cartão já estivesse verde e sem PIX. Esse texto poderia sugerir pagamento ainda necessário.

Alterado somente kids/kids.js no código de aplicação: mensagens de conclusão normal/recuperada passam a “Confira os dados no cartão”. As instruções específicas continuam nos cartões pendentes. Não houve alteração de API, permissões, layout ou código administrativo; build administrativo não precisou ser refeito. O preview ativo recebeu o novo asset pelo comando manual.

Após essa alteração de texto, foi executada regressão direcionada dos dois ramos de conclusão (normal e recuperada), nos estados PENDENTE e CONFIRMADO. Para não criar mais registros, esse teste intercepta somente create/confirmations com fixtures de transporte: confirma a mensagem neutra, mantém PIX pendente e remove orientações para pago. A inscrição 1064 foi novamente verificada. O percurso principal anterior foi integralmente real; somente a regressão de texto usou fixtures.

## Revisão direcionada versus execução

Executados nesta etapa: 11 grupos de aceitação em final-flow.cjs, navegação somente leitura em três páginas em final-console.cjs e duas ramificações de regressão textual em final-copy.cjs. Foram reaproveitados resume.cjs e os padrões de interação/recuperação de admin-flow.cjs e new-entry.cjs. Os runners antigos que reinicializam fixtures ou alteram configuração não foram executados contra o banco manual preservado.

Revisados no código, sem repetir testes de carga/concorrência/rollback já registrados anteriormente:

- Validação autoritativa: campos permitidos/tipos, telefone, data/idade, categoria, aceite/versão, valor/camisa no servidor; prazo após o bloqueio e replay antes do fechamento.
- Criação: transação, SELECT FOR UPDATE do evento, hash do payload, chave idempotente por sessão/edição e número único por evento. Recuperação real exercitada nos dois cenários acima.
- Listagem: filtros por edição/faixa, busca em JSON, paginação no servidor e contagens; proteção por geração contra respostas antigas, limitação de página após redução, carregamento/falha separados. Busca/faixa/Atualizar foram exercitados; navegação completa de páginas e atraso artificial não foram repetidos nesta etapa por não terem mudado.
- Sessões: cookies e caminhos separados, armazenamento administrativo privado, marcador de escopo, usuário ativo/perfil/auth_version autoritativos e troca obrigatória. A ausência de elevação entre público/KIDS/atendimentos foi exercitada.
- Pagamento: CSRF, valor e estado esperados, edição/situação, SELECT FOR UPDATE, atualização condicionada, auditoria na mesma transação e evento único. Cancelamento, clique repetido, persistência e auditoria foram exercitados; concorrência entre workers/rollback de auditoria não foram reinjetados no banco manual.
- Links e APIs: relativos à origem, /kids/?nova=1, /kids/admin/, /kids/api/ e /kids/admin/api/, sem porta de localhost em código de produção.

No percurso real: nenhuma exceção JavaScript ou falha local inesperada. Abortos de rede foram deliberados e separados no relatório. Google Fonts foi bloqueado pelo ambiente restrito; a verificação posterior somente leitura com acesso externo carregou as três páginas/fontes sem erro de console, exceção ou requisição falha. Não se repetiram inscrições ou pagamentos para essa verificação.

## Evidências e arquivos

- kids/tests/final-flow.cjs e final-flow-results.json: percurso real, requisições de Atualizar, números, auditoria e preservação da 1064. O script inclui agora uma asserção para o texto corrigido; essa asserção adicional foi validada de forma direcionada por final-copy.cjs, sem repetir a criação dos três registros.
- kids/tests/final-console.cjs e final-console-results.json: navegação somente leitura e recursos externos.
- kids/tests/final-copy.cjs e final-copy-results.json: regressão textual sem gravações no banco.
- Capturas em kids/tests/screenshots/: final-public-pending.png, final-admin-pending.png, final-admin-paid.png, final-public-paid.png, final-lookup-paid.png, final-copy-paid.png e final-copy-recovered-paid.png. final-public-paid.png mostra o resíduo antes da correção; final-copy-paid.png mostra a mensagem corrigida com fixture visual.
- Código de aplicação alterado: **kids/kids.js**, apenas duas mensagens. Nenhuma alteração administrativa/API, build ou SQL nesta etapa. Demais alterações são testes, resultados, capturas e este relatório.

## Limitações e próxima etapa

Validação local em navegador automatizado, HTTP de loopback, dados fictícios e relógio de inscrição fixo do preview. Sem TLS, hospedagem real, carga ou promessa de ausência absoluta de bugs. Outras alterações feitas simultaneamente por usuários do preview não foram simuladas. A persistência depende do datadir temporário preservado.

Próxima etapa registrada, ainda não implementada: **baixar pela administração a lista completa dos inscritos em PDF, abrangendo todas as páginas da listagem**. Escopo, filtros e apresentação serão definidos com o usuário após esta checagem.
