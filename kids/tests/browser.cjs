/* Real browser + isolated real HTTP/DB. Run after integration.php --preview. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const resume = require('./resume.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const preview = JSON.parse(fs.readFileSync(path.join(__dirname, 'preview.json')));
const out = path.join(__dirname, 'screenshots'); fs.mkdirSync(out, { recursive: true });
const results = [];
const pass = label => { results.push(label); console.log('PASS ' + label); };
async function fill(page, name = 'Criança Fictícia Ana') {
  if (!await page.locator('#form-panel').isVisible()) await page.locator('#another').click();
  await page.locator('#child_name').fill(name);
  await page.locator('#birth_date').fill('2018-10-17');
  await page.locator('#division').selectOption('F');
  await page.locator('#guardian_name').fill('Responsável Fictício');
  await page.locator('#relationship').fill('Responsável');
  await page.locator('#phone').fill('(11) 90000-0000');
  await page.locator('#accepted').check();
}
async function ready(page) { await page.waitForFunction(() => !document.querySelector('#submit').disabled); }
async function cards(page, count) { await page.waitForFunction(n => document.querySelectorAll('.kids-card').length === n, count); }
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  let originalConfig, originalClock;
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage(); const consoleMessages = []; const errors = [];
    page.on('console', m => consoleMessages.push(m.text())); page.on('pageerror', e => errors.push(e.message));
    await page.goto(preview.url);
    const eventConfig = (await (await page.request.get(new URL('/kids/api/session.php', page.url()).href)).json()).event; await ready(page);
    assert.match(await page.locator('#declaration-text').innerText(), /PROVISÓRIO/); pass('test declaration clearly provisional');
    await page.locator('#submit').click();
    assert.equal(await page.locator('#child_name').getAttribute('aria-invalid'), 'true');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'child_name'); pass('visible field validation and first-error focus');
    await fill(page); assert.match(await page.locator('#age-hint').innerText(), /8 anos.*8–10/);
    await page.screenshot({ path: path.join(out, 'formulario-desktop.png'), fullPage: true });
    let creates = 0; page.on('request', r => { if (r.url().endsWith('create.php')) creates++; });
    await page.evaluate(() => { const f = document.querySelector('#kids-form'); f.dispatchEvent(new Event('submit', { cancelable: true })); f.dispatchEvent(new Event('submit', { cancelable: true })); });
    await cards(page, 1); await ready(page);
    assert.equal(creates, 1); assert.equal(await page.locator('#child_name').inputValue(), '');
    assert.match(await page.locator('.kids-card').innerText(), /Inscrição registrada/i);
    assert.match(await page.locator('.kids-card').innerText(), /Pagamento pendente/); pass('complete registration, double-click sends once, fields cleared, pending payment');
    const pixPayload = (await (await page.request.get(new URL('/kids/api/confirmations.php', page.url()).href)).json()).registrations[0].pix_payload;
    assert.ok(pixPayload);
    await page.locator('button', { hasText: 'Copiar PIX de' }).click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), pixPayload); pass('PIX copied exactly');
    await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }); });
    await page.locator('button', { hasText: 'Copiar PIX de' }).click();
    assert.equal(await page.locator('.kids-manual').inputValue(), pixPayload); assert.equal(await page.locator('.kids-manual').isVisible(), true); pass('manual PIX fallback');
    const href = new URL(await page.locator('.kids-payment-link').getAttribute('href'));
    assert.equal(href.hostname, 'wa.me'); assert.equal(href.pathname, '/' + eventConfig.whatsapp);
    assert.equal(href.searchParams.get('text'), 'Olá! Fiz a inscrição de Criança Fictícia Ana na corrida KIDS do Projeto Semente Azul. Número da inscrição: 1007. Vou enviar o comprovante do pagamento de R$ 60,00 para conferência.'.replace('1007', await page.locator('.kids-bib>span').innerText()));
    assert.equal(await page.locator('.kids-payment-link').getAttribute('target'), '_blank'); pass('WhatsApp destination/message encoded correctly; no message sent');
    await page.screenshot({ path: path.join(out, 'confirmacao-desktop.png'), fullPage: true });
    await page.locator('#another').click(); await fill(page, 'Criança Fictícia Bia');
    let invalid = true;
    await page.route('**/create.php', async route => {
      if (invalid) { invalid = false; const body = JSON.parse(route.request().postData()); body.amount_cents = 1; await route.continue({ postData: JSON.stringify(body) }); }
      else await route.continue();
    });
    await page.locator('#submit').click(); await page.waitForFunction(() => document.querySelector('#message').textContent.includes('servidor recusou'));
    assert.equal(await page.locator('#child_name').inputValue(), 'Criança Fictícia Bia'); pass('real server validation error preserves input');
    await page.unroute('**/create.php');
    // Commit via real endpoint but discard HTTP response at the browser boundary.
    let drop = true;
    await page.route('**/create.php', async route => { if (drop) { drop = false; await route.fetch(); await route.abort('failed'); } else await route.continue(); });
    await page.locator('#submit').click(); await cards(page, 2); await ready(page);
    assert.match(await page.locator('#message').innerText(), /recuperada/); pass('lost response recovers registration automatically before suggesting new submission');
    await page.unroute('**/create.php');
    await page.locator('#another').click();
    await page.locator('#child_name').fill('Rascunho fictício');
    await resume(page); await ready(page);
    assert.equal(await page.locator('#child_name').inputValue(), 'Rascunho fictício'); pass('resume refresh preserves partially filled form');
    await page.reload(); await ready(page); await cards(page, 2); pass('reload recovers two children in same cookie session');
    await fill(page, 'Criança Fictícia Caio');
    let abortBefore = true; const keys = [];
    await page.route('**/create.php', async route => { keys.push(route.request().headers()['idempotency-key']); if (abortBefore) { abortBefore = false; await route.abort('failed'); } else await route.continue(); });
    await page.locator('#submit').click(); await page.waitForFunction(() => document.querySelector('#submit').textContent.includes('Recuperar / repetir') && !document.querySelector('#submit').disabled);
    assert.equal(await page.locator('#child_name').inputValue(), 'Criança Fictícia Caio');
    await page.locator('#submit').click(); await cards(page, 3); await ready(page);
    assert.equal(keys.length, 2); assert.equal(keys[0], keys[1]); pass('network failure before commit retries same key and payload');
    await page.unroute('**/create.php');
    assert.equal(await page.evaluate(() => localStorage.length), 0);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('kids.pending.v1')), null); pass('no localStorage PII or tokens; completed pending marker removed');
    await fill(page, 'Criança Fictícia Dora');
    let blockConfirmation = false;
    await page.route('**/create.php', async route => { await route.fetch(); blockConfirmation = true; await route.abort('failed'); });
    await page.route('**/confirmations.php', async route => { if (blockConfirmation) await route.abort('failed'); else await route.continue(); });
    await page.locator('#submit').click();
    await page.waitForFunction(() => document.querySelector('#recovery-message').textContent.includes('envio com resultado incerto'));
    assert.notEqual(await page.evaluate(() => sessionStorage.getItem('kids.pending.v1')), null);
    await page.unroute('**/create.php'); await page.unroute('**/confirmations.php');
    await page.reload(); await ready(page); await cards(page, 4);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('kids.pending.v1')), null); pass('reload after uncertain commit recovers pending attempt by key and clears marker');
    await page.setViewportSize({ width: 320, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); pass('320px layout has no horizontal overflow');
    await page.screenshot({ path: path.join(out, 'confirmacao-mobile.png'), fullPage: true });
    const mobileContext = await browser.newContext({ viewport: { width: 320, height: 900 } });
    const mobile = await mobileContext.newPage(); await mobile.goto(preview.url); await ready(mobile);
    await mobile.screenshot({ path: path.join(out, 'formulario-mobile.png'), fullPage: true });
    assert.equal(await mobile.locator('#child_name').evaluate(el => getComputedStyle(el).fontSize), '16px'); pass('mobile inputs at least 16px');
    originalClock = fs.readFileSync(preview.clock, 'utf8');
    fs.writeFileSync(preview.clock, '2026-11-21T16:00:00-03:00');
    await resume(page); await page.waitForFunction(() => document.querySelector('#availability').textContent.includes('encerradas'));
    assert.equal(await page.locator('#submit').isDisabled(), true); await cards(page, 4); pass('exact deadline disables new submissions and retains confirmations');
    fs.writeFileSync(preview.clock, originalClock); originalClock = undefined;
    originalConfig = fs.readFileSync(preview.config, 'utf8');
    fs.writeFileSync(preview.config, originalConfig.replace("'public_open' => true", "'public_open' => false"));
    const closedPage = await context.newPage(); await closedPage.goto(preview.url); await closedPage.waitForFunction(() => document.querySelector('#availability').textContent.includes('ainda não abertas'));
    assert.equal(await closedPage.locator('#submit').isDisabled(), true); pass('public closed gate visibly blocks submission');
    await closedPage.screenshot({ path: path.join(out, 'abertura-bloqueada.png'), fullPage: true });
    fs.writeFileSync(preview.config, originalConfig); originalConfig = undefined;
    // Session replacement must not silently turn a previous attempt into a new one.
    await resume(page); await ready(page);
    await page.locator('#another').click();
    await page.locator('#child_name').fill('Rascunho antes da expiração');
    await context.clearCookies({ name: 'PSA_KIDS_PUBLIC' });
    await resume(page);
    await page.waitForFunction(() => document.querySelector('#message').textContent.includes('sessão expirou ou foi substituída'));
    assert.equal(await page.locator('#submit').isDisabled(), true);
    assert.equal(await page.locator('#child_name').inputValue(), 'Rascunho antes da expiração'); pass('session replacement blocks new submission and preserves draft with contact guidance');
    const ratePage = await mobileContext.newPage(); await ratePage.goto(preview.url); await ready(ratePage); await fill(ratePage, 'Criança Fictícia Limite');
    await ratePage.evaluate(async () => { for (let i = 0; i < 30; i++) await fetch('/kids/api/create.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); });
    await ratePage.locator('#submit').click();
    await ratePage.waitForFunction(() => document.querySelector('#message').textContent.includes('Muitas tentativas'));
    assert.equal(await ratePage.locator('#child_name').inputValue(), 'Criança Fictícia Limite'); pass('rate-limit message remains clear and input is preserved');
    assert.deepEqual(errors, []); assert(!consoleMessages.some(m => /Criança Fictícia|Responsável Fictício|\b\d{11,15}\b/.test(m))); pass('no JS errors or fixture PII logged to console');
    fs.writeFileSync(path.join(__dirname, 'browser-results.json'), JSON.stringify({ browser: browser.version(), checks: results.length, passed: results }, null, 2));
    console.log(`OK: ${results.length} browser checks. Screenshots: ${out}`);
  } finally {
    if (originalConfig) fs.writeFileSync(preview.config, originalConfig);
    if (originalClock) fs.writeFileSync(preview.clock, originalClock);
    await browser.close();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
