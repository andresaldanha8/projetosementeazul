<?php
declare(strict_types=1);
// Fresh MariaDB datadir, minimal synthetic schema and private webroot. No real config/data.
if (PHP_SAPI !== 'cli') exit(1);
$project=dirname(__DIR__,2);$root=$project.'/tmp/cadastro-security-'.bin2hex(random_bytes(6));
$web=$root.'/web';$processes=[];$checks=[];
mkdir($web.'/cadastro/api',0700,true);mkdir($root.'/sessions',0700,true);
function check(bool $ok,string $label):void{global $checks;if(!$ok)throw new RuntimeException($label);$checks[]=$label;echo "PASS $label\n";}
function copyPublic(string $from,string $to):void{if(!is_dir($to))mkdir($to,0700,true);foreach(scandir($from) as $f){if($f==='.'||$f==='..'||str_starts_with($f,'.env'))continue;is_dir($from.'/'.$f)?copyPublic($from.'/'.$f,$to.'/'.$f):copy($from.'/'.$f,$to.'/'.$f);}}
function port():int{$s=stream_socket_server('tcp://127.0.0.1:0',$e,$m);$p=(int)substr(strrchr(stream_socket_get_name($s,false),':'),1);fclose($s);return $p;}
function launch(array $cmd,string $log){$p=proc_open($cmd,[0=>['pipe','r'],1=>['file',$log,'a'],2=>['file',$log,'a']],$pipes,null,null,['bypass_shell'=>true,'create_new_console'=>false]);if(!is_resource($p))throw new RuntimeException('launch');fclose($pipes[0]);return $p;}
function waitPort(int $port):void{for($i=0;$i<100;$i++){$s=@fsockopen('127.0.0.1',$port);if($s){fclose($s);return;}usleep(100000);}throw new RuntimeException('port timeout');}
function request(string $path,?array $body=null,array $headers=[]):array{global $base,$root;$c=curl_init($base.$path);curl_setopt_array($c,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_COOKIEFILE=>$root.'/test.cookies',CURLOPT_COOKIEJAR=>$root.'/test.cookies',CURLOPT_TIMEOUT=>15,CURLOPT_HTTPHEADER=>array_merge(['Content-Type: application/json'],$headers)]);if($body!==null)curl_setopt_array($c,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($body,JSON_THROW_ON_ERROR)]);$raw=curl_exec($c);if($raw===false)throw new RuntimeException('HTTP failure');$code=curl_getinfo($c,CURLINFO_RESPONSE_CODE);curl_close($c);return [$code,json_decode($raw,true)];}
try{
 copyPublic($project.'/cadastro/api',$web.'/cadastro/api');
 $bin='C:/xampp/mysql/bin';$dbPort=port();$httpPort=port();
 $init=launch([$bin.'/mysql_install_db.exe','--datadir='.$root.'/db','--port='.$dbPort],$root.'/init.log');check(proc_close($init)===0,'fresh isolated datadir');
 $processes[]=launch([$bin.'/mysqld.exe','--no-defaults','--basedir=C:/xampp/mysql','--datadir='.$root.'/db','--port='.$dbPort,'--bind-address=127.0.0.1','--skip-name-resolve','--innodb-buffer-pool-size=32M'],$root.'/db.log');waitPort($dbPort);
 $pdo=new PDO('mysql:host=127.0.0.1;port='.$dbPort,'root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
 $pdo->exec('CREATE DATABASE cadastro_security CHARACTER SET utf8mb4');$pdo->exec('USE cadastro_security');
 $pdo->exec('CREATE TABLE cad_usuarios(id INT PRIMARY KEY,nome VARCHAR(100),login VARCHAR(100),password_hash VARCHAR(255),perfil VARCHAR(30),ativo INT,auth_version INT,must_change_password INT,updated_at DATETIME(6)) ENGINE=InnoDB');
 $password=bin2hex(random_bytes(20));$stmt=$pdo->prepare('INSERT INTO cad_usuarios VALUES(1,?,?,?,?,1,1,0,NOW())');$stmt->execute(['Equipe Ficticia','teste.isolado',password_hash($password,PASSWORD_DEFAULT),'ADMINISTRADOR']);
 $pdo->exec('CREATE TABLE cad_declaracoes(id INT PRIMARY KEY,versao VARCHAR(100)) ENGINE=InnoDB');$pdo->exec("INSERT INTO cad_declaracoes VALUES(1,'PSA-CAD-2026-V1')");
 $pdo->exec('CREATE TABLE cad_idempotency(user_id INT,operation VARCHAR(100),idempotency_key VARCHAR(36),payload_hash VARCHAR(64),resource_id INT NULL,created_at DATETIME(6),UNIQUE KEY ux_cad_idempotency_user_op_key(user_id,operation,idempotency_key)) ENGINE=InnoDB');
 // Minimal fixture columns exercise actual INSERTs; this is not a production-schema migration test.
 $schemas=[
 'cad_fichas'=>'origem,situacao,data_ingresso,observacoes_administrativas,created_by,created_by_name_snapshot,created_at,updated_at,updated_by,updated_by_name_snapshot,crianca_nome,crianca_nome_social,crianca_nascimento,crianca_sexo,crianca_rg,crianca_cpf,bairro,crianca_telefone,escola_instituicao,possui_diagnostico,ano_escolar,serie_escolar,responsavel_nome,responsavel_parentesco,responsavel_nascimento,responsavel_telefone,responsavel_whatsapp,responsavel_email,outro_interesse_descricao,necessidades_especificas',
 'cad_autorizacoes'=>'cadastro_id,responsavel_nome_snapshot,declaracao_id,concordou,concordou_at,registrado_por,registrado_por_nome_snapshot',
 'cad_auditoria'=>'cadastro_id,usuario_id,usuario_nome_snapshot,operacao,ocorrido_at,campos_alterados,situacao_anterior,situacao_nova'];
 foreach($schemas as $table=>$columns)$pdo->exec('CREATE TABLE '.$table.'(id INT AUTO_INCREMENT PRIMARY KEY,'.implode(',',array_map(fn($c)=>$c.' TEXT NULL',explode(',',$columns))).') ENGINE=InnoDB');
 $dbPassword=bin2hex(random_bytes(20));$pdo->exec("CREATE USER 'fixture'@'127.0.0.1' IDENTIFIED BY '$dbPassword'");$pdo->exec("GRANT SELECT,INSERT,UPDATE,DELETE ON cadastro_security.* TO 'fixture'@'127.0.0.1'");
 file_put_contents($web.'/cadastro/api/config/.env.php',"<?php\ndefine('DB_HOST','127.0.0.1;port=$dbPort');define('DB_NAME','cadastro_security');define('DB_USER','fixture');define('DB_PASSWORD','$dbPassword');");
 $base='http://127.0.0.1:'.$httpPort;
 $processes[]=launch([PHP_BINARY,'-d','display_errors=0','-d','session.save_path='.$root.'/sessions','-S','127.0.0.1:'.$httpPort,'-t',$web],$root.'/http.log');waitPort($httpPort);
 check(request('/cadastro/api/auth/me.php')[0]===401,'anonymous access denied');
 check(request('/cadastro/api/auth/login.php',['login'=>'teste.isolado','password'=>'incorrect'])[0]===401,'invalid login denied');
 $login=request('/cadastro/api/auth/login.php',['login'=>'teste.isolado','password'=>$password]);check($login[0]===200&&isset($login[1]['csrfToken']),'real cadastro login with synthetic account');
 check(request('/cadastro/api/auth/me.php')[0]===200,'session persists');$csrf=['X-CSRF-Token: '.$login[1]['csrfToken']];
 $body=['child'=>['name'=>'Crianca Ficticia','birthDate'=>'2018-05-15','sex'=>'MASCULINO'],'guardian'=>['name'=>'Responsavel Ficticio','relationship'=>'Pai','phone'=>'11900000000'],'consent'=>true];
 check(request('/cadastro/api/fichas/create.php',$body)[0]===403,'cadastro rejects missing CSRF');
 $key='Idempotency-Key: 12345678-1234-4234-8234-123456789abc';
 $invalid=$body;$invalid['consent']=false;check(request('/cadastro/api/fichas/create.php',$invalid,array_merge($csrf,[$key]))[0]===400,'mandatory acceptance enforced');
 $created=request('/cadastro/api/fichas/create.php',$body,array_merge($csrf,[$key]));check($created[0]===201,'real cadastro creation commits');
 $replay=request('/cadastro/api/fichas/create.php',$body,array_merge($csrf,[$key]));check($replay[0]===200&&(int)$pdo->query('SELECT COUNT(*) FROM cad_fichas')->fetchColumn()===1,'idempotent replay does not duplicate');
 check((int)$pdo->query('SELECT COUNT(*) FROM cad_autorizacoes')->fetchColumn()===1&&(int)$pdo->query('SELECT COUNT(*) FROM cad_auditoria')->fetchColumn()===1,'consent and audit stored once');
 $stats=request('/cadastro/api/painel/indicadores.php');check($stats[0]===200&&$stats[1]['indicadores']['total']===1,'dashboard API reads isolated cadastro');
 check(request('/cadastro/api/auth/logout.php',[],$csrf)[0]===200&&request('/cadastro/api/auth/me.php')[0]===401,'logout revokes session');
 file_put_contents($root.'/results.json',json_encode(['checks'=>$checks,'schema'=>'minimal synthetic fixture','real_data_accessed'=>false],JSON_PRETTY_PRINT));echo 'OK '.count($checks)." cadastro checks\n";
}catch(Throwable $e){fwrite(STDERR,'FAIL '.$e->getMessage()."\nArtifacts: $root\n");$failed=true;}
finally{foreach(array_reverse($processes) as $p){proc_terminate($p);proc_close($p);}}
exit(isset($failed)?1:0);
