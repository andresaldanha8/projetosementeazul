<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);
if(($argv[2]??'')!=='CONFIRMED_ALL_PREVIEW_KIDS_FICTITIOUS')throw new RuntimeException('Explicit scope required');
ob_start();require __DIR__.'/manual-db.php';$identity=json_decode(ob_get_clean(),true,512,JSON_THROW_ON_ERROR);
$backup=json_decode(file_get_contents(__DIR__.'/release-backup-results.json'),true,512,JSON_THROW_ON_ERROR);
if(($backup['restore_verified']??false)!==true||!is_file($backup['backup'].'/database.sql')||hash_file('sha256',$backup['backup'].'/database.sql')!==$backup['database_sha256'])throw new RuntimeException('Backup not verified');
$expected=json_decode(file_get_contents($backup['backup'].'/inventory.json'),true,512,JSON_THROW_ON_ERROR);
$config=file_get_contents($argv[1].'/web/kids/api/config.php');if(!str_contains($config,"'public_open' => false"))throw new RuntimeException('Close preview first');
$pdo->beginTransaction();
try{
 $pdo->query('SELECT id FROM kids_eventos ORDER BY id FOR UPDATE')->fetchAll();
 foreach($expected['fingerprints'] as $table=>$hash){if(!preg_match('/^[a-zA-Z0-9_]+$/',$table))throw new RuntimeException();$rows=$pdo->query("SELECT * FROM `$table` ORDER BY 1")->fetchAll();if(hash('sha256',json_encode($rows))!==$hash)throw new RuntimeException('Changed since backup; stop');}
 $affected=[];
 foreach(['kids_auditoria','kids_idempotencia','kids_inscricoes','kids_consulta_limites','kids_admin_login_limites'] as $table)$affected[$table]=$pdo->exec("DELETE FROM `$table`");
 $affected['kids_eventos_counter']=$pdo->exec('UPDATE kids_eventos SET proximo_numero=1');
 foreach(['cad_usuarios','cad_fichas'] as $table){$rows=$pdo->query("SELECT * FROM `$table` ORDER BY 1")->fetchAll();if(hash('sha256',json_encode($rows))!==$expected['fingerprints'][$table])throw new RuntimeException('Shared data changed');}
 $pdo->commit();
 echo json_encode(['environment'=>'isolated-manual-preview','affected'=>$affected,'shared_tables_unchanged'=>true,'next_bib'=>'001','events_preserved'=>true,'ids_not_reset'=>true],JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR);
}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
