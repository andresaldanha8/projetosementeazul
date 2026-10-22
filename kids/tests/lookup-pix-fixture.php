<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require_once __DIR__.'/../api/config.php';
require_once __DIR__.'/../api/lookup-record.php';
$config = kids_config();
// Extra private columns must never leave the public serializer.
$row = ['numero_peito'=>1007, 'situacao'=>'REGISTRADA', 'pagamento'=>'PENDENTE', 'valor_centavos'=>6000, 'crianca_nome'=>'Criança Teste', 'telefone'=>'11900000000', 'responsavel_nome'=>'Privado', 'owner_hash'=>'secret', 'referencia'=>'secret'];
$fixtures = [];
foreach (['pending', 'different', 'paid', 'cancelled'] as $mode) {
    $sample = $row;
    if ($mode === 'different') { $sample['valor_centavos']=7543; $sample['numero_peito']=1008; $sample['crianca_nome']='Outra Criança'; }
    if ($mode === 'paid') { $sample['pagamento']='CONFIRMADO'; $sample['crianca_nome']='Maria Eduarda de Albuquerque Vasconcelos da Silva Oliveira '.str_repeat('Sobrenome', 12); }
    if ($mode === 'cancelled') $sample['situacao']='CANCELADA';
    $fixtures[$mode] = kids_lookup_record($sample, $config);
}
echo json_encode($fixtures, JSON_THROW_ON_ERROR);
