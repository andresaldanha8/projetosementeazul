<?php
declare(strict_types=1);
// Real MariaDB + HTTP. Never reads .env.php or an existing database.
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }

$php = PHP_BINARY;
$mysqlBin = $argv[1] ?? 'C:/xampp/mysql/bin';
$source = dirname(__DIR__) . '/api';
$root = sys_get_temp_dir() . '/kids-dedicated-' . bin2hex(random_bytes(6));
$web = $root . '/web';
$kids = $web . '/kids/api';
foreach ([$kids, $web . '/cadastro/api/config', $web . '/cadastro/api/auth', $root . '/sessions'] as $dir) mkdir($dir, 0700, true);
$processes = [];
$checks = 0;
$report = [];
function put(string $path, string $body): void { if (file_put_contents($path, $body) === false) throw new RuntimeException('write'); }
function check(bool $ok, string $label): void {
    global $checks, $report;
    if (!$ok) throw new RuntimeException('FAIL: ' . $label);
    $checks++; $report[] = $label; echo "PASS $label\n";
}
function launch(array $command, string $log) {
    $p = proc_open($command, [0 => ['pipe', 'r'], 1 => ['file', $log, 'a'], 2 => ['file', $log, 'a']], $pipes, null, null, ['bypass_shell' => true, 'create_new_console' => false]);
    if (!is_resource($p)) throw new RuntimeException('Process could not start');
    fclose($pipes[0]); return $p;
}
function port(): int { $s = stream_socket_server('tcp://127.0.0.1:0', $e, $m); $p = (int)substr(strrchr(stream_socket_get_name($s, false), ':'), 1); fclose($s); return $p; }
function waitPort(int $port): void { for ($i = 0; $i < 100; $i++) { $s = @fsockopen('127.0.0.1', $port); if ($s) { fclose($s); return; } usleep(100000); } throw new RuntimeException('Port not ready: ' . $port); }
function request(string $url, string $jar, ?array $body = null, array $headers = []): array {
    $c = curl_init($url);
    curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_COOKIEFILE => $jar, CURLOPT_COOKIEJAR => $jar, CURLOPT_TIMEOUT => 15, CURLOPT_HTTPHEADER => $headers]);
    if ($body !== null) curl_setopt_array($c, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($body, JSON_THROW_ON_ERROR)]);
    $raw = curl_exec($c); $status = curl_getinfo($c, CURLINFO_RESPONSE_CODE);
    if ($raw === false) throw new RuntimeException(curl_error($c));
    curl_close($c);
    return [$status, json_decode($raw, true), $raw];
}
function headersFor(array $session, string $key): array { return ['Content-Type: application/json', 'X-CSRF-Token: ' . $session[1]['csrf_token'], 'Idempotency-Key: ' . $key]; }
function clockAt(string $instant): void { global $root; put($root . '/clock', $instant); }
function payload(string $name = 'FICTICIA Criança A', string $birth = '2018-10-17'): array {
    return ['child_name' => $name, 'birth_date' => $birth, 'division' => 'F', 'guardian_name' => 'FICTICIO Responsavel', 'relationship' => 'Responsável', 'phone' => '11900000000', 'declaration_version' => 'TEST-ONLY', 'accepted' => true];
}

function copyTree(string $from, string $to): void {
    if (!is_dir($to)) mkdir($to, 0700, true);
    foreach (scandir($from) as $name) {
        if ($name === '.' || $name === '..') continue;
        if (is_dir($from.'/'.$name)) copyTree($from.'/'.$name,$to.'/'.$name);
        else copy($from.'/'.$name,$to.'/'.$name);
    }
}
function adminLogin(string $jar, string $login='admin.teste', string $password='KidsTeste!2026'): array {
    global $base;
    $guest=request($base.'/kids/admin/api/me.php',$jar);
    if ($guest[0]===401) $guest=request($base.'/kids/admin/api/me.php',$jar);
    return request($base.'/kids/admin/api/login.php',$jar,['login'=>$login,'password'=>$password],['Content-Type: application/json','X-CSRF-Token: '.$guest[1]['csrfToken']]);
}
function adminHeaders(array $login): array { return ['Content-Type: application/json','X-CSRF-Token: '.$login[1]['csrfToken']]; }
function cookieValue(string $jar, string $name): string {
    foreach (file($jar,FILE_IGNORE_NEW_LINES) as $line) { $parts=explode("\t",$line); if (count($parts)===7 && $parts[5]===$name) return $parts[6]; }
    throw new RuntimeException('Missing fixture cookie');
}

try {
    foreach (['curl','pdo_mysql','mbstring'] as $ext) if (!extension_loaded($ext)) throw new RuntimeException('Missing extension: '.$ext);
    $project=dirname($source,2);
    // Explicit source allowlist. Never copy .env, credentials, sessions or production records.
    foreach (glob($source.'/*.php') as $file) copy($file,$kids.'/'.basename($file));
    foreach (['config/config.php','config/session.php','auth/helpers.php','auth/credentials.php','auth/login.php','auth/me.php','auth/logout.php','auth/change_password.php'] as $file) copy(dirname($source, 2).'/cadastro/api/'.$file,$web.'/cadastro/api/'.$file);
    mkdir($web.'/cadastro/api/painel');
    foreach (['indicadores.php','fichas-recentes.php'] as $file) copy(dirname($source, 2).'/cadastro/api/painel/'.$file,$web.'/cadastro/api/painel/'.$file);
    foreach (['index.html','kids.css','kids.js','lookup.js'] as $file) copy($project.'/kids/'.$file,$web.'/kids/'.$file);
    copyTree($project.'/kids/admin',$web.'/kids/admin');
    copyTree($project.'/kids/pdf',$web.'/kids/pdf');
    copyTree($project.'/dashboard/dist',$web.'/dashboard');

    foreach (['css','js','img'] as $assets) copyTree($project.'/'.$assets,$web.'/'.$assets);
    copy($project.'/index.html',$web.'/index.html');
    copy($project.'/favicon.ico',$web.'/favicon.ico');
    $dbPort=port(); $httpPorts=[port(),port()];
    $init=launch([$mysqlBin.'/mysql_install_db.exe','--datadir='.$root.'/db','--port='.$dbPort],$root.'/init.log');
    if (proc_close($init)!==0) throw new RuntimeException('Database initialization failed');
    $processes[]=launch([$mysqlBin.'/mysqld.exe','--no-defaults','--basedir='.dirname($mysqlBin),'--datadir='.$root.'/db','--port='.$dbPort,'--bind-address=127.0.0.1','--skip-name-resolve','--innodb-buffer-pool-size=32M','--log-error='.$root.'/mariadb.log'],$root.'/db-process.log');
    waitPort($dbPort);
    $pdo=new PDO('mysql:host=127.0.0.1;port='.$dbPort.';charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    $pdo->exec('CREATE DATABASE kids_integration CHARACTER SET utf8mb4'); $pdo->exec('USE kids_integration');
    foreach (glob(dirname($source).'/migrations/*.sql') as $migration) $pdo->exec(file_get_contents($migration));
    check((int)$pdo->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='kids_integration' AND engine='InnoDB'")->fetchColumn()===6,'four migrations accepted in real isolated InnoDB schema');
    $dbPassword=bin2hex(random_bytes(24));
    $pdo->exec("CREATE USER 'kids_test'@'127.0.0.1' IDENTIFIED BY '$dbPassword'");
    $pdo->exec("GRANT SELECT,INSERT,UPDATE,DELETE ON kids_integration.* TO 'kids_test'@'127.0.0.1'");
    put($web.'/cadastro/api/config/.env.php',"<?php\ndefine('DB_HOST','127.0.0.1;port=$dbPort');\ndefine('DB_NAME','kids_integration');\ndefine('DB_USER','kids_test');\ndefine('DB_PASSWORD','$dbPassword');\n");
    $pdo->exec('CREATE TABLE cad_usuarios(id INT PRIMARY KEY,nome VARCHAR(100),login VARCHAR(100) UNIQUE,password_hash VARCHAR(255),perfil VARCHAR(30),ativo INT,auth_version INT,must_change_password INT,updated_at DATETIME(6)) ENGINE=InnoDB');
    $stmt=$pdo->prepare('INSERT INTO cad_usuarios VALUES(?,?,?,?,?,?,1,?,UTC_TIMESTAMP(6))');
    foreach ([[1,'FICTICIO Admin','admin.teste','ADMINISTRADOR',1,0],[2,'FICTICIO Cadastrador','cad.teste','CADASTRADOR',1,0],[3,'FICTICIO Inativo','inativo.teste','ADMINISTRADOR',0,0],[4,'FICTICIO Troca','troca.teste','ADMINISTRADOR',1,1]] as [$id,$name,$login,$role,$active,$change]) $stmt->execute([$id,$name,$login,password_hash('KidsTeste!2026',PASSWORD_DEFAULT),$role,$active,$change]);
    $pdo->exec("INSERT INTO cad_usuarios VALUES(5,'FICTICIO Sem Hash','semhash.teste',NULL,'ADMINISTRADOR',1,1,0,UTC_TIMESTAMP(6))");
    $pdo->exec('CREATE TABLE cad_fichas(id INT PRIMARY KEY,crianca_nome VARCHAR(200),responsavel_nome VARCHAR(200),situacao VARCHAR(40),created_at DATETIME(6),created_by_name_snapshot VARCHAR(200)) ENGINE=InnoDB');
    $pdo->exec("INSERT INTO kids_eventos(codigo) VALUES('OTHER-TEST')");
    $insert=$pdo->prepare("INSERT INTO kids_inscricoes(evento_id,numero_peito,referencia,owner_hash,crianca_nome,nascimento,divisao,idade_inscricao,faixa,responsavel_nome,vinculo,telefone,camisa,valor_centavos,pagamento,situacao,declaracao_versao,aceita_em,criada_em,atualizada_em) VALUES(?,?,?,?,?,'2019-05-15',?,?,?,'Responsável Fictício','Mãe','11900000000','P',6000,?,?,'TEST-ONLY',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))");
    $fixtures=[[1,1,7,'4-7','PENDENTE','REGISTRADA'],[1,2,8,'8-10','PENDENTE','REGISTRADA'],[1,3,11,'11-14','PENDENTE','REGISTRADA'],[1,999,4,'4-7','PENDENTE','REGISTRADA'],[1,1000,6,'4-7','PENDENTE','REGISTRADA'],[1,10,6,'4-7','PENDENTE','CANCELADA'],[1,20,6,'4-7','CONFIRMADO','REGISTRADA'],[2,1,6,'4-7','PENDENTE','REGISTRADA']];
    for ($i=0;$i<60;$i++) $fixtures[]=[1,1001+$i,[5,9,12][$i%3],['4-7','8-10','11-14'][$i%3],'PENDENTE','REGISTRADA'];
    foreach($fixtures as $n=>[$event,$number,$age,$band,$pay,$status]) $insert->execute([$event,$number,bin2hex(random_bytes(16)),hash('sha256','fixture-owner'),sprintf('Criança Fictícia %04d',$n+1),$n%2?'M':'F',$age,$band,$pay,$status]);

    // Test-only clock manipulation requires an already authenticated real KIDS session.
    // No login shortcut, source config seam or credential bypass is shipped in the application.
    put($web.'/router.php', <<<'PHP'
<?php
$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if (str_starts_with(rawurldecode($path),'/kids/pdf/')) { http_response_code(403); exit; }
if ($path==='/kids/admin/__test/expire') {
 require __DIR__.'/kids/admin/api/_bootstrap.php';
 kids_require_admin($pdo,true);
 if (($_GET['kind']??'')==='absolute') $_SESSION['psa_session_created_at']=time()-28800;
 else $_SESSION['psa_session_last_activity']=time()-1800;
 kids_reply(200,['sucesso'=>true]);
}
return false;
PHP
    );
    foreach ($httpPorts as $i=>$p) {
        $processes[]=launch([$php,'-d','display_errors=0','-d','log_errors=1','-d','error_log='.$root.'/php-errors.log','-d','session.save_path='.$root.'/sessions','-d','session.gc_probability=0','-S','127.0.0.1:'.$p,'-t',$web,$web.'/router.php'],$root.'/http-'.$i.'.log');
        waitPort($p);
    }
    $base='http://127.0.0.1:'.$httpPorts[0]; $base2='http://127.0.0.1:'.$httpPorts[1]; $api='/kids/admin/api/';
    if (in_array('--flow-preview', $argv, true)) {
        // Open only this disposable clone; production/workspace configuration is untouched.
        $original=file_get_contents($kids.'/config.php');
        put($kids.'/config.php',str_replace(["'public_open' => false","'declaration_version' => null","'declaration_text' => null"],["'public_open' => true","'declaration_version' => 'TEST-ONLY'","'declaration_text' => 'TESTE FICTICIO PROVISORIO - somente ambiente isolado.'"],$original));
        $pdo->exec('UPDATE kids_eventos SET proximo_numero=(SELECT COALESCE(MAX(numero_peito),0)+1 FROM kids_inscricoes WHERE evento_id=kids_eventos.id)');
        foreach (['create.php','session.php'] as $file) {
            $body=file_get_contents($kids.'/'.$file);
            $body=str_replace(["new DateTimeImmutable('now')","new DateTimeImmutable('now', new DateTimeZone(\$config['timezone']))"],"new DateTimeImmutable('2026-10-17T12:00:00-03:00')",$body);
            put($kids.'/'.$file,$body);
        }
        copy(__DIR__.'/flow-control.php',$root.'/flow-control.php');
        put($root.'/control.php',"<?php\nif(PHP_SAPI!=='cli')exit(1);\n\$pdo=new PDO('mysql:host=127.0.0.1;port=$dbPort;dbname=kids_integration;charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);\nrequire __DIR__.'/flow-control.php';\n");
        put(__DIR__.'/flow-preview.json',json_encode(['home_url'=>$base.'/','admin_url'=>$base.'/kids/admin/','public_url'=>$base.'/kids/?nova=1','root'=>$root,'control'=>$root.'/control.php','stop'=>$root.'/preview.stop']));
        echo "FLOW PREVIEW READY: $base/ (fictitious only; source registrations closed)\n";
        while(!file_exists($root.'/preview.stop')){clearstatcache();sleep(1);}
    } else {
    $guest=$root.'/guest.cookies';
    check(request($base.'/',$guest)[0]===200,'home page available');
    check(request($base.'/kids/admin/',$guest)[0]===200,'dedicated login shell available without private rows');
    check(request($base.$api.'registrations.php',$guest)[0]===401,'anonymous list refused');
    check(request($base.$api.'payment.php?id=1',$guest,[],['Content-Type: application/json'])[0]===401,'anonymous payment refused');
    foreach(['cad.teste','inativo.teste','missing.teste'] as $login) {
        $failedLogin=adminLogin($root.'/'.$login.'.cookies',$login);
        check($failedLogin[0]===401 && $failedLogin[1]['mensagem']==='Usuário ou senha inválidos.','generic login refusal '.$login);
    }
    check(adminLogin($root.'/nullhash.cookies','semhash.teste','PSA_DUMMY_PASSWORD_NEVER_USED_FOR_LOGIN')[0]===401,'missing credential hash never authenticates through timing dummy');
    $pdo->exec('DELETE FROM kids_admin_login_limites');
    $triple=$root.'/triple.cookies';
    $attendance=request($base.'/cadastro/api/auth/login.php',$triple,['login'=>'admin.teste','password'=>'KidsTeste!2026'],['Content-Type: application/json']);
    check($attendance[0]===200,'existing attendance login preserved');
    $public=request($base.'/kids/api/session.php',$triple);
    check($public[0]===200 && $public[1]['public_open']===false,'real registrations remain closed');
    $publicId=cookieValue($triple,'PSA_KIDS_PUBLIC');
    $contents=file_get_contents($root.'/sessions/sess_'.$publicId);
    if (!preg_match('/owner\|s:64:"([a-f0-9]{64})"/',$contents,$owner)) throw new RuntimeException('Public fixture owner unavailable');
    $stmt=$pdo->prepare('UPDATE kids_inscricoes SET owner_hash=? WHERE id=1'); $stmt->execute([hash('sha256',$owner[1])]);
    check(request($base.$api.'registrations.php',$triple)[0]===401,'attendance session alone cannot list KIDS');
    $beforePublic=request($base.'/kids/api/confirmations.php',$triple);
    $attendanceId=cookieValue($triple,'PSA_CADASTRO_SESSION');
    $spoof=request($base.$api.'registrations.php',$root.'/spoof.cookies',null,['Cookie: PSA_KIDS_ADMIN='.$attendanceId]);
    check($spoof[0]===401,'attendance session ID replay in KIDS cookie rejected');
    $admin=adminLogin($triple);
    check($admin[0]===200 && $admin[1]['usuario']['perfil']==='ADMINISTRADOR','active administrator signs in using dedicated credentials endpoint');
    check(cookieValue($triple,'PSA_KIDS_ADMIN')!==$attendanceId,'dedicated session identifier differs');
    check(request($base.'/cadastro/api/auth/me.php',$triple)[0]===200 && cookieValue($triple,'PSA_CADASTRO_SESSION')===$attendanceId,'KIDS login leaves attendance session intact');
    check(request($base.'/kids/api/confirmations.php',$triple)[1]===$beforePublic[1] && cookieValue($triple,'PSA_KIDS_PUBLIC')===$publicId,'KIDS login leaves public confirmations intact');
    foreach(['kids-registrations.php','kids-set-payment.php?id=1'] as $old) check(request($base.'/cadastro/api/painel/'.$old,$triple,str_contains($old,'set-payment')?[]:null,['Content-Type: application/json'])[0]===404,'old attendance endpoint absent '.$old);
    foreach (['/cadastro/kids-registrations.html','/cadastro/api/kids/session.php','/cadastro/api/kids/create.php'] as $old) {
        check(request($base.$old,$triple)[0]===404,'removed KIDS path absent '.$old);
    }
    $cookies=file_get_contents($triple);
    check(str_contains($cookies,"/kids/admin/\tFALSE\t0\tPSA_KIDS_ADMIN") && str_contains($cookies,'#HttpOnly_'),'dedicated cookie is HttpOnly and path-scoped (HTTP loopback)');
    $c=curl_init($base.$api.'me.php');curl_setopt_array($c,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_HEADER=>true]);$cookieHeaders=curl_exec($c);curl_close($c);
    check(str_contains(strtolower($cookieHeaders),'samesite=strict') && str_contains(strtolower($cookieHeaders),'cache-control: no-store'),'SameSite Strict and no-store headers');
    $only=$root.'/only-kids.cookies';$onlyLogin=adminLogin($only);
    check(request($base.'/cadastro/api/auth/me.php',$only)[0]===401,'KIDS login does not authenticate attendance');
    check(request($base.$api.'logout.php',$only,[],adminHeaders($onlyLogin))[0]===200,'dedicated logout succeeds');
    check(request($base.$api.'registrations.php',$only)[0]===401,'dedicated logout revokes KIDS session');
    check(request($base.$api.'logout.php',$triple,[],adminHeaders($admin))[0]===200 && request($base.'/cadastro/api/auth/me.php',$triple)[0]===200 && request($base.'/kids/api/confirmations.php',$triple)[1]===$beforePublic[1],'KIDS logout preserves other two sessions');
    $admin=adminLogin($triple);
    check(request($base.'/cadastro/api/auth/logout.php',$triple,[],['X-CSRF-Token: '.$attendance[1]['csrfToken']])[0]===200 && request($base.$api.'registrations.php',$triple)[0]===200,'attendance logout does not end KIDS session');

    $changeJar=$root.'/change.cookies';$change=adminLogin($changeJar,'troca.teste');
    check($change[0]===200 && $change[1]['mustChangePassword']===true,'mandatory password change establishes restricted KIDS session');
    check(request($base.$api.'registrations.php',$changeJar)[0]===403 && request($base.$api.'payment.php?id=1',$changeJar,[],adminHeaders($change))[0]===403,'mandatory password change cannot read or pay');
    $newBody=['currentPassword'=>'KidsTeste!2026','newPassword'=>'KidsNova!2026'];
    check(request($base.$api.'change-password.php',$changeJar,$newBody,['Content-Type: application/json','X-CSRF-Token: bad'])[0]===403,'password change CSRF enforced');
    $changed=request($base.$api.'change-password.php',$changeJar,$newBody,adminHeaders($change));
    check($changed[0]===200 && $changed[1]['mustChangePassword']===false && $changed[1]['csrfToken']!==$change[1]['csrfToken'],'mandatory password change rotates session and CSRF');
    check(request($base.$api.'registrations.php',$changeJar)[0]===200 && request($base.'/cadastro/api/auth/me.php',$changeJar)[0]===401,'password change unlocks KIDS only');
    $pdo->exec('DELETE FROM kids_admin_login_limites');
    foreach(['inactive','profile','version'] as $kind) {
        $revJar=$root.'/revoke-'.$kind.'.cookies';adminLogin($revJar);
        $pdo->exec(match($kind){'inactive'=>'UPDATE cad_usuarios SET ativo=0 WHERE id=1','profile'=>"UPDATE cad_usuarios SET perfil='CADASTRADOR' WHERE id=1",default=>'UPDATE cad_usuarios SET auth_version=auth_version+1 WHERE id=1'});
        check(in_array(request($base.$api.'registrations.php',$revJar)[0],[401,403],true),'revocation checked on every request '.$kind);
        $pdo->exec("UPDATE cad_usuarios SET ativo=1,perfil='ADMINISTRADOR' WHERE id=1");
    }
    foreach(['idle','absolute'] as $kind) {
        $expireJar=$root.'/expire-'.$kind.'.cookies';$expire=adminLogin($expireJar);
        request($base.'/kids/admin/__test/expire?kind='.$kind,$expireJar,[],adminHeaders($expire));
        check(request($base.$api.'registrations.php',$expireJar)[0]===401,'session expires '.$kind);
    }
    $pdo->exec('DELETE FROM kids_admin_login_limites');
    for($i=0;$i<9;$i++) $limited=adminLogin($root.'/attempt-'.$i.'.cookies','missing.teste','WrongPass!2026');
    check($limited[0]===429,'account login limit survives new cookies');
    $pdo->exec('DELETE FROM kids_admin_login_limites');
    for($i=0;$i<21;$i++) $limited=adminLogin($root.'/ip-attempt-'.$i.'.cookies','unknown'.$i,'WrongPass!2026');
    check($limited[0]===429,'IP login limit survives changing usernames');
    $pdo->exec('DELETE FROM kids_admin_login_limites');
    $admin=adminLogin($triple);$h=adminHeaders($admin);
    $guestToken=request($base.$api.'me.php',$root.'/badcsrf.cookies');
    check(request($base.$api.'login.php',$root.'/badcsrf.cookies',['login'=>'admin.teste','password'=>'KidsTeste!2026'],['Content-Type: application/json','X-CSRF-Token: bad'])[0]===403,'login CSRF enforced');
    check(request($base.$api.'registrations.php',$triple,['search'=>'Fictícia'],['Content-Type: application/json','X-CSRF-Token: bad'])[0]===403,'JSON search requires KIDS CSRF');
    check(request($base.$api.'registrations.php?search=invalid',$triple)[0]===400,'search in URL is refused; interface sends names only in JSON');
    foreach(['4-7','8-10','11-14'] as $band) {
        $list=request($base.$api.'registrations.php?band='.$band.'&perPage=100',$triple);
        check($list[0]===200 && count($list[1]['registrations'])>0 && count(array_filter($list[1]['registrations'],fn($r)=>$r['faixa']!==$band))===0,'persisted band separation '.$band);
        $numbers=array_map(fn($r)=>(int)$r['numero_peito'],$list[1]['registrations']);$sorted=$numbers;sort($sorted,SORT_NUMERIC);
        check($numbers===$sorted && $list[1]['counts'][$band]===count($numbers),'numeric bib ordering and counts '.$band);
    }
    $list=request($base.$api.'registrations.php?band=4-7&perPage=100',$triple);
    $numbers=array_map(fn($r)=>(int)$r['numero_peito'],$list[1]['registrations']);
    check(array_search(999,$numbers,true)<array_search(1000,$numbers,true) && $numbers[0]===1,'global bibs retained across 999 and 1000');
    $row=$list[1]['registrations'][0];
    check((int)$row['idade_inscricao']===7 && $row['vinculo']==='Mãe' && (int)$row['valor_centavos']===6000,'persisted age relationship and value returned');
    $found=request($base.$api.'registrations.php',$triple,['band'=>'4-7','search'=>$row['crianca_nome']],$h);
    check($found[1]['total']===1 && (int)$found[1]['registrations'][0]['id']===1,'name search');
    $found=request($base.$api.'registrations.php',$triple,['band'=>'4-7','search'=>'1000'],$h);
    check(count(array_filter($found[1]['registrations'],fn($r)=>(int)$r['numero_peito']===1000))===1,'bib search');
    foreach(['PENDENTE','CONFIRMADO'] as $payment) { $filtered=request($base.$api.'registrations.php?band=4-7&payment='.$payment,$triple);check(count(array_filter($filtered[1]['registrations'],fn($r)=>$r['pagamento']!==$payment))===0,'payment filter '.$payment); }
    $p1=request($base.$api.'registrations.php?band=4-7&perPage=2&page=1',$triple);$p2=request($base.$api.'registrations.php?band=4-7&perPage=2&page=2',$triple);
    check(count($p1[1]['registrations'])===2 && !array_intersect(array_column($p1[1]['registrations'],'id'),array_column($p2[1]['registrations'],'id')),'server pagination has no overlapping rows');
    check(request($base.$api.'registrations.php?band=invalid',$triple)[0]===400,'invalid band refused');
    $body=['expectedUpdatedAt'=>$row['atualizada_em'],'amountCents'=>(int)$row['valor_centavos']];$url=$base.$api.'payment.php?id=1';
    check(request($url,$triple,$body,['Content-Type: application/json','X-CSRF-Token: bad'])[0]===403,'payment CSRF enforced');
    $tampered=$body;$tampered['amountCents']=1;
    check(request($url,$triple,$tampered,$h)[0]===409,'changed amount requires fresh confirmation');
    $pdo->exec("CREATE TRIGGER kids_test_fail BEFORE INSERT ON kids_auditoria FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='test failure'");
    check(request($url,$triple,$body,$h)[0]===500 && $pdo->query('SELECT pagamento FROM kids_inscricoes WHERE id=1')->fetchColumn()==='PENDENTE','audit failure rolls back payment');
    $pdo->exec('DROP TRIGGER kids_test_fail');
    $secondJar=$root.'/second-admin.cookies';$second=adminLogin($secondJar);$before=(int)$pdo->query("SELECT COUNT(*) FROM kids_inscricoes WHERE pagamento='CONFIRMADO'")->fetchColumn();
    $pdo->beginTransaction();$pdo->query('SELECT * FROM kids_inscricoes WHERE id=1 FOR UPDATE')->fetch();
    $multi=curl_multi_init();$handles=[];
    foreach([[$base,$triple,$h],[$base2,$secondJar,adminHeaders($second)]] as [$host,$jar,$headers]) {
        $c=curl_init($host.$api.'payment.php?id=1');curl_setopt_array($c,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_COOKIEFILE=>$jar,CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($body),CURLOPT_HTTPHEADER=>$headers]);curl_multi_add_handle($multi,$c);$handles[]=$c;
    }
    $blocked=false;
    for($i=0;$i<100;$i++) { curl_multi_exec($multi,$running);$waiting=$pdo->query("SELECT COUNT(*) FROM information_schema.processlist WHERE ID<>CONNECTION_ID() AND INFO LIKE 'SELECT i.%FOR UPDATE'")->fetchColumn();if((int)$waiting===2){$blocked=true;break;}usleep(20000); }
    check($blocked,'two dedicated HTTP workers blocked concurrently on same row lock');$pdo->commit();
    do{curl_multi_exec($multi,$running);if($running)curl_multi_select($multi,1);}while($running);
    foreach($handles as $c){check(curl_getinfo($c,CURLINFO_RESPONSE_CODE)===200,'simultaneous payment succeeds idempotently');curl_multi_remove_handle($multi,$c);curl_close($c);}curl_multi_close($multi);
    $audit=$pdo->query('SELECT * FROM kids_auditoria WHERE inscricao_id=1')->fetchAll();
    check(count($audit)===1 && (int)$audit[0]['usuario_id']===1 && $audit[0]['estado_anterior']==='PENDENTE' && $audit[0]['estado_novo']==='CONFIRMADO' && $audit[0]['ocorrida_em']!==null,'one transactional audit contains identity time and states');
    check((int)$pdo->query("SELECT COUNT(*) FROM kids_inscricoes WHERE pagamento='CONFIRMADO'")->fetchColumn()===$before+1,'only selected registration changed');
    check(request($url,$triple,$body,$h)[0]===200 && (int)$pdo->query('SELECT COUNT(*) FROM kids_auditoria WHERE inscricao_id=1')->fetchColumn()===1,'repeated confirmation does not duplicate events');
    check(request($base.$api.'payment.php?id=6',$triple,$body,$h)[0]===409,'cancelled registration refused');
    check(request($base.$api.'payment.php?id=8',$triple,$body,$h)[0]===404,'other edition refused');
    $confirmed=request($base.'/kids/api/confirmations.php',$triple);
    check($confirmed[1]['registrations'][0]['payment_status']==='CONFIRMADO','public cards read administrative payment');
    $lookup=request($base.'/kids/api/lookup.php',$triple,['child_name'=>$row['crianca_nome'],'phone'=>$row['telefone']],['Content-Type: application/json','X-CSRF-Token: '.$public[1]['csrf_token']]);
    check($lookup[0]===200 && $lookup[1]['registration']['payment_status']==='CONFIRMADO','public lookup reads administrative payment');
    check(request($base.'/kids/api/create.php',$triple,payload(),['Content-Type: application/json','X-CSRF-Token: '.$public[1]['csrf_token'],'Idempotency-Key: '.bin2hex(random_bytes(32))])[0]===503,'public entry remains blocked after administration');
    check((int)$pdo->query("SELECT DATETIME_PRECISION FROM information_schema.columns WHERE table_schema='kids_integration' AND table_name='kids_inscricoes' AND column_name='atualizada_em'")->fetchColumn()===6,'test schema timestamp precision checked; locking guarantees transition');
    $logs=''; foreach(glob($root.'/http-*.log') as $log) $logs.=file_get_contents($log);
    $logs.=file_exists($root.'/php-errors.log')?file_get_contents($root.'/php-errors.log'):'';
    check(!str_contains($logs,'Fictícia') && !str_contains($logs,'11900000000') && !str_contains($logs,'KidsTeste!2026') && !str_contains($logs,$dbPassword),'application logs contain no personal data or credentials');
    check(str_contains(file_get_contents($source.'/config.php'),"'public_open' => false"),'workspace real registrations unchanged and closed');
    $pdo->exec('DELETE FROM kids_admin_login_limites');
    // Reset only the fictitious mandatory-change account for the normal browser flow.
    $reset=$pdo->prepare('UPDATE cad_usuarios SET password_hash=?,must_change_password=1 WHERE id=4');
    $reset->execute([password_hash('KidsTeste!2026',PASSWORD_DEFAULT)]);
    $summary=['php'=>PHP_VERSION,'database'=>$pdo->query('SELECT VERSION()')->fetchColumn(),'checks'=>$checks,'passed'=>$report,'temporary_directory'=>$root];
    put(__DIR__.'/dedicated-results.json',json_encode($summary,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));
    echo "OK: $checks dedicated integration checks. Artifacts: $root\n";
    if(in_array('--preview',$argv,true)) {
        put(__DIR__.'/dedicated-preview.json',json_encode(['home_url'=>$base.'/','admin_url'=>$base.'/kids/admin/','root'=>$root,'stop'=>$root.'/preview.stop']));
        echo "PREVIEW READY: $base/ — normal KIDS login admin.teste (fictitious only)\n";
        while(!file_exists($root.'/preview.stop')){clearstatcache();sleep(1);}
    }
    }
} catch(Throwable $e) { if(isset($pdo)&&$pdo->inTransaction())$pdo->rollBack();fwrite(STDERR,$e->getMessage()."\nArtifacts: $root\n");$failed=true; }
finally {foreach(array_reverse($processes) as $p){proc_terminate($p);proc_close($p);}}
exit(isset($failed)?1:0);
