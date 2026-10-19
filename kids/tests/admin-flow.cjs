// Real interfaces + HTTP + disposable MariaDB. Faults are explicitly marked below.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/Usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const resume=require('./resume.cjs');
const preview=JSON.parse(fs.readFileSync(path.join(__dirname,'flow-preview.json'))),base=new URL(preview.home_url).origin;
assert.match(preview.root,/kids-dedicated-/);assert.equal(new URL(base).hostname,'127.0.0.1');
const db=action=>JSON.parse(execFileSync('C:/xampp/php/php.exe',[preview.control,action||'snapshot'],{encoding:'utf8'}));
const passed=[],network=[],faults=[],consoleErrors=[],pageErrors=[],unexpectedFailures=[],registrations=[];
const pass=s=>{passed.push(s);console.log('PASS '+s)};
let fault=false;
const endpoint='**/kids/admin/api/registrations.php';
async function settled(page){await page.waitForTimeout(300);await page.waitForFunction(()=>document.querySelector('#kids-results')?.getAttribute('aria-busy')==='false');}
async function refresh(page){const response=page.waitForResponse(r=>r.url()===base+'/kids/admin/api/registrations.php'&&r.request().method()==='POST');await page.getByRole('button',{name:'Atualizar',exact:true}).click();const r=await response;await settled(page);return {status:r.status(),body:r.request().postDataJSON(),data:await r.json()};}
async function selectBand(page,value){await page.locator('#band-'+value).click();await settled(page);}
function observe(page){
 page.on('pageerror',e=>pageErrors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')(fault?faults:consoleErrors).push({text:m.text(),url:m.location().url})});
 page.on('requestfailed',r=>{(fault?faults:unexpectedFailures).push({url:r.url(),error:r.failure()?.errorText})});
 page.on('response',async r=>{if(r.url().startsWith(base)&&r.status()>=400&&!fault)unexpectedFailures.push({url:r.url(),status:r.status()});});
}
async function fill(page,name,birth){
 await page.goto(preview.public_url);await page.waitForFunction(()=>!document.querySelector('#submit').disabled);
 await page.locator('#child_name').fill(name);await page.locator('#birth_date').fill(birth);await page.locator('#division').selectOption('F');
 await page.locator('#guardian_name').fill('Responsavel Fluxo Ficticio');await page.locator('#relationship').fill('Mãe');await page.locator('#phone').fill('(11) 90000-0999');await page.locator('#accepted').check();
}
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
 const adminContext=await browser.newContext({viewport:{width:1440,height:1000}}),admin=await adminContext.newPage();observe(admin);
 await admin.goto(preview.admin_url);await admin.getByLabel('Usuário',{exact:true}).fill('admin.teste');await admin.getByLabel('Senha',{exact:true}).fill('KidsTeste!2026');await admin.getByRole('button',{name:'Entrar',exact:true}).click();await settled(admin);
 await admin.getByLabel('Inscrições por página').selectOption('50');await settled(admin);
 const initial=db();
 for(const b of ['4-7','8-10','11-14']){
  await selectBand(admin,b);const current=await refresh(admin);assert.equal(current.status,200);
  assert.equal(current.data.total,initial.rows.filter(r=>r.evento_id===1&&r.faixa===b).length);
  for(const v of ['4-7','8-10','11-14'])assert.match(await admin.locator('#band-'+v).innerText(),new RegExp('\\('+current.data.counts[v]+'\\)'));
  const texts=await admin.locator('tbody tr').allTextContents();assert.equal(texts.length,current.data.total);
  const numbers=current.data.registrations.map(r=>Number(r.numero_peito));assert.deepEqual(numbers,[...numbers].sort((a,b)=>a-b));
  for(let i=0;i<texts.length;i++){const r=current.data.registrations[i],text=texts[i];for(const value of [String(r.numero_peito).padStart(3,'0'),r.crianca_nome,r.responsavel_nome,r.vinculo,r.telefone,r.situacao,'60,00',r.divisao==='F'?'Feminina':'Masculina'])assert.ok(text.includes(value),value);}
 }
 pass('logged-in list: all three bands, counts, numeric bib order, names, persisted ages/divisions, guardians, amounts and states agree with real database/API');
 const pages=[];
 for(const [b,birth,name] of [['4-7','2020-10-17','Fluxo Ficticio Quatro Sete'],['8-10','2017-10-17','Fluxo Ficticio Oito Dez'],['11-14','2013-10-17','Fluxo Ficticio Onze Quatorze']]){
  await selectBand(admin,b);const before=await refresh(admin);
  const context=await browser.newContext();const page=await context.newPage();observe(page);pages.push(page);
  await fill(page,name,birth);
  const response=page.waitForResponse(r=>r.url().endsWith('/kids/api/create.php'));
  await page.locator('#submit').click();const creation=await response;assert.equal(creation.status(),201);
  await page.locator('.kids-card').waitFor();const number=await page.locator('.kids-bib>span').innerText();
  assert.match(await page.locator('.kids-card').innerText(),/Pagamento pendente/);
  assert.equal(await admin.locator('tbody tr').filter({hasText:name}).count(),0);
  const updated=await refresh(admin);const matches=updated.data.registrations.filter(r=>r.crianca_nome===name);assert.equal(matches.length,1);
  const record=db().rows.filter(r=>r.crianca_nome===name);assert.equal(record.length,1);
  assert.equal(String(record[0].numero_peito).padStart(3,'0'),number);assert.equal(String(matches[0].numero_peito).padStart(3,'0'),number);
  assert.equal(matches[0].pagamento,'PENDENTE');assert.equal(matches[0].faixa,b);assert.equal(matches[0].responsavel_nome,'Responsavel Fluxo Ficticio');assert.equal(Number(matches[0].valor_centavos),6000);
  assert.equal(updated.data.counts[b],before.data.counts[b]+1);assert.equal(await admin.locator('tbody tr').filter({hasText:name}).count(),1);
  registrations.push({id:Number(record[0].id),number,name,band:b});network.push({reason:'after public form',method:'POST',url:'/kids/admin/api/registrations.php',status:updated.status,body:updated.body,counts:updated.data.counts,number});
  await admin.screenshot({path:path.join(__dirname,'screenshots','flow-'+b+'.png'),fullPage:true});
 }
 pass('three real public forms, admin kept open: one new pending row per band, identical bib in card/database/list and counts incremented only after server refresh');
 await selectBand(admin,'4-7');await admin.getByLabel('Buscar por criança, responsável ou número de peito').fill('Fluxo');await admin.getByLabel('Pagamento',{exact:true}).selectOption('PENDENTE');await settled(admin);
 const filtered=await refresh(admin);assert.equal(filtered.body.search,'Fluxo');assert.equal(filtered.body.payment,'PENDENTE');assert.equal(filtered.body.band,'4-7');assert.equal(filtered.data.total,1);
 assert.match(await admin.getByText(/^Faixa:/).innerText(),/Pagamento: PENDENTE.*Busca: Fluxo/);pass('refresh preserves selected band, search and payment filter with visible active criteria');
 await admin.getByLabel('Pagamento',{exact:true}).selectOption('CONFIRMADO');await settled(admin);assert.equal(await admin.locator('tbody tr').count(),0);assert.equal(await admin.getByText('Nenhuma inscrição encontrada.',{exact:true}).count(),1);
 await admin.getByLabel('Buscar por criança, responsável ou número de peito').fill('');await admin.getByLabel('Pagamento',{exact:true}).selectOption('');await admin.getByLabel('Inscrições por página').selectOption('10');await settled(admin);
 assert.equal(await admin.locator('tbody tr').filter({hasText:registrations[0].name}).count(),0);assert.match(await admin.getByText(/inscrições encontradas · Página/).innerText(),/Página 1 de 3/);
 await admin.getByRole('button',{name:'Próxima',exact:true}).click();await settled(admin);await admin.getByRole('button',{name:'Próxima',exact:true}).click();await settled(admin);assert.equal(await admin.locator('tbody tr').filter({hasText:registrations[0].name}).count(),1);
 pass('empty filter and pagination legitimately hide new record; active criteria/page are visible and next pages reveal same bib');
 await admin.getByLabel('Inscrições por página').selectOption('50');await settled(admin);
 // Delay a real response, dispatch two same-tick clicks, inspect busy state and network count.
 let release,started;const gate=new Promise(r=>release=r),begun=new Promise(r=>started=r);let requests=0;
 await admin.route(endpoint,async route=>{requests++;const r=await route.fetch();started();await gate;await route.fulfill({response:r})});
 await admin.getByRole('button',{name:'Atualizar',exact:true}).evaluate(b=>{b.click();b.click()});await begun;
 assert.equal(await admin.getByRole('button',{name:'Atualizando…',exact:true}).isDisabled(),true);assert.equal(await admin.locator('#kids-results').getAttribute('aria-busy'),'true');assert.equal(await admin.getByText('Carregando…',{exact:true}).count(),1);assert.equal(requests,1);
 release();await settled(admin);await admin.unroute(endpoint);pass('refresh performs one real server request, shows updating/loading state and blocks repeated clicks');
 fault=true;await admin.route(endpoint,route=>route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({sucesso:false,mensagem:'Falha simulada de atualização'})}));await refresh(admin);
 assert.equal(await admin.locator('tbody tr').count(),0);assert.match(await admin.getByRole('alert').innerText(),/Falha simulada/);assert.match(await admin.locator('#band-4-7').innerText(),/—/);assert.equal(await admin.getByText('Nenhuma inscrição encontrada.',{exact:true}).count(),0);assert.equal(await admin.getByText('Lista não atualizada. Tente novamente.',{exact:true}).count(),1);assert.equal(await admin.getByText('Contagens indisponíveis.',{exact:true}).count(),1);
 await admin.screenshot({path:path.join(__dirname,'screenshots','flow-refresh-error.png'),fullPage:true});await admin.unroute(endpoint);await refresh(admin);fault=false;
 assert.equal(await admin.getByRole('alert').count(),0);assert.ok(await admin.locator('tbody tr').count()>0);pass('injected API failure clears stale rows/counts; successful retry removes old error and displays current data');
 // Older successful response arrives after a newer filtered query.
 let releaseOld,oldStarted;const oldGate=new Promise(r=>releaseOld=r),oldBegun=new Promise(r=>oldStarted=r);let first=true;
 await admin.route(endpoint,async route=>{if(first){first=false;const response=await route.fetch();oldStarted();await oldGate;await route.fulfill({response});}else await route.continue()});
 await admin.getByRole('button',{name:'Atualizar',exact:true}).click();await oldBegun;
 await admin.getByLabel('Buscar por criança, responsável ou número de peito').fill(registrations[0].name);await settled(admin);assert.equal(await admin.locator('tbody tr').count(),1);
 releaseOld();await admin.waitForTimeout(300);assert.equal(await admin.locator('tbody tr').count(),1);assert.match(await admin.locator('tbody tr').innerText(),new RegExp(registrations[0].name));assert.match(await admin.locator('#band-4-7').innerText(),/\(1\)/);assert.match(await admin.locator('#band-8-10').innerText(),/\(0\)/);await admin.unroute(endpoint);
 pass('late older server response cannot overwrite newer filtered rows/counts');
 // Real server refusal via invalid extra field, then real transaction failure via isolated trigger.
 for(const rollback of [false,true]){
  const c=await browser.newContext(),p=await c.newPage();observe(p);const name=rollback?'Fluxo Ficticio Rollback':'Fluxo Ficticio Recusado';await fill(p,name,'2020-10-17');const before=db();
  if(rollback)db('rollback-on');else await p.route('**/kids/api/create.php',route=>{const body=route.request().postDataJSON();body.amount_cents=1;return route.continue({postData:JSON.stringify(body)})});
  fault=true;const response=p.waitForResponse(r=>r.url().endsWith('/kids/api/create.php'));await p.locator('#submit').click();assert.equal((await response).status(),rollback?500:400);await p.waitForTimeout(200);fault=false;
  if(rollback)db('rollback-off');const after=db();assert.equal(after.rows.length,before.rows.length);assert.deepEqual(after.events,before.events);assert.equal(after.keys,before.keys);
  await admin.getByLabel('Buscar por criança, responsável ou número de peito').fill(name);await settled(admin);const result=await refresh(admin);assert.equal(result.data.total,0);assert.equal(await admin.locator('tbody tr').count(),0);await c.close();
 }
 pass('refused submission and real database rollback create no row, idempotency entry or bib advance and never appear after admin refresh');
 await admin.getByLabel('Buscar por criança, responsável ou número de peito').fill(registrations[0].name);await settled(admin);const beforePayment=db();
 await admin.getByRole('button',{name:'Confirmar pagamento',exact:true}).click();await admin.getByRole('dialog').waitFor();assert.match(await admin.getByRole('dialog').innerText(),new RegExp(registrations[0].number));await admin.getByRole('dialog').getByRole('button',{name:'Confirmar pagamento',exact:true}).click();await admin.getByRole('dialog').waitFor({state:'hidden'});await settled(admin);
 const paid=await refresh(admin);assert.equal(paid.data.registrations[0].pagamento,'CONFIRMADO');assert.match(await admin.locator('tbody tr').innerText(),/PAGO/);
 const afterPayment=db();const changed=afterPayment.rows.filter((r,i)=>r.pagamento!==beforePayment.rows[i].pagamento);assert.deepEqual(changed.map(r=>Number(r.id)),[registrations[0].id]);
 const audit=afterPayment.audit.filter(a=>Number(a.inscricao_id)===registrations[0].id);assert.equal(audit.length,1);assert.equal(Number(audit[0].usuario_id),1);assert.equal(audit[0].estado_anterior,'PENDENTE');assert.equal(audit[0].estado_novo,'CONFIRMADO');assert.ok(audit[0].ocorrida_em);
 const pub=pages[0];await pub.locator('#lookup-open').click();await pub.locator('#lookup-name').fill(registrations[0].name);await pub.locator('#lookup-phone').fill('(11) 90000-0999');await pub.locator('#lookup-submit').click();await pub.locator('#lookup-result').waitFor();assert.equal(await pub.locator('#lookup-number').innerText(),registrations[0].number);assert.match(await pub.locator('#lookup-payment').innerText(),/PAGO|confirmado/i);await pub.locator('#lookup-close').click();
 await resume(pub);await pub.waitForFunction(()=>document.querySelector('.kids-payment-status')?.textContent.includes('confirmado'));await pub.screenshot({path:path.join(__dirname,'screenshots','flow-paid-card.png'),fullPage:true});
 pass('dialog payment survives refresh; public modal and original card on resume agree; only chosen row changed with exactly one matching audit');
 // Reduce real pending fixtures while currently on last page.
 await admin.getByLabel('Buscar por criança, responsável ou número de peito').fill('');await admin.getByLabel('Pagamento',{exact:true}).selectOption('PENDENTE');await admin.getByLabel('Inscrições por página').selectOption('10');await settled(admin);
 await admin.getByRole('button',{name:'Próxima',exact:true}).click();await settled(admin);await admin.getByRole('button',{name:'Próxima',exact:true}).click();await settled(admin);db('shrink');
 await refresh(admin);assert.match(await admin.getByText(/inscrições encontradas · Página/).innerText(),/Página 1 de 1/);assert.equal(await admin.getByRole('button',{name:'Próxima',exact:true}).isDisabled(),true);assert.equal(await admin.getByLabel('Pagamento',{exact:true}).inputValue(),'PENDENTE');
 pass('real result shrink clamps pagination to a valid page and re-queries while preserving filter');
 // Real expiry with existing isolated router, then refresh must remove private rows.
 await admin.getByLabel('Pagamento',{exact:true}).selectOption('');await settled(admin);
 const me=await (await adminContext.request.get(base+'/kids/admin/api/me.php')).json();await adminContext.request.post(base+'/kids/admin/__test/expire',{headers:{'X-CSRF-Token':me.csrfToken}});
 fault=true;await admin.getByRole('button',{name:'Atualizar',exact:true}).click();await admin.getByRole('heading',{name:'Entrar na área KIDS',exact:true}).waitFor();assert.equal(await admin.locator('tbody tr').count(),0);fault=false;
 pass('real expired session on refresh returns to login and removes all private rows');
 assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(unexpectedFailures,[]);pass('no JavaScript exceptions, unexpected console errors or failed requests in normal paths; deliberate faults recorded separately');
 // Leave a useful dataset for manual checks, with all payment states visible.
 await admin.getByLabel('Usuário',{exact:true}).fill('admin.teste');await admin.getByLabel('Senha',{exact:true}).fill('KidsTeste!2026');await admin.getByRole('button',{name:'Entrar',exact:true}).click();await settled(admin);
 const result={checks:passed.length,passed,registrations,network,consoleErrors,pageErrors,unexpectedFailures,deliberateFaults:faults,paymentChangedIds:changed.map(r=>Number(r.id)),audit,preview:preview.home_url};
 fs.writeFileSync(path.join(__dirname,'admin-flow-results.json'),JSON.stringify(result,null,2));
 console.log('OK '+passed.length+' flow checks',registrations);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);fs.writeFileSync(path.join(__dirname,'admin-flow-failure.json'),JSON.stringify({error:String(e),passed,network,consoleErrors,pageErrors,unexpectedFailures,faults},null,2));process.exitCode=1});
