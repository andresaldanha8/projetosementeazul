-- Existing KIDS database: apply ONCE after 005. No UPDATE, backfill or user changes.
-- NULL means not informed for registrations created before this feature.
ALTER TABLE kids_inscricoes
 ADD COLUMN imagem_autorizada TINYINT UNSIGNED NULL DEFAULT NULL,
 ADD COLUMN imagem_autorizacao_versao VARCHAR(100) NULL DEFAULT NULL,
 ADD COLUMN imagem_autorizacao_texto TEXT NULL DEFAULT NULL,
 ADD COLUMN imagem_registrada_em DATETIME(6) NULL DEFAULT NULL;
