<?php
declare(strict_types=1);
// fichas-recentes.php — lista 5 fichas mais recentes (GET)
// Reutiliza config, session e helpers de autenticação do módulo /cadastro/

function respond_json(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

// Apenas permitir GET
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'GET') {
    header('Allow: GET');
    respond_json(405, ['sucesso' => false, 'mensagem' => 'Método não permitido.']);
}

// Bootstrap
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/session.php';
require_once __DIR__ . '/../auth/helpers.php';

try {
    // Validar sessão
    try {
        $user = validate_session_user($pdo, $_SESSION, $destroy_session);
    } catch (Throwable $e) {
        if (isset($destroy_session) && is_callable($destroy_session)) $destroy_session();
        error_log('painel/fichas-recentes.php: erro ao validar sessao');
        respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
    }

    if ($user === null) {
        respond_json(401, ['sucesso' => false, 'mensagem' => 'Não autenticado.']);
    }

    // Perfis permitidos
    $allowedProfiles = ['ADMINISTRADOR', 'CADASTRADOR'];
    if (!isset($user['perfil']) || !in_array($user['perfil'], $allowedProfiles, true)) {
        respond_json(403, ['sucesso' => false, 'mensagem' => 'Perfil não autorizado.']);
    }

    if (user_must_change_password($user)) {
        respond_json(403, ['sucesso' => false, 'mensagem' => 'Troca de senha obrigatória.']);
    }

    // Query determinística: created_at DESC, id DESC, limite 5
    $sql = 'SELECT id, crianca_nome, responsavel_nome, situacao, created_at, created_by_name_snapshot FROM cad_fichas ORDER BY created_at DESC, id DESC LIMIT 5';
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $result = [];
    foreach ($rows as $r) {
        $id = isset($r['id']) ? (int)$r['id'] : 0;
        $numero = sprintf('PSA-%06d', $id);
        $result[] = [
            'id' => $id,
            'numero' => $numero,
            'criancaNome' => isset($r['crianca_nome']) ? (string)$r['crianca_nome'] : '',
            'responsavelNome' => isset($r['responsavel_nome']) ? (string)$r['responsavel_nome'] : '',
            'situacao' => isset($r['situacao']) ? (string)$r['situacao'] : '',
            'createdAt' => isset($r['created_at']) ? (string)$r['created_at'] : null,
            'cadastradoPor' => isset($r['created_by_name_snapshot']) ? (string)$r['created_by_name_snapshot'] : null,
        ];
    }

    respond_json(200, ['sucesso' => true, 'fichas' => $result]);

} catch (Throwable $e) {
    error_log('painel/fichas-recentes.php: exceção inesperada: ' . $e->getMessage());
    respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
}

?>
