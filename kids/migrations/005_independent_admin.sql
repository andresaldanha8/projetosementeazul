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
