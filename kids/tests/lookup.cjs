// Real HTTP/MariaDB + real browser. Requires isolated integration.php --preview-only.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium, request } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const p = JSON.parse(fs.readFileSync(path.join(__dirname,'preview.json')));
const base = p.home_url.replace(/\/$/,''); const api='/kids/api/';
const results=[]; const pass=s=>{results.push(s);console.log('PASS '+s);};
const missing='Não foi possível localizar uma inscrição com esses dados. Confira o preenchimento ou fale com a organização.';
async function client(){const c=await request.newContext();const s=await(await c.get(base+api+'session.php')).json();return{c,csrf:s.csrf_token};}
async function lookup(c,name,phone,extra={}){return c.c.post(base+api+'lookup.php',{headers:{'X-CSRF-Token':c.csrf,...extra},data:{child_name:name,phone}});}
(async()=>{
 const fixture=await request.newContext();
 async function reset(){assert.equal((await fixture.post(base+'/cadastro/probe-lookup',{data:{action:'reset_limits'}})).status(),200);}
 assert.equal((await fixture.post(base+'/cadastro/probe-lookup',{data:{action:'seed'}})).status(),200);
 await reset();
 const original=await client();
 const originalName='Criança Original Fictícia '+require('node:crypto').randomBytes(4).toString('hex');
 let r=await original.c.post(base+api+'create.php',{headers:{'X-CSRF-Token':original.csrf,'Idempotency-Key':require('node:crypto').randomBytes(32).toString('hex')},data:{child_name:originalName,birth_date:'2018-10-17',division:'F',guardian_name:'Responsável Fictício',relationship:'Responsável',phone:'11900000009',declaration_version:'TEST-ONLY',accepted:true}});assert.equal(r.status(),201);
 const independent=await client();r=await lookup(independent,originalName.toLowerCase(),'(11) 90000-0009');assert.equal(r.status(),200);
 let body=await r.json();assert.deepEqual(Object.keys(body.registration).sort(),['number','payment_status','registration_status']);assert.equal(r.headers()['cache-control'],'no-store');
 assert.deepEqual((await(await independent.c.get(base+api+'confirmations.php')).json()).registrations,[]);pass('independent browser/session gets only number/status/payment and no original confirmations');
 const c=await client();r=await lookup(c,'  criança\u00A0 fictícia    ANA  ','(21) 90000-0100');assert.equal(r.status(),200);assert.equal((await r.json()).registration.number,'101');pass('exact name matching normalizes case, Unicode spaces and formatted phone; current edition only');
 for(const [name,phone] of [['Criança Fictícia Ana','11900000099'],['Crianca Ficticia Ana','21900000100'],['Criança Fictícia','21900000100']]){r=await lookup(c,name,phone);assert.equal(r.status(),404);assert.equal((await r.json()).message,missing);}pass('incorrect phone, missing accents and partial name return same generic no-match response');
 await reset();const hom=await client();
 for(const [phone,number,payment] of [['21900000101','102','CONFIRMADO'],['21900000102','103','PENDENTE']]){r=await lookup(hom,'Homônimo Fictício',phone);assert.equal(r.status(),200);body=await r.json();assert.equal(body.registration.number,number);assert.equal(body.registration.payment_status,payment);}pass('same full name with different phones resolves independently');
 r=await lookup(hom,'Duplicado Fictício','21900000103');assert.equal(r.status(),409);assert.equal((await r.json()).registration,undefined);pass('multiple exact matches direct to organization without selecting a record');
 r=await lookup(hom,'Cancelada Fictícia','21900000104');body=await r.json();assert.equal(body.registration.registration_status,'CANCELADA');assert.equal(body.registration.payment_status,'CONFIRMADO');pass('cancellation and payment are separate current states');
 const configuration=fs.readFileSync(p.config,'utf8');
 try{fs.writeFileSync(p.config,configuration.replace("'public_open' => true","'public_open' => false"));const closed=await client();assert.equal((await lookup(closed,'Homônimo Fictício','21900000101')).status(),200);await closed.c.dispose();pass('situation lookup remains available while new registrations are disabled');}finally{fs.writeFileSync(p.config,configuration);}
 await reset();const limited=await client();for(let i=0;i<5;i++)assert.equal((await lookup(limited,'Homônimo Fictício','21900000101')).status(),200);
 r=await lookup(limited,'Homônimo Fictício','21900000101');assert.equal(r.status(),429);assert(+r.headers()['retry-after']>0);pass('sixth session lookup in ten-minute window is limited with Retry-After');
 await reset();
 for(let i=0;i<21;i++){const fresh=await client();r=await lookup(fresh,'Homônimo Fictício','21900000101',{'X-Forwarded-For':'198.51.100.'+(i+1),'X-Real-IP':'203.0.113.'+(i+1)});assert.equal(r.status(),i<20?200:429);await fresh.c.dispose();}pass('IP limit shared across 21 fresh sessions; forged proxy headers cannot bypass it');
 await reset();const guard=await client();r=await guard.c.get(base+api+'lookup.php');assert.equal(r.status(),405);
 r=await guard.c.post(base+api+'lookup.php',{data:{child_name:'Fictícia',phone:'21900000100'}});assert.equal(r.status(),403);
 r=await lookup(guard,'Homônimo Fictício','21900000101',{'Sec-Fetch-Site':'cross-site'});assert.equal(r.status(),403);pass('GET, missing CSRF and cross-site requests refused');
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  for(const [label,width] of [['desktop',1280],['mobile',320]]){
   await reset();const context=await browser.newContext({viewport:{width,height:1000}});const page=await context.newPage();const requests=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('lookup.php'))requests.push(r.url());});
   await page.goto(p.url);await page.waitForFunction(()=>!document.querySelector('#submit').disabled);await page.locator('#lookup-open').click();
   assert.equal(await page.evaluate(()=>document.activeElement.id),'lookup-name');
   for(let i=0;i<9;i++){await page.keyboard.press('Tab');assert(await page.evaluate(()=>document.querySelector('#lookup-dialog').contains(document.activeElement)));}
   await page.locator('#lookup-name').fill('Criança Fictícia Ana');await page.locator('#lookup-phone').fill('(21) 90000-0100');
   await page.locator('#lookup-dialog').screenshot({path:path.join(__dirname,'screenshots',`consulta-modal-${label}.png`)});
   await page.route('**/lookup.php',async route=>{await new Promise(resolve=>setTimeout(resolve,200));await route.continue();});
   await page.locator('#lookup-submit').click();assert.equal(await page.locator('#lookup-submit').isDisabled(),true);await page.locator('#lookup-result').waitFor();assert.equal(await page.locator('#lookup-number').innerText(),'101');assert.equal(await page.locator('#lookup-payment').innerText(),'Pagamento pendente');
   await page.unroute('**/lookup.php');await page.locator('#lookup-dialog').screenshot({path:path.join(__dirname,'screenshots',`consulta-resultado-${label}.png`)});
   assert.equal(await page.locator('#cards').locator('.kids-card').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.keyboard.press('Escape');assert.equal(await page.locator('#lookup-dialog').isVisible(),false);assert.equal(await page.evaluate(()=>document.activeElement.id),'lookup-open');
   await page.locator('#lookup-open').click();await page.locator('#lookup-name').fill('Homônimo Fictício');await page.locator('#lookup-phone').fill('21900000101');await page.locator('#lookup-submit').click();await page.waitForFunction(()=>document.querySelector('#lookup-payment').textContent==='Pagamento confirmado');
   await page.locator('#lookup-name').fill('Cancelada Fictícia');await page.locator('#lookup-phone').fill('21900000104');await page.locator('#lookup-submit').click();await page.waitForFunction(()=>document.querySelector('#lookup-status').textContent==='Inscrição cancelada');assert.equal(await page.locator('#lookup-payment').innerText(),'Pagamento confirmado');
   await page.locator('#lookup-name').fill('Duplicado Fictício');await page.locator('#lookup-phone').fill('21900000103');await page.locator('#lookup-submit').click();await page.waitForFunction(()=>document.querySelector('#lookup-message').textContent.includes('única inscrição'));assert.equal(await page.locator('#lookup-result').isVisible(),false);
   await page.route('**/lookup.php',route=>route.abort('failed'));await page.locator('#lookup-submit').click();await page.waitForFunction(()=>document.querySelector('#lookup-message').textContent.includes('temporariamente indisponível'));assert.equal(await page.locator('#lookup-name').inputValue(),'Duplicado Fictício');await page.unroute('**/lookup.php');
   // Fifth valid server request, then sixth must hit the real session limiter.
   await page.locator('#lookup-name').fill('Sem Correspondência Fictícia');await page.locator('#lookup-submit').click();await page.waitForFunction(()=>document.querySelector('#lookup-message').textContent.includes('Não foi possível localizar'));await page.locator('#lookup-submit').click();await page.waitForFunction(()=>document.querySelector('#lookup-message').textContent.includes('Muitas consultas'));
   assert(await page.locator('#lookup-support').getAttribute('href'));await page.locator('#lookup-close').click();assert.equal(await page.evaluate(()=>document.activeElement.id),'lookup-open');assert.deepEqual(errors,[]);assert(requests.every(url=>!url.includes('?')));
   pass(label+': modal focus/trap/Escape/close, pending/confirmed/cancelled, ambiguity, failure, loading/rate-limit and no PII in URLs');await context.close();
  }
 }finally{await browser.close();}
 await reset();const logs=fs.readdirSync(p.root).filter(f=>f.endsWith('.log')).map(f=>fs.readFileSync(path.join(p.root,f),'utf8')).join('\n');assert(!/Criança Fictícia|Homônimo Fictício|2190000010[0-9]/u.test(logs));pass('server logs contain no lookup names or phones');
 fs.writeFileSync(path.join(__dirname,'lookup-results.json'),JSON.stringify({checks:results.length,passed:results},null,2));console.log('OK: '+results.length+' lookup checks');await fixture.dispose();
})().catch(e=>{console.error(e.message);process.exitCode=1;});

