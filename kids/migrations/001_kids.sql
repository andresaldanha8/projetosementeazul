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
