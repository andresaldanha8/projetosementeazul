<?php
declare(strict_types=1);
// change_password.php — troca obrigatória de senha para sessão autenticada

function respond_json(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate');
    header('Pragma: no-cache');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

// Somente POST
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    header('Allow: POST');
    respond_json(405, ['sucesso' => false, 'mensagem' => 'Método não permitido.']);
}

// Ler body com limite
$raw = file_get_contents('php://input');
if ($raw === false) {
    respond_json(400, ['sucesso' => false, 'mensagem' => 'Requisição inválida.']);
}
$maxBody = 4096;
if (strlen($raw) > $maxBody) {
    respond_json(413, ['sucesso' => false, 'mensagem' => 'Payload muito grande.']);
}

$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($contentType, 'application/json') !== 0) {
    respond_json(400, ['sucesso' => false, 'mensagem' => 'Requisição inválida.']);
}

$data = json_decode($raw, true);
if (!is_array($data)) {
    respond_json(400, ['sucesso' => false, 'mensagem' => 'JSON inválido.']);
}

$currentPassword = $data['currentPassword'] ?? null;
$newPassword = $data['newPassword'] ?? null;
if (!is_string($currentPassword) || $currentPassword === '') {
    respond_json(400, ['sucesso' => false, 'mensagem' => 'Senha atual incorreta.']);
}
if (!is_string($newPassword) || $newPassword === '') {
    respond_json(400, ['sucesso' => false, 'mensagem' => 'A nova senha é obrigatória.']);
}
if (strlen($newPassword) < 10 || strlen($newPassword) > 1024) {
    respond_json(400, ['sucesso' => false, 'mensagem' => 'A nova senha deve ter entre 10 e 1024 caracteres.']);
}

// Carregar config, sessão e helpers
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/session.php';
require_once __DIR__ . '/helpers.php';

// Verificar marcadores mínimos
if (!isset($_SESSION['psa_user_id']) || !isset($_SESSION['psa_auth_version'])) {
    respond_json(401, ['sucesso' => false, 'mensagem' => 'Não autenticado.']);
}

// Validar sessão autoritativamente
try {
    $user = validate_session_user($pdo, $_SESSION, $destroy_session);
} catch (Throwable $e) {
    if (isset($destroy_session) && is_callable($destroy_session)) {
        $destroy_session();
    }
    error_log('change_password.php: erro ao validar sessao');
    respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
}

if ($user === null) {
    respond_json(401, ['sucesso' => false, 'mensagem' => 'Não autenticado.']);
}

// Exigir CSRF
$received = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
if (!is_string($received) || $received === '') {
    respond_json(403, ['sucesso' => false, 'mensagem' => 'Requisição não autorizada.']);
}
try {
    $validCsrf = csrf_validate_token($_SESSION, $received);
} catch (Throwable $e) {
    error_log('change_password.php: erro ao validar token CSRF');
    respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
}
if (!$validCsrf) {
    respond_json(403, ['sucesso' => false, 'mensagem' => 'Requisição não autorizada.']);
}

// Alteração atômica em transação com SELECT ... FOR UPDATE para serializar por usuário
try {
    $pdo->beginTransaction();

    // Ler credential e bloquear a linha para update
    $selHash = $pdo->prepare('SELECT password_hash FROM cad_usuarios WHERE id = ? LIMIT 1 FOR UPDATE');
    $selHash->execute([(int)$user['id']]);
    $cred = $selHash->fetch(PDO::FETCH_ASSOC);
    if ($cred === false || !isset($cred['password_hash']) || !is_string($cred['password_hash']) || $cred['password_hash'] === '') {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('change_password.php: credencial inconsistente (hash ausente)');
        respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
    }

    $passwordHash = $cred['password_hash'];

    // Verificar senha atual dentro da transacao
    if (!password_verify($currentPassword, $passwordHash)) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        respond_json(400, ['sucesso' => false, 'mensagem' => 'Senha atual incorreta.']);
    }

    // Verificar nova senha diferente da atual
    if (password_verify($newPassword, $passwordHash)) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        respond_json(400, ['sucesso' => false, 'mensagem' => 'A nova senha deve ser diferente da senha atual.']);
    }

    // Gerar novo hash dentro da transacao
    $newHash = password_hash($newPassword, PASSWORD_DEFAULT);
    if (!is_string($newHash) || $newHash === '') {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('change_password.php: falha ao gerar novo hash');
        respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
    }

    // Executar update
    $update = $pdo->prepare('UPDATE cad_usuarios SET password_hash = ?, must_change_password = 0, auth_version = auth_version + 1, updated_at = CURRENT_TIMESTAMP(6) WHERE id = ?');
    $update->execute([$newHash, (int)$user['id']]);
    $affected = $update->rowCount();
    if ($affected !== 1) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('change_password.php: falha na transacao de senha (linhas afetadas != 1)');
        respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
    }

    // Ler novo auth_version dentro da mesma transacao
    $sel = $pdo->prepare('SELECT auth_version FROM cad_usuarios WHERE id = ? LIMIT 1');
    $sel->execute([(int)$user['id']]);
    $row2 = $sel->fetch(PDO::FETCH_ASSOC);
    if ($row2 === false || !isset($row2['auth_version'])) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('change_password.php: falha ao ler novo auth_version');
        respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
    }
    $newAuthVersion = (int)$row2['auth_version'];

    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('change_password.php: falha na transacao de senha');
    respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
}

// Após commit: renovar session id, atualizar sessão e rotacionar CSRF
try {
    if (!session_regenerate_id(true)) {
        if (isset($destroy_session) && is_callable($destroy_session)) {
            $destroy_session();
        }
        error_log('change_password.php: falha ao regenerar session id');
        respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
    }

    // Atualizar apenas a sessão atual
    $_SESSION['psa_auth_version'] = $newAuthVersion;
    // Garantir que os outros marcadores permaneçam
    $_SESSION['psa_user_id'] = (int)$user['id'];
    $_SESSION['psa_user_name'] = (string)$user['nome'];
    $_SESSION['psa_user_profile'] = (string)$user['perfil'];

    $now = time();
    $_SESSION['psa_session_created_at'] = $now;
    $_SESSION['psa_session_last_activity'] = $now;

    // Remover CSRF antigo
    if (isset($_SESSION['psa_csrf_token'])) unset($_SESSION['psa_csrf_token']);

    // Gerar novo CSRF
    $newCsrf = csrf_generate_token($_SESSION);
} catch (Throwable $e) {
    // Commit já ocorreu; destruimos a sessão atual (fail-closed)
    if (isset($destroy_session) && is_callable($destroy_session)) {
        $destroy_session();
    }
    error_log('change_password.php: falha ao renovar sessao apos troca');
    respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
}

// Use o registro original validado como fonte para a representação pública
$publicUser = public_user_from_record($user);
respond_json(200, [
    'sucesso' => true,
    'usuario' => $publicUser,
    'mustChangePassword' => false,
    'csrfToken' => $newCsrf
]);
