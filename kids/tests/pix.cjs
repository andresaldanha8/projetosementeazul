// Browser regression with local static files and simulated APIs only. No database access.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '../..');
const readPix = require('./pix-reader.cjs');
const fixtures = JSON.parse(execFileSync('php', [path.join(__dirname, 'pix-fixture.php')], { encoding: 'utf8' }));
for (const fixture of fixtures) {
  const parsed = readPix(fixture.pix_payload);
  assert.equal(parsed.key, '62090680000139');
  assert.equal(parsed.amount, (fixture.amount_cents / 100).toFixed(2));
  assert.equal(parsed.name, 'ASSOC PROJ SEMENTE AZUL');
  assert.equal(parsed.city, 'VITORIA XINGU');
  assert.throws(() => readPix(fixture.pix_payload.slice(0, -1) + (fixture.pix_payload.endsWith('0') ? '1' : '0')));
}
console.log('PASS independent TLV/CRC reader: BCB reference, persisted amounts, CNPJ, ASCII name/city, corrupt CRC rejected');
const config = JSON.parse(execFileSync('php', ['-r', "require 'kids/api/config.php'; echo json_encode(kids_config());"], { cwd: root, encoding: 'utf8' }));
assert.equal(config.pix, '62.090.680/0001-39');
assert.equal(config.payee, 'Associação Projeto Semente Azul');
assert.equal(config.amount_cents, 6000);
assert.equal(config.whatsapp, '5593984179663');
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const files = { '/kids/': 'kids/index.html', '/kids/kids.js': 'kids/kids.js', '/kids/lookup.js': 'kids/lookup.js', '/kids/kids.css': 'kids/kids.css' };
  if (!files[pathname]) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', pathname.endsWith('.js') ? 'application/javascript' : pathname.endsWith('.css') ? 'text/css' : 'text/html');
  res.end(fs.readFileSync(path.join(root, files[pathname])));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'msedge' });
    for (const mode of ['new', 'recovered', 'retry', 'mobile']) {
      const mobile = mode === 'mobile';
      const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'], ...(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {}) });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      let submitted = mode === 'recovered' || mobile;
      let paid = false;
      const row = fixtures[mobile ? 1 : 0];
      const expectedButton = mobile ? 'Copiar PIX de R$ 75,43' : 'Copiar PIX de R$ 60,00';
      await page.route('**/kids/api/**', async route => {
        const endpoint = new URL(route.request().url()).pathname.split('/').pop();
        let data;
        if (endpoint === 'session.php') data = {
          ok: true, csrf_token: 'test', session_generation: 'test', public_open: true,
          declaration_version: config.declaration_version, declaration_text: config.declaration_text,
          image_authorization_version: config.image_authorization_version, image_authorization_text: config.image_authorization_text,
          event: { ...config, server_now: '2026-10-19T12:00:00-03:00', closes_at: '2026-11-21T16:00:00-03:00' }
        };
        else if (endpoint === 'confirmations.php') data = { ok: true, registrations: submitted ? [{ ...row, payment_status: paid ? 'CONFIRMADO' : 'PENDENTE' }] : [], pending_reference: mode === 'retry' && submitted ? row.reference : null };
        else if (endpoint === 'create.php') {
          submitted = true;
          if (mode === 'retry') return route.abort('failed');
          data = { ok: true, registration: row };
        } else throw new Error('Unexpected API: ' + endpoint);
        await route.fulfill({ status: endpoint === 'create.php' ? 201 : 200, contentType: 'application/json', body: JSON.stringify(data) });
      });
      await page.goto(`http://127.0.0.1:${server.address().port}/kids/`);
      if (!submitted) {
        await page.waitForFunction(() => !document.querySelector('#submit').disabled);
        for (const [id, value] of Object.entries({ child_name: row.child_name, birth_date: '2017-10-17', guardian_name: 'Responsável Teste', relationship: 'Mãe', phone: '11900000000' })) await page.locator('#' + id).fill(value);
        await page.locator('#division').selectOption('F');
        await page.locator('#accepted').check();
        await page.locator('#submit').click();
      }
      await page.locator('.kids-pix').waitFor({ state: 'visible' });
      assert.equal(await page.locator('.kids-pix').innerText(), config.pix);
      assert.ok((await page.locator('.kids-payment').innerText()).includes('Favorecido: ' + config.payee));
      assert.ok((await page.locator('.kids-payment').innerText()).replace(/\u00a0/g, ' ').includes(expectedButton));
      assert.equal(new URL(await page.locator('.kids-payment-link').getAttribute('href')).pathname, '/' + config.whatsapp);
      await page.getByRole('button', { name: expectedButton }).click();
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), row.pix_payload);
      assert.equal(await page.locator('.kids-payment-status').getAttribute('data-status'), 'PENDENTE');
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } }));
      await page.getByRole('button', { name: expectedButton }).click();
      assert.equal(await page.locator('.kids-manual').inputValue(), row.pix_payload);
      assert.equal(await page.locator('.kids-manual').isVisible(), true);
      assert.equal(await page.locator('.kids-manual').evaluate(el => el.selectionEnd - el.selectionStart), row.pix_payload.length);
      if (mobile) assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');
      paid = true;
      await page.reload();
      await page.waitForFunction(() => document.querySelector('.kids-payment-status')?.dataset.status === 'CONFIRMADO');
      assert.equal(await page.locator('.kids-payment').count(), 0);
      assert.deepEqual(errors, []);
      console.log(`PASS ${mode}: CNPJ/payee, amount-specific BR Code clipboard/fallback, WhatsApp, pending/paid state`);
      await context.close();
    }
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
