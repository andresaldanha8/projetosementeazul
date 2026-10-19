# Comprovante individual de inscrição

Atualização manual na Hostinger: enviar somente estes quatro arquivos, mantendo os caminhos relativos à raiz do site:

- `kids/api/receipt.php` (novo)
- `kids/pdf/receipt.php` (novo)
- `kids/kids.js` (atualizado)
- `kids/kids.css` (atualizado)

Reutiliza `kids/pdf/vendor/` já instalado. Não exige migration, Composer, chave, token adicional, URL canônica ou alteração de configuração. Não enviar os testes, arquivos temporários ou este documento. Não há ZIP.

O endpoint aceita GET com `reference`, mas só retorna PDF se a sessão pública válida possuir o mesmo `owner_hash` da inscrição e a edição corresponder à configuração do evento. Não usa sessão administrativa para autorizar. Ausência/expiração da sessão retorna 401; referência inválida, inexistente ou pertencente a outra sessão retorna 404. Nome, número e ID não autorizam download. A consulta por nome/telefone não altera a propriedade nem disponibiliza PDF.

Cada emissão consulta os dados atuais, não escreve na inscrição e não reserva número. O PDF contém evento, criança, número com pelo menos três dígitos, faixa etária, data da inscrição, situação e pagamento. Datas mostram America/Sao_Paulo e deslocamento UTC. Pendências recebem o aviso solicitado e cancelamentos recebem destaque vermelho. Dados do responsável e telefone não são selecionados para o documento. Respostas usam no-store.

Validação local executada em datadir MariaDB novo, portas de loopback e cópia isolada do site, com dados fictícios. Nenhum acesso a produção ou alteração de credenciais/configuração de produção. Nenhum código, pacote ou migration exclusivo de QR Code foi encontrado nas áreas da implementação; nenhuma alteração anterior foi retirada.

Comandos de teste:

```text
php -l kids/api/receipt.php
php -l kids/pdf/receipt.php
node --check kids/kids.js
php kids/tests/domain_test.php
php kids/tests/receipt-integration.php
<Python do runtime local> kids/tests/receipt-verify.py
```

O teste de integração cria seu próprio banco isolado, testa o fluxo público real e executa Playwright no Edge headless. Cobre pendente/pago/cancelado, atualização de pagamento, 001/1000, isolamento, sessão expirada, seletores indevidos, consulta por nome/telefone sem acesso, emissão sem escrita/consumo de número, PDFs administrativos completo e filtrado, download no navegador, clique duplo, carregamento, falha, nova tentativa, preservação de cartão e recarga. A verificação de PDF extrai texto e limites dos caracteres e renderiza as três páginas com Poppler. As três imagens foram inspecionadas visualmente, incluindo acentos e nome longo.

Resultados locais: `kids/tests/receipt-results.json` e `kids/tests/receipt-pdf-results.json`. PDFs e imagens de teste ficam em `tmp/pdfs/receipts/` e não devem ser enviados ao servidor.
