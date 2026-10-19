// Focused UI checks. Real lookup API; card rendering uses read-only existing rows as fixtures.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/Usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const p=JSON.parse(fs.readFileSync(path.join(__dirname,'manual-preview.json'))),base=p.base;
const snapshot=JSON.parse(execFileSync('C:/xampp/php/php.exe',[path.join(p.root,'control.php'),'snapshot'],{encoding:'utf8'}));
const paid=snapshot.rows.find(r=>Number(r.numero_peito)===1064),pending=snapshot.rows.find(r=>Number(r.numero_peito)===1062);assert.equal(paid.pagamento,'CONFIRMADO');assert.equal(pending.pagamento,'PENDENTE');
const before=JSON.parse(execFileSync('C:/xampp/php/php.exe',[path.join(__dirname,'manual-db.php'),p.root],{encoding:'utf8'}));
const out=path.join(__dirname,'screenshots'),passed=[],metrics=[];const pass=s=>{passed.push(s);console.log('PASS '+s)};
function dto(r){return {reference:r.referencia,number:String(r.numero_peito).padStart(3,'0'),child_name:r.crianca_nome,age:Number(r.idade_inscricao),category:r.faixa,division:r.divisao,shirt_size:r.camisa,amount_cents:Number(r.valor_centavos),payment_status:r.pagamento,registration_status:r.situacao,created_at_utc:r.criada_em}}
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const ctx=await browser.newContext(),page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/');assert.equal(await page.locator('.ar-kids-link').getAttribute('href'),'/kids/?nova=1');assert.equal(await page.getByRole('link',{name:'Área administrativa KIDS',exact:true}).getAttribute('href'),'/kids/admin/');
 await page.locator('.ar-kids-link').click();assert.equal(new URL(page.url()).origin,base);
 await page.waitForFunction(()=>document.querySelector('#lookup-open'));
 await page.goto(base+'/kids/admin/');assert.equal(new URL(page.url()).origin,base);await page.getByLabel('Usuário',{exact:true}).waitFor();
 pass('home, form and admin share the same origin; links remain /kids/?nova=1 and /kids/admin/');
 for(const [label,width,height] of [['desktop',1280,900],['320',320,640]]){
  await page.setViewportSize({width,height});await page.goto(base+'/kids/');await page.locator('#lookup-open').click();
  assert.equal(await page.evaluate(()=>document.activeElement.id),'lookup-name');
  await page.locator('#lookup-name').fill(paid.crianca_nome);await page.locator('#lookup-phone').fill(paid.telefone);await page.locator('#lookup-submit').click();await page.locator('#lookup-result').waitFor();
  assert.equal(await page.locator('#lookup-number').innerText(),'1064');assert.match(await page.locator('#lookup-payment').innerText(),/confirmado/);
  for(const id of ['lookup-name','lookup-phone'])assert.equal(await page.locator('#'+id).isEditable(),true);
  const m=await page.locator('#lookup-dialog').evaluate(d=>{const r=d.getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,right:innerWidth-r.right,scrollHeight:d.scrollHeight,clientHeight:d.clientHeight,padding:getComputedStyle(d).padding,inputs:[...d.querySelectorAll('input')].map(x=>({height:x.getBoundingClientRect().height,font:getComputedStyle(x).fontSize})),buttons:[...d.querySelectorAll('button')].map(x=>x.getBoundingClientRect().height),overflow:d.scrollWidth>d.clientWidth}});
  assert.ok(m.width<=500.1);assert.ok(m.height<=height-23);assert.ok(m.left>=11.9&&m.right>=11.9);assert.equal(m.overflow,false);for(const x of m.inputs){assert.ok(x.height>=44&&x.height<=48);assert.ok(parseFloat(x.font)>=16)}for(const h of m.buttons)assert.ok(h>=44&&h<=48);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);metrics.push({label,...m});
  await page.locator('#lookup-dialog').evaluate(d=>d.scrollTop=0);await page.screenshot({path:path.join(out,'manual-lookup-'+label+'.png'),fullPage:false});
  await page.locator('#lookup-support').focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'lookup-close');await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'lookup-support');
  await page.locator('#lookup-name').fill('Outro nome editável');assert.equal(await page.locator('#lookup-name').inputValue(),'Outro nome editável');
  await page.keyboard.press('Escape');await page.locator('#lookup-dialog').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>document.activeElement.id),'lookup-open');
  pass(label+': real 1064 confirmed lookup, editable fields, compact geometry, contained focus, Escape and return to origin');
 }
 await page.setViewportSize({width:320,height:420});await page.locator('#lookup-open').click();await page.locator('#lookup-name').fill(paid.crianca_nome);await page.locator('#lookup-phone').fill(paid.telefone);await page.locator('#lookup-submit').click();await page.locator('#lookup-result').waitFor();
 const scroll=await page.locator('#lookup-dialog').evaluate(d=>{const previous=d.scrollTop;d.scrollTop=d.scrollHeight;return {scrollable:d.scrollHeight>d.clientHeight,moved:d.scrollTop>previous,height:d.getBoundingClientRect().height}});assert.equal(scroll.scrollable,true);assert.equal(scroll.moved,true);assert.ok(scroll.height<=396.1);
 await page.screenshot({path:path.join(out,'manual-lookup-320-scroll.png'),fullPage:false});await page.keyboard.press('Escape');pass('320px short viewport: internal vertical scrolling reaches result/contact without horizontal overflow');
 // Never claim the user's original cookie: render fixtures derived from existing DB rows only.
 const cards=await browser.newPage({viewport:{width:1100,height:900}});await cards.route('**/kids/api/confirmations.php',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,registrations:[dto(paid),dto(pending)],pending_reference:null})}));
 await cards.goto(base+'/kids/');await cards.locator('.kids-card').nth(1).waitFor();
 const confirmed=cards.locator('.kids-card').filter({hasText:paid.crianca_nome}),unpaid=cards.locator('.kids-card').filter({hasText:pending.crianca_nome});
 assert.equal(await confirmed.locator('.kids-payment-status').getAttribute('data-status'),'CONFIRMADO');assert.equal(await confirmed.locator('.kids-payment').count(),0);assert.equal(await unpaid.locator('.kids-payment').count(),1);
 const colors=await Promise.all([confirmed,unpaid].map(c=>c.locator('.kids-payment-status').evaluate(e=>({background:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color,text:e.textContent}))));assert.equal(colors[0].background,'rgb(228, 245, 233)');assert.equal(colors[1].background,'rgb(255, 243, 216)');
 assert.doesNotMatch(await cards.locator('.kids-return-note').innerText(),/PIX|comprovante|WhatsApp/);await cards.screenshot({path:path.join(out,'manual-payment-mixed.png'),fullPage:true});pass('mixed card fixture: confirmed green/no PIX; pending yellow/own PIX and receipt instructions; shared note is neutral');
 assert.deepEqual(errors,[]);const after=JSON.parse(execFileSync('C:/xampp/php/php.exe',[path.join(__dirname,'manual-db.php'),p.root],{encoding:'utf8'}));assert.equal(before.fingerprint,after.fingerprint);pass('1064 registration/payment/audit fingerprint unchanged; no page JavaScript exceptions');
 fs.writeFileSync(path.join(__dirname,'manual-ui-results.json'),JSON.stringify({checks:passed.length,passed,base,metrics,shortViewport:scroll,colors,preservation1064:{payment:after.payment,auditCount:after.auditCount,unchanged:true},cardTest:'Read-only database-derived fixtures via intercepted confirmations; real lookup API for 1064'},null,2));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
