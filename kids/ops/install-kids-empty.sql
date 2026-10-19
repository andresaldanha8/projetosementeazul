-- KIDS standalone installation: EMPTY database only.
-- Select the exclusive KIDS database in phpMyAdmin before importing.
-- Import this file ONCE; do NOT also run migrations 001..006.
-- No administrator, password, user import or registration fixtures.
-- DDL is not transactionally reversible: on errors STOP and inspect the selected database.

-- Source: 001_kids.sql
-- Aplicar somente após revisão, primeiro em banco isolado. MySQL/MariaDB, InnoDB.
-- Sem referências a cad_*: tipos reais do esquema legado não estão disponíveis.
CREATE TABLE kids_eventos (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 codigo VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 proximo_numero BIGINT UNSIGNED NOT NULL DEFAULT 1,
 UNIQUE KEY ux_kids_evento_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE kids_inscricoes (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 evento_id BIGINT UNSIGNED NOT NULL,
 numero_peito BIGINT UNSIGNED NOT NULL,
 referencia CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 owner_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 crianca_nome VARCHAR(200) NOT NULL,
 nascimento DATE NOT NULL,
 divisao CHAR(1) NOT NULL,
 idade_inscricao TINYINT UNSIGNED NOT NULL,
 faixa VARCHAR(5) NOT NULL,
 responsavel_nome VARCHAR(200) NOT NULL,
 vinculo VARCHAR(100) NOT NULL,
 telefone VARCHAR(15) NOT NULL,
 camisa VARCHAR(5) NOT NULL,
 valor_centavos INT UNSIGNED NOT NULL,
 pagamento VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
 situacao VARCHAR(20) NOT NULL DEFAULT 'REGISTRADA',
 declaracao_versao VARCHAR(100) NOT NULL,
 aceita_em DATETIME(6) NOT NULL,
 criada_em DATETIME(6) NOT NULL,
 atualizada_em DATETIME(6) NOT NULL,
 UNIQUE KEY ux_kids_numero (evento_id, numero_peito),
 UNIQUE KEY ux_kids_referencia (referencia),
 KEY ix_kids_owner (owner_hash),
 KEY ix_kids_possivel_duplicidade (evento_id, nascimento, telefone),
 CONSTRAINT fk_kids_inscricao_evento FOREIGN KEY (evento_id) REFERENCES kids_eventos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE kids_idempotencia (
 evento_id BIGINT UNSIGNED NOT NULL,
 owner_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 chave CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 payload_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 inscricao_id BIGINT UNSIGNED NULL,
 criada_em DATETIME(6) NOT NULL,
 PRIMARY KEY (evento_id, owner_hash, chave),
 CONSTRAINT fk_kids_idem_evento FOREIGN KEY (evento_id) REFERENCES kids_eventos(id),
 CONSTRAINT fk_kids_idem_inscricao FOREIGN KEY (inscricao_id) REFERENCES kids_inscricoes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO kids_eventos (codigo) VALUES ('AUTISMO-RUN-2026-KIDS');


-- Source: 002_lookup_limits.sql
-- Aditiva. Aplicar primeiro em banco isolado; nunca automaticamente em produção.
-- Não guarda IP, nome ou telefone em claro. Uma linha por hash de origem efetiva.
CREATE TABLE kids_consulta_limites (
 origem_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 janela_inicio BIGINT UNSIGNED NOT NULL,
 tentativas INT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX ix_kids_consulta_telefone ON kids_inscricoes (evento_id, telefone);


-- Source: 003_payment_audit.sql
-- Aplicar somente após revisão, primeiro em banco isolado.
CREATE TABLE kids_auditoria (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 inscricao_id BIGINT UNSIGNED NOT NULL,
 usuario_id BIGINT UNSIGNED NOT NULL,
 ocorrida_em DATETIME(6) NOT NULL,
 estado_anterior VARCHAR(20) NOT NULL,
 estado_novo VARCHAR(20) NOT NULL,
 UNIQUE KEY ux_kids_pagamento_evento (inscricao_id,estado_novo),
 CONSTRAINT fk_kids_auditoria_inscricao FOREIGN KEY (inscricao_id) REFERENCES kids_inscricoes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Sem IP. Identidade administrativa preservada sem presumir tipo de FK legado.


-- Source: 004_admin_login_limits.sql
-- Only test databases in this stage. Persistent login limits independent of sessions.
CREATE TABLE kids_admin_login_limites (
 origem_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 janela_inicio BIGINT UNSIGNED NOT NULL,
 tentativas INT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- No raw login, IP, password or child data. Expired windows reset on next attempt.


-- Source: 005_independent_admin.sql
-- Apply only after 001..004, with no pre-existing audit identities to map.
-- Historical user IDs must never be guessed or copied from another system.
CREATE TABLE kids_administradores (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 nome VARCHAR(200) NOT NULL,
 login VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
 password_hash VARCHAR(255) NOT NULL,
 perfil VARCHAR(30) NOT NULL DEFAULT 'ADMINISTRADOR',
 ativo TINYINT UNSIGNED NOT NULL DEFAULT 1,
 auth_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
 must_change_password TINYINT UNSIGNED NOT NULL DEFAULT 1,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY ux_kids_admin_login (login)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE kids_auditoria ADD CONSTRAINT fk_kids_auditoria_administrador
 FOREIGN KEY (usuario_id) REFERENCES kids_administradores(id) ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Source: 006_image_authorization.sql
-- Existing KIDS database: apply ONCE after 005. No UPDATE, backfill or user changes.
-- NULL means not informed for registrations created before this feature.
ALTER TABLE kids_inscricoes
 ADD COLUMN imagem_autorizada TINYINT UNSIGNED NULL DEFAULT NULL,
 ADD COLUMN imagem_autorizacao_versao VARCHAR(100) NULL DEFAULT NULL,
 ADD COLUMN imagem_autorizacao_texto TEXT NULL DEFAULT NULL,
 ADD COLUMN imagem_registrada_em DATETIME(6) NULL DEFAULT NULL;
