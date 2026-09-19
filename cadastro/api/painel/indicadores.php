<?php
declare(strict_types=1);
// indicadores.php — indicadores do Dashboard (GET)
// Reutiliza config, session e helpers de autenticação do módulo /cadastro/

// Resposta JSON helper
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
        error_log('painel/indicadores.php: erro ao validar sessao');
        respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
    }

    if ($user === null) {
        respond_json(401, ['sucesso' => false, 'mensagem' => 'Não autenticado.']);
    }

    // Perfis permitidos — reutilizar a mesma regra do sistema
    $allowedProfiles = ['ADMINISTRADOR', 'CADASTRADOR'];
    if (!isset($user['perfil']) || !in_array($user['perfil'], $allowedProfiles, true)) {
        respond_json(403, ['sucesso' => false, 'mensagem' => 'Perfil não autorizado.']);
    }

    // Consultas: calcular indicadores a partir de cad_fichas
    $sql = "SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN situacao = 'ATIVO' THEN 1 ELSE 0 END) AS ativos,
        SUM(CASE WHEN situacao = 'AGUARDANDO_DOCUMENTACAO' THEN 1 ELSE 0 END) AS aguardando,
        SUM(CASE WHEN situacao = 'ACOMPANHAMENTO' THEN 1 ELSE 0 END) AS acompanhamento
        FROM cad_fichas";

    $stmt = $pdo->query($sql);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row === false) {
        respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
    }

    $indicadores = [
        'total' => isset($row['total']) ? (int)$row['total'] : 0,
        'ativos' => isset($row['ativos']) ? (int)$row['ativos'] : 0,
        'aguardandoDocumentacao' => isset($row['aguardando']) ? (int)$row['aguardando'] : 0,
        'acompanhamento' => isset($row['acompanhamento']) ? (int)$row['acompanhamento'] : 0,
    ];

    respond_json(200, ['sucesso' => true, 'indicadores' => $indicadores]);

} catch (Throwable $e) {
    // Registrar detalhe técnico apenas no log
    error_log('painel/indicadores.php: exceção inesperada: ' . $e->getMessage());
    respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
}

?>
