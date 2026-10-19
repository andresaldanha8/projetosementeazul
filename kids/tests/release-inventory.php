<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);
ob_start();require __DIR__.'/manual-db.php';$identity=json_decode(ob_get_clean(),true,512,JSON_THROW_ON_ERROR);
$tables=$pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);$counts=[];$fingerprints=[];
foreach($tables as $table){if(!preg_match('/^[a-zA-Z0-9_]+$/',$table))throw new RuntimeException('Unexpected identifier');$rows=$pdo->query("SELECT * FROM `$table` ORDER BY 1")->fetchAll();$counts[$table]=count($rows);$fingerprints[$table]=hash('sha256',json_encode($rows));}
$editions=$pdo->query('SELECT e.id,e.codigo,e.proximo_numero,COUNT(i.id) registrations,SUM(CASE WHEN i.declaracao_versao="TEST-ONLY" THEN 1 ELSE 0 END) marked_test FROM kids_eventos e LEFT JOIN kids_inscricoes i ON i.evento_id=e.id GROUP BY e.id ORDER BY e.id')->fetchAll();
$potential=(int)$pdo->query("SELECT COUNT(*) FROM kids_inscricoes WHERE declaracao_versao <> 'TEST-ONLY' OR crianca_nome NOT REGEXP '(Fict|FICT|Teste|TEST)' OR responsavel_nome NOT REGEXP '(Fict|FICT|Teste|TEST)'")->fetchColumn();
$andre=$pdo->query("SELECT perfil,ativo FROM cad_usuarios WHERE nome LIKE '%Andr%' OR login LIKE '%andre%'")->fetchAll();
echo json_encode(['environment'=>'isolated-manual-preview','identity'=>$identity,'tables'=>$counts,'fingerprints'=>$fingerprints,'editions'=>$editions,'potentially_real'=>$potential,'andre_candidates'=>$andre],JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR);
