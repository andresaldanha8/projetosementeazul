# Administração logada e fluxo público → lista

Validação somente em cópias temporárias, MariaDB novo e dados fictícios. Configuração fonte em kids/api/config.php continua com public_open=false e declaração nula. Não houve publicação, acesso a produção, alteração de dados reais ou PDF.

## Problemas reproduzidos e correção

Em kids/tests/refresh-before-results.json estão os resultados do build anterior: após falha de atualização continuavam visíveis 20 linhas; depois de nova resposta 200 permanecia a mensagem de falha; ao reduzir os resultados no banco, a tela mostrava “0 inscrições · Página 3 de 1”. O script refresh-repro.cjs é evidência histórica e pressupõe o build anterior, não é a regressão da versão corrigida.

O único código de aplicação alterado nesta checagem foi kids/admin-app/src/KidsPage.tsx:

- Limpa erro anterior ao consultar novamente e não mantém linhas/contagens anteriores como resultado da nova consulta.
- Diferencia carregamento, lista vazia e falha. Em falha mostra “Lista não atualizada. Tente novamente.”, contagens indisponíveis e traços nas abas, sem alegar zero inscrições.
- Botão mostra “Atualizando…”; bloqueio síncrono evita dois envios no mesmo ciclo de eventos.
- Mantém faixa, busca, pagamento e tamanho da página. Se o total diminui, limita a página ao último índice válido e consulta novamente essa página.
- Preserva a proteção existente por geração: respostas anteriores não sobrescrevem a consulta mais recente.

Nenhuma atualização automática administrativa foi adicionada. Layout, regras de pagamento, permissões, auditoria, numeração e idempotência foram preservados.

## Testes executados

- 12 grupos de verificações integradas em admin-flow.cjs, com formulários e diálogos reais em navegador e consultas reais ao banco isolado. Todos aprovados na execução final.
- 75 verificações HTTP/MariaDB da suíte administrativa: aprovadas, incluindo isolamento de sessões e auditoria/rollback.
- 20 verificações da suíte dedicada de navegador: aprovadas (desktop/celular, busca, filtros, faixas, paginação, pagamento e reconciliação).
- 21 verificações de domínio, lint PHP do runner/helper, build KIDS e TypeScript: aprovados.

Os testes integrados cobrem dados e contagens das três faixas, ordenação numérica, filtros visíveis, lista vazia, página que oculta legitimamente a inscrição, carregamento, falha/repetição, resposta antiga após uma mais recente, queda real de total no banco e sessão expirada real. As falhas simuladas são registradas separadamente: API 500, submissão 400, rollback transacional 500 e sessão 401. O rollback usa trigger somente no banco descartável; não há seam de teste no código de aplicação.

Revisão de código: load() efetivamente consulta registrations.php via POST; o cliente usa cache:no-store; a API consulta registros e contagens no banco por edição/faixa/filtros. Essa revisão foi confirmada pela execução de rede, não usada como substituta do teste.

Na primeira execução sob restrição de rede, Google Fonts retornou ERR_NETWORK_ACCESS_DENIED. A repetição com acesso à fonte externa passou sem erros de console, exceções JavaScript ou requisições inesperadamente falhas. O produto não foi modificado para contornar a restrição. kids/tests/admin-flow-failure.json preserva a evidência dessa execução intermediária; admin-flow-results.json contém o resultado final aprovado.

## Evidência do botão Atualizar

Requisição capturada após cada clique:

```http
POST /kids/admin/api/registrations.php
Content-Type: application/json
X-CSRF-Token: [não registrado]

{"search":"","payment":"","band":"4-7","page":1,"perPage":50}
```

Resposta 200 com linhas e counts atuais do banco. Antes das inscrições, as contagens eram 25 / 21 / 21. Após os três formulários e respectivas atualizações: 26 / 21 / 21, depois 26 / 22 / 21 e finalmente 26 / 22 / 22. A administração permaneceu aberta; a nova inscrição não estava no estado anterior e apareceu após a nova consulta. Duas ativações síncronas do botão durante resposta real atrasada produziram apenas uma requisição. Os detalhes capturados ficam em admin-flow-results.json, sem tokens de sessão ou CSRF.

| Número fictício | Nome | Faixa | Resultado |
| --- | --- | --- | --- |
| 1061 | Fluxo Ficticio Quatro Sete | 4–7 | PENDENTE na criação; depois PAGO |
| 1062 | Fluxo Ficticio Oito Dez | 8–10 | PENDENTE |
| 1063 | Fluxo Ficticio Onze Quatorze | 11–14 | PENDENTE |

Cada número foi comparado entre cartão público, linha persistida no banco e linha administrativa. Nenhuma duplicação. Inscrição recusada e inscrição com rollback não apareceram e não avançaram o contador.

O pagamento da 1061 foi confirmado pelo diálogo. Após Atualizar continuou PAGO; modal público e cartão original ao retomar a página mostraram pagamento confirmado. A comparação do banco antes/depois identificou somente a inscrição 69 (número 1061) alterada e uma auditoria PENDENTE → CONFIRMADO pelo administrador fictício 1, com data/hora. Posteriormente, o teste de encolhimento muda apenas fixtures preexistentes no banco descartável para provocar redução do filtro PENDENTE; essa manipulação é distinta do teste de pagamento da inscrição pública.

Capturas: ../tests/screenshots/flow-4-7.png, flow-8-10.png, flow-11-14.png, flow-refresh-error.png e flow-paid-card.png.

## Reproduzir e conferir

```powershell
npm.cmd --prefix kids/admin-app run build
npm.cmd --prefix kids/admin-app run typecheck
C:/xampp/php/php.exe kids/tests/dedicated_integration.php C:/xampp/mysql/bin --flow-preview
# Outro terminal, depois de FLOW PREVIEW READY:
node kids/tests/admin-flow.cjs
```

O modo --flow-preview abre inscrições exclusivamente na cópia descartável, com declaração TEST-ONLY e data de inscrição fixa em 17/10/2026. O runner escolhe o próximo número após as fixtures existentes para evitar colisão no banco de teste. O helper CLI de controle fica fora do webroot temporário. O cenário requer fixture nova por execução.

Preview final ativo: http://127.0.0.1:51179/kids/admin/ ; formulário http://127.0.0.1:51179/kids/?nova=1 . Credenciais fictícias: admin.teste / KidsTeste!2026. Endereços mais recentes e arquivo stop em ../tests/flow-preview.json; a porta muda ao recriar o ambiente. A administração pode exigir login no navegador do usuário, pois os testes usam contextos próprios.

Limitações: HTTP de loopback, dados sintéticos, navegador automatizado, sem avaliação de TLS, hospedagem ou carga de produção. Fontes visuais dependem do serviço externo já existente. Sem verificação de tempo real por espera de 30 minutos: a expiração foi provocada somente pelo roteador de teste. Formulários, API, banco, pagamento e auditoria utilizaram os caminhos reais da aplicação; somente falhas de rede/500 e atrasos de resposta foram injetados explicitamente. Testes, evidências e documentação continuam fora do pacote público.
