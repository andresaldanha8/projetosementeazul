<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require_once __DIR__ . '/../api/domain.php';
require_once __DIR__ . '/../api/records.php';
$config = kids_config();
$config['declaration_version'] = 'TEST-ONLY';
$now = new DateTimeImmutable('2026-10-17 12:00:00', new DateTimeZone($config['timezone']));
$input = ['child_name' => 'Criança de teste', 'birth_date' => '', 'division' => 'F', 'guardian_name' => 'Responsável de teste', 'relationship' => 'Responsável', 'phone' => '(11) 90000-0000', 'declaration_version' => 'TEST-ONLY', 'accepted' => true];
$count = 0;
function check(bool $condition): void { global $count; $count++; if (!$condition) throw new RuntimeException('Teste falhou: ' . $count); }
foreach (['2022-10-17' => [4, '4-7'], '2019-10-17' => [7, '4-7'], '2018-10-17' => [8, '8-10'], '2016-10-17' => [10, '8-10'], '2015-10-17' => [11, '11-14'], '2012-10-17' => [14, '11-14'], '2018-10-18' => [7, '4-7']] as $birth => $expected) {
    $input['birth_date'] = $birth;
    $result = kids_validate($input, $now, $config);
    check([$result['age'], $result['category']] === $expected);
}
foreach (['2022-10-18', '2011-10-17', '2026-02-30', '2027-01-01', '17/10/2020', '2020-2-03'] as $birth) {
    $input['birth_date'] = $birth;
    try { kids_validate($input, $now, $config); check(false); } catch (InvalidArgumentException $e) { check(true); }
}
check(!kids_closed(new DateTimeImmutable('2026-11-21T18:59:59Z'), $config));
check(kids_closed(new DateTimeImmutable('2026-11-21T19:00:00Z'), $config));
check(kids_closed(new DateTimeImmutable('2026-11-21T19:00:01Z'), $config));
$input['birth_date'] = '2012-10-17';
$later = new DateTimeImmutable('2027-10-17T12:00:00-03:00');
check(kids_validate($input, $later, $config, false)['age'] === 15);
// Fuso local ainda está no dia anterior ao aniversário.
$input['birth_date'] = '2018-10-18';
check(kids_validate($input, new DateTimeImmutable('2026-10-18T01:00:00Z'), $config)['age'] === 7);
check(str_pad('1', 3, '0', STR_PAD_LEFT) === '001');
check(str_pad('1000', 3, '0', STR_PAD_LEFT) === '1000');
check(kids_config()['public_open'] === false && kids_config()['declaration_version'] === 'KIDS-2026-v2');
echo "OK: $count verificações de domínio\n";
