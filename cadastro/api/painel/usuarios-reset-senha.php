<?php
declare(strict_types=1);
// Redefinição administrativa de senha temporária de CADASTRADOR.

function respond_json(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    header('Allow: POST');
    respond_json(405, ['sucesso' => false, 'mensagem' => 'Método não permitido.']);
}

$contentType = trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '', 2)[0]);
if (strcasecmp($contentType, 'application/json') !== 0) {
    respond_json(415, ['sucesso' => false, 'mensagem' => 'Content-Type inválido.']);
}

// Mesmo teto de usuarios-criar.php; ler apenas o necessário para detectar excesso.
$maxBody = 8 * 1024;
$raw = file_get_contents('php://input', false, null, 0, $maxBody + 1);
if ($raw === false) {
    respond_json(400, ['sucesso' => false, 'mensagem' => 'Requisição inválida.']);
}
if (strlen($raw) > $maxBody) {
    respond_json(413, ['sucesso' => false, 'mensagem' => 'Payload muito grande.']);
}

$data = json_decode($raw);
if (json_last_error() !== JSON_ERROR_NONE || !($data instanceof stdClass)) {
    respond_json(400, ['sucesso' => false, 'mensagem' => 'JSON inválido.']);
}
$fields = get_object_vars($data);
if (count($fields) !== 2 || array_diff(array_keys($fields), ['usuarioId', 'senhaTemporaria'])
    || !isset($data->usuarioId, $data->senhaTemporaria)
    || !is_int($data->usuarioId) || $data->usuarioId <= 0
    || !is_string($data->senhaTemporaria)) {
    respond_json(400, ['sucesso' => false, 'mensagem' => 'Payload inválido.']);
}
$usuarioId = $data->usuarioId;
$senhaTemporaria = $data->senhaTemporaria;
if (strlen($senhaTemporaria) < 10 || strlen($senhaTemporaria) > 1024) {
    respond_json(400, ['sucesso' => false, 'mensagem' => 'A senha temporária deve ter entre 10 e 1024 bytes UTF-8.']);
}
// Não manter cópias do corpo com a senha durante o processamento.
unset($raw, $data, $fields);

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/session.php';
require_once __DIR__ . '/../auth/helpers.php';

try {
    $user = validate_session_user($pdo, $_SESSION, $destroy_session);
} catch (Throwable $e) {
    if (isset($destroy_session) && is_callable($destroy_session)) $destroy_session();
    error_log('painel/usuarios-reset-senha.php: erro ao validar sessao');
    respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
}
if ($user === null) {
    respond_json(401, ['sucesso' => false, 'mensagem' => 'Não autenticado.']);
}
// O helper já exige ator existente, ativo e com versão de sessão válida.
if (($user['perfil'] ?? null) !== 'ADMINISTRADOR') {
    respond_json(403, ['sucesso' => false, 'mensagem' => 'Requisição não autorizada.']);
}
if (!isset($user['must_change_password']) || (int)$user['must_change_password'] !== 0) {
    respond_json(403, ['sucesso' => false, 'mensagem' => 'Troca de senha obrigatória.']);
}

$received = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
if (!is_string($received) || $received === '') {
    respond_json(403, ['sucesso' => false, 'mensagem' => 'Requisição não autorizada.']);
}
try {
    $validCsrf = csrf_validate_token($_SESSION, $received);
} catch (Throwable $e) {
    error_log('painel/usuarios-reset-senha.php: erro ao validar CSRF');
    respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
}
if (!$validCsrf || $usuarioId === (int)$user['id']) {
    respond_json(403, ['sucesso' => false, 'mensagem' => 'Requisição não autorizada.']);
}

try {
    if (!$pdo->beginTransaction()) throw new RuntimeException('Falha na transacao.');
    $stmt = $pdo->prepare('SELECT id, perfil FROM cad_usuarios WHERE id = ? LIMIT 1 FOR UPDATE');
    $stmt->execute([$usuarioId]);
    $target = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($target === false) {
        $pdo->rollBack();
        respond_json(404, ['sucesso' => false, 'mensagem' => 'Usuário não encontrado.']);
    }
    if (($target['perfil'] ?? null) !== 'CADASTRADOR') {
        $pdo->rollBack();
        respond_json(403, ['sucesso' => false, 'mensagem' => 'Requisição não autorizada.']);
    }
    $newHash = password_hash($senhaTemporaria, PASSWORD_DEFAULT);
    unset($senhaTemporaria);
    if (!is_string($newHash) || $newHash === '') {
        throw new RuntimeException('Falha ao gerar credencial.');
    }

    // Preservar ativo, perfil e demais dados; inclusive para conta inativa.
    $update = $pdo->prepare('UPDATE cad_usuarios SET password_hash = ?, must_change_password = 1, auth_version = auth_version + 1, updated_at = CURRENT_TIMESTAMP(6) WHERE id = ?');
    if (!$update->execute([$newHash, $usuarioId]) || $update->rowCount() !== 1) {
        throw new RuntimeException('Redefinicao nao confirmada.');
    }
    unset($newHash);

    if (!$pdo->commit()) throw new RuntimeException('Falha ao confirmar transacao.');
    respond_json(200, ['sucesso' => true, 'usuario' => ['id' => $usuarioId, 'mustChangePassword' => true]]);
} catch (Throwable $e) {
    unset($senhaTemporaria, $newHash);
    if ($pdo->inTransaction()) {
        try {
            $pdo->rollBack();
        } catch (Throwable $rollbackError) {
            error_log('painel/usuarios-reset-senha.php: falha no rollback');
        }
    }
    error_log('painel/usuarios-reset-senha.php: falha interna ao redefinir senha');
    respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
}
