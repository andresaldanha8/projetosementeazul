<?php
declare(strict_types=1);
// New isolated datadir + KIDS-only webroot/user. Never touches an existing preview/database.
if (PHP_SAPI!=='cli') exit(1);
$project=dirname(__DIR__,2);
$root=$project.'/tmp/kids-independent-'.bin2hex(random_bytes(6));
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
try{
 foreach(['pdo_mysql','curl','mbstring','dom'] as $ext)if(!extension_loaded($ext))throw new RuntimeException('Missing '.$ext);
 foreach(['api','admin','pdf','config'] as $dir)copyTree($project.'/kids/'.$dir,$web.'/kids/'.$dir);
 foreach(['index.html','kids.js','kids.css','lookup.js'] as $f)copy($project.'/kids/'.$f,$web.'/kids/'.$f);
 foreach(['css','img'] as $asset)mkdir($web.'/'.$asset,0700,true);
 copy($project.'/css/style.css',$web.'/css/style.css');copy($project.'/img/logo.png',$web.'/img/logo.png');copy($project.'/favicon.ico',$web.'/favicon.ico');
 check(!is_dir($web.'/cadastro'),'webroot contains no attendance files');
 $dbPort=port();$httpPort=port();
 $init=launch([$bin.'/mysql_install_db.exe','--datadir='.$root.'/db','--port='.$dbPort],$root.'/init.log');
 check(proc_close($init)===0,'fresh isolated MariaDB datadir initialized');
 $processes[]=launch([$bin.'/mysqld.exe','--no-defaults','--basedir='.dirname($bin),'--datadir='.$root.'/db','--port='.$dbPort,'--bind-address=127.0.0.1','--skip-name-resolve','--innodb-buffer-pool-size=32M','--log-error='.$root.'/mariadb.log'],$root.'/db-process.log');waitPort($dbPort);
 $pdo=new PDO('mysql:host=127.0.0.1;port='.$dbPort.';charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
 $pdo->exec('CREATE DATABASE kids_independent CHARACTER SET utf8mb4');$pdo->exec('USE kids_independent');
 $pdo->exec(file_get_contents($project.'/kids/ops/install-kids-empty.sql'));
 check(count(schema($pdo,'kids_independent'))===7,'consolidated installer creates seven KIDS-only InnoDB tables');
 check((int)$pdo->query('SELECT COUNT(*) FROM kids_administradores')->fetchColumn()===0&&(int)$pdo->query('SELECT COUNT(*) FROM kids_inscricoes')->fetchColumn()===0&&(int)$pdo->query('SELECT proximo_numero FROM kids_eventos')->fetchColumn()===1,'installation has no admins, registrations or fixtures; next bib 001');
 $pdo->exec('CREATE DATABASE kids_migration_alternative CHARACTER SET utf8mb4');$pdo->exec('USE kids_migration_alternative');
 foreach(glob($project.'/kids/migrations/*.sql') as $migration){
  if(basename($migration)==='006_image_authorization.sql'){
   $pdo->exec("INSERT INTO kids_inscricoes(evento_id,numero_peito,referencia,owner_hash,crianca_nome,nascimento,divisao,idade_inscricao,faixa,responsavel_nome,vinculo,telefone,camisa,valor_centavos,declaracao_versao,aceita_em,criada_em,atualizada_em) VALUES(1,77,'01234567890123456789012345678901',REPEAT('a',64),'Legado Ficticio','2019-05-15','F',7,'4-7','Responsavel Ficticio','Mae','11900000000','P',6000,'LEGADO',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))");
   $legacyBefore=$pdo->query('SELECT * FROM kids_inscricoes')->fetch();
  }
  $pdo->exec(file_get_contents($migration));
 }
 $legacyAfter=$pdo->query('SELECT * FROM kids_inscricoes')->fetch();
 check(array_intersect_key($legacyAfter,$legacyBefore)===$legacyBefore&&$legacyAfter['imagem_autorizada']===null&&$legacyAfter['imagem_autorizacao_texto']===null&&$legacyAfter['imagem_autorizacao_versao']===null&&$legacyAfter['imagem_registrada_em']===null,'additive 006 preserves legacy data and leaves image authorization not informed');
 check(schema($pdo,'kids_independent')===schema($pdo,'kids_migration_alternative'),'alternative ordered migrations produce identical schema in a second empty database');
 $offlinePassword=bin2hex(random_bytes(16));$offlineSql=$root.'/primeiro-admin-privado.sql';
 $offline=proc_open([PHP_BINARY,$project.'/kids/ops/prepare-first-admin.php',$offlineSql,'admin.offline','Administrador Offline'],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes,null,null,['bypass_shell'=>true,'create_new_console'=>false]);
 fwrite($pipes[0],json_encode(['password'=>$offlinePassword]));fclose($pipes[0]);stream_get_contents($pipes[1]);stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);
 check(proc_close($offline)===0&&!str_contains(file_get_contents($offlineSql),$offlinePassword),'offline first-admin SQL generated with hash only and no database connection');
 $offlineStatements=array_filter(array_map('trim',explode(';',preg_replace('/^--.*$/m','',file_get_contents($offlineSql)))));
 foreach($offlineStatements as $sql){$statement=$pdo->query($sql);$statement->closeCursor();}
 $offlineAdmin=$pdo->query('SELECT * FROM kids_administradores')->fetch();
 check($offlineAdmin&&password_verify($offlinePassword,$offlineAdmin['password_hash'])&&(int)$offlineAdmin['must_change_password']===1,'offline provisioning SQL imports into alternative empty KIDS schema');
 foreach($offlineStatements as $sql){$statement=$pdo->query($sql);$statement->closeCursor();}
 check((int)$pdo->query('SELECT COUNT(*) FROM kids_administradores')->fetchColumn()===1,'offline provisioning SQL cannot duplicate existing admin');
 $pdo->exec('USE kids_independent');
 $dbPassword=bin2hex(random_bytes(24));$initialPassword=bin2hex(random_bytes(16));$password=bin2hex(random_bytes(16));
 $pdo->exec("CREATE USER 'kids_only'@'127.0.0.1' IDENTIFIED BY '$dbPassword'");
 $pdo->exec("GRANT SELECT,INSERT,UPDATE,DELETE ON kids_independent.* TO 'kids_only'@'127.0.0.1'");
 $restricted=new PDO('mysql:host=127.0.0.1;port='.$dbPort.';dbname=kids_independent;charset=utf8mb4','kids_only',$dbPassword,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
 $denied=false;try{$restricted->query('SELECT * FROM mysql.user');}catch(PDOException $e){$denied=true;}
 check($denied,'runtime MySQL user has no global or other-database access');
 $denied=false;try{$restricted->query('SELECT * FROM kids_migration_alternative.kids_eventos');}catch(PDOException $e){$denied=true;}
 check($denied,'runtime MySQL user cannot read the second local schema');
 $private=$web.'/kids/config/database.local.php';
 $dbConfig=['host'=>'127.0.0.1','port'=>$dbPort,'database'=>'kids_independent','username'=>'kids_only','password'=>$dbPassword];
 put($private,"<?php\nif(realpath(\$_SERVER['SCRIPT_FILENAME']??'')===__FILE__){http_response_code(403);exit;}\nreturn ".var_export($dbConfig,true).";\n");
 check(account('wrong_target','create-first',$initialPassword)!==0,'CLI refuses a mismatched selected database');
 check(account('kids_independent','create-first','short')!==0,'CLI refuses a short initial password');
 check(account('kids_independent','create-first',$initialPassword)===0,'first administrator created through private CLI with stdin secret');
 check(account('kids_independent','create-first',$initialPassword)!==0&&(int)$pdo->query('SELECT COUNT(*) FROM kids_administradores')->fetchColumn()===1,'first-admin provisioning cannot overwrite or create a second account');
 $admin=$pdo->query('SELECT * FROM kids_administradores')->fetch();
 check(password_verify($initialPassword,$admin['password_hash'])&&$admin['password_hash']!==$initialPassword&&(int)$admin['must_change_password']===1,'only password hash stored with mandatory first change');
 // Test-only expiry seam is outside all shipped runtime files.
 put($web.'/router.php', <<<'ROUTER'
<?php
$path=rawurldecode(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH));
if(str_starts_with($path,'/kids/config/')||str_starts_with($path,'/kids/pdf/')){http_response_code(403);exit;}
if($path==='/kids/admin/__test/expire'){
 require __DIR__.'/kids/admin/api/_bootstrap.php';kids_require_admin($pdo,true);
 if(($_GET['kind']??'')==='absolute')$_SESSION['kids_session_created_at']=time()-28800;
 else $_SESSION['kids_session_last_activity']=time()-1800;
 kids_reply(200,['sucesso'=>true]);
}
return false;
ROUTER
 );
 // Deterministic test clock only in this clone, never in the published sources.
 foreach(['create.php','session.php'] as $f){$s=file_get_contents($web.'/kids/api/'.$f);$s=str_replace(["new DateTimeImmutable('now')","new DateTimeImmutable('now', new DateTimeZone(\$config['timezone']))"],"new DateTimeImmutable('2026-10-18T12:00:00-03:00')",$s);put($web.'/kids/api/'.$f,$s);}
 $processes[]=launch([PHP_BINARY,'-d','display_errors=0','-d','log_errors=1','-d','error_log='.$root.'/php-errors.log','-d','session.save_path='.$root.'/sessions','-d','session.gc_probability=0','-S','127.0.0.1:'.$httpPort,'-t',$web,$web.'/router.php'],$root.'/http.log');waitPort($httpPort);
 $base='http://127.0.0.1:'.$httpPort;$api=$base.'/kids/admin/api/';$jar=$root.'/admin.cookies';$publicJar=$root.'/public.cookies';
 check(request($base.'/kids/admin/',$jar)[0]===200,'standalone admin shell loads without attendance runtime');
 check(request($api.'registrations.php',$jar)[0]===401,'anonymous administration refused');
 $guest=request($api.'me.php',$jar);
 check(request($api.'login.php',$jar,['login'=>'admin.isolado','password'=>$initialPassword],['Content-Type: application/json'])[0]===403,'login requires its own CSRF token');
 check(login($jar,'incorrect') [0]===401,'incorrect credentials refused');
 $first=login($jar,$initialPassword);
 check($first[0]===200&&$first[1]['mustChangePassword']===true,'KIDS-only login succeeds and requires password change');
 check(request($api.'registrations.php',$jar)[0]===403,'mandatory change blocks registrations');
 $oldJar=$root.'/old-session.cookies';check(login($oldJar,$initialPassword)[0]===200,'second session established for revocation test');
 check(request($api.'change-password.php',$jar,['currentPassword'=>$initialPassword,'newPassword'=>$password],['Content-Type: application/json'])[0]===403,'password change rejects missing CSRF');
 $changed=request($api.'change-password.php',$jar,['currentPassword'=>$initialPassword,'newPassword'=>$password],ah($first));
 check($changed[0]===200&&!$changed[1]['mustChangePassword']&&$changed[1]['csrfToken']!==$first[1]['csrfToken'],'password change rotates identity/CSRF and removes mandatory gate');
 check(request($api.'me.php',$oldJar)[0]===401,'password change revokes older sessions by auth_version');
 check(request($api.'registrations.php',$jar)[0]===200,'new KIDS session authorized against its own administrator table');
 $public=request($base.'/kids/api/session.php',$publicJar);
 check($public[0]===200&&$public[1]['public_open']===false,'production configuration starts closed in test clone');
 $payload=['child_name'=>'João Independente Fictício','birth_date'=>'2019-05-15','division'=>'M','guardian_name'=>'Responsável Fictícia','relationship'=>'Mãe','phone'=>'93999990001','declaration_version'=>$public[1]['declaration_version'],'accepted'=>true];
 $key=bin2hex(random_bytes(32));$ph=['Content-Type: application/json','X-CSRF-Token: '.$public[1]['csrf_token'],'Idempotency-Key: '.$key];
 check(request($base.'/kids/api/create.php',$publicJar,$payload,$ph)[0]===503&&(int)$pdo->query('SELECT proximo_numero FROM kids_eventos')->fetchColumn()===1,'closed registration refuses writes and preserves next number');
 $configFile=$web.'/kids/api/config.php';$closed=file_get_contents($configFile);
 put($configFile,str_replace("'public_open' => false","'public_open' => true",$closed));
 $created=request($base.'/kids/api/create.php',$publicJar,$payload,$ph);
 check($created[0]===201&&$created[1]['registration']['number']==='001','HTTP registration creates bib 001 in empty independent database');
 $replay=request($base.'/kids/api/create.php',$publicJar,$payload,$ph);
 check($replay[0]===200&&$replay[1]['replayed']&&(int)$pdo->query('SELECT COUNT(*) FROM kids_inscricoes')->fetchColumn()===1&&(int)$pdo->query('SELECT proximo_numero FROM kids_eventos')->fetchColumn()===2,'idempotent replay preserves registration and counter');
 $confirm=request($base.'/kids/api/confirmations.php',$publicJar);
 check($confirm[0]===200&&$confirm[1]['registrations'][0]['number']==='001','public confirmation uses independent PDO');
 check(request($api.'registrations.php',$publicJar)[0]===401,'public session cannot authenticate as KIDS administrator');
 $list=request($api.'registrations.php?band=4-7',$jar);$row=$list[1]['registrations'][0]??[];
 check($list[0]===200&&$list[1]['total']===1&&(int)$row['numero_peito']===1,'administrative list sees same independent registration');
 $body=['expectedUpdatedAt'=>$row['atualizada_em'],'amountCents'=>(int)$row['valor_centavos']];$pay=$api.'payment.php?id='.$row['id'];
 check(request($pay,$jar,$body,['Content-Type: application/json'])[0]===403,'payment requires KIDS CSRF');
 check(request($pay,$jar,$body,ah($changed))[0]===200,'payment confirmation succeeds');
 check(request($pay,$jar,$body,ah($changed))[0]===200&&(int)$pdo->query('SELECT COUNT(*) FROM kids_auditoria')->fetchColumn()===1,'payment repeat does not duplicate audit');
 $audit=$pdo->query('SELECT a.*,u.login FROM kids_auditoria a JOIN kids_administradores u ON u.id=a.usuario_id')->fetch();
 check($audit&&$audit['login']==='admin.isolado'&&$audit['estado_anterior']==='PENDENTE'&&$audit['estado_novo']==='CONFIRMADO','audit references KIDS administrator with original/new payment states');
 $denied=false;try{$pdo->exec('UPDATE kids_auditoria SET usuario_id=99999');}catch(PDOException $e){$denied=true;}check($denied,'audit FK rejects unknown administrative identity');
 $denied=false;try{$pdo->exec('DELETE FROM kids_administradores');}catch(PDOException $e){$denied=true;}check($denied,'audit FK preserves responsible administrator from deletion');
 $lookupJar=$root.'/lookup.cookies';$lookupSession=request($base.'/kids/api/session.php',$lookupJar);
 $lookup=request($base.'/kids/api/lookup.php',$lookupJar,['child_name'=>$payload['child_name'],'phone'=>$payload['phone']],['Content-Type: application/json','X-CSRF-Token: '.$lookupSession[1]['csrf_token']]);
 check($lookup[0]===200&&$lookup[1]['registration']['number']==='001'&&$lookup[1]['registration']['payment_status']==='CONFIRMADO','fresh public lookup sees paid bib 001');
 check(request($base.'/kids/api/confirmations.php',$publicJar)[1]['registrations'][0]['payment_status']==='CONFIRMADO','public confirmation updates after payment');
 $before=$pdo->query('SELECT * FROM kids_inscricoes')->fetchAll();
 $pdfFiles=[];
 foreach(['completa'=>[],'filtrada'=>['band'=>'4-7','payment'=>'CONFIRMADO','search'=>'001']] as $kind=>$filters){
  $endpoint=$kind==='completa'?'export-pdf.php':'export-filtered-pdf.php';$response=request($api.$endpoint,$jar,$filters,ah($changed));
  check($response[0]===200&&str_starts_with($response[2],'%PDF-'),'independent '.$kind.' PDF downloads from real endpoint');
  $file=$project.'/output/pdf/kids-independente-'.$kind.'-001.pdf';put($file,$response[2]);$pdfFiles[]=$file;
 }
 check($pdo->query('SELECT * FROM kids_inscricoes')->fetchAll()===$before,'PDF exports preserve all stored registration values');
 check(request($api.'export-pdf.php',$jar,[],['Content-Type: application/json'])[0]===403,'PDF export rejects missing CSRF');
 check(request($api.'export-filtered-pdf.php',$jar,['band'=>'8-10','payment'=>'','search'=>''],ah($changed))[0]===404,'empty filtered export keeps no-results response');
 require __DIR__.'/image-authorization-cases.php';
 foreach(['inactive','profile','version'] as $kind){
  $sessionJar=$root.'/'.$kind.'.cookies';$session=login($sessionJar,$password);check($session[0]===200,'revocation test session '.$kind);
  $pdo->exec(match($kind){'inactive'=>'UPDATE kids_administradores SET ativo=0','profile'=>"UPDATE kids_administradores SET perfil='REVOGADO'",default=>'UPDATE kids_administradores SET auth_version=auth_version+1'});
  check(request($api.'registrations.php',$sessionJar)[0]===401,'authoritative '.$kind.' change revokes KIDS session');
  $pdo->exec("UPDATE kids_administradores SET ativo=1,perfil='ADMINISTRADOR'");
 }
 $pdo->exec('DELETE FROM kids_admin_login_limites');
 foreach(['idle','absolute'] as $kind){$expiryJar=$root.'/expiry-'.$kind.'.cookies';$session=login($expiryJar,$password);check($session[0]===200&&request($base.'/kids/admin/__test/expire?kind='.$kind,$expiryJar,[],ah($session))[0]===200,'prepare isolated '.$kind.' session expiry');check(request($api.'registrations.php',$expiryJar)[0]===401,'session '.$kind.' expiry enforced');}
 $pdo->exec('DELETE FROM kids_admin_login_limites');
 for($i=1;$i<=9;$i++){$bad=login($root.'/bad-'.$i.'.cookies','wrong');check($bad[0]===($i<=8?401:429),'persistent per-login attempt limit '.$i);}
 $pdo->exec('DELETE FROM kids_admin_login_limites');
 for($i=1;$i<=21;$i++){$ipJar=$root.'/ip-'.$i.'.cookies';$g=request($api.'me.php',$ipJar);$r=request($api.'login.php',$ipJar,['login'=>'missing.'.$i,'password'=>'wrong'],['Content-Type: application/json','X-CSRF-Token: '.$g[1]['csrfToken']]);if($i===21)check($r[0]===429&&count(preg_grep('/^Retry-After:/i',$r[3]))===1,'persistent IP limit cannot be bypassed by changing login or cookies');}
 $pdo->exec('DELETE FROM kids_admin_login_limites');
 $resetPassword=bin2hex(random_bytes(16));$activeJar=$root.'/before-reset.cookies';check(login($activeJar,$password)[0]===200,'session established before CLI reset');
 check(account('kids_independent','reset-password',$resetPassword)===0&&request($api.'me.php',$activeJar)[0]===401,'private CLI reset revokes existing KIDS session');
 $resetJar=$root.'/reset.cookies';$reset=login($resetJar,$resetPassword);check($reset[0]===200&&$reset[1]['mustChangePassword'],'CLI reset again requires password change');
 check(request($api.'logout.php',$resetJar,[],ah($reset))[0]===200&&request($api.'me.php',$resetJar)[1]['usuario']===null,'logout destroys dedicated identity');
 $saved=file_get_contents($private);rename($private,$private.'.disabled');
 $unavailable=request($api.'me.php',$root.'/unavailable.cookies');
 check($unavailable[0]===503&&!str_contains($unavailable[2],'SQLSTATE')&&!str_contains($unavailable[2],$dbPassword),'missing KIDS config fails closed without fallback or credential disclosure');rename($private.'.disabled',$private);
 $wrong=$dbConfig;$wrong['password']=bin2hex(random_bytes(16));put($private,'<?php return '.var_export($wrong,true).';');
 check(request($api.'me.php',$root.'/wrong-db.cookies')[0]===503,'invalid KIDS database credential fails closed');put($private,$saved);
 put($configFile,$closed);
 check(request($base.'/kids/api/session.php',$publicJar)[1]['public_open']===false,'isolated test registration opening restored to closed');
 check(str_contains(file_get_contents($project.'/kids/api/config.php'),"'public_open' => false"),'workspace production configuration remains closed');
 $logs=file_get_contents($root.'/http.log').(is_file($root.'/php-errors.log')?file_get_contents($root.'/php-errors.log'):'');
 check(!str_contains($logs,$dbPassword)&&!str_contains($logs,$password)&&!str_contains($logs,$initialPassword)&&!str_contains($logs,$payload['child_name'])&&!str_contains($logs,$payload['phone']),'test HTTP/application logs contain no passwords or registration personal data');
 $summary=['checks'=>count($checks),'passed'=>$checks,'database'=>$pdo->query('SELECT VERSION()')->fetchColumn(),'temporary_directory'=>$root,'runtime_grants'=>$restricted->query('SHOW GRANTS')->fetchAll(PDO::FETCH_COLUMN),'pdfs'=>$pdfFiles,'attendance_files_present'=>false,'source_public_open'=>false];
 // Redact grant authentication material: retain only privilege lines, never hashes.
 $summary['runtime_grants']=array_values(array_filter($summary['runtime_grants'],fn($line)=>str_starts_with($line,'GRANT SELECT')));
 put(__DIR__.'/independent-results.json',json_encode($summary,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));
 echo 'OK '.count($checks)." independent integration checks.\n";
}catch(Throwable $e){fwrite(STDERR,$e->getMessage()."\nIsolated artifacts: $root\n");$failed=true;}
finally{foreach(array_reverse($processes) as $process){proc_terminate($process);proc_close($process);}}
exit(isset($failed)?1:0);
