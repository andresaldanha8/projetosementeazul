// Actual Apache .htaccess verification; isolated static copy, no database or credentials.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'kids-http-security-'));
 const web=path.join(root,'web');fs.mkdirSync(web);
 const source=path.resolve(__dirname,'..');
 for(const d of ['api','admin/api','tests','migrations','docs','admin-app','ops','pdf','config']){
  const dest=path.join(web,'kids',d);fs.mkdirSync(dest,{recursive:true});
  fs.copyFileSync(path.join(source,d,'.htaccess'),path.join(dest,'.htaccess'));
  fs.writeFileSync(path.join(dest,'probe.txt'),'private');
 }
 for(const f of ['config','database','domain','records','http','admin','admin-auth','admin-session','registration-query'])fs.writeFileSync(path.join(web,'kids/api',f+'.php'),'private');
 for(const f of ['database.local.php','database.example.php'])fs.writeFileSync(path.join(web,'kids/config',f),'private');
 fs.writeFileSync(path.join(web,'kids/admin/api/_bootstrap.php'),'private');
 fs.copyFileSync(path.join(source,'.htaccess'),path.join(web,'kids/.htaccess'));
 fs.writeFileSync(path.join(web,'kids/public.txt'),'public');
 const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
 const slash=s=>s.replaceAll('\\','/');
 const conf=path.join(root,'httpd.conf');
 fs.writeFileSync(conf,`ServerRoot "C:/xampp/apache"
Listen 127.0.0.1:${port}
ServerName 127.0.0.1
LoadModule authz_core_module modules/mod_authz_core.so
LoadModule authz_host_module modules/mod_authz_host.so
LoadModule dir_module modules/mod_dir.so
DocumentRoot "${slash(web)}"
PidFile "${slash(root)}/httpd.pid"
ErrorLog "${slash(root)}/error.log"
<Directory "${slash(web)}">
 AllowOverride All
 Require all granted
</Directory>
`);
 const child=spawn('C:/xampp/apache/bin/httpd.exe',['-f',slash(conf),'-X'],{windowsHide:true,stdio:'ignore'});
 try{
  const base='http://127.0.0.1:'+port;
  for(let i=0;i<100;i++){try{await fetch(base+'/kids/public.txt');break}catch{await new Promise(r=>setTimeout(r,100))}}
  const checks=[];
  for(const uri of ['tests/probe.txt','migrations/probe.txt','docs/probe.txt','admin-app/probe.txt','ops/probe.txt','pdf/probe.txt','config/probe.txt','config/database.local.php','config/database.example.php',...['config','database','domain','records','http','admin','admin-auth','admin-session','registration-query'].map(f=>'api/'+f+'.php'),'admin/api/_bootstrap.php']){
   assert.equal((await fetch(base+'/kids/'+uri)).status,403,uri);checks.push(uri);console.log('PASS HTTP denied '+uri);
  }
  assert.equal((await fetch(base+'/kids/public.txt')).status,200);
  fs.writeFileSync(path.join(__dirname,'http-security-results.json'),JSON.stringify({checks:checks.length+1,denied:checks,public:200,server:'Apache',temporary_directory:root},null,2));
 }finally{child.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});
