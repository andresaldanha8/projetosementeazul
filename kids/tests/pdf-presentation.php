<?php
declare(strict_types=1);
if (PHP_SAPI!=='cli') exit(1);
require_once dirname(__DIR__).'/pdf/report.php';
require_once dirname(__DIR__).'/api/config.php';
// Entirely in-memory fixtures: no connection, seeds or changes to any database.
$one=[['numero_peito'=>1,'crianca_nome'=>'João Fictício','idade_inscricao'=>7,'faixa'=>'4-7','divisao'=>'M','responsavel_nome'=>'Responsável Fictícia','telefone'=>'5593999990001','camisa'=>'P','pagamento'=>'CONFIRMADO','situacao'=>'REGISTRADA']];
$many=[$one[0],array_replace($one[0],['numero_peito'=>1000,'crianca_nome'=>'Maria Fictícia','divisao'=>'F','telefone'=>'1133330002','pagamento'=>'PENDENTE','situacao'=>'CANCELADA'])];
$before=serialize([$one,$many]);
foreach (['11999990001'=>'(11) 99999-0001','5593999990001'=>'(93) 99999-0001','1133330002'=>'(11) 3333-0002','(11) 3333-0002'=>'(11) 3333-0002','123'=>'123'] as $input=>$expected) {
    if (kids_pdf_phone((string)$input)!==$expected) throw new RuntimeException('Phone display mismatch');
}
$out=dirname(__DIR__,2).'/output/pdf';
$issued=new DateTimeImmutable('2026-10-18T12:00:00-03:00');
$cases=[];
foreach (['uma'=>$one,'varias'=>$many] as $quantity=>$rows) {
    foreach (['completa'=>null,'filtrada'=>['band'=>'4-7','payment'=>'','search'=>'Fictício']] as $kind=>$filters) {
        $file='kids-lista-'.$kind.'-'.$quantity.'-exemplo.pdf';
        file_put_contents($out.'/'.$file,kids_pdf_render($rows,kids_config(),$issued,$filters));
        $cases[]=['file'=>$file,'rows'=>$rows,'filters'=>$filters,'totals'=>kids_pdf_totals($rows)];
    }
}
if (serialize([$one,$many])!==$before) throw new RuntimeException('Fixture mutation');
file_put_contents(__DIR__.'/pdf-presentation-expected.json',json_encode($cases,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));
echo "Four presentation PDFs generated; input rows unchanged; phone display cases passed.\n";
