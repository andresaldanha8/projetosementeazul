// Export-only acceptance against preserved manual database. Never seeds or mutates registrations.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/Usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const state=JSON.parse(fs.readFileSync(path.join(__dirname,'manual-preview.json'))),base=state.base;
const snapshot=()=>JSON.parse(execFileSync('C:/xampp/php/php.exe',[path.join(state.root,'control.php'),'snapshot'],{encoding:'utf8'}));
const fingerprint=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const initial=snapshot(),before=fingerprint(initial),passed=[];
const pass=s=>{passed.push(s);console.log('PASS '+s)};
const output=path.resolve('output/pdf/kids-lista-completa-exemplo.pdf');
async function settled(page){await page.waitForTimeout(300);await page.waitForFunction(()=>document.querySelector('#kids-results')?.getAttribute('aria-busy')==='false')}
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const ctx=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1000}}),page=await ctx.newPage();const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
 await page.goto(base+'/kids/admin/');await page.getByLabel('Usuário',{exact:true}).fill('admin.teste');await page.getByLabel('Senha',{exact:true}).fill('KidsTeste!2026');await page.getByRole('button',{name:'Entrar',exact:true}).click();await settled(page);
 await page.screenshot({path:path.join(__dirname,'screenshots','pdf-admin-desktop.png'),fullPage:false});
 const csrf=(await(await ctx.request.get(base+'/kids/admin/api/me.php')).json()).csrfToken;
 assert.equal((await ctx.request.post(base+'/kids/admin/api/export-pdf.php')).status(),403);
 for(const mode of ['anonymous','public','attendance']){
  const guest=await browser.newContext();
  if(mode==='public')await guest.request.get(base+'/kids/api/session.php');
  if(mode==='attendance')assert.equal((await guest.request.post(base+'/cadastro/api/auth/login.php',{data:{login:'admin.teste',password:'KidsTeste!2026'}})).status(),200);
  assert.equal((await guest.request.post(base+'/kids/admin/api/export-pdf.php',{headers:{'X-CSRF-Token':csrf}})).status(),401);await guest.close();
 }
 assert.equal((await ctx.request.get(base+'/kids/pdf/composer.json')).status(),403);assert.equal((await ctx.request.get(base+'/kids/pdf/vendor/autoload.php')).status(),403);
 pass('anonymous, public and attendance sessions denied; missing CSRF denied; private PDF implementation/vendor blocked');
 await page.locator('#band-11-14').click();await settled(page);await page.getByLabel('Pagamento',{exact:true}).selectOption('PENDENTE');await page.getByLabel('Buscar por criança, responsável ou número de peito').fill('FILTRO-SEM-RESULTADOS-PDF');await settled(page);assert.equal(await page.locator('tbody tr').count(),0);
 let release,started;const gate=new Promise(r=>release=r),begun=new Promise(r=>started=r);let requests=0,headers;
 await page.route('**/kids/admin/api/export-pdf.php',async route=>{requests++;const response=await route.fetch();headers=response.headers();started();await gate;await route.fulfill({response})});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Baixar lista completa PDF',exact:true}).evaluate(b=>{b.click();b.click()});await begun;
 assert.equal(await page.getByRole('button',{name:'Gerando PDF… PDF',exact:true}).isDisabled(),true);assert.equal(requests,1);release();const file=await download;await file.saveAs(output);await page.unroute('**/kids/admin/api/export-pdf.php');
 assert.ok(fs.readFileSync(output).subarray(0,5).equals(Buffer.from('%PDF-')));assert.match(headers['content-type'],/application\/pdf/);assert.match(headers['content-disposition'],/attachment/);assert.match(headers['cache-control'],/no-store/);
 assert.equal(await page.getByLabel('Buscar por criança, responsável ou número de peito').inputValue(),'FILTRO-SEM-RESULTADOS-PDF');assert.equal(await page.getByLabel('Pagamento',{exact:true}).inputValue(),'PENDENTE');assert.equal(await page.locator('#band-11-14').getAttribute('aria-selected'),'true');
 pass('real desktop PDF download ignores active empty search/payment/band filters; busy state and same-tick duplicate click protection; download/no-cache headers');
 await page.getByLabel('Buscar por criança, responsável ou número de peito').fill('');await page.getByLabel('Pagamento',{exact:true}).selectOption('');await settled(page);const rows=await page.locator('tbody').innerText();
 await page.route('**/kids/admin/api/export-pdf.php',r=>r.fulfill({status:500,contentType:'application/json',body:JSON.stringify({sucesso:false,mensagem:'Falha simulada na geração do PDF'})}));await page.getByRole('button',{name:'Baixar lista completa PDF',exact:true}).click();await page.getByRole('alert').filter({hasText:'Falha simulada'}).waitFor();assert.equal(await page.locator('tbody').innerText(),rows);await page.unroute('**/kids/admin/api/export-pdf.php');pass('injected export failure reports error without losing list or filters');
 await page.setViewportSize({width:320,height:760});const mobileDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Baixar lista completa PDF',exact:true}).click();const mobileFile=await mobileDownload;assert.equal(await mobileFile.failure(),null);assert.equal(await page.getByRole('alert').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(__dirname,'screenshots','pdf-admin-mobile.png'),fullPage:false});pass('320px mobile export downloads valid file, clears prior error and does not overflow viewport');
 assert.equal(fingerprint(snapshot()),before);assert.deepEqual(pageErrors,[]);pass('all registration rows, payment/audit data, idempotency and counters unchanged by successful and failed exports');
 const selected=initial.rows.filter(r=>Number(r.evento_id)===1).map(r=>({numero_peito:r.numero_peito,crianca_nome:r.crianca_nome,idade_inscricao:r.idade_inscricao,faixa:r.faixa,divisao:r.divisao,responsavel_nome:r.responsavel_nome,telefone:r.telefone,camisa:r.camisa,pagamento:r.pagamento,situacao:r.situacao}));
 fs.writeFileSync(path.join(__dirname,'pdf-expected.json'),JSON.stringify({rows:selected,excludedOtherEdition:initial.rows.filter(r=>Number(r.evento_id)!==1).map(r=>r.crianca_nome)},null,2));
 fs.writeFileSync(path.join(__dirname,'pdf-browser-results.json'),JSON.stringify({passed,base,headers,requests,pagesStillFiltered:true,exportRows:selected.length,unchanged:true,pageErrors,output},null,2));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
