<?php
declare(strict_types=1);
// Read-only identity/preservation check against a known disposable datadir.
if (PHP_SAPI !== 'cli') { http_response_code(403); exit(1); }
$root=realpath($argv[1]??'');
$temp=realpath(sys_get_temp_dir());
if (!$root || !$temp || !str_starts_with(strtolower($root),strtolower($temp).DIRECTORY_SEPARATOR) || !preg_match('/^kids-dedicated-[a-f0-9]+$/',basename($root))) throw new RuntimeException('Not a recognized isolated preview');
$control=file_get_contents($root.'/control.php');
if (!preg_match('/port=(\d+);dbname=kids_integration/',$control,$match)) throw new RuntimeException('Missing isolated database port');
$pdo=new PDO('mysql:host=127.0.0.1;port='.$match[1].';dbname=kids_integration;charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$actual=realpath($pdo->query('SELECT @@datadir')->fetchColumn());
if (!$actual || strcasecmp($actual,realpath($root.'/db'))!==0) throw new RuntimeException('Database port conflict: datadir differs');
$row=$pdo->query('SELECT * FROM kids_inscricoes WHERE evento_id=1 AND numero_peito=1064')->fetch();
$audit=[];
if($row){$q=$pdo->prepare('SELECT * FROM kids_auditoria WHERE inscricao_id=? ORDER BY id');$q->execute([$row['id']]);$audit=$q->fetchAll();}
$clean=(int)$pdo->query('SELECT COUNT(*) FROM kids_inscricoes')->fetchColumn()===0 && (int)$pdo->query('SELECT MIN(proximo_numero) FROM kids_eventos')->fetchColumn()===1 && (int)$pdo->query('SELECT MAX(proximo_numero) FROM kids_eventos')->fetchColumn()===1;
echo json_encode(['port'=>(int)$match[1],'number'=>1064,'exists'=>(bool)$row,'payment'=>$row['pagamento']??null,'auditCount'=>count($audit),'fingerprint'=>hash('sha256',json_encode([$row,$audit])),'prepared_empty'=>$clean],JSON_THROW_ON_ERROR);
