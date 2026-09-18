<?php
declare(strict_types=1);
// create.php — endpoint para criação de ficha (CRUD criação transacional)
// Regras: usar config.php, session.php e helpers.php existentes.

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

// Only allow POST
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    header('Allow: POST');
    respond_json(405, ['sucesso' => false, 'mensagem' => 'Método não permitido.']);
}

// Content-Type must be application/json
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($contentType, 'application/json') !== 0) {
    respond_json(415, ['sucesso' => false, 'mensagem' => 'Content-Type inválido.']);
}

// Read raw body with reasonable limit
$raw = file_get_contents('php://input');
if ($raw === false) {
    respond_json(400, ['sucesso' => false, 'mensagem' => 'Requisição inválida.']);
}
$maxBody = 64 * 1024; // 64KB
if (strlen($raw) > $maxBody) {
    respond_json(413, ['sucesso' => false, 'mensagem' => 'Payload muito grande.']);
}

$data = json_decode($raw, true);
if (!is_array($data)) {
    respond_json(400, ['sucesso' => false, 'mensagem' => 'JSON inválido.']);
}

// Helpers: basic validators used only inside this file
function trim_or_null($v)
{
    if (!is_string($v)) return null;
    $t = trim($v);
    return $t === '' ? null : $t;
}

function is_valid_iso_date(string $d): bool
{
    $dt = DateTime::createFromFormat('Y-m-d', $d);
    return $dt && $dt->format('Y-m-d') === $d;
}

function normalize_digits($v)
{
    if ($v === null) return null;
    // Only accept strings here; callers must validate types before calling
    if (!is_string($v)) return null;
    $s = preg_replace('/\D+/', '', $v);
    return $s === '' ? null : $s;
}

function validate_cpf_digits(string $cpf): bool
{
    // expects 11 digits
    if (!preg_match('/^\d{11}$/', $cpf)) return false;
    // invalid known patterns
    if (preg_match('/^(\d)\1{10}$/', $cpf)) return false;
    $digits = str_split($cpf);
    // first verifier
    $sum = 0;
    for ($i = 0; $i < 9; $i++) $sum += (int)$digits[$i] * (10 - $i);
    $r = $sum % 11;
    $d1 = ($r < 2) ? 0 : 11 - $r;
    if ($d1 !== (int)$digits[9]) return false;
    // second verifier
    $sum = 0;
    for ($i = 0; $i < 10; $i++) $sum += (int)$digits[$i] * (11 - $i);
    $r = $sum % 11;
    $d2 = ($r < 2) ? 0 : 11 - $r;
    if ($d2 !== (int)$digits[10]) return false;
    return true;
}

// Begin access control: load config, session and helpers
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/session.php';
require_once __DIR__ . '/../auth/helpers.php';

// Validate session user authoritative
try {
    $user = validate_session_user($pdo, $_SESSION, $destroy_session);
} catch (Throwable $e) {
    if (isset($destroy_session) && is_callable($destroy_session)) $destroy_session();
    error_log('create.php: erro ao validar sessao');
    respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
}
if ($user === null) {
    respond_json(401, ['sucesso' => false, 'mensagem' => 'Não autenticado.']);
}

// Check must_change_password
if (isset($user['must_change_password']) && (int)$user['must_change_password'] === 1) {
    respond_json(403, ['sucesso' => false, 'mensagem' => 'Troca de senha obrigatória.']);
}

// Check profile
$allowedProfiles = ['ADMINISTRADOR', 'CADASTRADOR'];
if (!isset($user['perfil']) || !in_array($user['perfil'], $allowedProfiles, true)) {
    respond_json(403, ['sucesso' => false, 'mensagem' => 'Perfil não autorizado.']);
}

// Validate CSRF
$received = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
if (!is_string($received) || $received === '') {
    respond_json(403, ['sucesso' => false, 'mensagem' => 'Requisição não autorizada.']);
}
try {
    $validCsrf = csrf_validate_token($_SESSION, $received);
} catch (Throwable $e) {
    error_log('create.php: erro ao validar token CSRF');
    respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
}
if (!$validCsrf) {
    respond_json(403, ['sucesso' => false, 'mensagem' => 'Requisição não autorizada.']);
}

// Now structural validation of payload
$errors = [];

$child = is_array($data['child'] ?? null) ? $data['child'] : [];
$schooling = is_array($data['schooling'] ?? null) ? $data['schooling'] : [];
$guardian = is_array($data['guardian'] ?? null) ? $data['guardian'] : [];
$interests = is_array($data['interests'] ?? null) ? $data['interests'] : [];
$otherInterestDescription = $data['otherInterestDescription'] ?? null;
$specificNeeds = $data['specificNeeds'] ?? null;
$consent = $data['consent'] ?? null;

// Required fields
$child_name = trim_or_null($child['name'] ?? null);
if ($child_name === null) $errors[] = 'child.name obrigatório.';

// child.socialName type check and trim
$child_social = null;
if (array_key_exists('socialName', $child) && $child['socialName'] !== null && !is_string($child['socialName'])) {
    $errors[] = 'child.socialName tipo inválido.';
} else {
    $child_social = trim_or_null($child['socialName'] ?? null);
}

$child_birth = $child['birthDate'] ?? null;
if (!is_string($child_birth) || !is_valid_iso_date($child_birth)) $errors[] = 'child.birthDate inválida.';
else {
    // future date check
    $d = DateTime::createFromFormat('Y-m-d', $child_birth, new DateTimeZone('UTC'));
    $nowDate = new DateTime('now', new DateTimeZone('UTC'));
    if ($d > $nowDate) $errors[] = 'child.birthDate não pode ser futura.';
}

$guardian_name = trim_or_null($guardian['name'] ?? null);
if ($guardian_name === null) $errors[] = 'guardian.name obrigatório.';

$guardian_relationship = trim_or_null($guardian['relationship'] ?? null);
if ($guardian_relationship === null) $errors[] = 'guardian.relationship obrigatório.';

$guardian_phone = normalize_digits($guardian['phone'] ?? null);
$guardian_whatsapp = normalize_digits($guardian['whatsapp'] ?? null);
if ($guardian_phone === null && $guardian_whatsapp === null) $errors[] = 'guardian.phone ou guardian.whatsapp obrigatório.';

// consent must be boolean true
if ($consent !== true) $errors[] = 'consent deve ser true.';

// Validate sex
$child_sex = $child['sex'] ?? null;
if ($child_sex !== null) {
    $allowedSex = ['FEMININO', 'MASCULINO', 'OUTRO'];
    if (!is_string($child_sex) || !in_array($child_sex, $allowedSex, true)) $errors[] = 'child.sex inválido.';
}

// RG
$child_rg = trim_or_null($child['rg'] ?? null);
if ($child_rg !== null && mb_strlen($child_rg) > 30) $errors[] = 'child.rg maior que 30 caracteres.';

// CPF
// CPF: must be string when provided
if (array_key_exists('cpf', $child) && $child['cpf'] !== null && !is_string($child['cpf'])) {
    $errors[] = 'child.cpf tipo inválido.';
    $child_cpf = null;
} else {
    $child_cpf = normalize_digits($child['cpf'] ?? null);
}
if ($child_cpf !== null) {
    if (!preg_match('/^\d{11}$/', $child_cpf) || !validate_cpf_digits($child_cpf)) $errors[] = 'child.cpf inválido.';
}

// neighborhood
$child_neighborhood = trim_or_null($child['neighborhood'] ?? null);
if ($child_neighborhood !== null && mb_strlen($child_neighborhood) > 150) $errors[] = 'child.neighborhood muito longa.';

// phone
// child.phone must be string when provided
if (array_key_exists('phone', $child) && $child['phone'] !== null && !is_string($child['phone'])) {
    $errors[] = 'child.phone tipo inválido.';
    $child_phone = null;
} else {
    $child_phone = normalize_digits($child['phone'] ?? null);
    if ($child_phone !== null && !preg_match('/^\d{10,11}$/', $child_phone)) $errors[] = 'child.phone inválido.';
}

// school
$child_school = trim_or_null($child['school'] ?? null);
if ($child_school !== null && mb_strlen($child_school) > 200) $errors[] = 'child.school muito longo.';

// hasDiagnosis
$hasDiagnosis = $child['hasDiagnosis'] ?? null;
if ($hasDiagnosis !== null && !is_bool($hasDiagnosis)) $errors[] = 'child.hasDiagnosis inválido.';

// schooling
$schooling_year = trim_or_null($schooling['year'] ?? null);
if ($schooling_year !== null && mb_strlen($schooling_year) > 50) $errors[] = 'schooling.year muito longo.';
$schooling_grade = trim_or_null($schooling['grade'] ?? null);
if ($schooling_grade !== null && mb_strlen($schooling_grade) > 50) $errors[] = 'schooling.grade muito longo.';

// guardian birth
$guardian_birth = $guardian['birthDate'] ?? null;
if ($guardian_birth !== null) {
    if (!is_string($guardian_birth) || !is_valid_iso_date($guardian_birth)) $errors[] = 'guardian.birthDate inválida.';
    else {
        $d = DateTime::createFromFormat('Y-m-d', $guardian_birth, new DateTimeZone('UTC'));
        $nowDate = new DateTime('now', new DateTimeZone('UTC'));
        if ($d > $nowDate) $errors[] = 'guardian.birthDate não pode ser futura.';
    }
}

// guardian email
$guardian_email = trim_or_null($guardian['email'] ?? null);
if ($guardian_email !== null) {
    if (mb_strlen($guardian_email) > 254 || !filter_var($guardian_email, FILTER_VALIDATE_EMAIL)) $errors[] = 'guardian.email inválido.';
}

// guardian.phone and guardian.whatsapp must be strings when provided
if (array_key_exists('phone', $guardian) && $guardian['phone'] !== null && !is_string($guardian['phone'])) {
    $errors[] = 'guardian.phone tipo inválido.';
}
if (array_key_exists('whatsapp', $guardian) && $guardian['whatsapp'] !== null && !is_string($guardian['whatsapp'])) {
    $errors[] = 'guardian.whatsapp tipo inválido.';
}
// Normalize and validate guardian phones
$guardian_phone = normalize_digits($guardian['phone'] ?? null);
$guardian_whatsapp = normalize_digits($guardian['whatsapp'] ?? null);
if ($guardian_phone !== null && !preg_match('/^\d{10,11}$/', $guardian_phone)) $errors[] = 'guardian.phone inválido.';
if ($guardian_whatsapp !== null && !preg_match('/^\d{10,11}$/', $guardian_whatsapp)) $errors[] = 'guardian.whatsapp inválido.';
if ($guardian_phone === null && $guardian_whatsapp === null) $errors[] = 'guardian.phone ou guardian.whatsapp obrigatório.';

// normalize otherInterestDescription and specificNeeds
// otherInterestDescription handled above; ensure type was string or null
$otherInterestDescription = trim_or_null($otherInterestDescription);
if ($otherInterestDescription !== null && mb_strlen($otherInterestDescription) > 255) $errors[] = 'otherInterestDescription muito longa.';

$specificNeeds = trim_or_null($specificNeeds);

// interests: normalize codes
$normalized_interests = [];
if (is_array($interests)) {
    foreach ($interests as $c) {
        if (!is_string($c)) continue;
        $code = strtoupper(trim($c));
        if ($code === '') continue;
        $normalized_interests[$code] = $code; // dedupe
    }
    $normalized_interests = array_values($normalized_interests);
}

// If OUTRAS present, require otherInterestDescription
$has_outras = in_array('OUTRAS', $normalized_interests, true);
if ($has_outras) {
    if ($otherInterestDescription === null) $errors[] = 'otherInterestDescription obrigatório quando OUTRAS selecionado.';
}

// Length validations for fields that must not be truncated
if (is_string($child_name) && mb_strlen($child_name) > 200) $errors[] = 'child.name muito longo.';
if ($child_social !== null && mb_strlen($child_social) > 200) $errors[] = 'child.socialName muito longo.';
if (is_string($guardian_name) && mb_strlen($guardian_name) > 200) $errors[] = 'guardian.name muito longo.';
if (is_string($guardian_relationship) && mb_strlen($guardian_relationship) > 100) $errors[] = 'guardian.relationship muito longo.';

// If any validation errors so far, return 400
if (!empty($errors)) {
    respond_json(400, ['sucesso' => false, 'mensagem' => 'Validação falhou.', 'erros' => $errors]);
}

// Resolve declaration id by versao
try {
    $stmt = $pdo->prepare('SELECT id FROM cad_declaracoes WHERE versao = ? LIMIT 1');
    $stmt->execute(['PSA-CAD-2026-V1']);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row === false || !isset($row['id'])) {
        error_log('create.php: declaracao PSA-CAD-2026-V1 não encontrada');
        respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
    }
    $declaracao_id = (int)$row['id'];
} catch (Throwable $e) {
    error_log('create.php: falha ao resolver declaracao');
    respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
}

// Resolve interests by codigo and ativo=1 if any
$interest_map = []; // codigo => id
if (!empty($normalized_interests)) {
    // build placeholders
    $placeholders = implode(',', array_fill(0, count($normalized_interests), '?'));
    $sql = "SELECT id, codigo FROM cad_interesses WHERE codigo IN ($placeholders) AND ativo = 1";
    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($normalized_interests);
        $found = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($found as $r) {
            $interest_map[strtoupper($r['codigo'])] = (int)$r['id'];
        }
        // check for missing codes
        $missing = [];
        foreach ($normalized_interests as $code) {
            if (!isset($interest_map[$code])) $missing[] = $code;
        }
        if (!empty($missing)) {
            respond_json(400, ['sucesso' => false, 'mensagem' => 'Códigos de interesse inválidos ou inativos.', 'invalid' => $missing]);
        }
    } catch (Throwable $e) {
        error_log('create.php: falha ao resolver interesses');
        respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
    }
}

// All validations passed. Prepare to insert within a transaction.
// --- Idempotency: require header and compute payload hash (canonical) ---
// Header required: Idempotency-Key
$rawKey = $_SERVER['HTTP_IDEMPOTENCY_KEY'] ?? null;
if (!is_string($rawKey) || $rawKey === '') {
    respond_json(400, ['sucesso' => false, 'mensagem' => 'Idempotency-Key ausente ou inválida.']);
}
$idempotency_key = trim($rawKey);
// Validate strict UUIDv4 textual form (case-insensitive)
if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $idempotency_key)) {
    respond_json(400, ['sucesso' => false, 'mensagem' => 'Idempotency-Key ausente ou inválida.']);
}

// Build canonical payload object from already-validated/normalized values
$canonical = [
    'child' => [
        'name' => $child_name === null ? null : $child_name,
        'socialName' => $child_social === null ? null : $child_social,
        'birthDate' => $child_birth,
        'sex' => $child_sex ?? null,
        'rg' => $child_rg === null ? null : $child_rg,
        'cpf' => $child_cpf === null ? null : $child_cpf,
        'neighborhood' => $child_neighborhood === null ? null : $child_neighborhood,
        'phone' => $child_phone === null ? null : $child_phone,
        'school' => $child_school === null ? null : $child_school,
        'hasDiagnosis' => $hasDiagnosis === null ? null : ($hasDiagnosis ? true : false),
    ],
    'schooling' => [
        'year' => $schooling_year === null ? null : $schooling_year,
        'grade' => $schooling_grade === null ? null : $schooling_grade,
    ],
    'guardian' => [
        'name' => $guardian_name,
        'relationship' => $guardian_relationship,
        'birthDate' => $guardian_birth ?? null,
        'phone' => $guardian_phone === null ? null : $guardian_phone,
        'whatsapp' => $guardian_whatsapp === null ? null : $guardian_whatsapp,
        'email' => $guardian_email === null ? null : $guardian_email,
    ],
    'interests' => [],
    'otherInterestDescription' => $otherInterestDescription === null ? null : $otherInterestDescription,
    'specificNeeds' => $specificNeeds === null ? null : $specificNeeds,
    'consent' => $consent === null ? null : ($consent ? true : false),
];

// interests: use normalized_interests (already deduped); sort lexicographically for canonical form
$sorted_interests = $normalized_interests;
sort($sorted_interests, SORT_STRING);
$canonical['interests'] = array_values($sorted_interests);

$canonicalJson = json_encode($canonical, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($canonicalJson === false) {
    respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
}
$payload_hash = hash('sha256', $canonicalJson);

// End idempotency preparation
// Define created_by and name from validated session BEFORE any use (claim)
$created_by = (int)$user['id'];
$created_by_name = (string)$user['nome'];
try {
    // single UTC timestamp with microseconds
    $dt = DateTime::createFromFormat('U.u', sprintf('%.6F', microtime(true)));
    if ($dt === false) $dt = new DateTime('now', new DateTimeZone('UTC'));
    $dt->setTimezone(new DateTimeZone('UTC'));
    $ts = $dt->format('Y-m-d H:i:s.u');

    // Begin transaction
    $pdo->beginTransaction();

    // Attempt to claim idempotency key within this transaction using same timestamp
    try {
        $insIdemp = $pdo->prepare('INSERT INTO cad_idempotency (user_id, operation, idempotency_key, payload_hash, resource_id, created_at) VALUES (?, ?, ?, ?, NULL, ?)');
        $insIdemp->execute([
            $created_by,
            'fichas.create',
            $idempotency_key,
            $payload_hash,
            $ts
        ]);
    } catch (PDOException $e) {
        // Detect duplicate-key on the idempotency unique index
        $isDup = isset($e->errorInfo[0], $e->errorInfo[1]) && $e->errorInfo[0] === '23000' && (int)$e->errorInfo[1] === 1062 && strpos($e->errorInfo[2], 'ux_cad_idempotency_user_op_key') !== false;
        if (!$isDup) {
            // Not an idempotency duplicate — rethrow to outer handler
            throw $e;
        }
        // Duplicate idempotency key: rollback this transaction before querying existing record
        if ($pdo->inTransaction()) $pdo->rollBack();

        // Fetch existing idempotency record
        $sel = $pdo->prepare('SELECT payload_hash, resource_id FROM cad_idempotency WHERE user_id = ? AND operation = ? AND idempotency_key = ? LIMIT 1');
        $sel->execute([$created_by, 'fichas.create', $idempotency_key]);
        $row = $sel->fetch(PDO::FETCH_ASSOC);
        if ($row === false) {
            respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
        }
        // Compare payload hash
        $existing_hash = $row['payload_hash'] ?? null;
        $existing_resource = isset($row['resource_id']) ? ((string)$row['resource_id'] === '' ? null : (int)$row['resource_id']) : null;
        if (!hash_equals((string)$existing_hash, (string)$payload_hash)) {
            respond_json(409, ['ok' => false, 'mensagem' => 'A chave de idempotência já foi utilizada para outra submissão.']);
        }
        if ($existing_resource !== null) {
            // Replay: return previously created resource
            $numero = sprintf('PSA-%06d', $existing_resource);
            respond_json(200, ['ok' => true, 'cadastro' => ['id' => $existing_resource, 'numero' => $numero], 'replayed' => true]);
        }
        // resource_id IS NULL -> in progress
        header('Retry-After: 2');
        respond_json(202, ['ok' => false, 'mensagem' => 'A solicitação ainda está sendo processada. Tente novamente.']);
    }

    // Insert cad_fichas
    $ins = $pdo->prepare('INSERT INTO cad_fichas (origem, situacao, data_ingresso, observacoes_administrativas, created_by, created_by_name_snapshot, created_at, updated_at, updated_by, updated_by_name_snapshot, crianca_nome, crianca_nome_social, crianca_nascimento, crianca_sexo, crianca_rg, crianca_cpf, bairro, crianca_telefone, escola_instituicao, possui_diagnostico, ano_escolar, serie_escolar, responsavel_nome, responsavel_parentesco, responsavel_nascimento, responsavel_telefone, responsavel_whatsapp, responsavel_email, outro_interesse_descricao, necessidades_especificas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

    $origem = 'EQUIPE_CADASTRADOR';
    $situacao = 'ATIVO';
    $data_ingresso = null; // decision frozen
    $observacoes = null;
    // $created_by and $created_by_name defined earlier before claim
    $updated_by = null;
    $updated_by_name = null;
    $crianca_nome = mb_substr($child_name, 0, 200);
    $crianca_nome_social = $child['socialName'] ?? null; $crianca_nome_social = trim_or_null($crianca_nome_social); if ($crianca_nome_social !== null) $crianca_nome_social = mb_substr($crianca_nome_social, 0, 200);
    $crianca_nascimento = $child_birth;
    $crianca_sexo = $child_sex ?? null;
    $crianca_rg = $child_rg;
    $crianca_cpf = $child_cpf;
    $bairro = $child_neighborhood;
    $crianca_telefone = $child_phone;
    $escola_instituicao = $child_school;
    $possui_diagnostico = $hasDiagnosis === null ? null : ($hasDiagnosis ? 1 : 0);
    $ano_escolar = $schooling_year;
    $serie_escolar = $schooling_grade;
    $responsavel_nome = mb_substr($guardian_name, 0, 200);
    $responsavel_parentesco = mb_substr($guardian_relationship, 0, 100);
    $responsavel_nascimento = $guardian_birth ?? null;
    $responsavel_telefone = $guardian_phone;
    $responsavel_whatsapp = $guardian_whatsapp;
    $responsavel_email = $guardian_email;
    $outro_interesse_descricao = $has_outras ? mb_substr($otherInterestDescription, 0, 255) : null;
    $necessidades_especificas = $specificNeeds;

    $ins->execute([
        $origem,
        $situacao,
        $data_ingresso,
        $observacoes,
        $created_by,
        $created_by_name,
        $ts,
        $ts,
        $updated_by,
        $updated_by_name,
        $crianca_nome,
        $crianca_nome_social,
        $crianca_nascimento,
        $crianca_sexo,
        $crianca_rg,
        $crianca_cpf,
        $bairro,
        $crianca_telefone,
        $escola_instituicao,
        $possui_diagnostico,
        $ano_escolar,
        $serie_escolar,
        $responsavel_nome,
        $responsavel_parentesco,
        $responsavel_nascimento,
        $responsavel_telefone,
        $responsavel_whatsapp,
        $responsavel_email,
        $outro_interesse_descricao,
        $necessidades_especificas
    ]);

    $fichaId = (int)$pdo->lastInsertId();
    if ($fichaId <= 0) {
        $pdo->rollBack();
        error_log('create.php: lastInsertId inválido');
        respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
    }

    // Insert interests
    if (!empty($interest_map)) {
        $insInt = $pdo->prepare('INSERT INTO cad_ficha_interesses (cadastro_id, interesse_id) VALUES (?, ?)');
        foreach ($interest_map as $code => $iid) {
            $insInt->execute([$fichaId, $iid]);
        }
    }

    // Insert authorization
    $insAuth = $pdo->prepare('INSERT INTO cad_autorizacoes (cadastro_id, responsavel_nome_snapshot, declaracao_id, concordou, concordou_at, registrado_por, registrado_por_nome_snapshot) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $insAuth->execute([
        $fichaId,
        $responsavel_nome,
        $declaracao_id,
        1,
        $ts,
        $created_by,
        $created_by_name
    ]);

    // Build campos_alterados array (only names of fields persisted)
    $campos = [];
    // Mandatory at least these
    $campos[] = 'child.name';
    $campos[] = 'child.birthDate';
    $campos[] = 'guardian.name';
    $campos[] = 'guardian.relationship';
    $campos[] = 'consent';
    if ($child_rg !== null) $campos[] = 'child.rg';
    if ($child_cpf !== null) $campos[] = 'child.cpf';
    if ($child_neighborhood !== null) $campos[] = 'child.neighborhood';
    if ($child_phone !== null) $campos[] = 'child.phone';
    if ($child_school !== null) $campos[] = 'child.school';
    if ($hasDiagnosis !== null) $campos[] = 'child.hasDiagnosis';
    if ($schooling_year !== null) $campos[] = 'schooling.year';
    if ($schooling_grade !== null) $campos[] = 'schooling.grade';
    if ($guardian_birth !== null) $campos[] = 'guardian.birthDate';
    if ($responsavel_telefone !== null) $campos[] = 'guardian.phone';
    if ($responsavel_whatsapp !== null) $campos[] = 'guardian.whatsapp';
    if ($guardian_email !== null) $campos[] = 'guardian.email';
    if (!empty($interest_map)) $campos[] = 'interests';
    if ($has_outras) $campos[] = 'otherInterestDescription';
    if ($specificNeeds !== null) $campos[] = 'specificNeeds';

    $campos_json = json_encode(array_values($campos), JSON_UNESCAPED_UNICODE);

    // Insert audit
    $insAud = $pdo->prepare('INSERT INTO cad_auditoria (cadastro_id, usuario_id, usuario_nome_snapshot, operacao, ocorrido_at, campos_alterados, situacao_anterior, situacao_nova) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $insAud->execute([
        $fichaId,
        $created_by,
        $created_by_name,
        'CRIACAO',
        $ts,
        $campos_json,
        null,
        $situacao
    ]);

    // Associate idempotency claim with created resource
    $upd = $pdo->prepare('UPDATE cad_idempotency SET resource_id = ? WHERE user_id = ? AND operation = ? AND idempotency_key = ? AND resource_id IS NULL');
    $upd->execute([$fichaId, $created_by, 'fichas.create', $idempotency_key]);
    if ($upd->rowCount() !== 1) {
        throw new RuntimeException('Falha ao associar idempotency.');
    }

    // Commit
    $pdo->commit();

    // Response
    $numero = sprintf('PSA-%06d', $fichaId);
    respond_json(201, ['ok' => true, 'cadastro' => ['id' => $fichaId, 'numero' => $numero]]);

} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('create.php: exceção ao processar criação da ficha');
    respond_json(500, ['sucesso' => false, 'mensagem' => 'Erro interno.']);
}

?>
