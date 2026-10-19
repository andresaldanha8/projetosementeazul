<?php
declare(strict_types=1);
// Shared credential verification only: callers own authorization and session lifecycle.
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(403); exit; }
require_once __DIR__ . '/helpers.php';

function verify_user_credentials(PDO $pdo, string $login, string $password): ?array
{
    $user = get_user_by_login($pdo, mb_strtolower(trim($login)));
    $dummy = '$2y$10$TxigpevQUR49e8owlMkiW.yB.Yl6eZipJ/SsfHbiKYnlAyOc1pGtq';
    $hasHash = is_string($user['password_hash'] ?? null) && $user['password_hash'] !== '';
    $hash = $hasHash ? $user['password_hash'] : $dummy;
    $verified = password_verify($password, $hash);
    return $user !== null && $hasHash && $verified ? $user : null;
}
