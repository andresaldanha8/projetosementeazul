const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('C:/Users/Usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const input=JSON.parse(fs.readFileSync(0,'utf8')),checks=[];
const project=path.resolve(__dirname,'../..');
const pass=label=>{checks.push(label);console.log('PASS browser '+label)};
async function settled(page){await page.waitForFunction(()=>document.querySelector('#kids-results')?.getAttribute('aria-busy')==='false');}
async function signin(page){await page.goto(input.base+'/kids/admin/');await page.getByLabel('Usuário',{exact:true}).fill('admin.contrato');await page.getByLabel('Senha',{exact:true}).fill(input.password);await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.getByRole('heading',{name:'Inscrições KIDS',exact:true}).waitFor();await settled(page);}
async function imageCell(page,name){return page.getByRole('row').filter({hasText:name}).getByRole('cell').nth(5).innerText();}
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1050}}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await signin(page);
  const assertThree=async()=>{assert.ok((await imageCell(page,'Contrato Autorizado')).startsWith('Autorizado'));assert.ok((await imageCell(page,'Contrato Recusado')).startsWith('Não autorizado'));assert.equal(await imageCell(page,'Contrato Antigo'),'Não informado');};
  await assertThree();pass('real endpoint renders true/false/null as three distinct states');
  await page.getByRole('button',{name:'Atualizar',exact:true}).click();await settled(page);await assertThree();pass('real endpoint states persist after Atualizar');
  await page.reload();await settled(page);await assertThree();pass('real endpoint states persist after reload');
  const html=fs.readFileSync(path.join(input.web,'kids/admin/dist/index.html'),'utf8');const assets=[...html.matchAll(/(?:src|href)="(\/kids\/admin\/dist\/assets\/[^\"]+)"/g)].map(m=>m[1]);
  for(const asset of assets){const response=await context.request.get(input.base+asset);assert.equal(response.status(),200);assert.deepEqual(await response.body(),fs.readFileSync(path.join(input.web,asset)));}
  pass('shell references current assets at real paths, all served bytes match build');
  await page.screenshot({path:path.join(__dirname,'screenshots/image-contract-three-states.png'),fullPage:true});
  const wireCases=[[1,'Autorizado'],['1','Autorizado'],[true,'Autorizado'],[0,'Não autorizado'],['0','Não autorizado'],[false,'Não autorizado'],[null,'Não informado'],[undefined,'Informação indisponível'],['invalid','Informação indisponível'],['true','Informação indisponível'],['','Informação indisponível'],[2,'Informação indisponível']];
  let value;
  const rewrite=async route=>{const response=await route.fetch();const data=await response.json();const row=data.registrations.find(r=>Number(r.numero_peito)===4);if(row){if(value===undefined)delete row.imagem_autorizada;else row.imagem_autorizada=value;}await route.fulfill({response,json:data});};
  await page.route('**/kids/admin/api/registrations.php*',rewrite);
  for(const [wire,want] of wireCases){value=wire;await page.getByRole('button',{name:'Atualizar',exact:true}).click();await settled(page);assert.ok((await imageCell(page,'Contrato Autorizado')).startsWith(want));pass('wire '+typeof wire+' '+String(wire)+' -> '+want);}
  value=undefined;await page.reload();await settled(page);assert.ok((await imageCell(page,'Contrato Autorizado')).startsWith('Informação indisponível'));
  await page.screenshot({path:path.join(__dirname,'screenshots/image-contract-missing.png'),fullPage:true});pass('missing field after reload is unavailable, never refusal');
  await page.unroute('**/kids/admin/api/registrations.php*',rewrite);
  await page.getByRole('button',{name:'Atualizar',exact:true}).click();await settled(page);await assertThree();pass('real endpoint restores authorized display after mismatched response');
  // Reproduce the reported absent-field failure with the exact previous published-package bundle.
  const oldBundle=fs.readFileSync(path.join(__dirname,'fixtures/image-admin-before.js'));
  const legacy=await context.newPage();value=undefined;
  await legacy.route('**/kids/admin/dist/assets/*.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:oldBundle}));
  await legacy.route('**/kids/admin/api/registrations.php*',rewrite);
  await legacy.goto(input.base+'/kids/admin/');await settled(legacy);assert.ok((await imageCell(legacy,'Contrato Autorizado')).startsWith('Não autorizado'));
  pass('previous exact bundle reproduces false refusal when authorized row field is absent');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(__dirname,'image-contract-browser-results.json'),JSON.stringify({checks:checks.length,passed:checks,old_bundle_sha256:crypto.createHash('sha256').update(oldBundle).digest('hex'),no_page_errors:true,wire_mutations_only_in_browser:true},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
