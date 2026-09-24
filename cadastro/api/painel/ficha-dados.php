<?php
declare(strict_types=1);
// POST /cadastro/api/painel/ficha-dados.php?id=<id>

function respond_json(int $statusCode, array $payload): void
{
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        error_log('painel/ficha-dados.php: falha ao codificar resposta');
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

/**
 * Substituição completa dos dados cadastrais: todas as propriedades são exigidas.
 * Campos opcionais usam null; interests é a lista final, inclusive inativos mantidos.
 */
function ficha_dados_has_keys($value, array $keys): bool
{
    if (!($value instanceof stdClass)) return false;
    $properties = get_object_vars($value);
    return count($properties) === count($keys) && array_diff($keys, array_keys($properties)) === [];
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
    require_once __DIR__ . '/../fichas/validation.php';

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

    // Mesmo limite da criação, com leitura limitada antes de decodificar.
    $maxBody = 64 * 1024;
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
    $required = ['expectedUpdatedAt', 'child', 'schooling', 'guardian', 'interests',
        'otherInterestDescription', 'specificNeeds'];
    if (!ficha_dados_has_keys($decoded, $required)) {
        respond_json(400, ['sucesso' => false, 'mensagem' => 'Propriedades do payload inválidas.']);
    }
    $groups = [
        'child' => ['name', 'socialName', 'birthDate', 'sex', 'rg', 'cpf',
            'neighborhood', 'phone', 'school', 'hasDiagnosis'],
        'schooling' => ['year', 'grade'],
        'guardian' => ['name', 'relationship', 'birthDate', 'phone', 'whatsapp', 'email'],
    ];
    $data = get_object_vars($decoded);
    foreach ($groups as $group => $keys) {
        if (!ficha_dados_has_keys($data[$group], $keys)) {
            respond_json(400, ['sucesso' => false, 'mensagem' => 'Propriedades inválidas: ' . $group . '.']);
        }
        $data[$group] = get_object_vars($data[$group]);
        foreach ($data[$group] as $key => $value) {
            if ($group === 'child' && $key === 'hasDiagnosis') {
                $valid = $value === null || is_bool($value);
            } else {
                $valid = $value === null || is_string($value);
            }
            if (!$valid) {
                respond_json(400, ['sucesso' => false, 'mensagem' => 'Tipo inválido: ' . $group . '.' . $key . '.']);
            }
        }
    }
    foreach (['otherInterestDescription', 'specificNeeds'] as $key) {
        if ($data[$key] !== null && !is_string($data[$key])) {
            respond_json(400, ['sucesso' => false, 'mensagem' => 'Tipo inválido: ' . $key . '.']);
        }
    }
    if (!is_array($data['interests'])) {
        respond_json(400, ['sucesso' => false, 'mensagem' => 'Interesses devem ser uma lista.']);
    }
    foreach ($data['interests'] as $code) {
        if (!is_string($code) || trim($code) === '') {
            respond_json(400, ['sucesso' => false, 'mensagem' => 'Código de interesse inválido.']);
        }
    }
    // Proteção exclusiva da edição, antes da normalização compartilhada.
    // Aceitar dígitos ou as máscaras completas produzidas por cadastro/js/app.js.
    $presentations = [
        ['child', 'cpf', '/\A(?:[0-9]{11}|[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2})\z/'],
        ['child', 'phone', '/\A(?:[0-9]{10,11}|\([0-9]{2}\) [0-9]{4,5}-[0-9]{4})\z/'],
        ['guardian', 'phone', '/\A(?:[0-9]{10,11}|\([0-9]{2}\) [0-9]{4,5}-[0-9]{4})\z/'],
        ['guardian', 'whatsapp', '/\A(?:[0-9]{10,11}|\([0-9]{2}\) [0-9]{4,5}-[0-9]{4})\z/'],
    ];
    foreach ($presentations as [$group, $key, $pattern]) {
        $value = $data[$group][$key];
        if ($value === null) continue;
        // Apenas espaços externos são ignorados; controles/NUL não viram vazio.
        $value = trim($value, ' ');
        if ($value !== '' && preg_match($pattern, $value) !== 1) {
            respond_json(400, ['sucesso' => false, 'mensagem' => 'Formato inválido: ' . $group . '.' . $key . '.']);
        }
    }

    // Rejeitar datas malformadas antes de DateTime (inclusive bytes NUL).
    foreach (['child', 'guardian'] as $group) {
        $birth = $data[$group]['birthDate'];
        if ($birth !== null && !preg_match('/\A[0-9]{4}-[0-9]{2}-[0-9]{2}\z/', $birth)) {
            respond_json(400, ['sucesso' => false, 'mensagem' => 'Data inválida: ' . $group . '.birthDate.']);
        }
    }
    $expected = $data['expectedUpdatedAt'];
    if (!is_string($expected) || !valid_timestamp($expected)) {
        respond_json(400, ['sucesso' => false, 'mensagem' => 'Versão da ficha inválida.']);
    }
    // Não recebe, exige ou fabrica consentimento para a edição.
    $validated = validate_ficha_data($data);
    if ($validated['errors'] !== []) {
        respond_json(400, ['sucesso' => false, 'mensagem' => 'Validação falhou.', 'erros' => $validated['errors']]);
    }

    // Lista interna fechada: coluna => [nome no histórico, valor normalizado].
    $fields = [
        'crianca_nome' => ['child.name', $validated['child_name']],
        'crianca_nome_social' => ['child.socialName', $validated['child_social']],
        'crianca_nascimento' => ['child.birthDate', $validated['child_birth']],
        'crianca_sexo' => ['child.sex', $validated['child_sex']],
        'crianca_rg' => ['child.rg', $validated['child_rg']],
        'crianca_cpf' => ['child.cpf', $validated['child_cpf']],
        'bairro' => ['child.neighborhood', $validated['child_neighborhood']],
        'crianca_telefone' => ['child.phone', $validated['child_phone']],
        'escola_instituicao' => ['child.school', $validated['child_school']],
        'possui_diagnostico' => ['child.hasDiagnosis',
            $validated['hasDiagnosis'] === null ? null : ($validated['hasDiagnosis'] ? 1 : 0)],
        'ano_escolar' => ['schooling.year', $validated['schooling_year']],
        'serie_escolar' => ['schooling.grade', $validated['schooling_grade']],
        'responsavel_nome' => ['guardian.name', $validated['guardian_name']],
        'responsavel_parentesco' => ['guardian.relationship', $validated['guardian_relationship']],
        'responsavel_nascimento' => ['guardian.birthDate', $validated['guardian_birth']],
        'responsavel_telefone' => ['guardian.phone', $validated['guardian_phone']],
        'responsavel_whatsapp' => ['guardian.whatsapp', $validated['guardian_whatsapp']],
        'responsavel_email' => ['guardian.email', $validated['guardian_email']],
        'outro_interesse_descricao' => ['otherInterestDescription',
            $validated['has_outras'] ? $validated['otherInterestDescription'] : null],
        'necessidades_especificas' => ['specificNeeds', $validated['specificNeeds']],
    ];

    $pdo->beginTransaction();
    $stmt = $pdo->prepare('SELECT updated_at,
        crianca_nome, crianca_nome_social, crianca_nascimento, crianca_sexo, crianca_rg,
        crianca_cpf, bairro, crianca_telefone, escola_instituicao, possui_diagnostico,
        ano_escolar, serie_escolar, responsavel_nome, responsavel_parentesco,
        responsavel_nascimento, responsavel_telefone, responsavel_whatsapp,
        responsavel_email, outro_interesse_descricao, necessidades_especificas
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

    // A ficha já está bloqueada. Descobrir associações sem bloquear o catálogo.
    $stmt = $pdo->prepare('SELECT interesse_id FROM cad_ficha_interesses
        WHERE cadastro_id = :id');
    $stmt->bindValue(':id', $id, PDO::PARAM_INT);
    $stmt->execute();
    $existing = [];
    while (($interest = $stmt->fetch(PDO::FETCH_ASSOC)) !== false) {
        $interestId = (int)$interest['interesse_id'];
        if (isset($existing[$interestId])) {
            throw new RuntimeException('Associações de interesse inconsistentes.');
        }
        $existing[$interestId] = true;
    }

    $desired = [];
    $codes = $validated['normalized_interests'];
    $lockIds = $existing;
    if ($codes !== []) {
        $placeholders = implode(',', array_fill(0, count($codes), '?'));
        // Descoberta apenas: código e ativo serão conferidos sob lock abaixo.
        $stmt = $pdo->prepare("SELECT id FROM cad_interesses WHERE codigo IN ($placeholders)");
        $stmt->execute($codes);
        while (($interest = $stmt->fetch(PDO::FETCH_ASSOC)) !== false) {
            $lockIds[(int)$interest['id']] = true;
        }
    }

    // Uma única fase de locks do catálogo: união dos IDs, sem repetição, crescente.
    // Consultas por ID evitam depender da ordem de locks de um plano com IN/ORDER BY.
    $orderedIds = array_keys($lockIds);
    sort($orderedIds, SORT_NUMERIC);
    $catalog = [];
    $lock = $pdo->prepare('SELECT id, codigo, ativo FROM cad_interesses WHERE id = ? FOR UPDATE');
    foreach ($orderedIds as $interestId) {
        $lock->execute([$interestId]);
        $interest = $lock->fetch(PDO::FETCH_ASSOC);
        if ($interest === false || $interest['codigo'] === null) {
            if (isset($existing[$interestId])) {
                throw new RuntimeException('Associações de interesse inconsistentes.');
            }
            $pdo->rollBack();
            respond_json(400, ['sucesso' => false, 'mensagem' => 'Catálogo de interesses alterado. Recarregue os dados.']);
        }
        $code = strtoupper($interest['codigo']);
        if (isset($catalog[$code])) throw new RuntimeException('Catálogo de interesses inconsistente.');
        $catalog[$code] = $interest;
    }
    foreach ($codes as $code) {
        $interest = $catalog[$code] ?? null;
        if ($interest === null
            || ((int)$interest['ativo'] !== 1 && !isset($existing[(int)$interest['id']]))) {
            $pdo->rollBack();
            respond_json(400, ['sucesso' => false, 'mensagem' => 'Interesse inexistente ou inativo para nova associação.']);
        }
        $desired[(int)$interest['id']] = true;
    }
    // Só remove IDs omitidos da lista final explícita. Inativos enviados são mantidos.
    $removeIds = array_keys(array_diff_key($existing, $desired));
    $addIds = array_keys(array_diff_key($desired, $existing));
    $interestsChanged = $removeIds !== [] || $addIds !== [];

    $campos = [];
    $values = [];
    $digitColumns = ['crianca_cpf', 'crianca_telefone', 'responsavel_telefone', 'responsavel_whatsapp'];
    foreach ($fields as $column => [$label, $value]) {
        $stored = $current[$column];
        if ($column === 'possui_diagnostico') {
            $normalizedStored = $stored === null ? null : (int)$stored;
        } elseif (in_array($column, $digitColumns, true)) {
            $normalizedStored = normalize_digits($stored);
        } else {
            $normalizedStored = trim_or_null($stored);
        }
        if ($normalizedStored !== $value) {
            $campos[] = $label;
            $values[$column] = $value;
        } else {
            // Uma mudança em outro campo não reescreve a formatação histórica.
            $values[$column] = $stored;
        }
    }
    if ($interestsChanged) $campos[] = 'interests';
    $alterado = $campos !== [];

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
        // SQL fechado: nenhuma propriedade do payload vira identificador SQL.
        $update = $pdo->prepare('UPDATE cad_fichas SET
            crianca_nome = :crianca_nome, crianca_nome_social = :crianca_nome_social,
            crianca_nascimento = :crianca_nascimento, crianca_sexo = :crianca_sexo,
            crianca_rg = :crianca_rg, crianca_cpf = :crianca_cpf, bairro = :bairro,
            crianca_telefone = :crianca_telefone, escola_instituicao = :escola_instituicao,
            possui_diagnostico = :possui_diagnostico, ano_escolar = :ano_escolar,
            serie_escolar = :serie_escolar, responsavel_nome = :responsavel_nome,
            responsavel_parentesco = :responsavel_parentesco,
            responsavel_nascimento = :responsavel_nascimento,
            responsavel_telefone = :responsavel_telefone,
            responsavel_whatsapp = :responsavel_whatsapp, responsavel_email = :responsavel_email,
            outro_interesse_descricao = :outro_interesse_descricao,
            necessidades_especificas = :necessidades_especificas,
            updated_at = :updated_at, updated_by = :updated_by,
            updated_by_name_snapshot = :updated_by_name
            WHERE id = :id AND updated_at = :expected');
        foreach ($values as $column => $value) {
            $type = $value === null ? PDO::PARAM_NULL : (is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
            $update->bindValue(':' . $column, $value, $type);
        }
        $update->bindValue(':updated_at', $timestamp, PDO::PARAM_STR);
        $update->bindValue(':updated_by', (int)$user['id'], PDO::PARAM_INT);
        $update->bindValue(':updated_by_name', $user['nome'], PDO::PARAM_STR);
        $update->bindValue(':id', $id, PDO::PARAM_INT);
        $update->bindValue(':expected', $expected, PDO::PARAM_STR);
        $update->execute();
        if ($update->rowCount() !== 1) throw new RuntimeException('Atualização não confirmada.');

        if ($removeIds !== []) {
            $delete = $pdo->prepare('DELETE FROM cad_ficha_interesses WHERE cadastro_id = ? AND interesse_id = ?');
            foreach ($removeIds as $interestId) {
                $delete->execute([$id, $interestId]);
                if ($delete->rowCount() !== 1) throw new RuntimeException('Remoção de interesse não confirmada.');
            }
        }
        if ($addIds !== []) {
            $insert = $pdo->prepare('INSERT INTO cad_ficha_interesses (cadastro_id, interesse_id) VALUES (?, ?)');
            foreach ($addIds as $interestId) {
                $insert->execute([$id, $interestId]);
                if ($insert->rowCount() !== 1) throw new RuntimeException('Inclusão de interesse não confirmada.');
            }
        }

        // ALTERACAO já é usada pelo painel; não exige novo valor no schema.
        // Somente nomes de campos, sem valores pessoais anteriores/novos.
        $camposJson = json_encode($campos, JSON_UNESCAPED_UNICODE);
        if ($camposJson === false) throw new RuntimeException('Falha ao codificar auditoria.');
        $audit = $pdo->prepare('INSERT INTO cad_auditoria
            (cadastro_id, usuario_id, usuario_nome_snapshot, operacao, ocorrido_at,
             campos_alterados, situacao_anterior, situacao_nova)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $audit->execute([$id, (int)$user['id'], $user['nome'], 'ALTERACAO', $timestamp, $camposJson, null, null]);
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
            error_log('painel/ficha-dados.php: falha no rollback');
        }
    }
    error_log('painel/ficha-dados.php: falha interna na atualização cadastral');
    respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
}
