<?php
declare(strict_types=1);
// Real MariaDB + HTTP. Never reads .env.php or an existing database.
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }

$php = PHP_BINARY;
$mysqlBin = $argv[1] ?? 'C:/xampp/mysql/bin';
$source = dirname(__DIR__) . '/api';
$root = sys_get_temp_dir() . '/kids-integration-' . bin2hex(random_bytes(6));
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
try {
    foreach (['curl', 'pdo_mysql', 'mbstring'] as $ext) if (!extension_loaded($ext)) throw new RuntimeException('Missing extension: ' . $ext);
    // Explicit allowlist: no credentials or personal data are copied.
    foreach (glob($source . '/*.php') as $file) copy($file, $kids . '/' . basename($file));
    foreach (['config/config.php', 'config/session.php', 'auth/helpers.php'] as $file) copy(dirname($source, 2) . '/cadastro/api/' . $file, $web . '/cadastro/api/' . $file);
    copy(dirname($source) . '/migrations/001_kids.sql', $root . '/001_kids.sql');
    $dbPort = port(); $httpPorts = [port(), port()];
    $init = launch([$mysqlBin . '/mysql_install_db.exe', '--datadir=' . $root . '/db', '--port=' . $dbPort], $root . '/init.log');
    if (proc_close($init) !== 0) throw new RuntimeException('Database initialization failed; inspect init.log');
    $processes[] = launch([$mysqlBin . '/mysqld.exe', '--no-defaults', '--basedir=' . dirname($mysqlBin), '--datadir=' . $root . '/db', '--port=' . $dbPort, '--bind-address=127.0.0.1', '--skip-name-resolve', '--innodb-buffer-pool-size=32M', '--log-error=' . $root . '/mariadb.log'], $root . '/db-process.log');
    waitPort($dbPort);
    $pdo = new PDO('mysql:host=127.0.0.1;port=' . $dbPort . ';charset=utf8mb4', 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $pdo->exec('CREATE DATABASE kids_integration CHARACTER SET utf8mb4');
    $pdo->exec('USE kids_integration');
    $pdo->exec(file_get_contents($root . '/001_kids.sql'));
    check((int)$pdo->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='kids_integration' AND engine='InnoDB'")->fetchColumn() === 3, 'migration: three InnoDB tables and foreign keys accepted');
    $pdo->exec(file_get_contents(dirname($source) . '/migrations/002_lookup_limits.sql'));
    $password = bin2hex(random_bytes(24));
    $pdo->exec("CREATE USER 'kids_test'@'127.0.0.1' IDENTIFIED BY '$password'");
    $pdo->exec("GRANT SELECT,INSERT,UPDATE,DELETE ON kids_integration.* TO 'kids_test'@'127.0.0.1'");
    put($web . '/cadastro/api/config/.env.php', "<?php\ndefine('DB_HOST', '127.0.0.1;port=$dbPort');\ndefine('DB_NAME', 'kids_integration');\ndefine('DB_USER', 'kids_test');\ndefine('DB_PASSWORD', '$password');\n");
    // Fixture only: this is not claimed to be the real legacy schema.
    $pdo->exec('CREATE TABLE cad_usuarios (id INT PRIMARY KEY, nome VARCHAR(100), login VARCHAR(100), perfil VARCHAR(30), ativo INT, auth_version INT, must_change_password INT) ENGINE=InnoDB');
    $pdo->exec("INSERT INTO cad_usuarios VALUES (1,'FICTICIO Admin','admin','ADMINISTRADOR',1,1,0),(2,'FICTICIO Cadastrador','cad','CADASTRADOR',1,1,0),(3,'FICTICIO Inativo','inactive','ADMINISTRADOR',0,1,0),(4,'FICTICIO Troca','change','ADMINISTRADOR',1,1,1)");
    // Controlled clock exists ONLY in disposable copy; no request parameter or production seam.
    $domain = file_get_contents($kids . '/domain.php');
    $domain .= "\nfunction kids_test_now(): DateTimeImmutable { return new DateTimeImmutable(trim(file_get_contents(" . var_export($root . '/clock', true) . "))); }\n";
    put($kids . '/domain.php', $domain);
    $create = file_get_contents($kids . '/create.php');
    $create = str_replace(["new DateTimeImmutable('now')", "new DateTimeImmutable('now', new DateTimeZone(\$config['timezone']))"], 'kids_test_now()', $create);
    put($kids . '/create.php', $create);
    $configOriginal = file_get_contents($kids . '/config.php');
    $configOpen = str_replace(["'public_open' => false", "'declaration_version' => null", "'declaration_text' => null"], ["'public_open' => true", "'declaration_version' => 'TEST-ONLY'", "'declaration_text' => 'Texto provisório para teste técnico. Não aprovado para abertura pública.'"], $configOriginal);
    $sessionSource = file_get_contents($kids . '/session.php');
    $sessionSource = str_replace("new DateTimeImmutable('now', new DateTimeZone(\$config['timezone']))", 'new DateTimeImmutable(trim(file_get_contents(' . var_export($root . '/clock', true) . ')))', $sessionSource);
    put($kids . '/session.php', $sessionSource);
    clockAt('2026-10-17T12:00:00-03:00');
    // Test-only probes call the actual administrative helper and actual session code.
    put($web . '/router.php', <<<'PHP'
<?php
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if ($path === '/cadastro/probe-seed') {
 require __DIR__ . '/cadastro/api/config/session.php';
 session_regenerate_id(true);
 $_SESSION = ['psa_user_id' => (int)($_GET['id'] ?? 1), 'psa_auth_version' => 1, 'psa_session_created_at' => time(), 'psa_session_last_activity' => time(), 'psa_csrf_token' => str_repeat('a',64)];
 header('Content-Type: application/json'); echo json_encode(['ok'=>true]); return;
}
if ($path === '/cadastro/probe-admin') {
 require __DIR__ . '/cadastro/api/config/config.php';
 require __DIR__ . '/kids/api/admin.php';
 $u = kids_require_admin($pdo, isset($_GET['write'])); kids_reply(200, ['ok'=>true,'id'=>$u['id']]);
}
// Fixture endpoint exists ONLY in this generated loopback test router, never in the app.
if ($path === '/cadastro/probe-lookup') {
 if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !in_array($_SERVER['REMOTE_ADDR'], ['127.0.0.1','::1'], true)) { http_response_code(403); return; }
 require __DIR__ . '/cadastro/api/config/config.php';
 $action = json_decode(file_get_contents('php://input'), true)['action'] ?? '';
 if ($action === 'reset_limits') { $pdo->exec('DELETE FROM kids_consulta_limites'); }
 elseif ($action === 'seed') {
  $event = $pdo->query('SELECT id FROM kids_eventos ORDER BY id LIMIT 1')->fetchColumn();
  $pdo->exec("INSERT IGNORE INTO kids_eventos(codigo) VALUES ('OUTRA-EDICAO-TESTE')");
  $other = $pdo->query("SELECT id FROM kids_eventos WHERE codigo='OUTRA-EDICAO-TESTE'")->fetchColumn();
  $rows = [
   [$event,101,"  Criança\u{00A0}  Fictícia Ana  ",'21900000100','REGISTRADA','PENDENTE'],
   [$event,102,'Homônimo Fictício','21900000101','REGISTRADA','CONFIRMADO'],
   [$event,103,'Homônimo Fictício','21900000102','REGISTRADA','PENDENTE'],
   [$event,104,'Duplicado Fictício','21900000103','REGISTRADA','PENDENTE'],
   [$event,105,'Duplicado Fictício','21900000103','REGISTRADA','CONFIRMADO'],
   [$event,106,'Cancelada Fictícia','21900000104','CANCELADA','CONFIRMADO'],
   [$other,101,'Criança Fictícia Ana','21900000100','CANCELADA','CONFIRMADO'],
  ];
  $stmt=$pdo->prepare("INSERT INTO kids_inscricoes(evento_id,numero_peito,referencia,owner_hash,crianca_nome,nascimento,divisao,idade_inscricao,faixa,responsavel_nome,vinculo,telefone,camisa,valor_centavos,pagamento,situacao,declaracao_versao,aceita_em,criada_em,atualizada_em) VALUES (?,?,?,?,?,'2018-10-17','F',8,'8-10','Responsável Fictício','Responsável',?,'P',6000,?,?,'TEST-ONLY',UTC_TIMESTAMP(),UTC_TIMESTAMP(),UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE numero_peito=VALUES(numero_peito)");
  foreach($rows as [$edition,$number,$name,$phone,$status,$payment]) $stmt->execute([$edition,$number,bin2hex(random_bytes(16)),hash('sha256','fixture-not-a-public-session'),$name,$phone,$payment,$status]);
 }
 header('Content-Type: application/json'); echo '{"ok":true}'; return;
}
return false;
PHP
    );
    foreach ($httpPorts as $i => $p) {
        $processes[] = launch([$php, '-d', 'display_errors=0', '-d', 'log_errors=1', '-d', 'error_log=' . $root . '/php-errors.log', '-d', 'session.save_path=' . $root . '/sessions', '-d', 'session.gc_probability=0', '-S', '127.0.0.1:' . $p, '-t', $web, $web . '/router.php'], $root . '/http-' . $i . '.log');
        waitPort($p);
    }
    $base = 'http://127.0.0.1:' . $httpPorts[0]; $base2 = 'http://127.0.0.1:' . $httpPorts[1];
    $api = '/kids/api/'; $jar = $root . '/a.cookies'; $other = $root . '/b.cookies';
    if (!in_array('--preview-only', $argv, true)) {
    $session = request($base . $api . 'session.php', $jar);
    check($session[0] === 200 && $session[1]['public_open'] === false, 'public opening remains disabled by default');
    $key = bin2hex(random_bytes(32)); $body = payload();
    check(request($base . $api . 'create.php', $jar, $body, headersFor($session, $key))[0] === 503, 'closed gate refuses new registration');
    put($kids . '/config.php', $configOpen);
    $first = request($base . $api . 'create.php', $jar, $body, headersFor($session, $key));
    check($first[0] === 201 && $first[1]['registration']['number'] === '001', 'first registration is 001');
    check($first[1]['registration']['amount_cents'] === 6000 && $first[1]['registration']['shirt_size'] === 'P' && $first[1]['registration']['payment_status'] === 'PENDENTE', 'server defaults: 6000 cents, P, PENDENTE');
    $again = request($base . $api . 'create.php', $jar, $body, headersFor($session, $key));
    check($again[0] === 200 && $again[1]['registration'] === $first[1]['registration'], 'same key and payload return identical registration');
    check(request($base . $api . 'create.php', $jar, payload('FICTICIA Outro'), headersFor($session, $key))[0] === 409, 'same key with changed payload conflicts');
    $lostKey = bin2hex(random_bytes(32));
    request($base . $api . 'create.php', $jar, payload('FICTICIA Irma'), headersFor($session, $lostKey)); // Deliberately discard response.
    $lost = request($base . $api . 'create.php', $jar, payload('FICTICIA Irma'), headersFor($session, $lostKey));
    check($lost[0] === 200 && $lost[1]['replayed'] === true, 'discarded response recovered by idempotent resend; sibling accepted');
    $list = request($base . $api . 'confirmations.php', $jar);
    request($base . $api . 'session.php', $jar); // Page reload/bootstrap.
    check(count(request($base . $api . 'confirmations.php', $jar)[1]['registrations']) === 2, 'reload/bootstrap preserves both confirmations');
    $recovery = request($base . $api . 'confirmations.php', $jar, null, ['Idempotency-Key: ' . $lostKey]);
    check($recovery[1]['pending_reference'] === $lost[1]['registration']['reference'], 'confirmation lookup correlates pending key within session');
    request($base . $api . 'session.php', $other);
    check(request($base . $api . 'confirmations.php?id=1&number=001', $other)[1]['registrations'] === [], 'other public session cannot read first session records');
    check(request($base . $api . 'confirmations.php', $other, null, ['Idempotency-Key: ' . $lostKey])[1]['pending_reference'] === null, 'pending key cannot recover another session registration');
    check(request($base . $api . 'confirmations.php?id=1&number=001', $root . '/anonymous.cookies')[0] === 401, 'ID or bib without session is refused');
    // Two independent PHP servers and DB connections, real curl_multi requests.
    $sessions = [request($base . $api . 'session.php', $root . '/c.cookies'), request($base2 . $api . 'session.php', $root . '/d.cookies')];
    $multi = curl_multi_init(); $handles = [];
    foreach ([$base, $base2] as $i => $host) {
        $c = curl_init($host . $api . 'create.php');
        curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_COOKIEFILE => $root . '/' . ($i ? 'd' : 'c') . '.cookies', CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode(payload('FICTICIA Simultanea ' . $i)), CURLOPT_HTTPHEADER => headersFor($sessions[$i], bin2hex(random_bytes(32))), CURLOPT_TIMEOUT => 15]);
        curl_multi_add_handle($multi, $c); $handles[] = $c;
    }
    // Hold the event lock so both requests queue before releasing it.
    $pdo->beginTransaction(); $pdo->query('SELECT * FROM kids_eventos FOR UPDATE')->fetchAll();
    $waiting = 0;
    for ($attempt = 0; $attempt < 100; $attempt++) {
        curl_multi_exec($multi, $running);
        $waiting = (int)$pdo->query("SELECT COUNT(*) FROM information_schema.PROCESSLIST WHERE USER='kids_test' AND INFO LIKE 'SELECT id, proximo_numero FROM kids_eventos%'")->fetchColumn();
        if ($waiting >= 2) break;
        usleep(20000);
    }
    check($waiting >= 2, 'two real DB connections observed concurrently executing SELECT FOR UPDATE while event is locked');
    $pdo->commit();
    do { curl_multi_exec($multi, $running); if ($running) curl_multi_select($multi, 0.1); } while ($running);
    $numbers = [];
    foreach ($handles as $c) { check(curl_getinfo($c, CURLINFO_RESPONSE_CODE) === 201, 'simultaneous HTTP request succeeds'); $numbers[] = json_decode(curl_multi_getcontent($c), true)['registration']['number']; curl_multi_remove_handle($multi, $c); curl_close($c); }
    curl_multi_close($multi);
    check(count(array_unique($numbers)) === 2, 'simultaneous requests get distinct numbers');
    // Failure injected in DB after registration insert/counter update but before commit.
    $before = [$pdo->query('SELECT COUNT(*) FROM kids_inscricoes')->fetchColumn(), $pdo->query('SELECT COUNT(*) FROM kids_idempotencia')->fetchColumn(), $pdo->query('SELECT proximo_numero FROM kids_eventos')->fetchColumn()];
    $pdo->exec("CREATE TRIGGER fail_kids BEFORE UPDATE ON kids_idempotencia FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TEST_FAILURE'");
    $failureKey = bin2hex(random_bytes(32));
    $failedResponse = request($base . $api . 'create.php', $jar, payload('FICTICIA Rollback'), headersFor($session, $failureKey));
    check($failedResponse[0] === 500 && !str_contains($failedResponse[2], 'FICTICIA') && !str_contains($failedResponse[2], 'TEST_FAILURE') && !str_contains($failedResponse[2], 'SQLSTATE'), 'injected transaction failure returns safe 500 without PII or SQL detail');
    $after = [$pdo->query('SELECT COUNT(*) FROM kids_inscricoes')->fetchColumn(), $pdo->query('SELECT COUNT(*) FROM kids_idempotencia')->fetchColumn(), $pdo->query('SELECT proximo_numero FROM kids_eventos')->fetchColumn()];
    check($before === $after, 'rollback leaves no partial registration, key or counter change');
    $pdo->exec('DROP TRIGGER fail_kids');
    check(request($base . $api . 'create.php', $jar, payload('FICTICIA Rollback'), headersFor($session, $failureKey))[0] === 201, 'same failed request succeeds after database recovery');
    $pdo->exec('UPDATE kids_eventos SET proximo_numero=999');
    foreach (['999', '1000'] as $number) check(request($base . $api . 'create.php', $jar, payload('FICTICIA Numero ' . $number), headersFor($session, bin2hex(random_bytes(32))))[1]['registration']['number'] === $number, 'number presentation ' . $number);
    foreach (['2022-10-17' => '4-7', '2019-10-17' => '4-7', '2018-10-17' => '8-10', '2016-10-17' => '8-10', '2015-10-17' => '11-14', '2012-10-17' => '11-14'] as $birth => $category) {
        $ageKey = bin2hex(random_bytes(32));
        $r = request($base . $api . 'create.php', $jar, payload('FICTICIA Faixa', $birth), headersFor($session, $ageKey));
        check($r[0] === 201 && $r[1]['registration']['category'] === $category, 'HTTP age boundary ' . $birth);
    }
    foreach (['2022-10-18', '2011-10-17', '2026-02-30', '2027-01-01'] as $birth) check(request($base . $api . 'create.php', $jar, payload('FICTICIA Invalida', $birth), headersFor($session, bin2hex(random_bytes(32))))[0] === 400, 'invalid birth/age rejected ' . $birth);
    $tampered = $body; $tampered['amount_cents'] = 1;
    check(request($base . $api . 'create.php', $jar, $tampered, headersFor($session, bin2hex(random_bytes(32))))[0] === 400, 'client cannot override server amount');
    $tampered = $body; $tampered['shirt_size'] = 'G';
    check(request($base . $api . 'create.php', $jar, $tampered, headersFor($session, bin2hex(random_bytes(32))))[0] === 400, 'client cannot override shirt');
    check(request($base . $api . 'create.php', $jar, $body, ['Content-Type: application/json', 'Idempotency-Key: ' . bin2hex(random_bytes(32))])[0] === 403, 'missing CSRF rejected');
    clockAt('2027-11-22T16:00:00-03:00');
    put($kids . '/config.php', $configOriginal);
    $oldReplay = request($base . $api . 'create.php', $jar, payload('FICTICIA Faixa', '2012-10-17'), headersFor($session, $ageKey));
    check($oldReplay[0] === 200 && $oldReplay[1]['registration']['age'] === 14, 'replay preserves original age even after birthday, closure and declaration config change');
    put($kids . '/config.php', $configOpen);
    $jar = $root . '/deadline.cookies'; $sessionDeadline = request($base . $api . 'session.php', $jar);
    clockAt('2026-11-21T15:59:59-03:00');
    $deadlineKey = bin2hex(random_bytes(32));
    check(request($base . $api . 'create.php', $jar, $body, headersFor($sessionDeadline, $deadlineKey))[0] === 201, 'one second before deadline accepted');
    clockAt('2026-11-21T16:00:00-03:00');
    check(request($base . $api . 'create.php', $jar, $body, headersFor($sessionDeadline, bin2hex(random_bytes(32))))[0] === 403, 'exact deadline refuses new registration');
    check(request($base . $api . 'create.php', $jar, $body, headersFor($sessionDeadline, $deadlineKey))[0] === 200, 'completed registration replays after deadline');
    check(request($base . $api . 'confirmations.php', $jar)[0] === 200, 'confirmation accessible after deadline');
    $adminJar = $root . '/admin.cookies';
    check(request($base . '/cadastro/probe-admin', $root . '/no-admin.cookies')[0] === 401, 'anonymous administrator access denied');
    foreach ([2 => 401, 3 => 401, 4 => 401, 1 => 401] as $id => $expected) {
        request($base . '/cadastro/probe-seed?id=' . $id, $adminJar);
        check(request($base . '/cadastro/probe-admin', $adminJar)[0] === $expected, 'attendance fixture cannot authorize dedicated KIDS user ' . $id);
    }
    check(request($base . '/cadastro/probe-admin?write=1', $adminJar)[0] === 401, 'attendance session cannot mutate KIDS');
    check(request($base . '/cadastro/probe-admin?write=1', $adminJar, null, ['X-CSRF-Token: ' . str_repeat('a', 64)])[0] === 401, 'attendance CSRF cannot authorize KIDS');
    request($base . $api . 'session.php', $adminJar);
    request($base . $api . 'confirmations.php', $adminJar);
    check(request($base . '/cadastro/probe-admin', $adminJar)[0] === 401, 'public session does not elevate attendance session to KIDS admin');
    // Fresh public session for deterministic rate-limit test.
    $rateJar = $root . '/rate.cookies'; $rateSession = request($base . $api . 'session.php', $rateJar);
    for ($i = 0; $i < 31; $i++) $rate = request($base . $api . 'create.php', $rateJar, $body, headersFor($rateSession, bin2hex(random_bytes(32))));
    check($rate[0] === 429, '31st valid-shaped request in a minute rate limited');
    $badJar = $root . '/bad.cookies'; request($base . $api . 'session.php', $badJar);
    for ($i = 0; $i < 31; $i++) $bad = request($base . $api . 'create.php', $badJar, ['invalid' => true], ['Content-Type: application/json']);
    check($bad[0] === 429, 'malformed/CSRF-invalid submissions also counted by rate limiter');
    $logs = '';
    foreach (glob($root . '/*.log') as $f) $logs .= file_get_contents($f);
    check(!str_contains($logs, 'FICTICIA') && !str_contains($logs, '11900000000') && !str_contains($logs, $password) && !str_contains($logs, $key) && !str_contains($logs, $session[1]['csrf_token']), 'logs contain no fixture PII, password, idempotency key or CSRF');
    put($kids . '/config.php', $configOriginal);
    check(str_contains(file_get_contents($source . '/config.php'), "'public_open' => false"), 'workspace public opening unchanged');
    $summary = ['php' => PHP_VERSION, 'database' => $pdo->query('SELECT VERSION()')->fetchColumn(), 'checks' => $checks, 'passed' => $report, 'temporary_directory' => $root];
    put(__DIR__ . '/integration-results.json', json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    echo "OK: $checks integration checks. Artifacts: $root\n";
    }
    if (in_array('--preview', $argv, true) || in_array('--preview-only', $argv, true)) {
        // Reset only this disposable database for clean UI fixtures (first bib 001).
        $pdo->exec('DELETE FROM kids_idempotencia');
        $pdo->exec('DELETE FROM kids_inscricoes');
        $pdo->exec('UPDATE kids_eventos SET proximo_numero=1');
        if (!is_dir($web . '/kids')) mkdir($web . '/kids'); mkdir($web . '/img');
        $project = dirname($source, 2);
        copy($project . '/index.html', $web . '/index.html');
        foreach (['css', 'js', 'img'] as $assetDir) {
            if (!is_dir($web . '/' . $assetDir)) mkdir($web . '/' . $assetDir);
            foreach (glob($project . '/' . $assetDir . '/*') as $asset) {
                if (is_file($asset)) copy($asset, $web . '/' . $assetDir . '/' . basename($asset));
            }
        }
        foreach (['index.html', 'kids.css', 'kids.js', 'lookup.js'] as $file) copy($project . '/kids/' . $file, $web . '/kids/' . $file);
        copy($project . '/img/logo.png', $web . '/img/logo.png');
        copy($project . '/favicon.ico', $web . '/favicon.ico');
        clockAt('2026-10-17T12:00:00-03:00');
        put($kids . '/config.php', $configOpen);
        put(__DIR__ . '/preview.json', json_encode(['url' => $base . '/kids/', 'home_url' => $base . '/', 'root' => $root, 'config' => $kids . '/config.php', 'clock' => $root . '/clock', 'stop' => $root . '/preview.stop']));
        echo "PREVIEW READY: $base/ (home -> KIDS; isolated; stop by creating $root/preview.stop)\n";
        while (!file_exists($root . '/preview.stop')) { clearstatcache(); sleep(1); }
    }
} catch (Throwable $e) {
    fwrite(STDERR, $e->getMessage() . "\nArtifacts: $root\n"); $failed = true;
} finally {
    foreach (array_reverse($processes) as $p) { proc_terminate($p); proc_close($p); }
}
exit(isset($failed) ? 1 : 0);
