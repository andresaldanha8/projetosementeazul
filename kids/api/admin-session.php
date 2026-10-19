<?php
declare(strict_types=1);
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(403); exit; }
require_once __DIR__ . '/http.php';

// Separate storage also prevents a session ID from another cookie namespace being replayed here.
if (session_status() !== PHP_SESSION_NONE) kids_reply(500, ['sucesso' => false]);
$savePath = sys_get_temp_dir() . '/psa-kids-admin-' . hash('sha256', __DIR__);
if (!is_dir($savePath) && !@mkdir($savePath, 0700, true) && !is_dir($savePath)) {
    kids_reply(503, ['sucesso' => false]);
}
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
ini_set('session.gc_maxlifetime', '28800');
session_save_path($savePath);
session_name('PSA_KIDS_ADMIN');
$secure = (!empty($_SERVER['HTTPS']) && in_array($_SERVER['HTTPS'], ['on', '1'], true)) || (int)($_SERVER['SERVER_PORT'] ?? 0) === 443;
session_set_cookie_params(['lifetime' => 0, 'path' => '/kids/admin/', 'secure' => $secure, 'httponly' => true, 'samesite' => 'Strict']);
session_start();

$destroy_session = function (): void {
    $_SESSION = [];
    $params = session_get_cookie_params();
    setcookie(session_name(), '', ['expires' => time() - 42000, 'path' => $params['path'], 'secure' => $params['secure'], 'httponly' => true, 'samesite' => 'Strict']);
    session_destroy();
};
if (isset($_SESSION['psa_user_id']) || isset($_SESSION['kids_user_id'])) {
    $created = $_SESSION['kids_session_created_at'] ?? null;
    $last = $_SESSION['kids_session_last_activity'] ?? null;
    if (($_SESSION['kids_admin_scope'] ?? '') !== 'KIDS_ADMIN_V2' || !is_int($created) || !is_int($last)
        || time() - $last >= 1800 || time() - $created >= 28800) {
        $destroy_session();
        kids_reply(401, ['sucesso' => false, 'code' => 'SESSION_EXPIRED', 'mensagem' => 'Entre novamente na administração KIDS.']);
    }
    $_SESSION['kids_session_last_activity'] = time();
}

function kids_admin_session_payload(array $user): array
{
    return ['sucesso' => true, 'usuario' => kids_admin_public_user($user),
        'mustChangePassword' => kids_admin_must_change_password($user), 'csrfToken' => kids_admin_csrf_get($_SESSION)];
}

function kids_admin_start_identity(array $user): void
{
    if (!session_regenerate_id(true)) throw new RuntimeException('Session renewal failed');
    $_SESSION = ['kids_admin_scope' => 'KIDS_ADMIN_V2', 'kids_user_id' => (int)$user['id'],
        'kids_auth_version' => (int)$user['auth_version'],
        'kids_session_created_at' => time(), 'kids_session_last_activity' => time()];
    kids_admin_csrf_generate($_SESSION);
}
