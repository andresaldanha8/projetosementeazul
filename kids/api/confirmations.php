<?php
declare(strict_types=1);
require_once __DIR__ . '/http.php';
require_once __DIR__ . '/records.php';
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') { header('Allow: GET'); kids_reply(405, ['ok' => false]); }
kids_public_session();
$key = strtolower($_SERVER['HTTP_IDEMPOTENCY_KEY'] ?? '');
if ($key !== '' && !preg_match('/^[a-f0-9]{64}$/D', $key)) kids_reply(400, ['ok' => false]);
$owner = hash('sha256', $_SESSION['owner']);
session_write_close();
require_once __DIR__ . '/database.php';
try {
    $stmt = $pdo->prepare('SELECT * FROM kids_inscricoes WHERE owner_hash = ? ORDER BY id');
    $stmt->execute([$owner]);
    $rows = $stmt->fetchAll();
    $pendingReference = null;
    if ($key !== '') {
        $stmt = $pdo->prepare('SELECT i.referencia FROM kids_idempotencia d JOIN kids_inscricoes i ON i.id=d.inscricao_id JOIN kids_eventos e ON e.id=d.evento_id WHERE d.owner_hash=? AND d.chave=? AND e.codigo=?');
        $stmt->execute([$owner, $key, kids_config()['edition']]);
        $pendingReference = $stmt->fetchColumn() ?: null;
    }
    kids_reply(200, ['ok' => true, 'registrations' => array_map('kids_confirmation', $rows), 'pending_reference' => $pendingReference]);
} catch (Throwable $e) {
    error_log('kids/confirmations: falha interna');
    kids_reply(500, ['ok' => false]);
}
