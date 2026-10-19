-- Aditiva. Aplicar primeiro em banco isolado; nunca automaticamente em produção.
-- Não guarda IP, nome ou telefone em claro. Uma linha por hash de origem efetiva.
CREATE TABLE kids_consulta_limites (
 origem_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 janela_inicio BIGINT UNSIGNED NOT NULL,
 tentativas INT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX ix_kids_consulta_telefone ON kids_inscricoes (evento_id, telefone);
