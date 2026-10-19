// Focused regression for /kids/ presentation against the disposable PHP/MariaDB preview.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const resume = require('./resume.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const p = JSON.parse(fs.readFileSync(path.join(__dirname, 'preview.json')));
const out = path.join(__dirname, 'screenshots');
const passed = [];
const pass = text => { passed.push(text); console.log('PASS ' + text); };
async function ready(page) { await page.waitForFunction(() => !document.querySelector('#submit').disabled); }
async function fill(page, name = 'Criança Fictícia Ana') {
  if (!await page.locator('#form-panel').isVisible()) await page.locator('#another').click();
  for (const [id, text] of Object.entries({ child_name:name, birth_date:'2018-10-17', guardian_name:'Responsável Fictício', relationship:'Responsável', phone:'11900000000' })) await page.locator('#' + id).fill(text);
  await page.locator('#division').selectOption('F'); await page.locator('#accepted').check();
}
(async () => {
  const browser = await chromium.launch({ headless:true, executablePath:process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const config = fs.readFileSync(p.config, 'utf8'); const clock = fs.readFileSync(p.clock, 'utf8');
  try {
    const context = await browser.newContext({ viewport:{ width:1280, height:1000 }, permissions:['clipboard-read','clipboard-write'] });
    const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(p.url);
    const eventConfig = (await (await page.request.get(new URL('/kids/api/session.php', page.url()).href)).json()).event; await ready(page);
    assert.equal(await page.locator('h1').innerText(), 'Autismo Run KIDS');
    assert.match(await page.locator('#event-summary').innerText(), /60,00/);
    assert.match(await page.locator('#event-deadline').innerText(), /21\/11, às 16h/);
    assert.equal(await page.getByLabel('Categoria', {exact:true}).getAttribute('name'), 'division');
    assert.equal(await page.locator('#submit').innerText(), 'Concluir inscrição');
    pass('compact title, centralized summary, category label and unchanged API field');
    await page.locator('#submit').click(); assert.equal(await page.evaluate(() => document.activeElement.id), 'child_name');
    await fill(page); assert.match(await page.locator('#age-hint').innerText(), /8 anos.*8–10/);
    const positions = await page.evaluate(() => {
      const rect = id => document.getElementById(id).getBoundingClientRect();
      return { childFull: rect('child_name').width > rect('birth_date').width * 1.9, guardianFull: rect('guardian_name').width > rect('phone').width * 1.9, birthCategory:rect('birth_date').top === rect('division').top, guardianRow:rect('relationship').top === rect('phone').top };
    }); assert(Object.values(positions).every(Boolean));
    await page.screenshot({ path:path.join(out,'visual-formulario-desktop.png'), fullPage:true });
    pass('desktop form rows, full-width names, age hint and validation focus');
    let creates = 0; page.on('request', r => { if (r.url().endsWith('create.php')) creates++; });
    await page.evaluate(() => { const f=document.querySelector('form'); f.dispatchEvent(new Event('submit',{cancelable:true})); f.dispatchEvent(new Event('submit',{cancelable:true})); });
    await page.locator('.kids-card').waitFor(); await ready(page);
    assert.equal(creates,1); assert.equal(await page.locator('#child_name').inputValue(),'');
    assert.match(await page.locator('.kids-payment-status').innerText(),/Pagamento pendente/);
    await page.locator('button',{hasText:'Copiar chave PIX'}).click(); assert.equal(await page.evaluate(() => navigator.clipboard.readText()),eventConfig.pix);
    const url = new URL(await page.locator('.kids-payment-link').getAttribute('href')); assert.equal(url.hostname,'wa.me'); assert.match(url.searchParams.get('text'),/Criança Fictícia Ana/);
    await page.locator('#confirmations-section').screenshot({path:path.join(out,'visual-confirmacao-desktop.png')});
    pass('one POST on double click, confirmation, pending payment, PIX and WhatsApp unchanged');
    await page.locator('#another').click();
    await page.locator('#child_name').fill('Rascunho fictício');
    await page.route('**/confirmations.php',route=>route.abort('failed')); await resume(page);
    await page.waitForFunction(() => document.querySelector('#availability-panel').dataset.kind === 'unavailable');
    assert.equal(await page.locator('.kids-card').count(),1); assert.equal(await page.locator('#child_name').inputValue(),'Rascunho fictício'); assert.equal(await page.locator('#message').isVisible(),false);
    pass('recovery failure contextual beside preserved cards; draft untouched; no duplicate alert');
    await page.unroute('**/confirmations.php'); await page.locator('#retry').click(); await ready(page);
    await fill(page,'Criança Fictícia Bia');
    await page.route('**/create.php',async route=>{await route.fetch();await route.abort('failed');});
    await page.locator('#submit').click(); await page.waitForFunction(()=>document.querySelectorAll('.kids-card').length===2); await ready(page);
    await page.unroute('**/create.php'); await page.reload(); await ready(page); assert.equal(await page.locator('.kids-card').count(),2);
    pass('lost response recovers idempotently; reload preserves both children');
    await page.setViewportSize({width:320,height:900}); assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.locator('#confirmations-section').screenshot({path:path.join(out,'visual-confirmacao-mobile.png')});
    const mobileContext = await browser.newContext({viewport:{width:320,height:900}});const mobile=await mobileContext.newPage();await mobile.goto(p.url);await ready(mobile);
    assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await mobile.locator('#child_name').evaluate(el=>getComputedStyle(el).fontSize),'16px');
    assert(await mobile.locator('#submit').evaluate(el=>el.offsetHeight>=48));
    assert(await mobile.locator('#division').evaluate(el=>el.getBoundingClientRect().top>document.querySelector('#birth_date').getBoundingClientRect().bottom));
    await mobile.screenshot({path:path.join(out,'visual-formulario-mobile.png'),fullPage:true}); pass('320px form and confirmation: no overflow, single column, 16px inputs, comfortable button');
    const offlineContext=await browser.newContext({viewport:{width:1280,height:1000}});const offline=await offlineContext.newPage();
    await offline.route('**/session.php',route=>route.abort('failed'));await offline.goto(p.url);await offline.locator('#retry').waitFor();
    assert.equal(await offline.locator('#message').isVisible(),false);assert.equal(await offline.locator('#event-summary').isVisible(),false);assert.equal(await offline.locator('#submit').isDisabled(),true);
    assert(!/Carregando valor|campos foram mantidos|inscrições encerradas/i.test(await offline.locator('body').innerText()));
    await offline.screenshot({path:path.join(out,'visual-api-indisponivel.png'),fullPage:true});
    await offline.unroute('**/session.php');await offline.locator('#retry').click();await ready(offline);pass('initial API failure ends loading with one notice/retry; retry restores summary');
    fs.writeFileSync(p.config,config.replace("'public_open' => true","'public_open' => false"));
    const closed=await offlineContext.newPage();await closed.goto(p.url);await closed.waitForFunction(()=>document.querySelector('#availability').textContent.includes('ainda não abertas'));
    assert.equal(await closed.locator('#submit').isDisabled(),true);assert.match(await closed.locator('#declaration-text').innerText(),/PROVISÓRIO/);
    await closed.screenshot({path:path.join(out,'visual-inscricoes-desativadas.png'),fullPage:true});pass('disabled opening and provisional declaration remain explicit; no submission');
    fs.writeFileSync(p.config,config);fs.writeFileSync(p.clock,'2026-11-21T16:00:00-03:00');
    await resume(offline);await offline.waitForFunction(()=>document.querySelector('#availability').textContent.includes('Inscrições encerradas'));
    assert.equal(await offline.locator('#submit').isDisabled(),true);pass('deadline state distinct from disabled opening and API failure');
    assert.deepEqual(errors,[]);pass('no JavaScript runtime errors');
    fs.writeFileSync(path.join(__dirname,'presentation-results.json'),JSON.stringify({browser:browser.version(),checks:passed.length,passed},null,2));
  } finally {fs.writeFileSync(p.config,config);fs.writeFileSync(p.clock,clock);await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
