// One entry point. Reuse or resume the existing disposable database; never initialize SQL.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net'),http=require('node:http'),{spawn,execFileSync}=require('node:child_process');
const here=__dirname,project=path.resolve(here,'../..'),stateFile=path.join(here,'manual-preview.json');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const request=url=>new Promise(resolve=>{const q=http.get(url,r=>{let body='';r.on('data',x=>body+=x);r.on('end',()=>resolve({status:r.statusCode,body}))});q.on('error',()=>resolve(null));q.setTimeout(2000,()=>q.destroy());});
const occupied=port=>new Promise(resolve=>{const s=net.connect({host:'127.0.0.1',port});s.once('connect',()=>{s.destroy();resolve(true)});s.once('error',()=>resolve(false));s.setTimeout(1500,()=>{s.destroy();resolve(false)})});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function launch(exe,args,log){const fd=fs.openSync(log,'a');const child=spawn(exe,args,{detached:true,windowsHide:true,stdio:['ignore',fd,fd]});child.unref();fs.closeSync(fd);return child.pid;}
function validate(root){const resolved=fs.realpathSync(root),temp=fs.realpathSync(os.tmpdir());if(!resolved.toLowerCase().startsWith((temp+path.sep).toLowerCase())||!/^kids-dedicated-[a-f0-9]+$/.test(path.basename(resolved)))throw Error('Diretório não reconhecido como preview isolado');for(const f of ['control.php','web/router.php','db','sessions'])if(!fs.existsSync(path.join(resolved,f)))throw Error('Preview incompleto: '+f);return resolved;}
function dbCheck(root){return JSON.parse(execFileSync('C:/xampp/php/php.exe',[path.join(here,'manual-db.php'),root],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));}
(async()=>{
 let state;
 if(fs.existsSync(stateFile))state=read(stateFile);
 else{const old=read(path.join(here,'flow-preview.json'));if(new URL(old.home_url).port!=='51179')throw Error('O preview 51179 deve ser identificado antes de adoção; nenhum banco novo foi criado.');state={root:old.root,port:51179};}
 const root=validate(state.root),web=path.join(root,'web'),base='http://127.0.0.1:'+state.port;
 // Never overwrite the preserved shared-identity preview with incompatible standalone APIs.
 if(fs.existsSync(path.join(project,'kids/api/database.php'))&&!fs.existsSync(path.join(web,'kids/config/database.local.php'))){
  throw Error('Preview histórico preservado sem sincronização: a versão atual exige banco/administrador KIDS independentes. Use kids/tests/independent-integration.php para validação isolada; veja kids/docs/INSTALACAO-INDEPENDENTE.md.');
 }
 const id=path.basename(root);fs.writeFileSync(path.join(web,'kids','__manual-preview.json'),JSON.stringify({id}));
 const current=await request(base+'/kids/__manual-preview.json');
 if(current){if(current.status!==200||current.body!==JSON.stringify({id}))throw Error('Conflito na porta '+state.port+': outro serviço respondeu. Nenhum processo foi encerrado.');}
 else if(await occupied(state.port))throw Error('Conflito na porta '+state.port+': processo não identificado. Nenhum processo foi encerrado.');
 const control=fs.readFileSync(path.join(root,'control.php'),'utf8'),match=control.match(/port=(\d+);dbname=kids_integration/);if(!match)throw Error('Porta do banco isolado não identificada');
 if(!await occupied(Number(match[1]))){launch('C:/xampp/mysql/bin/mysqld.exe',['--no-defaults','--basedir=C:/xampp/mysql','--datadir='+path.join(root,'db'),'--port='+match[1],'--bind-address=127.0.0.1','--skip-name-resolve','--innodb-buffer-pool-size=32M','--log-error='+path.join(root,'manual-mariadb.log')],path.join(root,'manual-db-process.log'));for(let i=0;i<100&&!await occupied(Number(match[1]));i++)await pause(100);}
 const before=dbCheck(root);
 if(state.localTestOpen){if(state.port!==51179||!fs.readFileSync(path.join(web,'kids/api/config.php'),'utf8').includes('MANUAL-LOCAL-TEST'))throw Error('Configuração local de teste não reconhecida');}
 else if(state.preparedClosed){if(!before.prepared_empty||!fs.readFileSync(path.join(web,'kids/api/config.php'),'utf8').includes("'public_open' => false"))throw Error('Preview preparado deve permanecer vazio, fechado e com próximo número 001.');}
 else {if(!before.exists||before.payment!=='CONFIRMADO')throw Error('Inscrição 1064 paga não encontrada. Preview não foi recriado nem reinicializado.');if(state.fingerprint1064&&state.fingerprint1064!==before.fingerprint)throw Error('A inscrição 1064/auditoria mudou; confira antes de continuar.');}
 // Only static public UI files are synchronized. Database, PHP config and sessions are untouched.
 for(const f of ['index.html','kids.css','kids.js','lookup.js'])fs.copyFileSync(path.join(project,'kids',f),path.join(web,'kids',f));
 // Server-side PDF implementation and compiled admin UI, never database/config/session files.
 for(const dir of ['pdf','admin/api','admin/dist'])fs.cpSync(path.join(project,'kids',dir),path.join(web,'kids',dir),{recursive:true});
 fs.copyFileSync(path.join(project,'kids/api/registration-query.php'),path.join(web,'kids/api/registration-query.php'));
 const routerFile=path.join(web,'router.php');let router=fs.readFileSync(routerFile,'utf8');
 if(!router.includes('KIDS_PDF_PRIVATE')){router=router.replace("$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);","$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);\n// KIDS_PDF_PRIVATE: PHP built-in server does not interpret .htaccess.\nif (str_starts_with(rawurldecode($path),'/kids/pdf/')) { http_response_code(403); exit; }");fs.writeFileSync(routerFile,router);}
 if(!current){launch('C:/xampp/php/php.exe',['-d','display_errors=0','-d','log_errors=1','-d','error_log='+path.join(root,'php-errors.log'),'-d','session.save_path='+path.join(root,'sessions'),'-d','session.gc_probability=0','-S','127.0.0.1:'+state.port,'-t',web,path.join(web,'router.php')],path.join(root,'manual-http.log'));let alive;for(let i=0;i<100;i++){alive=await request(base+'/kids/__manual-preview.json');if(alive)break;await pause(100)}if(!alive||alive.body!==JSON.stringify({id}))throw Error('Não foi possível retomar HTTP; confira manual-http.log.');}
 const after=dbCheck(root);if(before.fingerprint!==after.fingerprint)throw Error('Falha na verificação de preservação da 1064');
 state={...state,root,port:state.port,base,dbPort:before.port};if(!state.preparedClosed)state.fingerprint1064=before.fingerprint;fs.writeFileSync(stateFile,JSON.stringify(state,null,2));
 console.log(state.localTestOpen?'Preview manual dispon?vel; inscri??es de teste local abertas somente na porta 51179.':(current?'Preview existente reutilizado':'Preview retomado')+(state.preparedClosed?'; preparação fechada, KIDS vazio, próximo número 001; backup da 1064 preservado.':' ; mesmo banco, inscrição 1064 CONFIRMADO e auditoria preservados.'));console.log('Início: '+base+'/\nFormulário: '+base+'/kids/?nova=1\nAdministração: '+base+'/kids/admin/\nLogin fictício: admin.teste / KidsTeste!2026');
})().catch(e=>{console.error(e.message);process.exitCode=1});
