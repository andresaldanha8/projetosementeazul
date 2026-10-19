# Revisão de apresentação da administração

Alterados somente textos e formatação de exibição em `admin-app/src/KidsPage.tsx` e `KidsAdminApp.tsx`; build em `admin/dist/` atualizado e sincronizado no preview 51179. Regras, consultas, filtros, exportações e dados preservados.

Saudação usa `me.php` e o nome autenticado, com alternativa Administrador para nome vazio. “FICTICIO Admin” é o nome da conta de teste, definido em `tests/dedicated_integration.php` e `tests/integration.php`; não houve substituição desse dado nem alteração no banco. Fixtures e contas fictícias continuam restritas aos testes, fora do pacote de produção.

Telefones de dez/onze dígitos recebem DDD e hífen somente na apresentação. Prefixo internacional 55 em números de treze dígitos é reconhecido. Valores não reconhecidos permanecem intactos na exibição. Situações passam a Registrada/Cancelada, categorias Masculino/Feminino e pagamentos continuam PENDENTE/PAGO.

Validação executada: build, typecheck e `node kids/tests/admin-texts-browser.cjs`. Conferidos desktop e 320 px, nome dinâmico e alternativa sem nome, singular/plural/zero, telefones fixo/celular, nomes longos e cancelamento. Os casos artificiais de apresentação usam respostas interceptadas no navegador e não escrevem no banco. Capturas em `tests/screenshots/admin-texts-*.png`; resultado em `tests/admin-texts-results.json`. Imagens desktop e celular inspecionadas. A tabela mantém sua rolagem horizontal existente no celular.

Seletores textuais dos testes existentes em `admin-flow.cjs`, `dedicated-browser.cjs`, `filtered-pdf-browser.cjs`, `final-flow.cjs`, `pdf-browser.cjs` e `refresh-repro.cjs` foram atualizados para os novos rótulos; suas suítes de backend não foram repetidas por esta alteração de apresentação.

Preview: `http://127.0.0.1:51179/kids/admin/`. Comando único `node kids/tests/manual-preview.cjs`; a verificação confirmou inscrição 1064 paga e auditoria preservadas. Nenhuma publicação ou alteração de dados reais; inscrições reais continuam bloqueadas.
