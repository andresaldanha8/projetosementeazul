# Atualização manual do PIX KIDS

Enviar estes arquivos para os mesmos caminhos na Hostinger, com o backend primeiro:

1. `kids/api/pix.php` (novo gerador estático BR Code)
2. `kids/api/records.php` (inclui `pix_payload` nas confirmações)
3. `kids/kids.js` (copia o payload da respectiva inscrição; alternativa manual)
4. `kids/index.html` (renova a versão de cache do JavaScript)

Não é necessário substituir `config.php` nesta etapa se a correção anterior já foi aplicada. Conferir somente os campos públicos de pagamento de `kids/api/config.php` em produção: `pix` deve ser `62.090.680/0001-39` e `payee`, `Associação Projeto Semente Azul`. Se faltarem essas correções, editar apenas esses campos. Preservar `public_open`, configurações privadas e todas as demais configurações de produção. Não enviar arquivos de teste ou executar SQL.

O payload usa `valor_centavos` da linha persistida, não o preço vigente da configuração. É calculado durante a serialização das confirmações, abrangendo criação, replay idempotente e recuperação, sem gravar no banco. Usa TLV EMV, GUI `br.gov.bcb.pix`, CNPJ sem máscara, moeda 986, país BR, valor decimal e CRC16/CCITT-FALSE incluindo `6304`. O txid `***` mantém a conferência administrativa manual. Não confirma pagamentos nem muda inscrições, numeração ou registros. Não inclui imagem de QR Code.

Somente dentro do payload: nome ASCII abreviado `ASSOC PROJ SEMENTE AZUL` (limite 25) e cidade `VITORIA XINGU` (abreviação de Vitória do Xingu, limite 15; UF não integra esse campo). A página mantém o favorecido completo com acentos e o CNPJ formatado. O WhatsApp permanece o mesmo.

Validação local: `node kids/tests/pix.cjs` e `php kids/tests/domain_test.php`. Nenhum acesso ao banco nos testes executados. Leitor TLV/CRC independente em JavaScript, sem reutilizar o gerador PHP, conferido com o exemplo estático do Banco Central (CRC 1D3D) e vetor CRC `123456789` (29B1). Verificados chave, valores 60,00 / 75,43 / 0,01 / 1.234.567,89, limites ASCII e rejeição de CRC adulterado; inscrições novas, recuperadas e recuperação após falha; cópia real do clipboard, fallback selecionável e ausência de bloco PIX em cartões pagos. Emulação móvel Chromium/Edge 390×844, com toque, cópia, seleção e ausência de rolagem horizontal. Não houve teste em aparelho físico ou validação em aplicativo bancário.

Referência: [Manual de Padrões para Iniciação do Pix, Banco Central, seção 2.6](https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualdePadroesparaIniciacaodoPix.pdf).
