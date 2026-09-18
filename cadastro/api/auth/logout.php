<?php
declare(strict_types=1);
// logout.php — encerra a sessão PSA_CADASTRO_SESSION de forma idempotente

function respond_json(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate');
    header('Pragma: no-cache');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

// Aceita somente POST
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    header('Allow: POST');
    respond_json(405, ['sucesso' => false, 'mensagem' => 'Método não permitido.']);
}

// Carregar sessão (não carregar config.php nem criar PDO)
require_once __DIR__ . '/../config/session.php';

// Detectar se sessão aparenta autenticada (marcadores mínimos)
$hasAuthMarkers = isset($_SESSION['psa_user_id']) && isset($_SESSION['psa_auth_version']);

// Se existir identidade aparente, exigir CSRF
if ($hasAuthMarkers) {
    // Ler header X-CSRF-Token
    $received = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($received) || $received === '') {
        respond_json(403, ['sucesso' => false, 'mensagem' => 'Requisição não autorizada.']);
    }

    // Para validar CSRF precisamos do helper
    require_once __DIR__ . '/helpers.php';
    try {
        $valid = csrf_validate_token($_SESSION, $received);
    } catch (Throwable $e) {
        error_log('logout.php: erro ao validar token CSRF');
        respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
    }
    if (!$valid) {
        respond_json(403, ['sucesso' => false, 'mensagem' => 'Requisição não autorizada.']);
    }
}

// Agora efetuar destruição da sessão — idempotente
if (isset($destroy_session) && is_callable($destroy_session)) {
    try {
        $destroy_session();
    } catch (Throwable $e) {
        error_log('logout.php: falha ao destruir sessao');
        respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
    }
} else {
    // Callback indisponível — erro de configuração
    error_log('logout.php: destrutor de sessao indisponivel');
    respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
}

// Sucesso idempotente
respond_json(200, ['sucesso' => true]);
