<?php
declare(strict_types=1);
require_once __DIR__ . '/_bootstrap.php';
kids_admin_method('GET');
try {
    if (!isset($_SESSION['kids_user_id'])) {
        $_SESSION['kids_csrf_token'] ??= bin2hex(random_bytes(32));
        kids_reply(200, ['sucesso' => true, 'usuario' => null, 'csrfToken' => $_SESSION['kids_csrf_token']]);
    }
    $user = kids_require_admin($pdo, false, true);
    kids_reply(200, kids_admin_session_payload($user));
} catch (Throwable $e) { kids_admin_error($e); }
