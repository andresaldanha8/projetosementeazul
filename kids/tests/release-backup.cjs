// Operates only on the datadir-verified disposable manual preview, never .env credentials.
const fs=require('fs'),path=require('path'),{execFileSync,spawnSync}=require('child_process');
const state=JSON.parse(fs.readFileSync(path.join(__dirname,'manual-preview.json'))),php='C:/xampp/php/php.exe';
const inventory=JSON.parse(execFileSync(php,[path.join(__dirname,'release-inventory.php'),state.root],{encoding:'utf8'}));
if(inventory.environment!=='isolated-manual-preview'||inventory.identity.port!==state.dbPort)throw Error('Unrecognized database');
const stamp=new Date().toISOString().replace(/[:.]/g,'-'),dest=path.join(state.root,'backups','release-'+stamp);fs.mkdirSync(dest,{recursive:true});
fs.writeFileSync(path.join(dest,'inventory.json'),JSON.stringify(inventory,null,2));
const sql=path.join(dest,'database.sql'),fd=fs.openSync(sql,'wx');
try{execFileSync('C:/xampp/mysql/bin/mysqldump.exe',['--no-defaults','--host=127.0.0.1','--port='+state.dbPort,'--user=root','--single-transaction','--routines','--triggers','--hex-blob','--skip-add-drop-table','kids_integration'],{stdio:['ignore',fd,'pipe']});}finally{fs.closeSync(fd);}
fs.cpSync(path.join(state.root,'web'),path.join(dest,'web'),{recursive:true});
const schema='kids_restore_verify_'+Date.now();
const helper=path.join(dest,'verify.php');
fs.writeFileSync(helper,`<?php
if(PHP_SAPI!=='cli')exit(1);
ob_start();require ${JSON.stringify(path.join(__dirname,'manual-db.php').replaceAll('\\','/'))};ob_end_clean();
$schema=$argv[2];if(!preg_match('/^kids_restore_verify_[0-9]+$/',$schema))exit(1);
if($argv[3]==='create'){$pdo->exec('CREATE DATABASE \\x60'.$schema.'\\x60 CHARACTER SET utf8mb4');exit;}
$expected=json_decode(file_get_contents(__DIR__.'/inventory.json'),true);$actual=[];
foreach($expected['fingerprints'] as $table=>$hash){$rows=$pdo->query('SELECT * FROM \\x60'.$schema.'\\x60.\\x60'.$table.'\\x60 ORDER BY 1')->fetchAll();if(hash('sha256',json_encode($rows))!==$hash)throw new RuntimeException('Restore mismatch');$actual[$table]=count($rows);}
echo json_encode(['restore_verified'=>true,'schema'=>$schema,'tables'=>$actual]);`.replaceAll('\\x60','`'));
execFileSync(php,[helper,state.root,schema,'create'],{stdio:['ignore','pipe','pipe']});
const restored=spawnSync('C:/xampp/mysql/bin/mysql.exe',['--no-defaults','--host=127.0.0.1','--port='+state.dbPort,'--user=root',schema],{input:fs.readFileSync(sql),maxBuffer:16*1024*1024});if(restored.status!==0)throw Error('Restore failed; backup kept');
const verified=JSON.parse(execFileSync(php,[helper,state.root,schema,'verify'],{encoding:'utf8'}));
const result={...verified,backup:dest,environment:'isolated-manual-preview',database_sha256:require('crypto').createHash('sha256').update(fs.readFileSync(sql)).digest('hex'),files_backup:true};
fs.writeFileSync(path.join(__dirname,'release-backup-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
