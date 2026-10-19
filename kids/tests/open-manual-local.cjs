const fs=require('fs'),path=require('path'),cp=require('child_process');
const file=path.join(__dirname,'manual-preview.json'),s=JSON.parse(fs.readFileSync(file)),root=fs.realpathSync(s.root);
if(s.port!==51179||path.basename(root)!=='kids-dedicated-3cde8194389b')throw Error('Preview inesperado');
cp.execFileSync('C:/xampp/php/php.exe',[path.join(__dirname,'check-manual-local.php')],{stdio:'pipe'});
for(const f of ['create.php','session.php'])fs.copyFileSync(path.join(__dirname,'../api',f),path.join(root,'web/kids/api',f));
const config=path.join(root,'web/kids/api/config.php');
let text=fs.readFileSync(config,'utf8');
if(!text.includes('MANUAL-LOCAL-TEST')){
 text=text.replace("'declaration_version' => null", "'declaration_version' => 'MANUAL-LOCAL-TEST-20261018'")
 .replace("'declaration_text' => null", "'declaration_text' => 'DECLARAÇÃO PROVISÓRIA — SOMENTE TESTE LOCAL. Confirmo que uso dados fictícios para testar o fluxo de inscrição. Este aceite não constitui inscrição real nem declaração aprovada pela organização.'")
 .replace("'public_open' => false", "'public_open' => PHP_SAPI !== 'cli' && ($_SERVER['SERVER_ADDR'] ?? '127.0.0.1') === '127.0.0.1' && (int)($_SERVER['SERVER_PORT'] ?? 0) === 51179");
 fs.writeFileSync(config,text);
}
s.localTestOpen=true;s.preparedClosed=false;fs.writeFileSync(file,JSON.stringify(s,null,2));
console.log('Inscrições habilitadas exclusivamente no preview manual 51179.');
