<?php
declare(strict_types=1);
// usuarios.php — listagem administrativa de usuários (GET, somente leitura).

function respond_json(int $statusCode, array $payload): void
{
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE);
    if ($json === false) {
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

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/session.php';
require_once __DIR__ . '/../auth/helpers.php';

try {
    $user = validate_session_user($pdo, $_SESSION, $destroy_session);
} catch (Throwable $e) {
    if (isset($destroy_session) && is_callable($destroy_session)) $destroy_session();
    error_log('painel/usuarios.php: erro ao validar sessao');
    respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
}

if ($user === null) {
    respond_json(401, ['sucesso' => false, 'mensagem' => 'Não autenticado.']);
}

// O helper já exige usuário existente e ativo, com sessão válida no banco.
if (($user['perfil'] ?? null) !== 'ADMINISTRADOR') {
    respond_json(403, ['sucesso' => false, 'mensagem' => 'Requisição não autorizada.']);
}

if (user_must_change_password($user)) {
    respond_json(403, ['sucesso' => false, 'mensagem' => 'Troca de senha obrigatória.']);
}

try {
    // Reutiliza o teto de 100 registros de fichas.php, sem parâmetros nesta versão.
    $stmt = $pdo->prepare('SELECT id, nome, login, perfil, ativo, must_change_password, created_at, updated_at
        FROM cad_usuarios
        ORDER BY nome ASC, id ASC
        LIMIT 100');
    $stmt->execute();

    $usuarios = [];
    while (($row = $stmt->fetch(PDO::FETCH_ASSOC)) !== false) {
        // Não produzir uma resposta pública fora do contrato em caso de dados inconsistentes.
        if (!isset($row['id'], $row['nome'], $row['login'], $row['perfil'],
            $row['ativo'], $row['must_change_password'], $row['created_at'], $row['updated_at'])
            || (int)$row['id'] <= 0
            || !is_string($row['nome']) || !is_string($row['login'])
            || !in_array($row['perfil'], ['ADMINISTRADOR', 'CADASTRADOR'], true)
            || !in_array($row['ativo'], [0, 1, '0', '1'], true)
            || !in_array($row['must_change_password'], [0, 1, '0', '1'], true)
            || !is_string($row['created_at']) || !is_string($row['updated_at'])) {
            throw new RuntimeException('Registro de usuario inconsistente.');
        }

        $usuarios[] = [
            'id' => (int)$row['id'],
            'nome' => $row['nome'],
            'login' => $row['login'],
            'perfil' => $row['perfil'],
            'ativo' => (int)$row['ativo'] === 1,
            'mustChangePassword' => user_must_change_password($row),
            'createdAt' => $row['created_at'],
            'updatedAt' => $row['updated_at'],
        ];
    }

    respond_json(200, ['sucesso' => true, 'usuarios' => $usuarios]);
} catch (Throwable $e) {
    error_log('painel/usuarios.php: erro interno ao listar usuarios');
    respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
}
