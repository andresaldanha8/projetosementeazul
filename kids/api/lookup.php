<?php
declare(strict_types=1);
require_once __DIR__ . '/http.php';

function kids_lookup_missing(int $status = 404): void
{
    kids_reply($status, ['ok' => false, 'message' => 'Não foi possível localizar uma inscrição com esses dados. Confira o preenchimento ou fale com a organização.']);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { header('Allow: POST'); kids_reply(405, ['ok' => false]); }
// Nomes/telefones devem viajar apenas no corpo; não aceitar parâmetros de URL.
if (($_SERVER['QUERY_STRING'] ?? '') !== '') kids_reply(400, ['ok' => false, 'message' => 'Use o formulário de consulta.']);
require_once __DIR__ . '/database.php';
$config = kids_config();
$windowSize = $config['lookup_window_seconds'];
$window = intdiv(time(), $windowSize) * $windowSize;
$retryAfter = $window + $windowSize - time();
try {
    // REMOTE_ADDR vem da conexão, não de cabeçalhos controláveis pelo cliente.
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    if (filter_var($ip, FILTER_VALIDATE_IP) === false) throw new RuntimeException();
    $ipHash = hash('sha256', 'kids.lookup.ip:' . inet_pton($ip));
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('INSERT INTO kids_consulta_limites (origem_hash, janela_inicio, tentativas) VALUES (?, ?, 1)
        ON DUPLICATE KEY UPDATE tentativas=IF(janela_inicio=VALUES(janela_inicio), LEAST(tentativas+1, 1000000), 1), janela_inicio=VALUES(janela_inicio)');
    $stmt->execute([$ipHash, $window]);
    $stmt = $pdo->prepare('SELECT tentativas FROM kids_consulta_limites WHERE origem_hash=?');
    $stmt->execute([$ipHash]);
    $ipAttempts = (int)$stmt->fetchColumn();
    $pdo->commit();
    if ($ipAttempts > $config['lookup_ip_limit']) { header('Retry-After: ' . $retryAfter); kids_reply(429, ['ok' => false, 'message' => 'Muitas consultas. Aguarde alguns minutos antes de tentar novamente.']); }

    // Uma sessão nova pode consultar; ela nunca recebe o owner/hash de outra sessão.
    kids_public_session();
    if (($_SESSION['lookup_window'] ?? null) !== $window) { $_SESSION['lookup_window'] = $window; $_SESSION['lookup_count'] = 0; }
    if (++$_SESSION['lookup_count'] > $config['lookup_session_limit']) { header('Retry-After: ' . $retryAfter); kids_reply(429, ['ok' => false, 'message' => 'Muitas consultas. Aguarde alguns minutos antes de tentar novamente.']); }
    if (($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site' || !hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) kids_reply(403, ['ok' => false, 'message' => 'Não foi possível autorizar a consulta. Atualize a página.']);
    session_write_close();
    if (strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])) !== 'application/json') kids_reply(415, ['ok' => false]);
    $raw = file_get_contents('php://input', false, null, 0, 2049);
    if ($raw === false || strlen($raw) > 2048) kids_reply(413, ['ok' => false]);
    try {
        $data = json_decode($raw, true, 8, JSON_THROW_ON_ERROR);
        if (!is_array($data) || count($data) !== 2 || !isset($data['child_name'], $data['phone']) || !is_string($data['child_name']) || !is_string($data['phone'])) kids_lookup_missing(400);
        if (preg_match('//u', $data['child_name']) !== 1 || mb_strlen($data['child_name'], 'UTF-8') > 200 || strlen($data['phone']) > 30) kids_lookup_missing(400);
        $name = mb_strtolower(trim(preg_replace('/[\p{Z}\s]+/u', ' ', $data['child_name'])), 'UTF-8');
        if ($name === '' || preg_match('/[\x00-\x1f\x7f]/u', $name) || !preg_match('/^[+()\d .-]+$/D', $data['phone'])) kids_lookup_missing(400);
        $phone = preg_replace('/\D/', '', $data['phone']);
        if (strlen($phone) < 10 || strlen($phone) > 15) kids_lookup_missing(400);
    } catch (JsonException $e) { kids_lookup_missing(400); }
    // Comparação exata após normalização, com collation binária para não ignorar acentos.
    // REGEXP_REPLACE disponível no MariaDB testado; validar versão do destino antes de publicar.
    $stmt = $pdo->prepare("SELECT i.numero_peito, i.situacao, i.pagamento FROM kids_inscricoes i
        JOIN kids_eventos e ON e.id=i.evento_id WHERE e.codigo=? AND i.telefone=?
        AND LOWER(TRIM(REGEXP_REPLACE(i.crianca_nome, ?, ' '))) COLLATE utf8mb4_bin = CONVERT(? USING utf8mb4) COLLATE utf8mb4_bin LIMIT 2");
    $stmt->execute([$config['edition'], $phone, '[\\p{Z}\\s]+', $name]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (!$rows) kids_lookup_missing();
    if (count($rows) !== 1) kids_reply(409, ['ok' => false, 'message' => 'Não foi possível identificar uma única inscrição. Fale com a organização para consultar.']);
    kids_reply(200, ['ok' => true, 'registration' => [
        'number' => str_pad((string)$rows[0]['numero_peito'], 3, '0', STR_PAD_LEFT),
        'registration_status' => $rows[0]['situacao'], 'payment_status' => $rows[0]['pagamento'],
    ]]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('kids/lookup: falha interna na consulta');
    kids_reply(503, ['ok' => false, 'message' => 'Consulta temporariamente indisponível. Tente novamente mais tarde.']);
}
