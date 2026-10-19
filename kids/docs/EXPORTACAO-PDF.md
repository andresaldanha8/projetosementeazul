# Lista administrativa completa em PDF

A exportação completa permanece independente de filtros. O novo botão de exportação filtrada e sua validação estão documentados em [EXPORTACAO-FILTRADA-PDF.md](EXPORTACAO-FILTRADA-PDF.md).

Implementada exclusivamente na administração dedicada. O comprovante individual continua pendente e não faz parte desta etapa. Nada foi publicado e nenhum banco de produção foi acessado. Fonte kids/api/config.php continua com public_open=false e declaração nula.

## Comportamento e conteúdo

O botão **Baixar lista completa em PDF** exporta todas as inscrições da edição configurada, independentemente da faixa, busca, pagamento, tamanho de página ou página atual da interface. A frase “Inclui todas as faixas etárias e situações de pagamento” acompanha o botão. Enquanto gera, mostra “Gerando PDF…”, desabilita o botão e usa trava síncrona para cliques no mesmo ciclo. Falhas comuns têm mensagem própria e não apagam a listagem nem os filtros. Expiração/revogação segue o tratamento de autenticação já existente.

PDF A4 paisagem, com logo oficial, título solicitado, edição/data do evento e emissão em America/Sao_Paulo. Cada faixa possui tabela própria, com faixa e cabeçalho repetidos em cada página. Linhas não são divididas entre páginas. Número de peito ordenado numericamente, com pelo menos três dígitos; idade/faixa persistidas, categoria, criança, responsável/telefone, camisa e pagamento. Inscrição REGISTRADA/CANCELADA aparece em coluna própria, com cancelamento em texto e negrito, independente de cor. Não aparecem ID, tokens, nascimento completo nem auditoria.

Totais distinguem **ativas (REGISTRADA)**, **pendentes ativas**, **pagas ativas**, **canceladas** e **total incluindo canceladas**. As canceladas mantêm seu pagamento original na linha, mas não entram nos três totais de ativas. O código do evento vem de kids_eventos; data/nome do evento vêm da configuração exclusiva KIDS existente (a tabela atual não possui coluna de data). Nenhuma migration foi criada ou reaplicada.

## Consistência e proteção

- POST /kids/admin/api/export-pdf.php; somente sessão PSA_KIDS_ADMIN válida, administrador ativo e CSRF da própria sessão. Reutiliza kids_require_admin e sua verificação autoritativa de perfil, ativo, auth_version e troca obrigatória.
- Sessões pública e de atendimentos não autorizam a exportação. Nenhuma credencial ou usuário foi duplicado.
- Leitura em transação READ ONLY com REPEATABLE READ. A primeira consulta estabelece o snapshot do evento; todos os registros são obtidos sem LIMIT. Totais são calculados desse mesmo array. A transação termina antes da renderização, sem bloqueio de linhas nem transação aberta durante a geração.
- Um pagamento que confirme durante a leitura não mistura totais e linhas: aparece integralmente no próximo snapshot. Testado com duas conexões MariaDB reais e commit intercalado em um schema auxiliar criado exclusivamente para esse teste e removido depois. O schema manual não foi alterado por esse teste.
- HTML gerado pelo servidor com todos os dados escapados. Nenhum HTML, URL, filtro ou caminho enviado pelo cliente entra no template. Acesso remoto, execução PHP e JavaScript do renderizador estão desabilitados. Somente file:// e caminhos locais restritos ao logo/fontes são permitidos.
- PDF é gerado em memória e transmitido com application/pdf, attachment, no-store/private, Pragma/Expires e nosniff. Não é salvo pelo endpoint.
- O renderizador usa diretório aleatório 0700 no TEMP privado do PHP para arquivos auxiliares/fontes e remove seus arquivos no finally. Nenhum diretório temporário de PDF ficou após as verificações.
- kids/pdf/.htaccess bloqueia a biblioteca inteira via Apache. Helpers PHP recusam execução direta. O router local também bloqueia /kids/pdf/, pois PHP embutido não interpreta .htaccess. Em outro servidor, aplicar regra equivalente; não presumir proteção automática no Nginx.
- A instância e o banco do preview manual 51179 foram reutilizados. O sincronizador copia apenas implementação/assets/build, sem substituir configuração, banco ou sessões.

## Biblioteca e hospedagem

**Dompdf v3.1.6**, travado em kids/pdf/composer.lock. Versões transitivas:

| Pacote | Versão |
| --- | --- |
| dompdf/php-font-lib | 1.0.2 |
| dompdf/php-svg-lib | 1.0.2 |
| masterminds/html5 | 2.11.0 |
| sabberworm/php-css-parser | 9.5.0 |

Versão instalada compatível com PHP 8.2.12 local. Manifesto requer PHP ^8.2; extensões dom, mbstring e iconv, além de PDO/pdo_mysql e sessões já usados pela aplicação. libxml/fontes DejaVu acompanham requisitos/componentes da biblioteca. Composer check-platform-reqs passou; composer audit não encontrou avisos nas versões instaladas na consulta desta etapa.

Não é necessário GD para este relatório: kids/pdf/assets/logo.jpg é uma cópia de impressão com fundo branco derivada do logo oficial img/logo.png, sem substituir o original. Dompdf incorpora JPEG e as fontes locais; não usa serviços de conversão remotos. Necessário diretório temporário privado gravável e permissões de leitura para vendor/fontes/assets. Recomenda-se display_errors=Off para respostas binárias. Composer/Node não precisam estar na hospedagem se o pacote já levar vendor e o build compilado.

Referências oficiais consultadas: [Dompdf README](https://github.com/dompdf/dompdf/blob/master/README.md), [releases](https://github.com/dompdf/dompdf/releases), [correção 3.1.6](https://github.com/dompdf/dompdf/security/advisories/GHSA-cx96-42px-69fm). Não usar versões antigas vulneráveis. O lock torna a instalação reproduzível; alterações de versão devem passar por nova validação.

## Pacote de publicação futuro

Na máquina de preparação, executar na raiz do projeto:

```powershell
composer install --working-dir=kids/pdf --no-dev --prefer-dist --optimize-autoloader --no-interaction --no-scripts
composer check-platform-reqs --working-dir=kids/pdf --no-dev
npm.cmd --prefix kids/admin-app run build
```

Incluir:

- kids/admin/api/export-pdf.php e bootstrap/endpoints existentes;
- kids/pdf/report.php, .htaccess, composer.json, composer.lock e assets/logo.jpg;
- **kids/pdf/vendor/ inteiro**, incluindo autoload.php, composer/, cinco pacotes, fontes DejaVu e licenças. Embora ignorado pelo Git, é dependência obrigatória no servidor; não enviar apenas o pacote dompdf isolado;
- kids/admin/dist/ completo, index.php administrativo e dependências compartilhadas já existentes.

Excluir do pacote público: kids/tests/, kids/docs/, kids/admin-app/, output/, tmp/, node_modules, previews/estado local, logs, arquivos de sessão e credenciais locais. Migrations permanecem no pacote operacional separado, sem reaplicação. Os exemplos em output/pdf e evidências de testes não são arquivos do endpoint e possuem bloqueio HTTP adicional. Nenhuma publicação foi feita nesta etapa.

## Testes executados

1. pdf-browser.cjs, usando apenas o preview 51179: exportação desktop e 320px, download real, lista completa apesar de busca sem resultados/filtro/aba ativos, carregamento e dois cliques gerando uma requisição; 500 simulado sem perda de lista; anônimo/público/atendimentos recusados; CSRF ausente recusado; implementação privada bloqueada. Snapshot de todas as inscrições, pagamentos, auditoria, idempotência e contadores idêntico antes/depois. Inscrição 1064 e auditoria preservadas também pelo verificador do preview.
2. pdf-report-test.php: ordenação 001/1000, outra edição excluída, canceladas pagas/pendentes, nomes longos/acento/markup, idade persistida com emissão em 2035, falha de renderização sem alteração de linhas e snapshot com pagamento simultâneo. Schema auxiliar novo e isolado; nenhum registro manual modificado.
3. pdf-verify.py: comparação de **todas as nove células de todas as 74 linhas** com o banco; 27 na faixa 4–7, 25 na 8–10 e 22 na 11–14. Totais: 73 ativas, 46 pendentes ativas, 27 pagas ativas, 1 cancelada, 74 incluindo canceladas. Verificados cabeçalhos, ordem, páginas X de 6, logo, margens, linhas inteiras, acentos e ausência dos campos proibidos. Registros além da primeira página da interface foram incluídos.
4. PDF real de exemplo renderizado por Poppler: **todas as seis páginas inspecionadas visualmente**. Documento auxiliar de nomes longos/cancelamentos: suas três páginas também inspecionadas. Sem cortes/linhas sobrepostas. Resultado tem textos explícitos e contraste suficiente para preto e branco.
5. Apache isolado: 12 rotas privadas recusadas com 403 (incluindo kids/pdf), asset público 200. PHP lint, build KIDS, TypeScript, Composer platform requirements e auditoria de dependências aprovados.

Reproduzir a validação (runtime Python/Poppler pode ser substituído por instalação equivalente):

```powershell
node kids/tests/manual-preview.cjs
node kids/tests/pdf-browser.cjs
$previewPdf = Get-Content kids/tests/manual-preview.json -Raw | ConvertFrom-Json
C:/xampp/php/php.exe kids/tests/pdf-report-test.php $previewPdf.root
# Python com pdfplumber:
python kids/tests/pdf-verify.py
```

Exemplo completo: output/pdf/kids-lista-completa-exemplo.pdf. Capturas: kids/tests/screenshots/pdf-admin-desktop.png e pdf-admin-mobile.png. Renderizações e layout auxiliar: kids/tests/pdf-pages/. Resultados JSON em kids/tests/pdf-browser-results.json, pdf-report-results.json e pdf-verify-results.json. Amostra integral tem 74 linhas e seis páginas, exatamente como o banco isolado no momento da exportação.

## Arquivos da etapa e limites

Criados: endpoint export-pdf.php; kids/pdf/ com renderer, manifesto/lock, logo e bloqueio; testes pdf-browser.cjs, pdf-report-test.php, pdf-verify.py; exemplos/resultados/renderizações; bloqueios de output/pdf e tmp/pdfs; este documento.

Alterados: kids/admin-app/src/KidsPage.tsx e api.ts; build kids/admin/dist/; kids/.gitignore; sincronização manual-preview.cjs; cópia da biblioteca/router em dedicated_integration.php; verificação HTTP em http-security.cjs. O fluxo público, as migrations e o dashboard de atendimentos não foram alterados.

Limitações: HTTP local e dados fictícios; sem TLS ou validação da hospedagem final. A geração precisa manter a edição em memória; tempo/memória de edições muito maiores que a amostra não foram submetidos a teste de carga. Não há certificado de ausência absoluta de bugs. O comprovante individual continua fora do escopo.

Preview preservado: http://127.0.0.1:51179/kids/admin/ ; iniciar/retomar com node kids/tests/manual-preview.cjs. Usuário fictício admin.teste / KidsTeste!2026. Inscrições reais seguem bloqueadas.
