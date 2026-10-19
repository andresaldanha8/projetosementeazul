<?php
// Included only by the fresh independent integration runner. No existing database is used.
$imageSession=request($base.'/kids/api/session.php',$publicJar)[1];
$imageVersion=$imageSession['image_authorization_version'];$imageText=$imageSession['image_authorization_text'];
$submitImage=function(array $data,?string $attempt=null)use($base,$publicJar,$imageSession):array{
 return request($base.'/kids/api/create.php',$publicJar,$data,['Content-Type: application/json','X-CSRF-Token: '.$imageSession['csrf_token'],'Idempotency-Key: '.($attempt??bin2hex(random_bytes(32)))]);
};
$authorized=array_replace($payload,['child_name'=>'Imagem API sim','image_authorized'=>true,'image_authorization_version'=>$imageVersion]);
$attempt=bin2hex(random_bytes(32));$yes=$submitImage($authorized,$attempt);
check($yes[0]===201,'image authorization true does not change registration flow');
$yesRow=$pdo->query("SELECT * FROM kids_inscricoes WHERE crianca_nome='Imagem API sim'")->fetch();
check((int)$yesRow['imagem_autorizada']===1&&$yesRow['imagem_autorizacao_versao']===$imageVersion&&$yesRow['imagem_autorizacao_texto']===$imageText&&$yesRow['imagem_registrada_em']===$yesRow['criada_em'],'positive choice stores authoritative version/text and UTC registration timestamp');
check($submitImage($authorized,$attempt)[0]===200,'authorized registration replays same idempotency key');
check($submitImage(array_replace($authorized,['image_authorized'=>false]),$attempt)[0]===409,'changing optional choice on same key is an idempotency conflict');
$no=$submitImage(array_replace($authorized,['child_name'=>'Imagem API nao','image_authorized'=>false]));
check($no[0]===201&&(int)$pdo->query("SELECT imagem_autorizada FROM kids_inscricoes WHERE crianca_nome='Imagem API nao'")->fetchColumn()===0,'explicit refusal permits registration and is persisted');
$omitted=$pdo->query('SELECT * FROM kids_inscricoes WHERE numero_peito=1')->fetch();
check((int)$omitted['imagem_autorizada']===0&&$omitted['imagem_autorizacao_texto']===$imageText,'omitted optional authorization permits registration and never implies permission');
$invalid=array_replace($authorized,['accepted'=>false]);check($submitImage($invalid)[0]===400,'mandatory declaration remains required independently of image authorization');
unset($invalid['accepted']);check($submitImage($invalid)[0]===400,'missing mandatory acceptance is refused');
check($submitImage(array_replace($authorized,['image_authorization_version'=>'OLD']))[0]===400,'positive authorization requires the presented current version');
$publicConfirm=request($base.'/kids/api/confirmations.php',$publicJar);
check(!str_contains($publicConfirm[2],'imagem_')&&!str_contains($publicConfirm[2],'image_authorized'),'public confirmations disclose no optional authorization data');
$publicLookup=request($base.'/kids/api/lookup.php',$lookupJar,['child_name'=>'Imagem API sim','phone'=>$payload['phone']],['Content-Type: application/json','X-CSRF-Token: '.$lookupSession[1]['csrf_token']]);
check($publicLookup[0]===200&&!str_contains($publicLookup[2],'imagem_')&&!str_contains($publicLookup[2],'image_authorized'),'public lookup discloses no optional authorization data');
$imageList=request($api.'registrations.php?band=4-7',$jar);
check($imageList[0]===200&&in_array('1',array_map('strval',array_column($imageList[1]['registrations'],'imagem_autorizada')),true),'authenticated list includes image authorization for the team');
require_once $project.'/kids/pdf/report.php';require_once $project.'/kids/api/config.php';
$issued=new DateTimeImmutable('2026-10-18T12:00:00-03:00');
check(kids_pdf_html([$yesRow],kids_config(),$issued)===kids_pdf_html([array_replace($yesRow,['imagem_autorizada'=>0,'imagem_autorizacao_texto'=>'other'])],kids_config(),$issued),'PDF HTML and layout ignore optional authorization fields');
// A legacy-shaped test row to exercise the administrative Not informed display.
$legacyDisplay=$pdo->prepare('INSERT INTO kids_inscricoes(evento_id,numero_peito,referencia,owner_hash,crianca_nome,nascimento,divisao,idade_inscricao,faixa,responsavel_nome,vinculo,telefone,camisa,valor_centavos,declaracao_versao,aceita_em,criada_em,atualizada_em) SELECT evento_id,999,?,owner_hash,\'Imagem legado\',nascimento,divisao,idade_inscricao,faixa,responsavel_nome,vinculo,telefone,camisa,valor_centavos,declaracao_versao,aceita_em,criada_em,atualizada_em FROM kids_inscricoes WHERE numero_peito=1');
$legacyDisplay->execute([bin2hex(random_bytes(16))]);
// Only this fresh test clone exposes its random login to the browser through stdin.
$browser=proc_open(['node',$project.'/kids/tests/image-authorization-browser.cjs'],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes,null,null,['bypass_shell'=>true,'create_new_console'=>false]);
fwrite($pipes[0],json_encode(['base'=>$base,'password'=>$password]));fclose($pipes[0]);
$browserOutput=stream_get_contents($pipes[1]);$browserError=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);$browserExit=proc_close($browser);
echo $browserOutput;
if($browserExit!==0)throw new RuntimeException('Browser authorization checks failed: '.$browserError);
check(true,'browser tests passed for optional choice, recovery, reset and administrative display');
