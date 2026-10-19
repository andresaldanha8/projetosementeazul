# Exportação filtrada em PDF — validação final

O botão **Baixar lista filtrada em PDF** usa a faixa, pagamento e busca da última consulta aplicada com sucesso. Exporta todas as páginas desse resultado. O botão de lista completa permanece independente e exporta toda a edição.

## Implementação

- `api/registration-query.php`: validação e condições SQL compartilhadas pela listagem e PDF. Mantém a busca por criança/responsável e número e a ordenação numérica.
- `admin/api/registrations.php`: reutiliza a consulta compartilhada, preservando paginação, contagens e consulta individual.
- `admin/api/export-filtered-pdf.php`: POST com filtros obrigatórios validados, sessão administrativa KIDS e CSRF. Sem resultados, responde JSON 404 com “Nenhuma inscrição encontrada para os filtros selecionados”, sem PDF.
- `pdf/report.php` e `admin/api/export-pdf.php`: renderização/download reutilizados. Snapshot somente leitura mantém linhas e totais consistentes. O PDF filtrado identifica faixa, pagamento e busca; preserva canceladas e seus pagamentos.
- `admin-app/src/api.ts` e `KidsPage.tsx`: download, carregamento, trava contra cliques repetidos e erros sem apagar tabela. Filtros pendentes, debounce ou falha invalidam a exportação filtrada; respostas atrasadas não substituem a consulta mais recente. A exportação completa continua disponível.
- `api/.htaccess`: bloqueia acesso HTTP ao novo helper.
- `tests/manual-preview.cjs`: sincroniza o helper com o preview existente.

## Testes executados com dados fictícios

| Faixa | Todos | PENDENTE | PAGO |
| --- | ---: | ---: | ---: |
| 4–7 | 27 | 0 | 27 |
| 8–10 | 25 | 24 | 1 |
| 11–14 | 22 | 22 | 0 |

As nove combinações foram comparadas com todas as páginas da listagem. Casos vazios exibiram a mensagem exigida sem download. Buscas por criança, responsável, número 001 e 1064 passaram. Exportar estando na página 2 incluiu os 27 resultados, além das dez linhas visíveis.

`tests/filtered-pdf-browser.cjs` verificou debounce, aplicação pendente, falha da listagem, resposta atrasada, mesmo filtro selecionado, erro da geração, clique repetido, desktop e viewport 320 px. Filtros inválidos foram recusados com 400; ausência de CSRF com 403; sessões pública e de atendimentos com 401. O PDF completo, solicitado com filtros sem resultados, ainda trouxe os 74 registros da edição em seis páginas.

`tests/filtered-pdf-verify.py` comparou todas as células, números, totais e metadados de 14 PDFs não vazios com os resultados da listagem, incluindo acentos, 001, números acima de 999 e cancelamento. `tests/pdf-report-test.php` passou oito verificações, incluindo snapshot com pagamento concorrente em schema auxiliar isolado e totais filtrados com cancelamento. Nenhum dado do banco manual foi alterado.

`tests/http-security.cjs` confirmou 13 caminhos internos bloqueados, incluindo o novo helper, e o recurso público permitido. Build Vite, typecheck e lint dos cinco arquivos PHP afetados passaram.

Evidências: `tests/filtered-pdf-results.json`, `tests/filtered-pdf-verify-results.json`, `tests/filtered-pdf-cases/`, `tests/screenshots/filtered-pdf-desktop.png` e `filtered-pdf-mobile.png`. O resultado preliminar de falha foi preservado; a falha de invalidação ao selecionar o mesmo filtro foi corrigida e o teste final passou.

## Exemplo e inspeção visual

`output/pdf/kids-lista-filtrada-exemplo.pdf`: faixa 4–7, pagamento PAGO, busca “Fictícia”; 25 registros em duas páginas, sendo 24 ativos pagos e um cancelado pago. Ambas as páginas foram renderizadas pelo Poppler e inspecionadas: cabeçalhos repetidos, linhas inteiras, texto legível e paginação correta. Imagens em `tests/pdf-pages/filtrada-1.png` e `filtrada-2.png`.

## Build, preview e publicação futura

Build: `npm.cmd --prefix kids/admin-app run build`. Tipos: `npm.cmd --prefix kids/admin-app run typecheck`.

Comando único: `node kids/tests/manual-preview.cjs`. Reutiliza `http://127.0.0.1:51179/`, `/kids/?nova=1` e `/kids/admin/`, com o mesmo banco. Login fictício: `admin.teste` / `KidsTeste!2026`. A inscrição 1064, seu pagamento confirmado e auditoria foram preservados; hashes de registros, auditoria, contadores e idempotência permaneceram iguais durante os testes.

Nenhuma dependência nova: mantém Dompdf 3.1.6 e requisitos documentados em `EXPORTACAO-PDF.md`. No futuro pacote, incluir o novo helper, `.htaccess`, endpoints, renderizador, `admin/dist/` atualizado e dependências PHP existentes com seus arquivos de licença. Excluir `tests/`, `docs/`, `migrations/`, `admin-app/`, `node_modules/`, `output/`, `tmp/`, estados e bancos de preview, screenshots e evidências. Manter as regras HTTP de bloqueio dos diretórios internos.

Limitações: testes locais em HTTP e dados fictícios; não representam teste de carga de grandes volumes nem validação de TLS/hospedagem final. Nada foi publicado ou acessado em produção. Inscrições reais continuam bloqueadas. Comprovante individual permanece fora do escopo.
