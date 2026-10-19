<?php
declare(strict_types=1);
require_once __DIR__ . '/http.php';
require_once __DIR__ . '/domain.php';
require_once __DIR__ . '/records.php';
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { header('Allow: POST'); kids_reply(405, ['ok' => false]); }
if (strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])) !== 'application/json') kids_reply(415, ['ok' => false]);
kids_public_session();
// Contar também CSRF inválido e corpos malformados, antes da validação.
$window = intdiv(time(), 60);
if (($_SESSION['rate_window'] ?? null) !== $window) { $_SESSION['rate_window'] = $window; $_SESSION['rate_count'] = 0; }
if (++$_SESSION['rate_count'] > 30) { header('Retry-After: 60'); kids_reply(429, ['ok' => false]); }
if (!hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) kids_reply(403, ['ok' => false]);
$raw = file_get_contents('php://input', false, null, 0, 8193);
if ($raw === false || strlen($raw) > 8192) kids_reply(413, ['ok' => false]);
$key = strtolower($_SERVER['HTTP_IDEMPOTENCY_KEY'] ?? '');
if (!preg_match('/^[a-f0-9]{64}$/D', $key)) kids_reply(400, ['ok' => false, 'message' => 'Chave de envio inválida.']);
$config = kids_config();
try {
    $data = json_decode($raw, true, 16, JSON_THROW_ON_ERROR);
    if (!is_array($data)) throw new InvalidArgumentException();
    $validated = kids_validate($data, new DateTimeImmutable('now'), $config, false);
    $hash = hash('sha256', json_encode($validated['input'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
} catch (JsonException | InvalidArgumentException $e) {
    kids_reply(400, ['ok' => false, 'message' => 'Confira os campos e a declaração.']);
}
$owner = hash('sha256', $_SESSION['owner']);
session_write_close();
require_once __DIR__ . '/database.php';
try {
    $pdo->beginTransaction();
    // Serializa a edição, incluindo a consulta idempotente e a reserva do número.
    $stmt = $pdo->prepare('SELECT id, proximo_numero FROM kids_eventos WHERE codigo = ? FOR UPDATE');
    $stmt->execute([$config['edition']]);
    $event = $stmt->fetch();
    if (!$event) throw new RuntimeException();
    $stmt = $pdo->prepare('SELECT payload_hash, inscricao_id FROM kids_idempotencia WHERE evento_id = ? AND owner_hash = ? AND chave = ?');
    $stmt->execute([$event['id'], $owner, $key]);
    $existing = $stmt->fetch();
    if ($existing) {
        if (!hash_equals($existing['payload_hash'], $hash)) { $pdo->rollBack(); kids_reply(409, ['ok' => false, 'message' => 'Chave já usada para outro envio.']); }
        $stmt = $pdo->prepare('SELECT * FROM kids_inscricoes WHERE id = ? AND owner_hash = ?');
        $stmt->execute([$existing['inscricao_id'], $owner]);
        $row = $stmt->fetch();
        if (!$row) throw new RuntimeException();
        $pdo->commit();
        kids_reply(200, ['ok' => true, 'replayed' => true, 'registration' => kids_confirmation($row)]);
    }
    // Relógio lido DEPOIS da espera pelo bloqueio. Replay sempre precede fechamento.
    $now = new DateTimeImmutable('now', new DateTimeZone($config['timezone']));
    if (kids_closed($now, $config)) { $pdo->rollBack(); kids_reply(403, ['ok' => false, 'message' => 'Inscrições encerradas.']); }
    if (!$config['public_open'] || $config['declaration_version'] === null) { $pdo->rollBack(); kids_reply(503, ['ok' => false, 'message' => 'Inscrições ainda não abertas.']); }
    $validated = kids_validate($data, $now, $config);
    $input = $validated['input'];
    $ts = $now->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s.u');
    $stmt = $pdo->prepare('INSERT INTO kids_idempotencia (evento_id, owner_hash, chave, payload_hash, criada_em) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$event['id'], $owner, $key, $hash, $ts]);
    $reference = bin2hex(random_bytes(16));
    $stmt = $pdo->prepare('INSERT INTO kids_inscricoes (evento_id, numero_peito, referencia, owner_hash, crianca_nome, nascimento, divisao, idade_inscricao, faixa, responsavel_nome, vinculo, telefone, camisa, valor_centavos, pagamento, situacao, declaracao_versao, aceita_em, criada_em, atualizada_em,imagem_autorizada,imagem_autorizacao_versao,imagem_autorizacao_texto,imagem_registrada_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?,?,?)');
    $stmt->execute([$event['id'], $event['proximo_numero'], $reference, $owner, $input['child_name'], $input['birth_date'], $input['division'], $validated['age'], $validated['category'], $input['guardian_name'], $input['relationship'], $input['phone'], $config['shirt_size'], $config['amount_cents'], 'PENDENTE', 'REGISTRADA', $input['declaration_version'], $ts, $ts, $ts,($input['image_authorized']??false)?1:0,$config['image_authorization_version'],$config['image_authorization_text'],$ts]);
    $id = $pdo->lastInsertId();
    $stmt = $pdo->prepare('UPDATE kids_eventos SET proximo_numero = proximo_numero + 1 WHERE id = ?');
    $stmt->execute([$event['id']]);
    $stmt = $pdo->prepare('UPDATE kids_idempotencia SET inscricao_id = ? WHERE evento_id = ? AND owner_hash = ? AND chave = ?');
    $stmt->execute([$id, $event['id'], $owner, $key]);
    $stmt = $pdo->prepare('SELECT * FROM kids_inscricoes WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    $pdo->commit();
    kids_reply(201, ['ok' => true, 'replayed' => false, 'registration' => kids_confirmation($row)]);
} catch (InvalidArgumentException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    kids_reply(400, ['ok' => false, 'message' => 'Confira os campos e a declaração.']);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('kids/create: falha interna na inscrição');
    kids_reply(500, ['ok' => false, 'message' => 'Não foi possível confirmar. Repita com a mesma chave de envio.']);
}
