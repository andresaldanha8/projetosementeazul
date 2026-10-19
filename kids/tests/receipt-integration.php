<?php
declare(strict_types=1);
// New isolated datadir + KIDS-only webroot/user. Never touches an existing preview/database.
if (PHP_SAPI!=='cli') exit(1);
$project=dirname(__DIR__,2);
$root=$project.'/tmp/kids-receipt-'.bin2hex(random_bytes(6));
$web=$root.'/web';
$bin=$argv[1]??'C:/xampp/mysql/bin';
$processes=[];$checks=[];
mkdir($web.'/kids',0700,true);mkdir($root.'/sessions',0700,true);
function put(string $path,string $body):void{if(file_put_contents($path,$body)===false)throw new RuntimeException('write');}
function check(bool $ok,string $label):void{global $checks;if(!$ok)throw new RuntimeException('FAIL '.$label);$checks[]=$label;echo "PASS $label\n";}
function copyTree(string $from,string $to):void{if(!is_dir($to))mkdir($to,0700,true);foreach(scandir($from) as $f){if($f==='.'||$f==='..'||$f==='database.local.php')continue;is_dir($from.'/'.$f)?copyTree($from.'/'.$f,$to.'/'.$f):copy($from.'/'.$f,$to.'/'.$f);}}
function port():int{$s=stream_socket_server('tcp://127.0.0.1:0',$e,$m);$p=(int)substr(strrchr(stream_socket_get_name($s,false),':'),1);fclose($s);return $p;}
function launch(array $cmd,string $log){$p=proc_open($cmd,[0=>['pipe','r'],1=>['file',$log,'a'],2=>['file',$log,'a']],$pipes,null,null,['bypass_shell'=>true,'create_new_console'=>false]);if(!is_resource($p))throw new RuntimeException('launch');fclose($pipes[0]);return $p;}
function waitPort(int $port):void{for($i=0;$i<100;$i++){$s=@fsockopen('127.0.0.1',$port);if($s){fclose($s);return;}usleep(100000);}throw new RuntimeException('port timeout');}
function request(string $url,string $jar,?array $body=null,array $headers=[]):array{
 $c=curl_init($url);$received=[];
 curl_setopt_array($c,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_COOKIEFILE=>$jar,CURLOPT_COOKIEJAR=>$jar,CURLOPT_TIMEOUT=>30,CURLOPT_HTTPHEADER=>$headers,CURLOPT_HEADERFUNCTION=>function($c,$line)use(&$received){$received[]=trim($line);return strlen($line);}]);
 if($body!==null)curl_setopt_array($c,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($body,JSON_THROW_ON_ERROR)]);
 $raw=curl_exec($c);$status=curl_getinfo($c,CURLINFO_RESPONSE_CODE);if($raw===false)throw new RuntimeException('HTTP request failed');curl_close($c);
 return [$status,json_decode($raw,true),$raw,$received];
}
function login(string $jar,string $password):array{global $base;$guest=request($base.'/kids/admin/api/me.php',$jar);return request($base.'/kids/admin/api/login.php',$jar,['login'=>'admin.isolado','password'=>$password],['Content-Type: application/json','X-CSRF-Token: '.($guest[1]['csrfToken']??'')]);}
function ah(array $response):array{return ['Content-Type: application/json','X-CSRF-Token: '.$response[1]['csrfToken']];}
function account(string $expected,string $mode,string $password):int{
 global $project,$web;
 $p=proc_open([PHP_BINARY,$project.'/kids/ops/admin-account.php',$web,$expected,$mode,'admin.isolado','Administrador Isolado'],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes,null,null,['bypass_shell'=>true,'create_new_console'=>false]);
 fwrite($pipes[0],json_encode(['password'=>$password]));fclose($pipes[0]);stream_get_contents($pipes[1]);stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);return proc_close($p);
}
function schema(PDO $pdo,string $name):array{
 $result=[];
 foreach($pdo->query('SHOW TABLES FROM `'.$name.'`')->fetchAll(PDO::FETCH_COLUMN) as $table){$ddl=$pdo->query('SHOW CREATE TABLE `'.$name.'`.`'.$table.'`')->fetch(PDO::FETCH_NUM)[1];$result[$table]=preg_replace('/ AUTO_INCREMENT=\d+/','',$ddl);}
 return $result;
}
try {
 foreach(['api','admin','pdf','config'] as $dir)copyTree($project.'/kids/'.$dir,$web.'/kids/'.$dir);
 foreach(['index.html','kids.js','kids.css','lookup.js'] as $f)copy($project.'/kids/'.$f,$web.'/kids/'.$f);
 foreach(['css','img'] as $dir)mkdir($web.'/'.$dir,0700,true);
 copy($project.'/css/style.css',$web.'/css/style.css');copy($project.'/img/logo.png',$web.'/img/logo.png');
 $dbPort=port();$httpPort=port();
 $init=launch([$bin.'/mysql_install_db.exe','--datadir='.$root.'/db','--port='.$dbPort],$root.'/init.log');
 check(proc_close($init)===0,'fresh isolated MariaDB initialized');
 $processes[]=launch([$bin.'/mysqld.exe','--no-defaults','--basedir='.dirname($bin),'--datadir='.$root.'/db','--port='.$dbPort,'--bind-address=127.0.0.1','--skip-name-resolve','--innodb-buffer-pool-size=32M','--log-error='.$root.'/mariadb.log'],$root.'/db.log');waitPort($dbPort);
 $pdo=new PDO('mysql:host=127.0.0.1;port='.$dbPort.';charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
 $pdo->exec('CREATE DATABASE receipt_test CHARACTER SET utf8mb4');$pdo->exec('USE receipt_test');
 $pdo->exec(file_get_contents($project.'/kids/ops/install-kids-empty.sql'));
 $secret=bin2hex(random_bytes(24));$pdo->exec("CREATE USER 'receipt_reader'@'127.0.0.1' IDENTIFIED BY '$secret'");
 $pdo->exec("GRANT SELECT,INSERT,UPDATE,DELETE ON receipt_test.* TO 'receipt_reader'@'127.0.0.1'");
 put($web.'/kids/config/database.local.php','<?php return '.var_export(['host'=>'127.0.0.1','port'=>$dbPort,'database'=>'receipt_test','username'=>'receipt_reader','password'=>$secret],true).';');
 // Only the isolated copy permits the normal public creation flow.
 $config=file_get_contents($web.'/kids/api/config.php');$config=str_replace("'public_open' => false","'public_open' => true",$config);put($web.'/kids/api/config.php',$config);
 $processes[]=launch([PHP_BINARY,'-d','display_errors=0','-d','session.save_path='.$root.'/sessions','-S','127.0.0.1:'.$httpPort,'-t',$web],$root.'/http.log');waitPort($httpPort);
 $base='http://127.0.0.1:'.$httpPort;$jar=$root.'/owner.cookies';$foreign=$root.'/foreign.cookies';
 $session=request($base.'/kids/api/session.php',$jar);
 $payload=['child_name'=>'João Ávila da Conceição São José de Alcântara Maria Vitória Gonçalves de Oliveira e Albuquerque','birth_date'=>'2019-05-15','division'=>'F','guardian_name'=>'RESPONSAVEL PRIVADO','relationship'=>'Mãe','phone'=>'11987654321','declaration_version'=>$session[1]['declaration_version'],'accepted'=>true];
 $headers=['Content-Type: application/json','X-CSRF-Token: '.$session[1]['csrf_token'],'Idempotency-Key: '.bin2hex(random_bytes(32))];
 $created=request($base.'/kids/api/create.php',$jar,$payload,$headers);check($created[0]===201,'real public registration created in isolated copy');
 $rows=$pdo->query('SELECT * FROM kids_inscricoes')->fetchAll();$row=$rows[0];$ref=$row['referencia'];
 $url=$base.'/kids/api/receipt.php?reference='.$ref;
 $before=$pdo->query('SELECT * FROM kids_inscricoes')->fetchAll();$counter=$pdo->query('SELECT proximo_numero FROM kids_eventos')->fetchColumn();
 $out=$project.'/tmp/pdfs/receipts';if(!is_dir($out))mkdir($out,0700,true);
 foreach(['pending','paid','cancelled'] as $case){
  if($case==='paid')$pdo->exec("UPDATE kids_inscricoes SET pagamento='CONFIRMADO', numero_peito=1000");
  if($case==='cancelled')$pdo->exec("UPDATE kids_inscricoes SET situacao='CANCELADA'");
  $snapshot=$pdo->query('SELECT * FROM kids_inscricoes')->fetchAll();
  $pdf=request($url,$jar);check($pdf[0]===200&&str_starts_with($pdf[2],'%PDF-'),$case.' real endpoint PDF');
  check(count(preg_grep('/^Cache-Control:.*no-store/i',$pdf[3]))===1,$case.' no-store headers');
  put($out.'/'.$case.'.pdf',$pdf[2]);
  check($pdo->query('SELECT * FROM kids_inscricoes')->fetchAll()===$snapshot&&$pdo->query('SELECT proximo_numero FROM kids_eventos')->fetchColumn()===$counter,$case.' emission changes no registration or counter');
 }
 check(request($url,$foreign)[0]===401,'no public session denied');
 $other=request($base.'/kids/api/session.php',$foreign);
 check(request($url,$foreign)[0]===404,'other public owner denied known reference');
 foreach(['id=1','number=001','child_name=Jo%C3%A3o','reference%5B%5D=x','reference=1'] as $query)check(request($base.'/kids/api/receipt.php?'.$query,$jar)[0]===404,'selector alone denied '.$query);
 check(request($url,$jar,[])[0]===405,'POST refused');
 $lookup=request($base.'/kids/api/lookup.php',$foreign,['child_name'=>$payload['child_name'],'phone'=>$payload['phone']],['Content-Type: application/json','X-CSRF-Token: '.$other[1]['csrf_token']]);
 check($lookup[0]===200&&request($url,$foreign)[0]===404,'successful name/phone lookup grants no PDF authority');
 // Real existing administrative rendering continues to use the unchanged report code.
 require_once $project.'/kids/pdf/report.php';require_once $project.'/kids/api/config.php';
 $admin=$pdo->query('SELECT * FROM kids_inscricoes')->fetchAll();
 check(str_starts_with(kids_pdf_render($admin,kids_config(),new DateTimeImmutable()),'%PDF-'),'existing administrative PDF renders');
 check(str_starts_with(kids_pdf_render($admin,kids_config(),new DateTimeImmutable(),kids_registration_filters(['band'=>'4-7','payment'=>'CONFIRMADO','search'=>'João'])),'%PDF-'),'existing filtered administrative PDF renders');
 $node=proc_open(['node',$project.'/kids/tests/receipt-browser.cjs'],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes,null,null,['bypass_shell'=>true,'create_new_console'=>false]);
 fwrite($pipes[0],json_encode(['base'=>$base]));fclose($pipes[0]);echo stream_get_contents($pipes[1]);$error=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);check(proc_close($node)===0,'browser checks '.$error);
 $sid='';foreach(file($jar) as $line){$parts=explode("\t",trim($line));if(count($parts)===7&&$parts[5]==='PSA_KIDS_PUBLIC')$sid=$parts[6];}
 check($sid!==''&&is_file($root.'/sessions/sess_'.$sid),'owner session fixture located');
 $sessionPath=$root.'/sessions/sess_'.$sid;$saved=file_get_contents($sessionPath);put($sessionPath,preg_replace('/expires\|i:\d+;/','expires|i:1;',$saved));
 check(request($url,$jar)[0]===401,'expired owner session denied');
 put(__DIR__.'/receipt-results.json',json_encode(['passed'=>$checks,'production_accessed'=>false,'new_migration'=>false,'pdf_directory'=>$out],JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));
} catch(Throwable $e){fwrite(STDERR,$e->getMessage()."\n");$failed=true;}
finally{foreach(array_reverse($processes) as $p){proc_terminate($p);proc_close($p);}}
exit(isset($failed)?1:0);
