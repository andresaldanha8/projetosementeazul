// Targeted home -> new entry vs payment resume. No deletion, counter reset or migrations.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const resume = require('./resume.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const p = JSON.parse(fs.readFileSync(path.join(__dirname,'preview.json')));
const passed=[];const pass=s=>{passed.push(s);console.log('PASS '+s);};
async function ready(page){await page.waitForFunction(()=>!document.querySelector('#submit').disabled);}
async function fill(page,name){for(const [id,value] of Object.entries({child_name:name,birth_date:'2018-10-17',guardian_name:'Responsável Fictício',relationship:'Responsável',phone:'11900000008'}))await page.locator('#'+id).fill(value);await page.locator('#division').selectOption('F');await page.locator('#accepted').check();}
async function list(page){return page.evaluate(async()=> (await(await fetch('/kids/api/confirmations.php')).json()).registrations);}
async function homeEntry(page){await page.getByRole('link',{name:'← Voltar ao site',exact:true}).click();await page.locator('.ar-kids-link').click();await page.waitForFunction(()=>document.querySelector('#form-panel')&&!document.querySelector('#form-panel').hidden&&!new URL(location.href).searchParams.has('nova'));await ready(page);}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const config=fs.readFileSync(p.config,'utf8');
 try{
  for(const [label,width] of [['desktop',1280],['mobile',320]]){
   const context=await browser.newContext({viewport:{width,height:1000}});await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
   const page=await context.newPage();const keys=[];page.on('request',r=>{if(r.url().endsWith('create.php'))keys.push(r.headers()['idempotency-key']);});
   const firstName='Criança Fictícia Entrada '+crypto.randomBytes(4).toString('hex');const secondName='Criança Fictícia Irmã '+crypto.randomBytes(4).toString('hex');
   await page.goto(p.url);await ready(page);await fill(page,firstName);await page.locator('#submit').click();await page.locator('.kids-card').waitFor();await ready(page);
   const first=(await list(page))[0];
   await homeEntry(page);assert.equal(await page.locator('#child_name').inputValue(),'');assert.equal(await page.locator('#accepted').isChecked(),false);assert.equal(await page.locator('#confirmations-section').isVisible(),false);assert.equal(keys.length,1);assert.deepEqual(await list(page),[first]);
   assert.equal(new URL(page.url()).searchParams.has('nova'),false);pass(label+': exact return-home/KIDS path opens empty unchecked form, hides old cards, consumes no number/request and removes nova');
   await page.locator('#lookup-open').click();await page.locator('#lookup-name').fill(firstName);await page.locator('#lookup-phone').fill('(11) 90000-0008');await page.locator('#lookup-submit').click();await page.locator('#lookup-result').waitFor();assert.equal(await page.locator('#lookup-number').innerText(),first.number);await page.keyboard.press('Escape');
   await page.locator('#child_name').fill('Rascunho fictício');await resume(page);assert.equal(await page.locator('#form-panel').isVisible(),true);assert.equal(await page.locator('#child_name').inputValue(),'Rascunho fictício');assert.equal(await page.locator('#confirmations-section').isVisible(),false);
   await page.locator('#back-to-confirmations').click();assert.equal(await page.locator('#confirmations-section').isVisible(),true);await page.locator('#another').click();assert.equal(await page.locator('#child_name').inputValue(),'Rascunho fictício');pass(label+': independent lookup finds first record; background resume preserves new draft and intentional back access');
   await fill(page,secondName);await page.locator('#submit').click();await page.waitForFunction(()=>document.querySelectorAll('.kids-card').length===2&&!document.querySelector('#confirmations-section').hidden);await ready(page);
   const rows=await list(page);assert.deepEqual(rows[0],first);assert.equal(Number(rows[1].number),Number(first.number)+1);assert.equal(keys.length,2);assert.notEqual(keys[0],keys[1]);
   await resume(page);await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.kids-card').length===2&&!document.querySelector('#confirmations-section').hidden);assert.equal(await page.locator('#form-panel').isVisible(),false);assert.equal((await list(page))[1].child_name,secondName);assert.equal(new URL(page.url()).searchParams.has('nova'),false);pass(label+': second child gets new key/next number, first unchanged; app return and reload restore payment, not blank form');
   await context.close();
  }
  for(const committed of [true,false]){
   const context=await browser.newContext();await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());const page=await context.newPage();let blocked=false;let creates=0;
   page.on('request',r=>{if(r.url().endsWith('create.php'))creates++;});
   await page.goto(p.url);await ready(page);const name='Criança Fictícia Incerta '+crypto.randomBytes(4).toString('hex');await fill(page,name);
   await page.route('**/create.php',async route=>{if(committed)await route.fetch();blocked=true;await route.abort('failed');});await page.route('**/confirmations.php',route=>blocked?route.abort('failed'):route.continue());
   await page.locator('#submit').click();await page.waitForFunction(()=>document.querySelector('#availability-panel').dataset.kind==='unavailable');const pending=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('kids.pending.v1')));
   await page.unroute('**/create.php');await page.unroute('**/confirmations.php');
   await homeEntry(page);
   if(committed){assert.equal(await page.evaluate(()=>sessionStorage.getItem('kids.pending.v1')),null);assert.equal(await page.locator('#child_name').inputValue(),'');assert.equal((await list(page)).length,1);assert.equal(creates,1);pass('new-entry with uncertain committed send resolves it before offering blank form, without duplicate');}
   else{assert.equal((await page.evaluate(()=>JSON.parse(sessionStorage.getItem('kids.pending.v1')))).key,pending.key);assert.match(await page.locator('#submit').innerText(),/Recuperar \/ repetir/);assert.equal((await list(page)).length,0);await fill(page,name);await page.locator('#submit').click();await page.waitForFunction(()=>!sessionStorage.getItem('kids.pending.v1')&&!document.querySelector('#form-panel').hidden);await ready(page);assert.equal((await list(page)).length,1);assert.equal(await page.locator('#child_name').inputValue(),'');pass('new-entry keeps unresolved key and blocks a different logical send until original retry is confirmed');}
   await context.close();
  }
  fs.writeFileSync(p.config,config.replace("'public_open' => true","'public_open' => false"));const context=await browser.newContext();const closed=await context.newPage();await closed.goto(p.url+'?nova=1');await closed.waitForFunction(()=>document.querySelector('#availability').textContent.includes('ainda não abertas'));assert.equal(await closed.locator('#submit').isDisabled(),true);assert.equal(new URL(closed.url()).searchParams.has('nova'),false);await context.close();pass('nova is presentation-only and cannot bypass disabled opening');
  fs.writeFileSync(path.join(__dirname,'new-entry-results.json'),JSON.stringify({checks:passed.length,passed},null,2));
 }finally{fs.writeFileSync(p.config,config);await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
