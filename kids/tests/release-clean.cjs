const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const stateFile=path.join(__dirname,'manual-preview.json'),state=JSON.parse(fs.readFileSync(stateFile)),backup=JSON.parse(fs.readFileSync(path.join(__dirname,'release-backup-results.json')));
if(!backup.restore_verified||!backup.backup.startsWith(path.join(state.root,'backups')+path.sep))throw Error('Invalid backup');
execFileSync('C:/xampp/php/php.exe',[path.join(__dirname,'manual-db.php'),state.root]);
fs.copyFileSync(path.resolve(__dirname,'../api/config.php'),path.join(state.root,'web/kids/api/config.php'));
const invalidated={public:0,admin:0};const saved=path.join(backup.backup,'invalidated-sessions');fs.mkdirSync(saved);
for(const file of fs.readdirSync(path.join(state.root,'sessions'))){if(!file.startsWith('sess_'))continue;const full=path.join(state.root,'sessions',file),body=fs.readFileSync(full,'utf8');if(body.includes('owner|s:64:')&&body.includes('expires|')&&!body.includes('psa_user_id|')){fs.renameSync(full,path.join(saved,'public-'+file));invalidated.public++;}}
const code="echo sys_get_temp_dir().'/psa-kids-admin-'.hash('sha256',realpath($argv[1]));";
const admin=execFileSync('C:/xampp/php/php.exe',['-r',code,path.join(state.root,'web/kids/api')],{encoding:'utf8'});
if(fs.existsSync(admin))for(const file of fs.readdirSync(admin)){if(file.startsWith('sess_')&&fs.statSync(path.join(admin,file)).isFile()){fs.renameSync(path.join(admin,file),path.join(saved,'admin-'+file));invalidated.admin++;}}
const result=JSON.parse(execFileSync('C:/xampp/php/php.exe',[path.join(__dirname,'release-clean.php'),state.root,'CONFIRMED_ALL_PREVIEW_KIDS_FICTITIOUS'],{encoding:'utf8'}));
state.preparedClosed=true;state.cleanupBackup=backup.backup;fs.writeFileSync(stateFile,JSON.stringify(state,null,2));
fs.writeFileSync(path.join(__dirname,'release-clean-results.json'),JSON.stringify({...result,invalidated,public_open:false,backup:backup.backup},null,2));console.log(JSON.stringify({...result,invalidated,public_open:false},null,2));
