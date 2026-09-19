<?php
declare(strict_types=1);
// POST /cadastro/api/painel/ficha-administrativo.php?id=<id>

function respond_json(int $statusCode, array $payload): void
{
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        error_log('painel/ficha-administrativo.php: falha ao codificar resposta');
        $statusCode = 500;
        $json = '{"sucesso":false,"mensagem":"Erro interno."}';
    }
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo $json;
    exit;
}

function valid_date(string $value): bool
{
    if (!preg_match('/\A([0-9]{4})-([0-9]{2})-([0-9]{2})\z/', $value, $parts)) {
        return false;
    }
    return (int)$parts[1] >= 1000
        && checkdate((int)$parts[2], (int)$parts[3], (int)$parts[1]);
}

function valid_timestamp(string $value): bool
{
    if (!preg_match('/\A([0-9]{4}-[0-9]{2}-[0-9]{2}) ([0-9]{2}):([0-9]{2}):([0-9]{2})\.[0-9]{6}\z/', $value, $parts)) {
        return false;
    }
    return valid_date($parts[1]) && (int)$parts[2] <= 23
        && (int)$parts[3] <= 59 && (int)$parts[4] <= 59;
}

function normalize_observacoes(?string $value): ?string
{
    if ($value === null) return null;
    $value = trim($value);
    return $value === '' ? null : $value;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    header('Allow: POST');
    respond_json(405, ['sucesso' => false, 'mensagem' => 'Método não permitido.']);
}

$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (!is_string($contentType) || strtolower(trim(explode(';', $contentType, 2)[0])) !== 'application/json') {
    respond_json(415, ['sucesso' => false, 'mensagem' => 'Content-Type inválido.']);
}

try {
    require_once __DIR__ . '/../config/config.php';
    require_once __DIR__ . '/../config/session.php';
    require_once __DIR__ . '/../auth/helpers.php';
    require_once __DIR__ . '/ficha-read.php';

    try {
        $user = validate_session_user($pdo, $_SESSION, $destroy_session);
    } catch (Throwable $e) {
        if (isset($destroy_session) && is_callable($destroy_session)) $destroy_session();
        throw $e;
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
    $received = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($received) || !csrf_validate_token($_SESSION, $received)) {
        respond_json(403, ['sucesso' => false, 'mensagem' => 'Requisição não autorizada.']);
    }

    $rawId = $_GET['id'] ?? null;
    if (!is_string($rawId) || !preg_match('/\A[0-9]+\z/', $rawId)) {
        respond_json(400, ['sucesso' => false, 'mensagem' => 'Parâmetro inválido: id.']);
    }
    $id = filter_var(ltrim($rawId, '0'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($id === false) {
        respond_json(400, ['sucesso' => false, 'mensagem' => 'Parâmetro inválido: id.']);
    }

    // TEXT: até 65.535 bytes; escapes JSON podem ocupar até seis vezes mais.
    // Ler somente limite + 1, sem confiar em Content-Length.
    $maxBody = 512 * 1024;
    $raw = file_get_contents('php://input', false, null, 0, $maxBody + 1);
    if ($raw === false) {
        respond_json(400, ['sucesso' => false, 'mensagem' => 'Requisição inválida.']);
    }
    if (strlen($raw) > $maxBody) {
        respond_json(413, ['sucesso' => false, 'mensagem' => 'Payload muito grande.']);
    }
    $decoded = json_decode($raw);
    if (json_last_error() !== JSON_ERROR_NONE || !($decoded instanceof stdClass)) {
        respond_json(400, ['sucesso' => false, 'mensagem' => 'JSON inválido.']);
    }
    $data = get_object_vars($decoded);
    $required = ['expectedUpdatedAt', 'situacao', 'dataIngresso', 'observacoesAdministrativas'];
    if (count($data) !== count($required) || array_diff($required, array_keys($data)) !== []) {
        respond_json(400, ['sucesso' => false, 'mensagem' => 'Propriedades do payload inválidas.']);
    }
    $situacao = $data['situacao'];
    if (!is_string($situacao) || !in_array($situacao, ['ATIVO', 'AGUARDANDO_DOCUMENTACAO', 'ACOMPANHAMENTO', 'ENCERRADO'], true)) {
        respond_json(400, ['sucesso' => false, 'mensagem' => 'Situação inválida.']);
    }
    $dataIngresso = $data['dataIngresso'];
    if ($dataIngresso !== null && (!is_string($dataIngresso) || !valid_date($dataIngresso))) {
        respond_json(400, ['sucesso' => false, 'mensagem' => 'Data de ingresso inválida.']);
    }
    $observacoes = $data['observacoesAdministrativas'];
    if ($observacoes !== null && !is_string($observacoes)) {
        respond_json(400, ['sucesso' => false, 'mensagem' => 'Observações administrativas inválidas.']);
    }
    // json_decode rejeita UTF-8 inválido; strlen mede os bytes da string decodificada.
    $observacoes = normalize_observacoes($observacoes);
    if ($observacoes !== null && strlen($observacoes) > 65535) {
        respond_json(400, ['sucesso' => false, 'mensagem' => 'Observações administrativas excedem o limite permitido.']);
    }
    $expected = $data['expectedUpdatedAt'];
    if (!is_string($expected) || !valid_timestamp($expected)) {
        respond_json(400, ['sucesso' => false, 'mensagem' => 'Versão da ficha inválida.']);
    }

    $pdo->beginTransaction();
    $stmt = $pdo->prepare('SELECT situacao, data_ingresso, observacoes_administrativas, updated_at
        FROM cad_fichas WHERE id = :id FOR UPDATE');
    $stmt->bindValue(':id', $id, PDO::PARAM_INT);
    $stmt->execute();
    $current = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($current === false) {
        $pdo->rollBack();
        respond_json(404, ['sucesso' => false, 'mensagem' => 'Ficha não encontrada.']);
    }
    if ($current['updated_at'] !== $expected) {
        $pdo->rollBack();
        respond_json(409, ['sucesso' => false, 'mensagem' => 'A ficha foi alterada por outro usuário. Recarregue os dados antes de salvar.']);
    }

    $situacaoMudou = $current['situacao'] !== $situacao;
    $ingressoMudou = $current['data_ingresso'] !== $dataIngresso;
    $observacoesMudaram = normalize_observacoes($current['observacoes_administrativas']) !== $observacoes;
    $campos = [];
    if ($situacaoMudou) $campos[] = 'administrativo.situacao';
    if ($ingressoMudou) $campos[] = 'administrativo.dataIngresso';
    if ($observacoesMudaram) $campos[] = 'administrativo.observacoesAdministrativas';
    $alterado = count($campos) > 0;

    if ($alterado) {
        $utc = new DateTimeZone('UTC');
        $agora = new DateTimeImmutable('now', $utc);
        $timestamp = $agora->format('Y-m-d H:i:s.u');
        if (strcmp($timestamp, $current['updated_at']) <= 0) {
            $anterior = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s.u', $current['updated_at'], $utc);
            if ($anterior === false) throw new RuntimeException('Timestamp interno inválido.');
            $seguinte = $anterior->modify('+1 microsecond');
            if ($seguinte === false) throw new RuntimeException('Falha ao incrementar timestamp.');
            $timestamp = $seguinte->format('Y-m-d H:i:s.u');
        }
        if (!valid_timestamp($timestamp) || strcmp($timestamp, $current['updated_at']) <= 0) {
            throw new RuntimeException('Timestamp fora do intervalo permitido.');
        }
        // SQL estático. Campos sem mudança mantêm exatamente o valor armazenado.
        $update = $pdo->prepare('UPDATE cad_fichas SET situacao = :situacao,
            data_ingresso = :data_ingresso, observacoes_administrativas = :observacoes,
            updated_at = :updated_at, updated_by = :updated_by,
            updated_by_name_snapshot = :updated_by_name
            WHERE id = :id AND updated_at = :expected');
        $update->bindValue(':situacao', $situacao, PDO::PARAM_STR);
        $update->bindValue(':data_ingresso', $dataIngresso, $dataIngresso === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        $observacoesPersistidas = $observacoesMudaram ? $observacoes : $current['observacoes_administrativas'];
        $update->bindValue(':observacoes', $observacoesPersistidas, $observacoesPersistidas === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        $update->bindValue(':updated_at', $timestamp, PDO::PARAM_STR);
        $update->bindValue(':updated_by', (int)$user['id'], PDO::PARAM_INT);
        $update->bindValue(':updated_by_name', $user['nome'], PDO::PARAM_STR);
        $update->bindValue(':id', $id, PDO::PARAM_INT);
        $update->bindValue(':expected', $expected, PDO::PARAM_STR);
        $update->execute();
        if ($update->rowCount() !== 1) throw new RuntimeException('Atualização não confirmada.');

        $operacao = 'ALTERACAO';
        if (count($campos) === 1) {
            if ($situacaoMudou) $operacao = 'ALTERACAO_STATUS';
            elseif ($observacoesMudaram) $operacao = 'ALTERACAO_OBSERVACOES';
        }
        $camposJson = json_encode($campos, JSON_UNESCAPED_UNICODE);
        if ($camposJson === false) throw new RuntimeException('Falha ao codificar auditoria.');
        $audit = $pdo->prepare('INSERT INTO cad_auditoria
            (cadastro_id, usuario_id, usuario_nome_snapshot, operacao, ocorrido_at,
             campos_alterados, situacao_anterior, situacao_nova)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $audit->execute([
            $id, (int)$user['id'], $user['nome'], $operacao, $timestamp, $camposJson,
            $situacaoMudou ? $current['situacao'] : null,
            $situacaoMudou ? $situacao : null,
        ]);
        if ($audit->rowCount() !== 1) throw new RuntimeException('Auditoria não confirmada.');
    }

    $ficha = fetch_ficha_detalhe($pdo, $id);
    if ($ficha === null) throw new RuntimeException('Falha na leitura final.');
    // Preparar JSON antes do commit: falha de codificação também causa rollback.
    $json = json_encode(['sucesso' => true, 'alterado' => $alterado, 'ficha' => $ficha], JSON_UNESCAPED_UNICODE);
    if ($json === false) throw new RuntimeException('Falha ao codificar resposta.');
    $pdo->commit();

    http_response_code(200);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo $json;
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        try {
            $pdo->rollBack();
        } catch (Throwable $rollbackError) {
            error_log('painel/ficha-administrativo.php: falha no rollback');
        }
    }
    error_log('painel/ficha-administrativo.php: falha interna na atualização administrativa');
    respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
}
