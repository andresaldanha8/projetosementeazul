<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require_once __DIR__.'/../api/config.php';
require_once __DIR__.'/../api/records.php';
$row = ['referencia'=>str_repeat('a', 32), 'numero_peito'=>1007, 'crianca_nome'=>'Criança Teste', 'idade_inscricao'=>9, 'faixa'=>'8–10', 'divisao'=>'F', 'camisa'=>'P', 'valor_centavos'=>6000, 'pagamento'=>'PENDENTE', 'situacao'=>'REGISTRADA', 'criada_em'=>'2026-10-19 15:00:00'];
$rows = [];
foreach ([6000, 7543, 1, 123456789] as $amount) {
    $row['valor_centavos'] = $amount;
    $rows[] = kids_confirmation($row);
}
$row['pagamento'] = 'CONFIRMADO';
if (kids_confirmation($row)['pix_payload'] !== null) throw new RuntimeException('Paid PIX');
$row['pagamento'] = 'PENDENTE'; $row['situacao'] = 'CANCELADA';
if (kids_confirmation($row)['pix_payload'] !== null) throw new RuntimeException('Cancelled PIX');
foreach ([0, -1, 1000000000000] as $amount) {
    try { kids_pix_payload($amount, kids_config()); throw new RuntimeException('Invalid amount accepted'); }
    catch (InvalidArgumentException $expected) {}
}
echo json_encode($rows, JSON_THROW_ON_ERROR);
