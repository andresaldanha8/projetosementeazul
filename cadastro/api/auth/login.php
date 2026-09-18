<?php
declare(strict_types=1);
// login.php — endpoint de autenticação real (POST JSON)
// Carrega configuração, sessão e helpers; usa sessão PHP como credencial.

// Compatibilidade: impedir acesso direto por GET etc.
if (basename($_SERVER['SCRIPT_FILENAME']) === basename(__FILE__)) {
    // allow as endpoint; execution will proceed when requested
}

// Respostas JSON helper
function send_json(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate');
    header('Pragma: no-cache');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

// Only allow POST
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    header('Allow: POST');
    send_json(405, ['sucesso' => false, 'mensagem' => 'Método não permitido.']);
}

// Content-Type must be application/json
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($contentType, 'application/json') !== 0) {
    send_json(400, ['sucesso' => false, 'mensagem' => 'Requisição inválida.']);
}

// Limit body size (defensive)
$raw = file_get_contents('php://input');
if ($raw === false) {
    send_json(400, ['sucesso' => false, 'mensagem' => 'Requisição inválida.']);
}
$maxBody = 4096; // bytes
if (strlen($raw) > $maxBody) {
    send_json(413, ['sucesso' => false, 'mensagem' => 'Payload muito grande.']);
}

$data = json_decode($raw, true);
if (!is_array($data)) {
    send_json(400, ['sucesso' => false, 'mensagem' => 'JSON inválido.']);
}

// Validate input
$login = $data['login'] ?? null;
$password = $data['password'] ?? null;
if (!is_string($login) || $login === '') {
    send_json(400, ['sucesso' => false, 'mensagem' => 'Login e senha obrigatórios.']);
}
$login = trim($login);
if ($login === '' || mb_strlen($login) > 100) {
    send_json(400, ['sucesso' => false, 'mensagem' => 'Login ou senha inválidos.']);
}
if (!is_string($password) || $password === '') {
    send_json(400, ['sucesso' => false, 'mensagem' => 'Login ou senha inválidos.']);
}
// Defensive maximum password length
if (mb_strlen($password) > 1024) {
    send_json(400, ['sucesso' => false, 'mensagem' => 'Login ou senha inválidos.']);
}

// Normalize login
$normalizedLogin = mb_strtolower($login);

// Load config, session, helpers
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/session.php';
require_once __DIR__ . '/helpers.php';

// Dummy hash for timing mitigation (constant)
// Generated locally from the string "PSA_DUMMY_PASSWORD_NEVER_USED_FOR_LOGIN" using
// password_hash(..., PASSWORD_BCRYPT). Used only to mitigate timing for non-existent users.
const DUMMY_PASSWORD_HASH = '$2y$10$TxigpevQUR49e8owlMkiW.yB.Yl6eZipJ/SsfHbiKYnlAyOc1pGtq';

try {
    // Attempt to retrieve user (may throw PDOException)
    $user = get_user_by_login($pdo, $normalizedLogin);

    $passwordHash = null;
    if ($user === null) {
        // Use dummy hash to mitigate timing differences
        $passwordHash = DUMMY_PASSWORD_HASH;
    } else {
        // Ensure required fields
        if (!isset($user['password_hash']) || !is_string($user['password_hash'])) {
            // Treat as invalid credentials but verify against dummy to equalize timing
            $passwordHash = DUMMY_PASSWORD_HASH;
        } else {
            $passwordHash = $user['password_hash'];
        }
    }

    $verified = password_verify($password, $passwordHash);

    // If user not found or not verified, return generic 401
    if ($user === null || !$verified) {
        // delay further by calling password_verify on dummy if needed (already done)
        send_json(401, ['sucesso' => false, 'mensagem' => 'Login ou senha inválidos.']);
    }

    // At this point password verified. Validate active and profile
    $allowedProfiles = ['ADMINISTRADOR', 'CADASTRADOR'];
    if (!isset($user['ativo']) || (int)$user['ativo'] !== 1 || !isset($user['perfil']) || !in_array($user['perfil'], $allowedProfiles, true)) {
        // Treat as invalid credentials without leaking details
        send_json(401, ['sucesso' => false, 'mensagem' => 'Login ou senha inválidos.']);
    }

    // Successful credential verification — establish authenticated session
    // Clean any prior auth state but keep session until regenerate
    // Remove csrf token from previous identity if present
    if (isset($_SESSION['psa_csrf_token'])) unset($_SESSION['psa_csrf_token']);
    if (isset($_SESSION['psa_user_id'])) {
        // Remove previous markers
        unset($_SESSION['psa_user_id'], $_SESSION['psa_user_name'], $_SESSION['psa_user_profile'], $_SESSION['psa_auth_version'], $_SESSION['psa_session_created_at'], $_SESSION['psa_session_last_activity']);
    }

    // Regenerate session id
    if (!session_regenerate_id(true)) {
        // Regeneration failed — destroy session immediately and report error
        if (isset($destroy_session) && is_callable($destroy_session)) {
            $destroy_session();
        }
        error_log('login.php: falha ao regenerar session id');
        send_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
    }

    // Establish authenticated session markers atomically; fail-closed on any error
    try {
        $now = time();
        $_SESSION['psa_user_id'] = (int)$user['id'];
        $_SESSION['psa_user_name'] = (string)$user['nome'];
        $_SESSION['psa_user_profile'] = (string)$user['perfil'];
        $_SESSION['psa_auth_version'] = (int)$user['auth_version'];
        $_SESSION['psa_session_created_at'] = $now;
        $_SESSION['psa_session_last_activity'] = $now;

        // Generate CSRF token now that session is authenticated
        $csrfToken = csrf_generate_token($_SESSION);
    } catch (Throwable $e) {
        // Ensure no authenticated markers remain and destroy session
        if (isset($destroy_session) && is_callable($destroy_session)) {
            $destroy_session();
        }
        error_log('login.php: falha ao inicializar sessão autenticada');
        send_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
    }

    // Password rehash if needed — do not block login on failure
    try {
        if (password_needs_rehash($passwordHash, PASSWORD_DEFAULT)) {
            $newHash = password_hash($password, PASSWORD_DEFAULT);
            if (is_string($newHash) && $newHash !== '') {
                try {
                    update_password_hash($pdo, (int)$user['id'], $newHash);
                } catch (Throwable $e) {
                    error_log('login.php: falha ao atualizar hash da senha');
                    // continue without blocking login
                }
            }
        }
    } catch (Throwable $e) {
        // Any error here should not block login
        error_log('login.php: erro ao verificar necessidade de rehash');
    }

    // Build response
    $publicUser = public_user_from_record($user);
    $mustChange = user_must_change_password($user);

    send_json(200, [
        'sucesso' => true,
        'usuario' => $publicUser,
        'mustChangePassword' => $mustChange,
        'csrfToken' => $csrfToken
    ]);

} catch (Throwable $e) {
    // Do not leak details
    error_log('login.php: erro inesperado durante autenticação');
    send_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
}
