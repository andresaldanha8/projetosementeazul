# Correção de apresentação da imagem — atualização sem configuração

## Causa e evidências

O responsável confirmou que a resposta `registrations.php` recebida na administração para a inscrição 004 **não contém `imagem_autorizada`**, embora a consulta somente leitura do banco tenha mostrado 1. Não acessamos produção ou o banco remoto.

Na tela anterior, `value === null ? 'Não informado' : Number(value) === 1 ? 'Autorizado' : 'Não autorizado'` classificava `undefined` como recusa (`Number(undefined)` é NaN). Esse é o defeito de apresentação reproduzido. O bundle anterior `index-rnqPml0X.js` contém exatamente essa condição. Foi reproduzida a recusa incorreta com esse bundle e uma resposta em que somente o campo da linha autorizada foi omitido no navegador, sem modificar o banco de teste.

O mesmo código anterior já reconhecia 1, "1" e true como autorizado. Esses tipos não explicam o caso confirmado. A fonte local do endpoint anterior selecionava o campo, `api.ts` não o removia e o build anterior coincidia com a fonte. Portanto, a resposta observada em produção está incompatível com esse contrato local. Arquivo antigo, caminho/roteamento para outra cópia ou versões publicadas diferentes devem ser conferidos no destino; sem acessá-lo, não identificamos qual arquivo físico estava sendo servido. Ctrl+F5 não adiciona um campo ausente na resposta da API.

## Correção mínima

- `registrations.php` conserva o SELECT e os filtros; serializa explicitamente `imagem_autorizada` como booleano true/false ou null. Dados inesperados geram falha da lista, nunca uma recusa presumida. Respostas válidas incluem `X-Kids-Image-Contract: 1` para identificação da API atualizada.
- `api.ts` define o tipo de registro e normaliza estritamente os formatos legados 1/"1"/true e 0/"0"/false, além de null. Campo ausente ou inválido vira estado distinto, indisponível; não usa coerção genérica de números ou booleanos.
- A tela usa o estado normalizado: Autorizado, Não autorizado, Não informado (null explícito) ou Informação indisponível (contrato ausente/inválido).
- Não há alteração de dados, migrations, captura da opção, pagamento, auditoria, numeração, PDFs, credenciais ou configuração de abertura.

## Arquivos exatos para substituir

Usar **somente `kids-image-admin-fix-20261018.zip`**, cujo conteúdo é:

1. `kids/admin/api/registrations.php`
2. `kids/admin/dist/index.html`
3. `kids/admin/dist/assets/index-U4hdTJVS.js`
4. `kids/admin/dist/assets/index-UlaFfeC_.css`

O ZIP de correção não contém `kids/api/config.php`, `kids/config/database.local.php`, SQL, credenciais, registros ou ferramentas de administrador. **Preservar integralmente a configuração aberta de produção e a conexão privada. Não enviar o runtime completo sobre o site existente.**

Os ZIPs completos runtime/release também são regenerados para consistência do código preparado, mas contêm a configuração local fechada para instalação nova. Não devem ser usados como atualização integral desta produção aberta. O release inclui esta orientação e `ARQUIVOS-CORRECAO-ADMIN-IMAGEM.json` com hashes e arquivos a preservar. O roteiro anterior de autorização/migration 006 não deve ser repetido para esta correção.

Antes da substituição manual, fazer backup dos quatro arquivos existentes. Enviar primeiro o endpoint e os dois assets e, por último, `kids/admin/dist/index.html`. Não alterar `kids/admin/index.php`: ele já entrega esse HTML. Não apagar assets antigos durante a conferência. O CSS tem o mesmo nome/conteúdo do build anterior e é incluído para garantir o conjunto completo. Nenhum arquivo de atendimentos deve ser substituído.

## Confirmar a inscrição 004 sem mudar seus dados

1. Entrar normalmente na administração e abrir as ferramentas do navegador, aba Rede, com cache desabilitado. Recarregar a página; não confirmar pagamento, editar dados ou criar inscrição.
2. Conferir que o HTML de `/kids/admin/` referencia `/kids/admin/dist/assets/index-U4hdTJVS.js`, que responde 200. O shell deve usar o HTML novo e o JS de mesmo nome. Comparar os hashes com o manifesto quando houver acesso aos arquivos do servidor.
3. Localizar 004 pela busca existente e clicar Atualizar. Na resposta da requisição administrativa `registrations.php`, conferir que a linha de `numero_peito` 4 contém **`imagem_autorizada: true`**, a versão `KIDS-IMAGEM-2026-v1` e o horário já gravado. O cabeçalho deve conter **`X-Kids-Image-Contract: 1`**. A tela deve mostrar Autorizado; repetir Atualizar e recarregar para confirmar persistência visual.
4. Se o campo continuar ausente ou o cabeçalho não aparecer, a API corrigida não está sendo servida nesse caminho. Conferir o document root, `/kids/admin/api/registrations.php` e caches PHP/OPcache pelos meios do provedor. Não mudar a inscrição ou o banco para compensar arquivo antigo. Com o JS novo, a ausência deve aparecer como Informação indisponível.
5. Se o JSON trouxer true e a tela ainda indicar recusa, conferir o JS efetivamente carregado e seu hash. Se trouxer false/null, registrar apenas o tipo/valor e a versão do endpoint para investigar a leitura/conexão; não executar UPDATE e não enviar dados pessoais ou credenciais ao chat.

A consulta pública não recebe a escolha e não serve para validar este campo. Confirmar somente pela resposta administrativa autenticada e sua interface.

## Testes locais executados

Evidências: `kids/tests/image-contract-baseline.json`, `image-contract-results.json` e `image-contract-browser-results.json`.

O teste dedicado cria esquema mínimo/fixtures em datadir novo de MariaDB e usa uma cópia **idêntica** de `kids/api/database.php` para reproduzir as opções PDO reais. Não executa arquivos de migrations nem acessa o arquivo privado do projeto. Registra tipos PHP e atributos disponíveis do driver, verifica GET/POST/lista individual no endpoint real e o contrato true/false/null. A conta MySQL só acessa o schema de teste.

Passaram **14 verificações de integração e 19 verificações no navegador**, além de typecheck, build e lint. Neste runtime local (mysqlnd 8.2.12/MariaDB 10.4.32), `ATTR_EMULATE_PREPARES` retornou 0 e o modo de fetch 2 (associativo). Os valores vindos do PDO foram inteiros 1/0 e NULL, confirmando que esse cenário não perde o campo ou produz a divergência por si só. O getter de `ATTR_STRINGIFY_FETCHES` não é suportado por esse driver; não foi alterado para o teste. A execução utilizou exatamente as opções do arquivo de conexão entregue, sem presumir a configuração do driver da Hostinger.

No Edge/Playwright, verifica as três situações com resposta real, Atualizar e reload; compara os assets servidos com os bytes do build; exercita 1, "1", true, 0, "0", false, null, campo ausente e valores inválidos alterando somente a resposta no navegador. Reproduz a falha com o bundle anterior. Ao terminar, snapshots comprovam que registros, administrador, pagamentos, auditoria e contador das fixtures não mudaram. Typecheck, build e lint do endpoint também são executados. Nenhuma requisição de inscrição, pagamento ou alteração de conta é feita pelo teste.
