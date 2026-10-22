const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/Usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const config=JSON.parse(fs.readFileSync(0,'utf8')),results=[];
const pass=label=>{results.push(label);console.log('PASS browser '+label)};
const output=path.join(__dirname,'screenshots');
async function fill(page,name){await page.locator('#child_name').fill(name);await page.locator('#birth_date').fill('2019-05-15');await page.locator('#division').selectOption('M');await page.locator('#guardian_name').fill('Responsavel Ficticio');await page.locator('#relationship').fill('Pai');await page.locator('#phone').fill('93999990009');}
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:1000}}),page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(config.base+'/kids/?nova=1');await page.locator('#submit').waitFor({state:'visible'});await page.waitForFunction(()=>!document.getElementById('submit').disabled);
  assert.equal(await page.locator('#image_authorized').isChecked(),false);
  assert.equal(await page.locator('#image_authorized').getAttribute('required'),null);
  assert.ok((await page.locator('#image-authorization-note').textContent()).includes('Opcional. A recusa não impede a inscrição.'));
  assert.ok(!(await page.locator('#declaration-text').textContent()).includes('imagem'));
  pass('optional checkbox starts unchecked, without required; texts separated');
  await fill(page,'Imagem Browser sem');await page.locator('#submit').click();
  await page.locator('#accepted-error').filter({hasText:'Leia e aceite'}).waitFor();
  assert.equal(await page.locator('#confirmations-section').isVisible(),false);pass('mandatory acceptance absent blocks submission');
  await page.locator('#accepted').check();await page.locator('#submit').click();await page.locator('#confirmations-section').waitFor({state:'visible'});pass('unchecked image authorization permits registration');
  await page.locator('#another').click();assert.equal(await page.locator('#image_authorized').isChecked(),false);assert.equal(await page.locator('#accepted').isChecked(),false);pass('new registration resets both checkboxes');
  await fill(page,'Imagem Browser recuperada');await page.locator('#accepted').check();await page.locator('#image_authorized').check();
  let submissions=0;
  await page.route('**/kids/api/create.php',async route=>{submissions++;const response=await route.fetch();assert.equal(response.status(),201);await route.abort('failed');});
  await page.locator('#submit').click();await page.locator('#confirmations-section').waitFor({state:'visible'});
  assert.equal(submissions,1);assert.ok((await page.locator('#cards').textContent()).includes('Imagem Browser recuperada'));pass('lost response after commit recovers once without changing positive choice');
  await page.unroute('**/kids/api/create.php');await page.locator('#another').click();
  assert.equal(await page.locator('#image_authorized').isChecked(),false);pass('new registration after positive recovery starts unchecked');
  await fill(page,'Imagem Browser repetir');await page.locator('#accepted').check();await page.locator('#image_authorized').check();
  let fail=true;await page.route('**/kids/api/create.php',async route=>{if(fail){fail=false;await route.abort('failed');}else await route.continue();});
  await page.locator('#submit').click();await page.waitForFunction(()=>!document.getElementById('submit').disabled&&document.getElementById('submit').textContent.includes('Recuperar'));
  const pending=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('kids.pending.v1')));assert.equal(pending.image_authorized,true);assert.ok(!JSON.stringify(pending).includes('Imagem Browser'));
  await page.reload();await page.waitForFunction(()=>!document.getElementById('submit').disabled);
  assert.equal(await page.locator('#image_authorized').isChecked(),true);await fill(page,'Imagem Browser repetir');await page.locator('#accepted').check();
  await page.locator('#submit').click();await page.locator('#confirmations-section').waitFor({state:'visible'});pass('failure before commit and reload preserve optional choice for same-key retry without personal data in storage');
  await page.unroute('**/kids/api/create.php');await page.locator('#another').click();
  assert.equal(await page.locator('#image_authorized').isChecked(),false);
  await page.setViewportSize({width:320,height:850});await page.locator('#image_authorized').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'image-authorization-mobile.png')});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);pass('optional section fits 320px');
  await page.locator('#image_authorized').check();await page.locator('#accepted').check();
  await page.route('**/kids/api/session.php',async route=>{const response=await route.fetch();const data=await response.json();data.image_authorization_version+='-changed';data.declaration_version+='-changed';await route.fulfill({response,json:data});});
  await page.locator('#retry').evaluate(button=>button.click());await page.waitForFunction(()=>!document.getElementById('image_authorized').checked&&!document.getElementById('accepted').checked);pass('changed term versions require a new explicit choice');
  const admin=await context.newPage();await admin.goto(config.base+'/kids/admin/');await admin.getByLabel('Usuário',{exact:true}).fill('admin.isolado');await admin.getByLabel('Senha',{exact:true}).fill(config.password);await admin.getByRole('button',{name:'Entrar',exact:true}).click();
  await admin.getByRole('heading',{name:'Inscrições KIDS',exact:true}).waitFor();await admin.waitForFunction(()=>document.querySelector('#kids-results')?.getAttribute('aria-busy')==='false');
  assert.equal(await admin.getByRole('columnheader',{name:'Imagem',exact:true}).count(),1);
  for(const [name,status] of [['Imagem API sim','AUTORIZADO'],['Imagem API nao','NÃO AUTORIZADO'],['Imagem legado','Não informado'],['Imagem Browser recuperada','AUTORIZADO'],['Imagem Browser repetir','AUTORIZADO']]){
   const row=admin.getByRole('row').filter({hasText:name});await row.waitFor();assert.ok((await row.textContent()).includes(status));
  }
  // Current presentation shows the authoritative status only; provenance is verified by API cases.
  assert.equal(await admin.getByText('Registro da escolha',{exact:true}).count(),0);
  await admin.screenshot({path:path.join(output,'image-authorization-admin.png'),fullPage:true});
  pass('administration shows authorized, refused and not informed without the retired detail control');
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(__dirname,'image-authorization-browser-results.json'),JSON.stringify({checks:results.length,passed:results,no_page_errors:true},null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1});
