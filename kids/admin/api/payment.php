<?php
declare(strict_types=1);
require_once __DIR__.'/_bootstrap.php';
if (($_SERVER['REQUEST_METHOD']??'GET')!=='POST') kids_reply(405,['sucesso'=>false]);
try {
 $user=kids_require_admin($pdo,true);
 if (strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE']??'')[0]))!=='application/json') kids_reply(415,['sucesso'=>false]);
 $id=filter_var($_GET['id']??'',FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);
 $body=json_decode(file_get_contents('php://input',false,null,0,4097),true);
 if (!$id || !is_array($body) || !isset($body['expectedUpdatedAt'],$body['amountCents']) || !is_string($body['expectedUpdatedAt']) || !is_int($body['amountCents'])) kids_reply(400,['sucesso'=>false]);
 $pdo->beginTransaction();
 // Row lock and guarded state transition guarantee uniqueness independently of timestamp precision.
 $stmt=$pdo->prepare('SELECT i.* FROM kids_inscricoes i JOIN kids_eventos e ON e.id=i.evento_id WHERE i.id=? AND e.codigo=? FOR UPDATE');
 $stmt->execute([$id,kids_config()['edition']]); $row=$stmt->fetch(PDO::FETCH_ASSOC);
 if (!$row) { $pdo->rollBack(); kids_reply(404,['sucesso'=>false]); }
 if ($row['situacao']!=='REGISTRADA') { $pdo->rollBack(); kids_reply(409,['sucesso'=>false,'mensagem'=>'Inscrição indisponível para pagamento.']); }
 if ($row['pagamento']==='CONFIRMADO') { $pdo->commit(); kids_reply(200,['sucesso'=>true,'alreadyConfirmed'=>true]); }
 if ($row['pagamento']!=='PENDENTE' || $row['atualizada_em']!==$body['expectedUpdatedAt'] || (int)$row['valor_centavos']!==$body['amountCents']) { $pdo->rollBack(); kids_reply(409,['sucesso'=>false,'mensagem'=>'Inscrição alterada. Confira os dados novamente.']); }
 $stmt=$pdo->prepare("UPDATE kids_inscricoes SET pagamento='CONFIRMADO',atualizada_em=UTC_TIMESTAMP(6) WHERE id=? AND pagamento='PENDENTE' AND situacao='REGISTRADA'"); $stmt->execute([$id]);
 if ($stmt->rowCount()!==1) throw new RuntimeException('Conflict');
 $stmt=$pdo->prepare("INSERT INTO kids_auditoria(inscricao_id,usuario_id,ocorrida_em,estado_anterior,estado_novo) VALUES(?,?,UTC_TIMESTAMP(6),'PENDENTE','CONFIRMADO')"); $stmt->execute([$id,$user['id']]);
 $pdo->commit(); kids_reply(200,['sucesso'=>true,'pagamento'=>'CONFIRMADO']);
} catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); error_log('kids payment: falha interna'); kids_reply(500,['sucesso'=>false]); }
