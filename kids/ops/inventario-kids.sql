-- Read-only. Select the exclusive KIDS database before executing.
SELECT DATABASE() AS banco_selecionado;
SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME;
SELECT codigo,proximo_numero FROM kids_eventos;
SELECT COUNT(*) AS administradores FROM kids_administradores;
SELECT COUNT(*) AS inscricoes FROM kids_inscricoes;
