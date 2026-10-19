<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';

function kids_reply(int $status, array $body): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('Referrer-Policy: no-referrer');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}

function kids_public_session(bool $create = false): void
{
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.gc_maxlifetime', (string)kids_config()['session_seconds']);
    session_name('PSA_KIDS_PUBLIC');
    session_set_cookie_params([
        'lifetime' => 0, 'path' => '/kids/api/', 'httponly' => true,
        'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (int)($_SERVER['SERVER_PORT'] ?? 0) === 443,
        'samesite' => 'Strict',
    ]);
    session_start();
    // Fixed public-session version for the test-registration cleanup.
    $publicEpoch = 'kids-public-pos-limpeza-testes-2026-10-v1';
    if (($_SESSION['kids_public_epoch'] ?? null) !== $publicEpoch) {
        $_SESSION = [];
    }
    $expired = isset($_SESSION['expires']) && time() >= $_SESSION['expires'];
    if ($expired) $_SESSION = [];
    if (!isset($_SESSION['owner'])) {
        if (!$create) kids_reply(401, ['ok' => false, 'message' => 'Inicie uma sessão de inscrição.']);
        session_regenerate_id(true);
        $_SESSION = [
            'owner' => bin2hex(random_bytes(32)),
            'csrf' => bin2hex(random_bytes(32)),
            'expires' => time() + kids_config()['session_seconds'],
            'kids_public_epoch' => $publicEpoch,
        ];
    }
}
