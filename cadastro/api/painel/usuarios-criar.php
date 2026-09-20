<?php
declare(strict_types=1);
// usuarios-criar.php — criar usuário CADASTRADOR via painel por ADMINISTRADOR autenticado

function respond_json(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

// Apenas POST
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    header('Allow: POST');
    respond_json(405, ['sucesso' => false, 'mensagem' => 'Método não permitido.']);
}

// Content-Type: application/json
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($contentType, 'application/json') !== 0) {
    respond_json(415, ['sucesso' => false, 'mensagem' => 'Content-Type inválido.']);
}

// Ler body com limite defensivo
$raw = file_get_contents('php://input');
if ($raw === false) {
    respond_json(400, ['sucesso' => false, 'mensagem' => 'Requisição inválida.']);
}
$maxBody = 8 * 1024; // 8KB suficiente para este payload
if (strlen($raw) > $maxBody) {
    respond_json(413, ['sucesso' => false, 'mensagem' => 'Payload muito grande.']);
}

$data = json_decode($raw, true);
if (!is_array($data)) {
    respond_json(400, ['sucesso' => false, 'mensagem' => 'JSON inválido.']);
}

// Não permitir propriedades adicionais
$allowed = ['nome', 'login', 'senhaTemporaria'];
$extra = array_diff(array_keys($data), $allowed);
if (!empty($extra)) {
    respond_json(400, ['sucesso' => false, 'mensagem' => 'Propriedades adicionais não permitidas.']);
}

// Validar campos
$nome = $data['nome'] ?? null;
$login = $data['login'] ?? null;
$senhaTemp = $data['senhaTemporaria'] ?? null;

if (!is_string($nome)) respond_json(400, ['sucesso' => false, 'mensagem' => 'Campo nome inválido.']);
$nome = trim($nome);
if ($nome === '' || mb_strlen($nome) > 200) respond_json(400, ['sucesso' => false, 'mensagem' => 'Nome inválido.']);

if (!is_string($login)) respond_json(400, ['sucesso' => false, 'mensagem' => 'Campo login inválido.']);
$login = trim($login);
if ($login === '' || mb_strlen($login) > 100) respond_json(400, ['sucesso' => false, 'mensagem' => 'Login inválido.']);
// Normalizar login conforme padrão do projeto
$normalizedLogin = mb_strtolower($login);

if (!is_string($senhaTemp)) respond_json(400, ['sucesso' => false, 'mensagem' => 'Campo senhaTemporaria inválido.']);
if (strlen($senhaTemp) < 10) respond_json(400, ['sucesso' => false, 'mensagem' => 'A senha deve ter pelo menos 10 caracteres.' ]);

// Carregar infra existente
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/session.php';
require_once __DIR__ . '/../auth/helpers.php';

// Verificar sessão mínima
if (!isset($_SESSION['psa_user_id']) || !isset($_SESSION['psa_auth_version'])) {
    respond_json(401, ['sucesso' => false, 'mensagem' => 'Não autenticado.']);
}

// Validar sessão autoritativamente
try {
    $user = validate_session_user($pdo, $_SESSION, $destroy_session);
} catch (Throwable $e) {
    if (isset($destroy_session) && is_callable($destroy_session)) $destroy_session();
    error_log('usuarios-criar.php: erro ao validar sessao');
    respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
}
if ($user === null) {
    respond_json(401, ['sucesso' => false, 'mensagem' => 'Não autenticado.']);
}

// Regras de autorização: somente ADMINISTRADOR ativo e sem must_change_password pendente
if (!isset($user['perfil']) || $user['perfil'] !== 'ADMINISTRADOR') {
    respond_json(403, ['sucesso' => false, 'mensagem' => 'Requisição não autorizada.']);
}
if (!isset($user['ativo']) || (int)$user['ativo'] !== 1) {
    respond_json(403, ['sucesso' => false, 'mensagem' => 'Conta inativa.']);
}
if (isset($user['must_change_password']) && (int)$user['must_change_password'] === 1) {
    respond_json(403, ['sucesso' => false, 'mensagem' => 'Troca de senha obrigatória.']);
}

// CSRF
$received = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
if (!is_string($received) || $received === '') {
    respond_json(403, ['sucesso' => false, 'mensagem' => 'Requisição não autorizada.']);
}
try {
    $validCsrf = csrf_validate_token($_SESSION, $received);
} catch (Throwable $e) {
    error_log('usuarios-criar.php: erro ao validar token CSRF');
    respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
}
if (!$validCsrf) {
    respond_json(403, ['sucesso' => false, 'mensagem' => 'Requisição não autorizada.']);
}

// Verificar duplicidade preliminar
try {
    $sel = $pdo->prepare('SELECT id FROM cad_usuarios WHERE login = ? LIMIT 1');
    $sel->execute([$normalizedLogin]);
    if ($sel->fetch()) {
        respond_json(409, ['sucesso' => false, 'mensagem' => 'Login já existente.']);
    }
} catch (Throwable $e) {
    error_log('usuarios-criar.php: falha ao verificar duplicidade');
    respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
}

// Gerar hash da senha temporária (não logar nem retornar)
$password_hash = password_hash($senhaTemp, PASSWORD_DEFAULT);
// Esvaziar variável de senha em claro
$senhaTemp = null;
if ($password_hash === false) {
    respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
}

// Inserir novo usuário em transação; tratar duplicidade por UNIQUE
try {
    $now = (new DateTime('now', new DateTimeZone('UTC')))->format('Y-m-d H:i:s.u');
    $pdo->beginTransaction();
    $insert = $pdo->prepare('INSERT INTO cad_usuarios (nome, login, password_hash, perfil, ativo, auth_version, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $insert->execute([
        $nome,
        $normalizedLogin,
        $password_hash,
        'CADASTRADOR',
        1,
        1,
        1,
        $now,
        $now
    ]);
    $newId = (int)$pdo->lastInsertId();
    if ($newId <= 0) {
        $pdo->rollBack();
        respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
    }
    $pdo->commit();
    // NUNCA expor password_hash
    respond_json(201, ['sucesso' => true, 'usuario' => [
        'id' => $newId,
        'nome' => $nome,
        'login' => $normalizedLogin,
        'perfil' => 'CADASTRADOR',
        'ativo' => true,
        'mustChangePassword' => true
    ]]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    // Não inferir causa a partir da mensagem do driver; já existe pré-check de duplicidade.
    error_log('usuarios-criar.php: falha interna ao criar usuario');
    respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);

} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log('usuarios-criar.php: exceção inesperada');
    respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
}

?>
