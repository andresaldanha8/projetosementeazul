# Homologação manual única

> Preview histórico preservado. A arquitetura independente é validada em ambiente separado conforme [INSTALACAO-INDEPENDENTE.md](INSTALACAO-INDEPENDENTE.md). O comando abaixo agora recusa sincronizar APIs incompatíveis com esse banco legado; não converter, limpar ou copiar seus usuários.

A administração inclui agora a lista completa em PDF. Dependências, publicação futura e testes: [EXPORTACAO-PDF.md](EXPORTACAO-PDF.md). O comando manual também sincroniza o endpoint, biblioteca privada e build administrativo, preservando banco, configuração e sessões.

Na raiz do projeto, execute somente:

```powershell
node kids/tests/manual-preview.cjs
```

O comando adotou o ambiente já ativo em **http://127.0.0.1:51179**, com o mesmo banco isolado na porta 51178 e datadir temporário kids-dedicated-3cde8194389b/db. Não criou banco ou nova instância. Inscrição 1064, pagamento CONFIRMADO e sua auditoria foram verificados antes/depois e preservados.

- Início: http://127.0.0.1:51179/
- Formulário: http://127.0.0.1:51179/kids/?nova=1
- Administração: http://127.0.0.1:51179/kids/admin/
- Usuário fictício: admin.teste / KidsTeste!2026.

O estado local fica em kids/tests/manual-preview.json (ignorado pelo Git). Se HTTP e banco já estiverem ativos, o comando apenas verifica a identidade e informa os endereços. Se estiverem parados, retoma os mesmos executáveis sobre o datadir existente e a porta preferencial 51179, sem inicializar banco ou executar SQL/migrations. Porta ocupada por serviço diferente produz erro explícito, sem matar processos ou escolher outra porta. O datadir do MySQL é verificado antes do uso. Se o estado/dados temporários desaparecerem, o comando falha; não recria silenciosamente a inscrição manual.

Somente index.html, kids.css, kids.js e lookup.js públicos são sincronizados para a cópia de preview. Configuração PHP, banco e sessões não são substituídos. Os links e endpoints de aplicação continuam relativos ao domínio; a porta fixa aparece somente em ferramentas/documentos de homologação.

Inscrições abertas apenas nessa cópia TEST-ONLY, com relógio de inscrição fictício herdado do teste. A configuração fonte permanece bloqueada. Testes, docs, arquivos de estado e ferramentas CLI permanecem fora do pacote de publicação. O helper manual-db.php é somente leitura e recusa execução HTTP.

## Previews anteriores identificados, sem desativação

Todos os endereços abaixo usam 127.0.0.1. Cada par HTTP corresponde aos dois workers do runner de teste, compartilhando um banco. Os processos foram identificados por CommandLine, datadir e porta; não foram encerrados nem removidos.

| HTTP | Banco | Diretório temporário | Finalidade identificada |
| --- | --- | --- | --- |
| 63122 / 63123 | 63121 | kids-integration-1b60e71f2e14 | Regressão e preview público da reorganização |
| 63322 / 63323 | 63321 | kids-dedicated-6f9726241ad2 | Administração dedicada após separação física |
| 63191 / 63192 | 63190 | kids-dedicated-33d3a4d32394 | Reprodução dos bugs de Atualizar, build anterior |
| 53318 / 53319 | 53317 | kids-dedicated-7e4b5d9b4d76 | Primeira validação integrada; tentativa intermediária |
| 56472 / 56473 | 56471 | kids-dedicated-d9bf3546fb3a | Validação integrada; tentativa com bloqueio de fontes |
| 56479 / 56480 | 56478 | kids-dedicated-51c1ea8fa6ef | Suítes HTTP e navegador administrativas |
| 61524 / 61525 | 61523 | kids-dedicated-947a803c00de | Regressão integrada anterior ao último ajuste de mensagem |
| 51179 / 51180 | 51178 | kids-dedicated-3cde8194389b | **Ambiente preservado; 51179 é o único endereço manual.** 51180 é worker auxiliar antigo |

Os sete primeiros ambientes e o worker auxiliar 51180 estão listados para avaliação/desativação posterior. O banco 51178 contém a inscrição manual 1064 e deve ser preservado. Nenhuma ação de desligamento/limpeza foi executada.

## Ajustes visuais e validação focada

Arquivos de aplicação: kids/index.html (texto curto do modal e nota neutra dos cartões), kids/kids.css (modal compacto e cores), kids/kids.js (data-status no rótulo de pagamento). lookup.js, API e permissões não foram alterados.

Modal: largura máxima 500px; padding 22px no desktop/20px em 320px; campos 46px com fonte 16px; botões 44px; espaçamento 12px; resultado compacto em duas colunas com número em destaque. Em tela de 320px há ao menos 12px de margem lateral. Altura limitada a 100dvh - 24px com rolagem interna.

Foram executados seis grupos de verificações focadas em manual-ui.cjs: links no mesmo domínio; consulta real da 1064 no desktop e 320px; edição após resultado; Tab/Shift+Tab contidos; Escape e retorno ao botão; rolagem interna em 320×420; cores e instruções por cartão; preservação da 1064 e auditoria. Sem repetir a suíte completa.

Para os cartões mistos, a resposta de confirmações foi interceptada somente no navegador automatizado com fixtures derivadas de registros já existentes (1064 pago e 1062 pendente), sem assumir o cookie do usuário ou alterar o banco. O modal consultou a API real da 1064. Confirmado fica verde, pendente amarelo. Instruções PIX/comprovante permanecem apenas no cartão pendente; a nota compartilhada é neutra. Nenhum erro JavaScript de página nos testes.

Capturas em kids/tests/screenshots/: manual-lookup-desktop.png, manual-lookup-320.png, manual-lookup-320-scroll.png e manual-payment-mixed.png. Métricas e resultados em kids/tests/manual-ui-results.json. Reuso do comando executado repetidamente sobre o preview ativo. O ramo de retomada após parada foi revisado, mas não foi necessário interromper o ambiente do usuário para exercitá-lo.

Limitações: a persistência usa o datadir temporário existente; limpeza do TEMP pode removê-lo. Não houve teste de reinicialização do Windows, TLS ou hospedagem de produção. Nada publicado; sem PDF.
