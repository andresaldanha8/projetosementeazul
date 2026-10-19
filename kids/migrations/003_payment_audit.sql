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
