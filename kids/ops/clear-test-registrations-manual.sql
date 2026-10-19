-- EXECUCAO MANUAL EXCLUSIVA NO BANCO u330320079_kids.
-- Nao e migration. Nao importar antes de ler o guia correspondente.
-- Pressuposto: TODAS as inscricoes deste banco sao testes descartaveis.
-- Fazer exportacao SQL do banco antes. Manter abertura publica desativada.
-- Suspender tambem alteracoes administrativas e aguardar requisicoes em andamento.

-- ETAPA 1: executar apenas estas conferencias primeiro.
USE `u330320079_kids`;
SELECT DATABASE() AS banco_selecionado;
SELECT TABLE_NAME, ENGINE, AUTO_INCREMENT
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'u330320079_kids'
ORDER BY TABLE_NAME;

-- Conferir todas as FKs que saem ou chegam neste banco, inclusive de outro schema.
-- Se houver dependencia diferente das descritas no guia, PARAR e revisar.
SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME,
       REFERENCED_TABLE_SCHEMA, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_NAME IS NOT NULL
  AND (TABLE_SCHEMA = 'u330320079_kids'
       OR REFERENCED_TABLE_SCHEMA = 'u330320079_kids')
ORDER BY TABLE_SCHEMA, TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION;

SELECT e.id, e.codigo, e.proximo_numero,
       (SELECT COUNT(*) FROM `u330320079_kids`.kids_inscricoes i WHERE i.evento_id=e.id) AS inscricoes,
       (SELECT COUNT(*) FROM `u330320079_kids`.kids_idempotencia d WHERE d.evento_id=e.id) AS idempotencias
FROM `u330320079_kids`.kids_eventos e ORDER BY e.id;
SELECT COUNT(*) AS auditorias FROM `u330320079_kids`.kids_auditoria;
SELECT COUNT(*) AS administradores FROM `u330320079_kids`.kids_administradores;

-- ETAPA 2: depois de conferir a etapa 1, selecionar e executar TODO este bloco
-- de START TRANSACTION ate COMMIT de uma vez, na mesma requisicao do phpMyAdmin.
-- Nao executar COMMIT se algum comando falhar. Nao usar opcao para ignorar erros.
-- Para ensaio sem persistir, substituir o COMMIT final por ROLLBACK e executar
-- o bloco inteiro. Uma segunda requisicao do phpMyAdmin nao preserva a transacao.
START TRANSACTION;

-- Mesmo bloqueio usado pelo fluxo de criacao de inscricoes.
SELECT id, codigo, proximo_numero
FROM `u330320079_kids`.kids_eventos ORDER BY id FOR UPDATE;

-- Guarda adicional contra banco selecionado incorreto, evento ausente e
-- engine sem suporte a rollback. Se autorizada=0, nenhuma alteracao sera feita.
SET @kids_limpeza_autorizada = (
    DATABASE() = 'u330320079_kids'
    AND (SELECT COUNT(*) FROM `u330320079_kids`.kids_eventos
         WHERE codigo='AUTISMO-RUN-2026-KIDS') = 1
    AND (SELECT COUNT(*) FROM information_schema.TABLES
         WHERE TABLE_SCHEMA='u330320079_kids' AND ENGINE='InnoDB'
           AND TABLE_NAME IN ('kids_eventos','kids_inscricoes','kids_idempotencia',
                              'kids_auditoria','kids_administradores')) = 5
);
SELECT @kids_limpeza_autorizada AS autorizada;

SELECT 'antes' AS momento,
       (SELECT COUNT(*) FROM `u330320079_kids`.kids_inscricoes) AS inscricoes,
       (SELECT COUNT(*) FROM `u330320079_kids`.kids_idempotencia) AS idempotencias,
       (SELECT COUNT(*) FROM `u330320079_kids`.kids_auditoria) AS auditorias,
       (SELECT COUNT(*) FROM `u330320079_kids`.kids_administradores) AS administradores;

-- Tabelas filhas primeiro. A FK de usuario_id nao exige excluir administradores.
DELETE FROM `u330320079_kids`.kids_auditoria
WHERE @kids_limpeza_autorizada = 1;
SELECT ROW_COUNT() AS auditorias_excluidas;

-- Inclui tentativas de idempotencia com inscricao_id NULL.
DELETE FROM `u330320079_kids`.kids_idempotencia
WHERE @kids_limpeza_autorizada = 1;
SELECT ROW_COUNT() AS idempotencias_excluidas;

DELETE FROM `u330320079_kids`.kids_inscricoes
WHERE @kids_limpeza_autorizada = 1;
SELECT ROW_COUNT() AS inscricoes_excluidas;

-- 1 e exibido como 001 pela aplicacao. Nenhum AUTO_INCREMENT e alterado.
-- Outros eventos, se existirem, preservam seus contadores.
UPDATE `u330320079_kids`.kids_eventos SET proximo_numero = 1
WHERE codigo = 'AUTISMO-RUN-2026-KIDS'
  AND @kids_limpeza_autorizada = 1
  AND NOT EXISTS (SELECT 1 FROM `u330320079_kids`.kids_inscricoes)
  AND NOT EXISTS (SELECT 1 FROM `u330320079_kids`.kids_idempotencia)
  AND NOT EXISTS (SELECT 1 FROM `u330320079_kids`.kids_auditoria);

SELECT 'apos_exclusao_na_transacao' AS momento,
       (SELECT COUNT(*) FROM `u330320079_kids`.kids_inscricoes) AS inscricoes,
       (SELECT COUNT(*) FROM `u330320079_kids`.kids_idempotencia) AS idempotencias,
       (SELECT COUNT(*) FROM `u330320079_kids`.kids_auditoria) AS auditorias,
       (SELECT COUNT(*) FROM `u330320079_kids`.kids_administradores) AS administradores;
SELECT id, codigo, proximo_numero FROM `u330320079_kids`.kids_eventos ORDER BY id;
COMMIT;

-- ETAPA 3: executar apos o sucesso da etapa 2 (tambem pode ser nova requisicao).
SELECT DATABASE() AS banco_selecionado,
       (SELECT COUNT(*) FROM `u330320079_kids`.kids_inscricoes) AS inscricoes,
       (SELECT COUNT(*) FROM `u330320079_kids`.kids_idempotencia) AS idempotencias,
       (SELECT COUNT(*) FROM `u330320079_kids`.kids_auditoria) AS auditorias,
       (SELECT COUNT(*) FROM `u330320079_kids`.kids_administradores) AS administradores;
SELECT id, codigo, proximo_numero FROM `u330320079_kids`.kids_eventos ORDER BY id;
SELECT TABLE_NAME, AUTO_INCREMENT
FROM information_schema.TABLES
WHERE TABLE_SCHEMA='u330320079_kids'
  AND TABLE_NAME IN ('kids_inscricoes','kids_auditoria','kids_administradores')
ORDER BY TABLE_NAME;
