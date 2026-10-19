<?php
if (PHP_SAPI !== 'cli') exit(1);
$state=json_decode(file_get_contents(__DIR__.'/manual-preview.json'),true);
$root=realpath($state['root']);
if ($state['port']!==51179 || basename($root)!=='kids-dedicated-3cde8194389b') throw new RuntimeException('Unexpected preview');
require $root.'/web/cadastro/api/config/config.php';
$actual=realpath($pdo->query('SELECT @@datadir')->fetchColumn());
if (strcasecmp($actual,realpath($root.'/db'))!==0) throw new RuntimeException('Unexpected database');
$event=$pdo->query("SELECT proximo_numero FROM kids_eventos WHERE codigo='AUTISMO-RUN-2026-KIDS'")->fetchColumn();
foreach (['kids/api/create.php','kids/admin/api/_bootstrap.php'] as $file) {
 if (!str_contains(file_get_contents($root.'/web/'.$file),"'/cadastro/api/config/config.php'")) throw new RuntimeException('Shared connection missing');
}
$hashes=[];
foreach (['kids/api/create.php','kids/api/domain.php','kids/api/session.php'] as $file) $hashes[$file]=hash_file('sha256',$root.'/web/'.$file)===hash_file('sha256',dirname(__DIR__,2).'/'.$file);
echo json_encode(['database'=>'kids_integration','port'=>51178,'same_shared_connection'=>true,'records'=>(int)$pdo->query('SELECT COUNT(*) FROM kids_inscricoes')->fetchColumn(),'next_number'=>(int)$event,'unchanged_validation_files'=>$hashes],JSON_PRETTY_PRINT);
