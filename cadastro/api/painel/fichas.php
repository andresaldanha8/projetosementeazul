<?php
declare(strict_types=1);
// fichas.php — listagem paginada e filtrável para o painel
// GET /cadastro/api/painel/fichas.php

if (basename($_SERVER['SCRIPT_FILENAME']) === basename(__FILE__)) {
    // allow as endpoint
}

function respond_json(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

// Only allow GET
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'GET') {
    header('Allow: GET');
    respond_json(405, ['sucesso' => false, 'mensagem' => 'Método não permitido.']);
}

// Bootstrap config, session and auth helpers (use same paths as other painel endpoints)
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/session.php';
require_once __DIR__ . '/../auth/helpers.php';

// Validate session and user
try {
    $user = validate_session_user($pdo, $_SESSION, $destroy_session);
} catch (Throwable $e) {
    if (isset($destroy_session) && is_callable($destroy_session)) $destroy_session();
    error_log('painel/fichas.php: erro ao validar sessao');
    respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
}
if ($user === null) {
    respond_json(401, ['sucesso' => false, 'mensagem' => 'Não autenticado.']);
}

// Block access when user must change password (consistent with other endpoints)
if (isset($user['must_change_password']) && (int)$user['must_change_password'] === 1) {
    respond_json(403, ['sucesso' => false, 'mensagem' => 'Troca de senha obrigatória.']);
}

// Allowed situacao tokens
$allowedSituacoes = [
    'ATIVO',
    'AGUARDANDO_DOCUMENTACAO',
    'ACOMPANHAMENTO',
    'ENCERRADO'
];

// Read and validate query parameters
$q = isset($_GET['q']) ? trim((string)$_GET['q']) : null;
$situacao = isset($_GET['situacao']) ? trim((string)$_GET['situacao']) : null;
$data_inicio = isset($_GET['data_inicio']) ? trim((string)$_GET['data_inicio']) : null;
$data_fim = isset($_GET['data_fim']) ? trim((string)$_GET['data_fim']) : null;

$page = 1;
if (isset($_GET['page'])) {
    if (!ctype_digit((string)$_GET['page']) || (int)$_GET['page'] < 1) {
        respond_json(400, ['sucesso' => false, 'mensagem' => 'Parâmetro inválido: page']);
    }
    $page = (int)$_GET['page'];
}

$per_page = 50;
if (isset($_GET['per_page'])) {
    if (!ctype_digit((string)$_GET['per_page']) || (int)$_GET['per_page'] < 1) {
        respond_json(400, ['sucesso' => false, 'mensagem' => 'Parâmetro inválido: per_page']);
    }
    $per_page = (int)$_GET['per_page'];
}
if ($per_page > 100) $per_page = 100;

// Validate situacao if provided
if ($situacao !== null && $situacao !== '') {
    if (!in_array($situacao, $allowedSituacoes, true)) {
        respond_json(400, ['sucesso' => false, 'mensagem' => 'Parâmetro inválido: situacao']);
    }
}

// Validate dates (YYYY-MM-DD)
function is_valid_ymd(string $d): bool
{
    $dt = DateTime::createFromFormat('Y-m-d', $d);
    return $dt && $dt->format('Y-m-d') === $d;
}

if ($data_inicio !== null && $data_inicio !== '') {
    if (!is_valid_ymd($data_inicio)) respond_json(400, ['sucesso' => false, 'mensagem' => 'Parâmetro inválido: data_inicio']);
}
if ($data_fim !== null && $data_fim !== '') {
    if (!is_valid_ymd($data_fim)) respond_json(400, ['sucesso' => false, 'mensagem' => 'Parâmetro inválido: data_fim']);
}
if ($data_inicio !== null && $data_inicio !== '' && $data_fim !== null && $data_fim !== '') {
    $di = DateTime::createFromFormat('Y-m-d', $data_inicio);
    $df = DateTime::createFromFormat('Y-m-d', $data_fim);
    if ($di > $df) respond_json(400, ['sucesso' => false, 'mensagem' => 'data_inicio não pode ser posterior a data_fim']);
}

// Build WHERE clauses and parameters
$where = [];
$params = [];
$paramTypes = [];

if ($situacao !== null && $situacao !== '') {
    $where[] = 'situacao = ?';
    $params[] = $situacao;
    $paramTypes[] = PDO::PARAM_STR;
}

// Date range: created_at >= data_inicio 00:00:00 and created_at < (data_fim +1 day) 00:00:00
if ($data_inicio !== null && $data_inicio !== '') {
    $startTs = $data_inicio . ' 00:00:00';
    $where[] = 'created_at >= ?';
    $params[] = $startTs;
    $paramTypes[] = PDO::PARAM_STR;
}
if ($data_fim !== null && $data_fim !== '') {
    // exclusive upper bound: next day 00:00:00
    $df = DateTime::createFromFormat('Y-m-d', $data_fim, new DateTimeZone('UTC'));
    $df->modify('+1 day');
    $endTs = $df->format('Y-m-d') . ' 00:00:00';
    $where[] = 'created_at < ?';
    $params[] = $endTs;
    $paramTypes[] = PDO::PARAM_STR;
}

// Search q: PSA/id, numeric id, CPF (digits >=3), or text search on crianca_nome/responsavel_nome
if ($q !== null && $q !== '') {
    $qRaw = $q;
    // Check PSA pattern
    if (preg_match('/^PSA-?0*(\d+)$/i', $qRaw, $m)) {
        $id = (int)$m[1];
        $where[] = 'id = ?';
        $params[] = $id;
        $paramTypes[] = PDO::PARAM_INT;
    } elseif (preg_match('/^\d+$/', $qRaw)) {
        // pure digits: could be id or CPF search; try id exact first
        $num = $qRaw;
        // treat as id if reasonable (<= 1e9)
        if (strlen($num) <= 9) {
            $id = (int)$num;
            $where[] = 'id = ?';
            $params[] = $id;
            $paramTypes[] = PDO::PARAM_INT;
        } elseif (strlen($num) >= 3) {
            // long digits: use CPF search
            $digits = preg_replace('/\D+/', '', $qRaw);
            if (strlen($digits) >= 3) {
                $where[] = 'crianca_cpf LIKE ?';
                $params[] = '%' . $digits . '%';
                $paramTypes[] = PDO::PARAM_STR;
            }
        }
        // If digits length between 3 and 9 but not intended as id, also allow CPF match
        if (strlen($num) >= 3 && strlen($num) <= 11) {
            // add OR clause for CPF search alongside any id condition
            $where[] = '(crianca_cpf LIKE ? OR id = ?)';
            $params[] = '%' . $num . '%';
            $paramTypes[] = PDO::PARAM_STR;
            $params[] = (int)$num;
            $paramTypes[] = PDO::PARAM_INT;
        }
    } else {
        // text search: case-insensitive on crianca_nome and responsavel_nome
        $term = mb_strtolower($qRaw, 'UTF-8');
        $like = '%' . $term . '%';
        // Use LOWER(...) in SQL to ensure case-insensitive matching when collation is not CI
        $where[] = '(LOWER(crianca_nome) LIKE ? OR LOWER(responsavel_nome) LIKE ?)';
        $params[] = $like;
        $paramTypes[] = PDO::PARAM_STR;
        $params[] = $like;
        $paramTypes[] = PDO::PARAM_STR;
    }
}

// Compose final WHERE clause
$whereSql = '';
if (!empty($where)) {
    $whereSql = 'WHERE ' . implode(' AND ', $where);
}

// Pagination
$offset = ($page - 1) * $per_page;

try {
    // Count total with same filters
    $countSql = 'SELECT COUNT(*) AS cnt FROM cad_fichas ' . $whereSql;
    $countStmt = $pdo->prepare($countSql);
    // bind params for count
    for ($i = 0; $i < count($params); $i++) {
        $type = $paramTypes[$i] ?? PDO::PARAM_STR;
        $countStmt->bindValue($i + 1, $params[$i], $type);
    }
    $countStmt->execute();
    $row = $countStmt->fetch(PDO::FETCH_ASSOC);
    $total = $row === false ? 0 : (int)$row['cnt'];

    // Select page of results
    $selectSql = 'SELECT id, crianca_nome, crianca_nascimento, crianca_sexo, responsavel_nome, responsavel_parentesco, situacao, created_at, created_by_name_snapshot FROM cad_fichas ' . $whereSql . ' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?';
    $selectStmt = $pdo->prepare($selectSql);

    // bind params for select (existing params + limit/offset)
    $bindIndex = 1;
    for ($i = 0; $i < count($params); $i++, $bindIndex++) {
        $type = $paramTypes[$i] ?? PDO::PARAM_STR;
        $selectStmt->bindValue($bindIndex, $params[$i], $type);
    }
    // bind limit and offset as integers
    $selectStmt->bindValue($bindIndex++, $per_page, PDO::PARAM_INT);
    $selectStmt->bindValue($bindIndex++, $offset, PDO::PARAM_INT);

    $selectStmt->execute();
    $fichas = [];
    while (($r = $selectStmt->fetch(PDO::FETCH_ASSOC)) !== false) {
        // ensure types
        $id = isset($r['id']) ? (int)$r['id'] : 0;
        $numero = sprintf('PSA-%06d', $id);
        $fichas[] = [
            'id' => $id,
            'numero' => $numero,
            'criancaNome' => isset($r['crianca_nome']) ? (string)$r['crianca_nome'] : '',
            'criancaNascimento' => isset($r['crianca_nascimento']) ? (string)$r['crianca_nascimento'] : null,
            'criancaSexo' => isset($r['crianca_sexo']) && $r['crianca_sexo'] !== '' ? (string)$r['crianca_sexo'] : null,
            'responsavelNome' => isset($r['responsavel_nome']) ? (string)$r['responsavel_nome'] : null,
            'responsavelParentesco' => isset($r['responsavel_parentesco']) ? (string)$r['responsavel_parentesco'] : null,
            'situacao' => isset($r['situacao']) ? (string)$r['situacao'] : null,
            'createdAt' => isset($r['created_at']) ? (string)$r['created_at'] : null,
            'cadastradoPor' => isset($r['created_by_name_snapshot']) ? (string)$r['created_by_name_snapshot'] : null,
        ];
    }

    respond_json(200, [
        'sucesso' => true,
        'total' => $total,
        'page' => $page,
        'perPage' => $per_page,
        'fichas' => $fichas,
    ]);

} catch (Throwable $e) {
    error_log('painel/fichas.php: exceção interna');
    respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
}

?>
