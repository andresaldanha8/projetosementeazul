# Limpeza manual dos testes KIDS

Não foi executado nada em produção. O SQL é uma operação manual de dados, não uma migration. Alvo exclusivo: `u330320079_kids`. O código local não distingue inscrição real de teste: o arquivo remove TODAS as inscrições, auditorias e idempotências desse banco, em todas as edições. Só usar se todas forem descartáveis. O contador reiniciado é somente o de `AUTISMO-RUN-2026-KIDS`.

## Dependências conferidas no esquema local atual

- `kids_auditoria.inscricao_id` referencia `kids_inscricoes.id`.
- `kids_auditoria.usuario_id` referencia `kids_administradores.id`. Excluir a auditoria não exclui seu administrador.
- `kids_idempotencia.inscricao_id` referencia `kids_inscricoes.id` e pode ser NULL.
- `kids_idempotencia.evento_id` e `kids_inscricoes.evento_id` referenciam `kids_eventos.id`.

Ordem: auditorias, idempotências (inclusive sem inscrição vinculada), inscrições, atualização de `proximo_numero`. Não usa TRUNCATE, ALTER TABLE, reinício de AUTO_INCREMENT ou desativação de FKs. Administradores, hashes de senha, versões de autenticação, tabelas de limites e configurações do evento permanecem intactos. Apenas `proximo_numero` da edição indicada muda. Não há acesso ao sistema de atendimentos.

## Procedimento

1. Manter `public_open=false` em produção, suspender ações administrativas que gravem e aguardar requisições em andamento terminarem. O fechamento público ainda permite replay idempotente no código atual, por isso aguardar e invalidar sessões também faz parte do procedimento.
2. Exportar o banco KIDS completo no phpMyAdmin e guardar o backup fora da pasta pública do site.
3. Executar somente a ETAPA 1 do SQL. Confirmar banco, contagens, edição e engines InnoDB. Conferir as FKs reais com a lista acima. Se houver tabelas/dependências adicionais ou inscrições reais, parar e revisar. A conferência local não substitui essa checagem do esquema de produção.
4. Preparar a invalidação pública descrita abaixo para aplicá-la imediatamente após a limpeza, mantendo a abertura desativada. Essa alteração manual não foi aplicada ao arquivo local nem publicada.
5. Executar a ETAPA 2 inteira, em uma única requisição do phpMyAdmin, com interrupção em erros. Não separar START TRANSACTION e COMMIT em submissões diferentes. A guarda `autorizada` deve retornar 1. Em erro, não continuar até COMMIT: na conexão ainda aberta executar ROLLBACK; se a conexão foi encerrada, a transação InnoDB não confirmada é revertida. Repetir as conferências antes de tentar de novo. Não reaplicar cegamente um bloco após resultado incerto: conferir primeiro.
6. Executar a ETAPA 3. Esperado: inscrições/idempotências/auditorias = 0, administradores com a mesma contagem, edição alvo com `proximo_numero=1`, IDs internos sem reinicialização. DELETE não promete eliminar lacunas nem restaurar números de AUTO_INCREMENT consumidos anteriormente.
7. Aplicar a invalidação pública abaixo em todas as instâncias, ainda com abertura desativada, e aguardar requisições do código anterior terminarem. Depois validar com um navegador que tinha inscrição de teste: os registros antigos não retornam; uma URL antiga de PDF deve receber 401 ou 404. Um cartão já aberto pode permanecer desenhado até a atualização da página, mas não deve obter novamente o PDF. PDFs já baixados não são revogados pela limpeza.
8. Só reabrir depois de concluir a limpeza, a invalidação e as conferências. Não criar uma inscrição real em produção apenas para testar, pois consumiria um número.

## Invalidar somente sessões públicas KIDS antes da reabertura

SQL não apaga sessões PHP. O `owner` aleatório da sessão determina o `owner_hash`; os IDs internos e números de peito não autorizam consultas ou PDFs. Apagar as linhas elimina o acesso aos registros antigos, mas uma sessão antiga ainda válida poderia criar novas inscrições em seu próprio owner após a reabertura. Para excluir também essa possibilidade de reutilização, é necessário invalidar a sessão pública no servidor.

Opção recomendada: uma versão fixa do ciclo de sessões públicas em `kids/api/http.php`, dentro de `kids_public_session()`. Não mudar credenciais, configurações do evento, sessão administrativa ou diretório global de sessões.

Imediatamente depois de `session_start();`, antes de verificar expiração, inserir:

```php
// Valor fixo para esta limpeza. Manter igual em todas as requisicoes.
$publicEpoch = 'kids-public-pos-limpeza-testes-2026-10-v1';
if (($_SESSION['kids_public_epoch'] ?? null) !== $publicEpoch) {
    $_SESSION = [];
}
```

Na atribuição que cria a nova sessão, incluir o campo de versão, preservando a regeneração do ID e os demais campos:

```php
session_regenerate_id(true);
$_SESSION = [
    'owner' => bin2hex(random_bytes(32)),
    'csrf' => bin2hex(random_bytes(32)),
    'expires' => time() + kids_config()['session_seconds'],
    'kids_public_epoch' => $publicEpoch,
];
```

Manter essa validação e esse valor após a limpeza. Não usar time() ou um valor aleatório como versão a cada requisição. Em uma futura invalidação, escolher outro valor fixo. Ativar esta versão depois do COMMIT da limpeza e antes da reabertura, em todas as instâncias que atendem KIDS. Assim, inclusive sessões abertas durante a janela de limpeza usando o código antigo são invalidadas. Aguardar as requisições do código anterior terminarem antes de reabrir. A sessão antiga sem a versão é esvaziada na primeira requisição; endpoints protegidos negam acesso, e `session.php` cria um novo owner, CSRF e generation. A recuperação do formulário já compara generation e impede repetir silenciosamente um envio pendente da sessão antiga.

Trocar só o nome do cookie não é suficiente para invalidar registros de sessão no mesmo armazenamento. Não apagar indiscriminadamente `sess_*`: isso pode desconectar atendimentos ou administradores. Limpar cookies no seu navegador afeta somente aquele navegador. A expiração atual é de oito horas, mas esperar oito horas sem bloquear novas sessões não é uma invalidação global.

Este guia descreve a alteração manual adicional necessária: não foi aplicada automaticamente e não há arquivo PHP alterado nesta entrega. O SQL, sozinho, não oferece invalidação de sessões.

## Validação realizada

SQL executado somente em MariaDB local com datadir novo e dados fictícios: COMMIT, ROLLBACK, banco selecionado incorreto, duas edições, idempotência sem inscrição, preservação integral dos administradores e das tabelas de limites, preservação dos AUTO_INCREMENT e FKs ativas. Confirmado que só o contador da edição alvo volta a 1.

Os dois trechos PHP deste guia foram aplicados a uma cópia temporária de `http.php` e testados com sessões sintéticas: leitura com sessão antiga negada, novo owner e ID ao recriar a sessão e persistência da sessão com a nova versão nas requisições seguintes. Nenhum arquivo PHP da aplicação foi modificado para esta entrega.
