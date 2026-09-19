<?php
declare(strict_types=1);
// GET /cadastro/api/painel/ficha.php?id=<id>

function respond_json(int $statusCode, array $payload): void
{
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        error_log('painel/ficha.php: falha ao codificar resposta JSON');
        $statusCode = 500;
        $json = '{"sucesso":false,"mensagem":"Erro interno."}';
    }
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo $json;
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    header('Allow: GET');
    respond_json(405, ['sucesso' => false, 'mensagem' => 'Método não permitido.']);
}

try {
    require_once __DIR__ . '/../config/config.php';
    require_once __DIR__ . '/../config/session.php';
    require_once __DIR__ . '/../auth/helpers.php';

    try {
        $user = validate_session_user($pdo, $_SESSION, $destroy_session);
    } catch (Throwable $e) {
        if (isset($destroy_session) && is_callable($destroy_session)) {
            $destroy_session();
        }
        error_log('painel/ficha.php: erro ao validar sessao');
        respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
    }

    if ($user === null) {
        respond_json(401, ['sucesso' => false, 'mensagem' => 'Não autenticado.']);
    }
    if (!isset($user['perfil']) || !in_array($user['perfil'], ['ADMINISTRADOR', 'CADASTRADOR'], true)) {
        respond_json(403, ['sucesso' => false, 'mensagem' => 'Perfil não autorizado.']);
    }
    if (user_must_change_password($user)) {
        respond_json(403, ['sucesso' => false, 'mensagem' => 'Troca de senha obrigatória.']);
    }

    $rawId = $_GET['id'] ?? null;
    if (!is_string($rawId) || !preg_match('/\A[0-9]+\z/', $rawId)) {
        respond_json(400, ['sucesso' => false, 'mensagem' => 'Parâmetro inválido: id.']);
    }
    // Normalizar zeros iniciais e rejeitar overflow antes de converter para int.
    $normalizedId = ltrim($rawId, '0');
    $id = filter_var($normalizedId, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($id === false) {
        respond_json(400, ['sucesso' => false, 'mensagem' => 'Parâmetro inválido: id.']);
    }

    require_once __DIR__ . '/ficha-read.php';
    $ficha = fetch_ficha_detalhe($pdo, $id);
    if ($ficha === null) {
        respond_json(404, ['sucesso' => false, 'mensagem' => 'Ficha não encontrada.']);
    }

    respond_json(200, ['sucesso' => true, 'ficha' => $ficha]);
} catch (Throwable $e) {
    error_log('painel/ficha.php: falha interna ao consultar detalhe da ficha');
    respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
}
