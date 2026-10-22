# PIX no modal de consulta KIDS

Atualização manual na Hostinger (backend antes do frontend):

1. `kids/api/lookup-record.php` — novo serializador público com lista explícita de campos.
2. `kids/api/lookup.php` — lê valor persistido e nome canônico do registro e usa o serializador.
3. `kids/lookup.js` — opções PIX, cópia, alternativa manual, WhatsApp e limpeza entre buscas.
4. `kids/kids.css` — ajustes compactos e responsivos do pagamento no modal.
5. `kids/index.html` — área de pagamento do resultado e versões de cache de CSS/consulta.

Dependência: `kids/api/pix.php`, gerador da etapa anterior, deve estar instalado. Se ainda não foi enviado, enviá-lo antes de `lookup-record.php`. Para instalar também o PIX nos cartões de confirmação, seguir a lista da etapa anterior em `PIX-COPIA-E-COLA.md` (`records.php` e `kids.js`).

Não substituir configurações privadas ou `config.php`. Preservar `public_open` e demais configurações de produção. Usar a configuração PIX/CNPJ/favorecido já corrigida na etapa anterior. Não executar SQL nem enviar os arquivos de teste.

A consulta mantém POST, validação, CSRF, limites por IP/sessão, consulta independente do proprietário original e leitura atual no servidor sem cache. A resposta continua sem telefone, responsável, referência, owner/hash ou dados para acesso ao PDF. Somente para `REGISTRADA` + `PENDENTE` inclui um objeto `payment`: valor em centavos, CNPJ público, favorecido, BR Code e URL WhatsApp com nome da criança consultada, número e valor. O nome da criança é retornado em `child_name`, exibido no resultado da consulta e incluído na mensagem do WhatsApp. Os demais dados pessoais e identificadores privados continuam excluídos da resposta. Paga/cancelada não recebem o objeto de pagamento. O PDF e seus controles de acesso não foram alterados. Copiar ou enviar o comprovante não confirma pagamento.

Resultado e código são apagados ao editar campos, reenviar, fechar/reabrir o modal ou ocorrer erro. A edição cancela consultas em andamento, e respostas anteriores não podem repor opções de pagamento.

Testes executados sem banco:

- `node kids/tests/lookup-pix.cjs`: serializador PHP real com fixtures e transporte simulado no navegador; whitelist de dados, pendente/paga/cancelada, valores persistidos R$ 60,00 e R$ 75,43, leitura independente do BR Code/CRC, WhatsApp com nome/número/valor corretos, clipboard real e alternativa manual selecionável, limpeza ao editar/reenviar, falha de rede, resposta 429, descarte de resposta atrasada, validação local e CSRF enviado com sessão nova. Viewports 1024 e 320 px, sem overflow horizontal e com rolagem interna no modal em 320 px.
- `node kids/tests/pix.cjs`: regressão do cartão em criação, recuperação, recuperação após falha e emulação móvel; clipboard, fallback, valor persistido e ausência de opções em pagamento confirmado; leitor independente do payload/CRC.
- `php kids/tests/domain_test.php`: 21 verificações de domínio.
- PHP lint de `lookup.php` e `lookup-record.php`, sintaxe JavaScript e `git diff --check`.

Os guardas de autorização, validação e limitação do endpoint foram preservados por revisão do diff. Os testes desta etapa não acessaram o endpoint com banco real e não afirmam validação bancária ou teste em aparelho físico. Nada publicado, nenhum ZIP e nenhuma alteração de registros, pagamentos ou numeração.
