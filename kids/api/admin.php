<?php
declare(strict_types=1);
// Helper interno: futuros endpoints devem chamar kids_require_admin($pdo, $mutation).
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(403); exit; }
require_once __DIR__ . '/http.php';
require_once __DIR__ . '/admin-session.php';
require_once __DIR__ . '/admin-auth.php';

function kids_require_admin(PDO $pdo, bool $mutation = false, bool $allowPasswordChange = false): array
{
    global $destroy_session;
    $user = kids_admin_validate_session($pdo, $_SESSION, $destroy_session);
    if ($user === null) kids_reply(401, ['sucesso' => false, 'code' => 'SESSION_EXPIRED']);
    if (($user['perfil'] ?? '') !== 'ADMINISTRADOR') {
        $destroy_session();
        kids_reply(403, ['sucesso' => false, 'code' => 'ACCESS_REVOKED']);
    }
    if (!$allowPasswordChange && kids_admin_must_change_password($user)) kids_reply(403, ['sucesso' => false, 'code' => 'PASSWORD_CHANGE_REQUIRED']);
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if ($mutation && (!is_string($token) || !kids_admin_csrf_validate($_SESSION, $token))) kids_reply(403, ['sucesso' => false, 'mensagem' => 'Requisição não autorizada.']);
    return $user;
}
