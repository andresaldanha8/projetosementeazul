const fs = require('fs'), assert = require('node:assert/strict');
const {chromium} = require('C:/Users/Usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {base} = JSON.parse(fs.readFileSync(0, 'utf8'));
(async () => {
 const browser = await chromium.launch({channel:'msedge', headless:true});
 try {
  const context = await browser.newContext({viewport:{width:390,height:844}}), page = await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/kids/');
  await page.waitForFunction(()=>!document.querySelector('#submit').disabled);
  await page.locator('#child_name').fill('Criança Fictícia Ágata');
  await page.locator('#birth_date').fill('2019-05-15');
  await page.locator('#division').selectOption('F');
  await page.locator('#guardian_name').fill('Responsável Privado');
  await page.locator('#relationship').fill('Mãe');
  await page.locator('#phone').fill('11911112222');
  await page.locator('#accepted').check();await page.locator('#submit').click();
  const button=page.getByRole('button',{name:'Baixar comprovante',exact:true});await button.waitFor();
  const card=await page.locator('.kids-card').innerText();let calls=0, release;
  const gate=new Promise(r=>release=r);let started;const begin=new Promise(r=>started=r);
  await page.route('**/receipt.php?*',async route=>{calls++;const response=await route.fetch();started();await gate;await route.fulfill({response});});
  const downloaded=page.waitForEvent('download');await button.evaluate(b=>{b.click();b.click();});await begin;
  assert.equal(calls,1);assert.equal(await page.getByRole('button',{name:'Gerando comprovante…'}).isDisabled(),true);
  release();const file=await downloaded;assert.equal(await file.failure(),null);await button.waitFor();
  await page.unroute('**/receipt.php?*');
  await page.route('**/receipt.php?*',route=>route.fulfill({status:500,contentType:'application/json',body:'{"ok":false}'}));
  await button.click();await page.getByRole('status').filter({hasText:'Não foi possível baixar'}).waitFor();
  assert.equal(await button.isEnabled(),true);assert.ok((await page.locator('.kids-card').innerText()).includes('Criança Fictícia Ágata'));
  await page.unroute('**/receipt.php?*');const retry=page.waitForEvent('download');await button.click();await retry;await button.waitFor();
  assert.equal(await page.getByText('Não foi possível baixar',{exact:false}).count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'tmp/pdfs/receipts/mobile.png',fullPage:true});
  await page.reload();await button.waitFor();assert.equal(await page.locator('.kids-card').count(),1);
  assert.equal(errors.length,0);assert.ok(card.includes('Criança Fictícia Ágata'));
  console.log('PASS browser: public creation, download, duplicate click, busy, failure/card preserved, retry, mobile, reload');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
