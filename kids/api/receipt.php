<?php
declare(strict_types=1);
require_once __DIR__.'/http.php';
header('Cache-Control: no-store, private, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    kids_reply(405, ['ok'=>false]);
}
kids_public_session();
$owner = hash('sha256', $_SESSION['owner']);
session_write_close();
$reference = $_GET['reference'] ?? '';
if (!is_string($reference) || !preg_match('/^[a-f0-9]{32}$/D', $reference)) kids_reply(404, ['ok'=>false]);
require_once __DIR__.'/database.php';
try {
    // A reference is only a selector. The live public session is the authority.
    $stmt = $pdo->prepare('SELECT i.numero_peito, i.crianca_nome, i.faixa, i.criada_em, i.situacao, i.pagamento FROM kids_inscricoes i JOIN kids_eventos e ON e.id=i.evento_id WHERE i.referencia=? AND i.owner_hash=? AND e.codigo=?');
    $stmt->execute([$reference, $owner, kids_config()['edition']]);
    $row = $stmt->fetch();
    if (!$row) kids_reply(404, ['ok'=>false]);
    require_once dirname(__DIR__).'/pdf/receipt.php';
    $bytes = kids_receipt_render($row, kids_config(), new DateTimeImmutable('now'));
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="autismo-run-kids-comprovante-'.str_pad((string)$row['numero_peito'],3,'0',STR_PAD_LEFT).'.pdf"');
    header('Content-Length: '.strlen($bytes));
    echo $bytes;
} catch (Throwable $e) {
    error_log('kids/receipt: falha interna');
    kids_reply(500, ['ok'=>false, 'message'=>'Não foi possível gerar o comprovante. Tente novamente.']);
}
