// Explicit runtime allowlist. No environment credentials, database, source frontend or fixtures.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const project=path.resolve(__dirname,'../..'),release=path.join(project,'output/kids-release-20261018');
if(!fs.readFileSync(path.join(project,'kids/api/config.php'),'utf8').includes("'public_open' => false"))throw Error('Publication packages require public_open=false');
if(fs.existsSync(release)&&!process.argv.includes('--refresh'))throw Error('Release already exists; use --refresh only for this generated package');
if(fs.existsSync(release)){
 const expected=path.join(project,'output','kids-release-20261018');
 const actual=fs.realpathSync(release);
 if(actual.toLowerCase()!==expected.toLowerCase()||fs.lstatSync(release).isSymbolicLink())throw Error('Refusing to refresh unexpected path');
 fs.rmSync(actual,{recursive:true});
}
const upload=path.join(release,'upload'),review=path.join(release,'shared-review'),operations=path.join(release,'operations');
for(const d of [upload,review,operations])fs.mkdirSync(d,{recursive:true});
const copy=(src,dst)=>{fs.mkdirSync(path.dirname(dst),{recursive:true});fs.cpSync(src,dst,{recursive:true,filter:p=>!/(?:^|[\\/])(?:tests?|docs|examples?|\.git|\.github|node_modules)(?:[\\/]|$)/i.test(p)});};
for(const file of ['.htaccess','index.html','kids.css','kids.js','lookup.js'])copy(path.join(project,'kids',file),path.join(upload,'kids',file));
for(const dir of ['api','admin/api','admin/dist'])copy(path.join(project,'kids',dir),path.join(upload,'kids',dir));
for(const f of ['.htaccess','database.example.php'])copy(path.join(project,'kids/config',f),path.join(upload,'kids/config',f));
copy(path.join(project,'kids/admin/index.php'),path.join(upload,'kids/admin/index.php'));
for(const f of ['.htaccess','report.php','composer.json','composer.lock','assets','vendor'])copy(path.join(project,'kids/pdf',f),path.join(upload,'kids/pdf',f));
for(const f of ['index.html','css/style.css'])copy(path.join(project,f),path.join(review,f));
// Logo/favicon are existing site dependencies; isolated copies available for comparison only.
for(const f of ['img/logo.png','favicon.ico'])copy(path.join(project,f),path.join(review,f));
for(const f of fs.readdirSync(path.join(project,'kids/migrations')).filter(f=>f.endsWith('.sql')))copy(path.join(project,'kids/migrations',f),path.join(operations,'migrations-alternativa',f));
for(const f of ['install-kids-empty.sql','admin-account.php','prepare-first-admin.php','Administrador-KIDS.ps1','administrador-kids.sh','inventario-kids.sql'])copy(path.join(__dirname,f),path.join(operations,f));
copy(path.join(project,'kids/docs/INSTALACAO-INDEPENDENTE.md'),path.join(operations,'INSTALACAO-INDEPENDENTE.md'));
copy(path.join(project,'kids/docs/ATUALIZACAO-IMAGEM.md'),path.join(operations,'ATUALIZACAO-IMAGEM.md'));
copy(path.join(project,'kids/docs/CORRECAO-ADMIN-IMAGEM.md'),path.join(operations,'CORRECAO-ADMIN-IMAGEM.md'));
const adminFix=['kids/admin/api/registrations.php','kids/admin/dist/index.html',...fs.readdirSync(path.join(project,'kids/admin/dist/assets')).map(f=>'kids/admin/dist/assets/'+f)];
fs.writeFileSync(path.join(operations,'ARQUIVOS-CORRECAO-ADMIN-IMAGEM.json'),JSON.stringify({purpose:'admin-image-presentation-only',preserve:['kids/api/config.php','kids/config/database.local.php'],files:adminFix.map(f=>({path:f,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(project,f))).digest('hex')}))},null,2));
const imageUpdate=['kids/index.html','kids/kids.js','kids/api/config.php','kids/api/domain.php','kids/api/session.php','kids/api/create.php','kids/admin/api/registrations.php','kids/admin/dist/index.html',...fs.readdirSync(path.join(project,'kids/admin/dist/assets')).map(f=>'kids/admin/dist/assets/'+f)];
fs.writeFileSync(path.join(operations,'ARQUIVOS-ATUALIZACAO-IMAGEM.json'),JSON.stringify({migration:'operations/migrations-alternativa/006_image_authorization.sql',production_open:false,replace:imageUpdate.map(f=>({path:f,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(project,f))).digest('hex')})),preserve:['kids/config/database.local.php']},null,2));
copy(path.join(project,'kids/docs/PREPARACAO-PRODUCAO.md'),path.join(release,'LEIA-ME.md'));
const files=[];function walk(root){for(const item of fs.readdirSync(root,{withFileTypes:true})){const f=path.join(root,item.name);if(item.isDirectory())walk(f);else if(f!==path.join(release,'MANIFEST.json'))files.push(f);}}walk(release);
const forbidden=[];for(const f of files){const rel=path.relative(release,f).replaceAll('\\','/');if(/(?:^|\/)(?:\.env[^/]*|database\.local\.php|tests?|fixtures?|previews?|node_modules|admin-app)(?:\/|$)/i.test(rel))forbidden.push(rel);if(rel.startsWith('upload/')&&!rel.includes('/vendor/')&&/\.(php|js|html|css)$/.test(f)&&/localhost|127\.0\.0\.1|admin\.teste|KidsTeste|TEST-ONLY|FICTICIO Admin|Criança Fictícia|cad_usuarios|cadastro\/api/i.test(fs.readFileSync(f,'utf8')))forbidden.push(rel+': nonproduction or shared dependency marker');}
if(forbidden.length)throw Error(JSON.stringify(forbidden));
const manifest=files.map(f=>({path:path.relative(release,f).replaceAll('\\','/'),bytes:fs.statSync(f).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')}));
fs.writeFileSync(path.join(release,'MANIFEST.json'),JSON.stringify({created:'2026-10-18',status:'prepared-closed-not-uploaded',files:manifest},null,2));
fs.writeFileSync(path.join(release,'.htaccess'),'Require all denied\n');
fs.writeFileSync(path.join(project,'kids/tests/release-package-results.json'),JSON.stringify({release,files:manifest.length,runtime:manifest.filter(f=>f.path.startsWith('upload/')).length,scan_passed:true,public_open:false},null,2));console.log('Prepared '+release+' ('+manifest.length+' files); upload/ only, review shared changes separately.');
