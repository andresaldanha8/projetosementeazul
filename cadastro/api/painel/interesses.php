<?php
declare(strict_types=1);
// GET /cadastro/api/painel/interesses.php

function respond_json(int $statusCode, array $payload): void
{
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        error_log('painel/interesses.php: falha ao codificar resposta JSON');
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
        error_log('painel/interesses.php: erro ao validar sessao');
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

    // Catálogo ativo para novas seleções. Parâmetros do cliente não são utilizados.
    // Associações históricas/inativas continuam vindo do detalhe da ficha.
    $stmt = $pdo->prepare('SELECT codigo, nome FROM cad_interesses
        WHERE ativo = 1 ORDER BY ordem ASC, id ASC');
    $stmt->execute();
    $interesses = $stmt->fetchAll(PDO::FETCH_ASSOC);

    respond_json(200, ['sucesso' => true, 'interesses' => $interesses]);
} catch (Throwable $e) {
    error_log('painel/interesses.php: falha interna ao consultar catálogo');
    respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
}
