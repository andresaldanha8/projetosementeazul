// Focused QA: home -> KIDS, affected card, closed gate and API unavailable.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const preview = JSON.parse(fs.readFileSync(path.join(__dirname, 'preview.json')));
const out = path.join(__dirname, 'screenshots');
const passed = [];
function pass(s) { passed.push(s); console.log('PASS ' + s); }
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const config = fs.readFileSync(preview.config, 'utf8');
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage(); await page.goto(preview.home_url, { waitUntil: 'domcontentloaded' });
    const card = page.locator('#autismo-run .ar-registration-card');
    assert.equal(await card.locator('a').count(), 2);
    assert.equal(await card.getByRole('link', { name: 'Inscrição geral', exact: true }).getAttribute('href'), 'https://www.cronosantarem.com.br/evento/ii-corrida-solidrio-autismo-run');
    assert.equal(await card.getByRole('link', { name: 'Inscrição geral', exact: true }).getAttribute('target'), '_blank');
    const kidsLink = card.getByRole('link', { name: 'Inscrever criança — KIDS', exact: true });
    assert.equal(await kidsLink.getAttribute('href'), '/kids/?nova=1'); assert.equal(await kidsLink.getAttribute('target'), null);
    pass('general external link preserved and KIDS opens same tab');
    for (const [name, width] of [['desktop', 1440], ['mobile', 320]]) {
      await page.setViewportSize({ width, height: 1000 });
      await card.scrollIntoViewIfNeeded();
      const bounds = await card.evaluate(el => {
        const c = el.getBoundingClientRect(); const a = [...el.querySelectorAll(':scope > a')].map(x => x.getBoundingClientRect());
        return { fits: el.scrollWidth <= el.clientWidth && a.every(x => x.left >= c.left && x.right <= c.right), stacked: a[1].top >= a[0].bottom, touch: a.every(x => x.height >= 48) };
      });
      assert.deepEqual(bounds, { fits: true, stacked: true, touch: true });
      await card.screenshot({ path: path.join(out, `cartao-acessos-${name}.png`) });
      pass(`${name}: buttons stacked, within card, touch targets >=48px`);
    }
    await kidsLink.click(); await page.waitForURL('**/kids/'); await page.waitForFunction(() => !document.querySelector('#submit').disabled);
    for (const [id, value] of Object.entries({ child_name: 'Criança Fictícia Percurso', birth_date: '2018-10-17', guardian_name: 'Responsável Fictício', relationship: 'Responsável', phone: '11900000000' })) await page.locator('#' + id).fill(value);
    await page.locator('#division').selectOption('F'); await page.locator('#accepted').check(); await page.locator('#submit').click();
    await page.locator('.kids-card').waitFor(); assert.equal(await page.locator('.kids-bib>span').innerText(), '001');
    pass('real home -> KIDS -> form -> confirmation with fictitious data and bib 001');
    fs.writeFileSync(preview.config, config.replace("'public_open' => true", "'public_open' => false"));
    const closedContext = await browser.newContext(); const closed = await closedContext.newPage();
    await closed.goto(preview.home_url, { waitUntil: 'domcontentloaded' });
    await closed.getByRole('link', { name: 'Inscrever criança — KIDS', exact: true }).click();
    await closed.waitForFunction(() => document.querySelector('#availability').textContent.includes('ainda não abertas'));
    assert.equal(await closed.locator('#submit').isDisabled(), true);
    const status = await closed.evaluate(async () => {
      const s = await (await fetch('/kids/api/session.php')).json();
      return (await fetch('/kids/api/create.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': s.csrf_token, 'Idempotency-Key': [...crypto.getRandomValues(new Uint8Array(32))].map(x => x.toString(16).padStart(2,'0')).join('') }, body: JSON.stringify({ child_name:'Criança Fictícia Bloqueada', birth_date:'2018-10-17', division:'F', guardian_name:'Responsável Fictício', relationship:'Responsável', phone:'11900000000', declaration_version:'TEST-ONLY', accepted:true }) })).status;
    });
    assert.equal(status, 503); pass('KIDS access with gate closed: clear notice, disabled form, backend still rejects POST (503)');
    const unavailable = await closedContext.newPage();
    await unavailable.route('**/session.php', route => route.abort('failed'));
    await unavailable.goto(preview.url);
    await unavailable.waitForFunction(() => document.querySelector('#availability').textContent.includes('temporariamente indisponível'));
    assert.equal(await unavailable.locator('#submit').isDisabled(), true);
    assert(!/encerradas/i.test(await unavailable.locator('#availability').innerText()));
    pass('unavailable API shown distinctly from closed registration deadline');
    fs.writeFileSync(path.join(__dirname, 'access-results.json'), JSON.stringify({ browser: browser.version(), checks: passed.length, passed }, null, 2));
  } finally { fs.writeFileSync(preview.config, config); await browser.close(); }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
