<?php
declare(strict_types=1);
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(403); exit; }
require_once dirname(__DIR__, 2) . '/api/http.php';
require_once dirname(__DIR__, 2) . '/api/database.php';
require_once dirname(__DIR__, 2) . '/api/admin.php';

function kids_admin_method(string $method): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== $method) {
        header('Allow: ' . $method);
        kids_reply(405, ['sucesso' => false]);
    }
}

function kids_admin_body(): array
{
    if (strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])) !== 'application/json') kids_reply(415, ['sucesso' => false]);
    $raw = file_get_contents('php://input', false, null, 0, 4097);
    if ($raw === false || strlen($raw) > 4096) kids_reply(413, ['sucesso' => false]);
    $body = json_decode($raw, true);
    if (!is_array($body)) kids_reply(400, ['sucesso' => false]);
    return $body;
}

function kids_admin_error(Throwable $e): void
{
    global $pdo;
    if ($pdo->inTransaction()) $pdo->rollBack();
    // No SQL, credentials or personal data in application logs.
    error_log('kids admin: falha interna');
    kids_reply(500, ['sucesso' => false, 'mensagem' => 'Não foi possível concluir. Tente novamente.']);
}
