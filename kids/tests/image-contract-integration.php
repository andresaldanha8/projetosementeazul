<?php
declare(strict_types=1);
// Read-only application exercise over fixtures in a brand-new local datadir.
// No migration files, existing databases, production configuration or accounts are used.
if(PHP_SAPI!=='cli')exit(1);
$project=dirname(__DIR__,2);$root=$project.'/tmp/kids-image-contract-'.bin2hex(random_bytes(6));$web=$root.'/web';$processes=[];$checks=[];
mkdir($web.'/kids',0700,true);mkdir($root.'/sessions',0700,true);
function check(bool $ok,string $label):void{global $checks;if(!$ok)throw new RuntimeException($label);$checks[]=$label;echo "PASS $label\n";}
function launch(array $command,string $log){$p=proc_open($command,[0=>['pipe','r'],1=>['file',$log,'a'],2=>['file',$log,'a']],$pipes,null,null,['bypass_shell'=>true,'create_new_console'=>false]);fclose($pipes[0]);return $p;}
function port():int{$s=stream_socket_server('tcp://127.0.0.1:0',$e,$m);$p=(int)substr(strrchr(stream_socket_get_name($s,false),':'),1);fclose($s);return $p;}
function waitPort(int $p):void{for($i=0;$i<100;$i++){$s=@fsockopen('127.0.0.1',$p);if($s){fclose($s);return;}usleep(100000);}throw new RuntimeException('Local server timeout');}
function copyTree(string $from,string $to):void{if(!is_dir($to))mkdir($to,0700,true);foreach(scandir($from) as $f){if($f==='.'||$f==='..'||$f==='database.local.php')continue;is_dir($from.'/'.$f)?copyTree($from.'/'.$f,$to.'/'.$f):copy($from.'/'.$f,$to.'/'.$f);}}
function request(string $url,string $jar,?array $body=null,array $headers=[]):array{$c=curl_init($url);$received=[];curl_setopt_array($c,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_COOKIEFILE=>$jar,CURLOPT_COOKIEJAR=>$jar,CURLOPT_TIMEOUT=>20,CURLOPT_HTTPHEADER=>$headers,CURLOPT_HEADERFUNCTION=>function($c,$line)use(&$received){$received[]=trim($line);return strlen($line);}]);if($body!==null)curl_setopt_array($c,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($body)]);$raw=curl_exec($c);$status=curl_getinfo($c,CURLINFO_RESPONSE_CODE);curl_close($c);return [$status,json_decode($raw,true),$received];}
function snapshot(PDO $connection):string{$data=[];foreach(['kids_eventos','kids_administradores','kids_inscricoes','kids_auditoria'] as $t)$data[$t]=$connection->query('SELECT * FROM '.$t.' ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);return hash('sha256',serialize($data));}
try{
 foreach(['api','admin'] as $dir)copyTree($project.'/kids/'.$dir,$web.'/kids/'.$dir);
 mkdir($web.'/kids/config',0700,true);
 $dbPort=port();$httpPort=port();$bin='C:/xampp/mysql/bin';
 $init=launch([$bin.'/mysql_install_db.exe','--datadir='.$root.'/db','--port='.$dbPort],$root.'/init.log');check(proc_close($init)===0,'fresh isolated datadir; no migrations or existing preview used');
 $processes[]=launch([$bin.'/mysqld.exe','--no-defaults','--basedir=C:/xampp/mysql','--datadir='.$root.'/db','--port='.$dbPort,'--bind-address=127.0.0.1','--skip-name-resolve','--innodb-buffer-pool-size=32M','--log-error='.$root.'/mariadb.log'],$root.'/db.log');waitPort($dbPort);
 $setup=new PDO('mysql:host=127.0.0.1;port='.$dbPort.';charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
 $setup->exec('CREATE DATABASE image_contract CHARACTER SET utf8mb4');$setup->exec('USE image_contract');
 // Minimal fixture schema for the real authentication/list endpoints, no installer or migrations.
 $setup->exec('CREATE TABLE kids_eventos(id BIGINT PRIMARY KEY,codigo VARCHAR(80),proximo_numero BIGINT) ENGINE=InnoDB');
 $setup->exec('CREATE TABLE kids_administradores(id BIGINT PRIMARY KEY,nome VARCHAR(100),login VARCHAR(100),password_hash VARCHAR(255),perfil VARCHAR(30),ativo INT,auth_version INT,must_change_password INT) ENGINE=InnoDB');
 $setup->exec('CREATE TABLE kids_admin_login_limites(origem_hash CHAR(64) PRIMARY KEY,janela_inicio BIGINT,tentativas INT) ENGINE=InnoDB');
 $setup->exec('CREATE TABLE kids_inscricoes(id BIGINT PRIMARY KEY,evento_id BIGINT,numero_peito BIGINT,crianca_nome VARCHAR(100),nascimento DATE,divisao CHAR(1),idade_inscricao INT,faixa VARCHAR(5),responsavel_nome VARCHAR(100),vinculo VARCHAR(30),telefone VARCHAR(15),camisa VARCHAR(5),valor_centavos INT,pagamento VARCHAR(20),situacao VARCHAR(20),atualizada_em DATETIME(6),imagem_autorizada TINYINT UNSIGNED NULL,imagem_autorizacao_versao VARCHAR(100),imagem_autorizacao_texto TEXT,imagem_registrada_em DATETIME(6)) ENGINE=InnoDB');
 $setup->exec('CREATE TABLE kids_auditoria(id BIGINT PRIMARY KEY,inscricao_id BIGINT,usuario_id BIGINT,estado_anterior VARCHAR(20),estado_novo VARCHAR(20)) ENGINE=InnoDB');
 $setup->exec("INSERT INTO kids_eventos VALUES(1,'AUTISMO-RUN-2026-KIDS',7)");
 $password=bin2hex(random_bytes(16));$dbSecret=bin2hex(random_bytes(24));
 $q=$setup->prepare("INSERT INTO kids_administradores VALUES(1,'Administrador Isolado','admin.contrato',?,'ADMINISTRADOR',1,1,0)");$q->execute([password_hash($password,PASSWORD_DEFAULT)]);
 $q=$setup->prepare("INSERT INTO kids_inscricoes VALUES(?,1,?,?, '2019-05-15','F',7,'4-7','Responsavel Ficticio','Mae','93999990000','P',6000,'CONFIRMADO','REGISTRADA','2026-10-18 15:00:00',?,?,?,?)");
 foreach([[4,'Contrato Autorizado',1],[5,'Contrato Recusado',0],[6,'Contrato Antigo',null]] as [$id,$name,$choice])$q->execute([$id,$id,$name,$choice,$choice===null?null:'KIDS-IMAGEM-2026-v1',$choice===null?null:'Texto de teste isolado',$choice===null?null:'2026-10-18 15:00:00']);
 $setup->exec("INSERT INTO kids_auditoria VALUES(1,4,1,'PENDENTE','CONFIRMADO')");
 $setup->exec("CREATE USER 'contract_runtime'@'127.0.0.1' IDENTIFIED BY '$dbSecret'");$setup->exec("GRANT SELECT,INSERT,UPDATE,DELETE ON image_contract.* TO 'contract_runtime'@'127.0.0.1'");
 $local=['host'=>'127.0.0.1','port'=>$dbPort,'database'=>'image_contract','username'=>'contract_runtime','password'=>$dbSecret];file_put_contents($web.'/kids/config/database.local.php','<?php return '.var_export($local,true).';');
 require $web.'/kids/api/database.php'; // Actual runtime PDO options, not a test approximation.
 $raw=$pdo->query('SELECT numero_peito,imagem_autorizada FROM kids_inscricoes ORDER BY id')->fetchAll();
 $attribute=static function(int $key)use($pdo){try{return $pdo->getAttribute($key);}catch(PDOException $e){return 'getter_unsupported';}};
 $pdoEvidence=['emulate_prepares'=>$attribute(PDO::ATTR_EMULATE_PREPARES),'stringify_fetches'=>$attribute(PDO::ATTR_STRINGIFY_FETCHES),'default_fetch_mode'=>$attribute(PDO::ATTR_DEFAULT_FETCH_MODE),'client'=>$attribute(PDO::ATTR_CLIENT_VERSION),'raw'=>array_map(fn($r)=>['number'=>$r['numero_peito'],'value'=>$r['imagem_autorizada'],'php_type'=>gettype($r['imagem_autorizada'])],$raw)];
 check(in_array($pdoEvidence['emulate_prepares'],[false,0],true)&&array_key_exists('imagem_autorizada',$raw[0])&&hash_file('sha256',$web.'/kids/api/database.php')===hash_file('sha256',$project.'/kids/api/database.php'),'probe uses unmodified kids/api/database.php and exact runtime PDO settings');
 $before=snapshot($pdo);
 $processes[]=launch([PHP_BINARY,'-d','display_errors=0','-d','log_errors=1','-d','error_log='.$root.'/php-errors.log','-d','session.save_path='.$root.'/sessions','-S','127.0.0.1:'.$httpPort,'-t',$web],$root.'/http.log');waitPort($httpPort);
 $base='http://127.0.0.1:'.$httpPort;$jar=$root.'/admin.cookies';$api=$base.'/kids/admin/api/';$g=request($api.'me.php',$jar);
 $login=request($api.'login.php',$jar,['login'=>'admin.contrato','password'=>$password],['Content-Type: application/json','X-CSRF-Token: '.$g[1]['csrfToken']]);check($login[0]===200,'real login endpoint with random isolated credentials');
 $h=['Content-Type: application/json','X-CSRF-Token: '.$login[1]['csrfToken']];
 foreach(['GET','POST','id'] as $mode){$response=$mode==='POST'?request($api.'registrations.php',$jar,['band'=>'4-7','payment'=>'','search'=>'','page'=>1,'perPage'=>20],$h):request($api.'registrations.php'.($mode==='id'?'?id=4':'?band=4-7'),$jar);check($response[0]===200,'real registrations endpoint '.$mode);
  $want=$mode==='id'?[true]:[true,false,null];check(array_column($response[1]['registrations'],'imagem_autorizada')===$want,'JSON boolean/null contract '.$mode);
  check(in_array('X-Kids-Image-Contract: 1',$response[2],true),'endpoint deployment marker '.$mode);
 }
 $node=proc_open(['node',$project.'/kids/tests/image-contract-browser.cjs'],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes,null,null,['bypass_shell'=>true,'create_new_console'=>false]);fwrite($pipes[0],json_encode(['base'=>$base,'password'=>$password,'web'=>$web]));fclose($pipes[0]);echo stream_get_contents($pipes[1]);$error=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);check(proc_close($node)===0,'browser contract checks: '.$error);
 check(snapshot($pdo)===$before,'all fixture registrations, administrators, payments, audit and counter unchanged');
 file_put_contents(__DIR__.'/image-contract-results.json',json_encode(['checks'=>count($checks),'passed'=>$checks,'pdo'=>$pdoEvidence,'database'=>$pdo->query('SELECT VERSION()')->fetchColumn(),'data_unchanged'=>true,'production_accessed'=>false,'migrations_executed'=>false],JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));
}catch(Throwable $e){fwrite(STDERR,$e->getMessage()."\n");$failed=true;}finally{foreach(array_reverse($processes) as $p){proc_terminate($p);proc_close($p);}}
exit(isset($failed)?1:0);
