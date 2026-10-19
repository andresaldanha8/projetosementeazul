// Focused regression: one visible step, real isolated backend, no production access.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const resume = require('./resume.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const p = JSON.parse(fs.readFileSync(path.join(__dirname, 'preview.json')));
const out = path.join(__dirname, 'screenshots');
const passed=[]; const pass=s=>{passed.push(s);console.log('PASS '+s);};
async function fill(page,name){for(const [id,value] of Object.entries({child_name:name,birth_date:'2018-10-17',guardian_name:'Responsável Fictício',relationship:'Responsável',phone:'11900000000'}))await page.locator('#'+id).fill(value);await page.locator('#division').selectOption('F');await page.locator('#accepted').check();}
async function confirmation(page,n){await page.waitForFunction(n=>document.querySelectorAll('.kids-card').length===n&&!document.querySelector('#confirmations-section').hidden&&document.querySelector('#form-panel').hidden,n);await page.waitForFunction(()=>!document.querySelector('#another').disabled);}
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const clock=fs.readFileSync(p.clock,'utf8');
try{
 for(const [label,width] of [['desktop',1280],['mobile',320]]){
  const context=await browser.newContext({viewport:{width,height:1000}});const page=await context.newPage();const keys=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().endsWith('create.php'))keys.push(r.headers()['idempotency-key']);});
  await page.goto(p.url);await page.waitForFunction(()=>!document.querySelector('#submit').disabled);
  assert.equal(await page.locator('#form-panel').isVisible(),true);assert.equal(await page.locator('#confirmations-section').isVisible(),false);pass(label+': first visit shows form only');
  await fill(page,'Criança Fictícia Ana');await page.locator('#submit').click();await confirmation(page,1);
  assert.equal(await page.locator('#child_name').inputValue(),'');assert.equal(await page.evaluate(()=>document.activeElement.id),'confirmations-title');assert.equal(await page.locator('#availability-panel').isVisible(),false);
  await page.locator('#child_name').evaluate(el=>el.focus());assert.notEqual(await page.evaluate(()=>document.activeElement.id),'child_name');
  await page.screenshot({path:path.join(out,`etapa-confirmacao-${label}.png`),fullPage:true});pass(label+': success clears/hides form, excludes its fields from focus, focuses confirmation, removes open notice');
  await page.locator('#another').click();assert.equal(await page.locator('#child_name').inputValue(),'');assert.equal(await page.locator('#confirmations-section').isVisible(),false);assert.equal(await page.evaluate(()=>document.activeElement.id),'child_name');
  await page.locator('#child_name').fill('Rascunho fictício');await page.locator('#back-to-confirmations').click();assert.equal(await page.locator('#form-panel').isVisible(),false);
  await page.locator('#another').click();assert.equal(await page.locator('#child_name').inputValue(),'Rascunho fictício');assert.equal(keys.length,1);pass(label+': new child opens blank, back/forward preserves draft and creates no request/key');
  const refreshed=page.waitForResponse(r=>r.url().endsWith('confirmations.php'));await resume(page);await refreshed;await page.waitForTimeout(150);
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await page.waitForTimeout(300);
  assert.equal(await page.locator('#form-panel').isVisible(),true);assert.equal(await page.locator('#confirmations-section').isVisible(),false);assert.equal(await page.locator('#child_name').inputValue(),'Rascunho fictício');pass(label+': refresh/app return keeps active draft visible and unchanged');
  await fill(page,'Criança Fictícia Bia');let abort=true;await page.route('**/create.php',async route=>{if(abort){abort=false;await route.abort('failed');}else await route.continue();});
  await page.locator('#submit').click();await page.waitForFunction(()=>document.querySelector('#submit').textContent.includes('Recuperar / repetir')&&!document.querySelector('#submit').disabled);
  assert.equal(await page.locator('#form-panel').isVisible(),true);assert.equal(await page.locator('#child_name').inputValue(),'Criança Fictícia Bia');assert.equal(await page.locator('#back-to-confirmations').isDisabled(),true);
  await page.locator('#submit').click();await confirmation(page,2);assert.equal(keys[1],keys[2]);assert.notEqual(keys[0],keys[1]);await page.unroute('**/create.php');pass(label+': uncertain request keeps form/payload/key; retry reuses key, next child has a new key');
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>document.activeElement.id),'confirmations-title');assert.equal(await page.locator('#form-panel').isVisible(),false);
  await page.reload();await confirmation(page,2);assert.equal(await page.evaluate(()=>document.activeElement.id),'confirmations-title');pass(label+': app return and reload show confirmations only, with confirmation focus');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
  fs.writeFileSync(p.clock,'2026-11-21T16:00:00-03:00');await resume(page);await page.waitForFunction(()=>document.querySelector('#availability').textContent.includes('Inscrições encerradas'));
  assert.equal(await page.locator('#another').isDisabled(),true);assert.equal(await page.locator('#confirmations-section').isVisible(),true);assert.equal(await page.locator('#form-panel').isVisible(),false);pass(label+': deadline keeps confirmations available and blocks new child');
  fs.writeFileSync(p.clock,clock);await context.close();
 }
 fs.writeFileSync(path.join(__dirname,'steps-results.json'),JSON.stringify({browser:browser.version(),checks:passed.length,passed},null,2));
}finally{fs.writeFileSync(p.clock,clock);await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
