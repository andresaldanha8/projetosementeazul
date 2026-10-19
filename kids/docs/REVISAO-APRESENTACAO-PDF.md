# Apresentação dos PDFs — 18/10/2026

Alterado apenas `pdf/report.php`, compartilhado pelas exportações completa e filtrada: singular/plural por faixa; categorias Masculino/Feminino; telefone com DDD na exibição, seguindo o formatador administrativo (celular, fixo e prefixo 55 em celular); situações Registrada/Cancelada. Formatos de telefone não reconhecidos conservam a exibição original. Nenhuma consulta, filtro, cálculo de totais, número de peito ou dado armazenado foi alterado.

Validação independente do banco: `tests/pdf-presentation.php` gera quatro exemplos fictícios em memória, completos e filtrados com uma e duas inscrições, incluindo 001, 1000, ambos os sexos e cancelamento. `tests/pdf-presentation-verify.py` compara todas as células, totais, filtros, singular/plural, limites da página e paginação e renderiza as oito páginas com Poppler. Todas passaram; PNGs em `tmp/pdfs/presentation/` inspecionados visualmente, sem cortes ou sobreposições. As páginas de faixas vazias da lista completa foram preservadas. Expectativas dos verificadores anteriores foram adaptadas aos novos textos, sem executar suas suítes históricas dependentes do banco antigo.

Exemplos: `output/pdf/kids-lista-{completa,filtrada}-{uma,varias}-exemplo.pdf`. Evidências: `tests/pdf-presentation-results.json` e `tests/pdf-package-results.json`.

Pacotes regenerados: `output/kids-release-20261018.zip` e `output/kids-runtime-20261018.zip`. Manifesto e hashes conferidos; gerador nos dois ZIPs idêntico à fonte; integridade dos ZIPs aprovada; configuração de produção com `public_open=false` e declaração pendente preservada. Nenhuma configuração de abertura local foi incluída.

Preview 51179 sincronizado por `node kids/tests/manual-preview.cjs`, preservando abertura MANUAL-LOCAL-TEST somente no ambiente local, configuração, banco e sessões. Não houve limpeza, migração, inclusão de fixtures no banco ou publicação nesta etapa.
