-- Only test databases in this stage. Persistent login limits independent of sessions.
CREATE TABLE kids_admin_login_limites (
 origem_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 janela_inicio BIGINT UNSIGNED NOT NULL,
 tentativas INT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- No raw login, IP, password or child data. Expired windows reset on next attempt.
