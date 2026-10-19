<?php
declare(strict_types=1);
require_once __DIR__.'/_bootstrap.php';
require_once dirname(__DIR__,2).'/api/registration-query.php';
$method=$_SERVER['REQUEST_METHOD']??'GET';
if (!in_array($method,['GET','POST'],true)) { header('Allow: GET, POST'); kids_reply(405, ['sucesso'=>false]); }
try {
 kids_require_admin($pdo,$method==='POST');
 // Name/phone searches must stay in a JSON body, outside URLs and access logs.
 if ($method==='GET' && isset($_GET['search'])) kids_reply(400,['sucesso'=>false]);
 $input=$method==='POST'?kids_admin_body():$_GET;
 $page=filter_var($input['page']??'1',FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>1000000]]);
 $size=filter_var($input['perPage']??'20',FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>100]]);
 try { $filters=kids_registration_filters($input,true); } catch(InvalidArgumentException $e) { kids_reply(400,['sucesso'=>false]); }
 if (!$page || !$size) kids_reply(400,['sucesso'=>false]);
 $band=$filters['band'];
 [$from,$args]=kids_registration_from(kids_config()['edition'],$filters,false);
 // Counts reflect active search/payment filters, without transferring registration records.
 $stmt=$pdo->prepare('SELECT i.faixa,COUNT(*) AS total'.$from.' GROUP BY i.faixa'); $stmt->execute($args);
 $counts=['4-7'=>0,'8-10'=>0,'11-14'=>0];
 foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $count) if (array_key_exists($count['faixa'],$counts)) $counts[$count['faixa']]=(int)$count['total'];
 // Individual reconciliation still stays in the current edition; ID is never a public credential.
 [$from,$args]=kids_registration_from(kids_config()['edition'],$filters);
 $stmt=$pdo->prepare('SELECT COUNT(*)'.$from); $stmt->execute($args); $total=(int)$stmt->fetchColumn();
 $stmt=$pdo->prepare('SELECT i.id,i.numero_peito,i.crianca_nome,i.nascimento,i.divisao,i.idade_inscricao,i.faixa,i.responsavel_nome,i.vinculo,i.telefone,i.camisa,i.valor_centavos,i.pagamento,i.situacao,i.atualizada_em,i.imagem_autorizada,i.imagem_autorizacao_versao,i.imagem_autorizacao_texto,i.imagem_registrada_em'.$from.' ORDER BY i.numero_peito ASC,i.id ASC LIMIT '.(int)$size.' OFFSET '.(($page-1)*$size));
 $stmt->execute($args);
 $rows=$stmt->fetchAll(PDO::FETCH_ASSOC);
 // Stable JSON contract, independent of PDO numeric fetch types. Never coerce unknown data to refusal.
 foreach ($rows as &$row) {
  if (!array_key_exists('imagem_autorizada',$row)) throw new RuntimeException('Missing image authorization');
  $value=$row['imagem_autorizada'];
  if (in_array($value,[1,'1',true],true)) $row['imagem_autorizada']=true;
  elseif (in_array($value,[0,'0',false],true)) $row['imagem_autorizada']=false;
  elseif ($value!==null) throw new RuntimeException('Invalid image authorization');
 }
 unset($row);
 header('X-Kids-Image-Contract: 1');
 kids_reply(200,['sucesso'=>true,'registrations'=>$rows,'total'=>$total,'page'=>$page,'perPage'=>$size,'band'=>$band,'counts'=>$counts]);
} catch (Throwable $e) { error_log('kids list: falha interna'); kids_reply(500,['sucesso'=>false]); }
