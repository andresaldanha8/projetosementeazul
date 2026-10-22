// Local HTTP + real PHP serializer fixtures. No database reads or writes.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const read = require('./pix-reader.cjs');
const root = path.resolve(__dirname, '../..');
const fixtures = JSON.parse(execFileSync('php', [path.join(__dirname, 'lookup-pix-fixture.php')], { encoding: 'utf8' }));
for (const [mode, row] of Object.entries(fixtures)) {
  assert.deepEqual(Object.keys(row).sort(), (['pending', 'different'].includes(mode) ? ['number', 'child_name', 'registration_status', 'payment_status', 'payment'] : ['number', 'child_name', 'registration_status', 'payment_status']).sort());
  if (row.payment) {
    assert.deepEqual(Object.keys(row.payment).sort(), ['amount_cents', 'pix', 'payee', 'pix_payload', 'whatsapp_url'].sort());
    assert.equal(read(row.payment.pix_payload).amount, mode === 'different' ? '75.43' : '60.00');
    assert.equal(read(row.payment.pix_payload).key, '62090680000139');
  }
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const files = { '/kids/': 'index.html', '/kids/kids.js': 'kids.js', '/kids/lookup.js': 'lookup.js', '/kids/kids.css': 'kids.css' };
  if (!files[url.pathname]) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', url.pathname.endsWith('.js') ? 'application/javascript' : url.pathname.endsWith('.css') ? 'text/css' : 'text/html');
  res.end(fs.readFileSync(path.join(root, 'kids', files[url.pathname])));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'msedge' });
    for (const width of [1024, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 640 }, isMobile: width === 320, hasTouch: width === 320, permissions: ['clipboard-read', 'clipboard-write'] });
      const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
      let mode = 'pending', count = 0, release, started;
      const session = { ok: true, csrf_token: 'current-new-session', public_open: false, event: { name: 'KIDS', timezone: 'America/Sao_Paulo', server_now: new Date().toISOString(), closes_at: '2026-11-21T16:00:00-03:00', amount_cents: 6000, shirt_size: 'P', whatsapp: '5593984179663' } };
      await page.route('**/kids/api/**', async route => {
        const endpoint = new URL(route.request().url()).pathname.split('/').pop();
        if (endpoint === 'lookup.php') {
          count++;
          assert.equal(route.request().method(), 'POST');
          assert.equal(route.request().headers()['x-csrf-token'], session.csrf_token);
          assert.deepEqual(Object.keys(route.request().postDataJSON()).sort(), ['child_name', 'phone']);
          const current = mode;
          if (current === 'network') return route.abort('failed');
          if (current === 'delayed') { started(); await new Promise(resolve => { release = resolve; }); }
          return route.fulfill({ status: current === 'limited' ? 429 : 200, contentType: 'application/json', body: JSON.stringify(current === 'limited' ? { ok: false } : { ok: true, registration: fixtures[current === 'delayed' ? 'pending' : current] }) });
        }
        assert.ok(['session.php', 'confirmations.php'].includes(endpoint), 'no create/payment/PDF request');
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify(endpoint === 'session.php' ? session : { ok: true, registrations: [] }) });
      });
      await page.goto(`http://127.0.0.1:${server.address().port}/kids/`);
      await page.locator('#lookup-open').click();
      await page.locator('#lookup-name').fill('Criança Teste');
      await page.locator('#lookup-phone').fill('11900000000');
      const search = async next => {
        if (await page.locator('#lookup-new').isVisible()) await page.locator('#lookup-new').click();
        mode = next; await page.locator('#lookup-submit').click(); await page.waitForFunction(() => !document.querySelector('#lookup-submit').disabled);
      };
      const payment = page.locator('#lookup-payment-options');
      await search('pending');
      assert.equal(await page.locator('#lookup-child-name').innerText(), fixtures.pending.child_name);
      assert.equal(await page.locator('#lookup-number').innerText(), fixtures.pending.number);
      assert.equal(await page.locator('#lookup-form').isVisible(), false);
      assert.equal(await page.locator('#lookup-result').evaluate(el => document.activeElement === el), true);
      if (width > 320) assert.ok(await page.locator('#lookup-dialog').evaluate(el => el.scrollHeight <= el.clientHeight + 1), 'compact result fits desktop viewport');
      assert.ok(await page.locator('#lookup-dialog').evaluate(el => el.getBoundingClientRect().height <= innerHeight), 'result fits mobile viewport with scrolling if needed');
      assert.equal(await page.locator('#lookup-payment').innerText(), 'Pagamento pendente');
      assert.ok((await payment.innerText()).includes('62.090.680/0001-39'));
      assert.ok((await payment.innerText()).includes('Associação Projeto Semente Azul'));
      const copy = payment.getByRole('button', { name: 'Copiar PIX de R$ 60,00' });
      await copy.click();
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), fixtures.pending.payment.pix_payload);
      assert.equal(await page.locator('#lookup-payment').innerText(), 'Pagamento pendente');
      const link = new URL(await payment.getByRole('link').getAttribute('href'));
      assert.equal(link.pathname, '/5593984179663');
      assert.match(link.searchParams.get('text'), /Criança Teste.*1007.*R\$ 60,00/);
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }));
      await copy.click();
      const manual = payment.locator('textarea');
      assert.equal(await manual.inputValue(), fixtures.pending.payment.pix_payload);
      assert.equal(await manual.evaluate(el => el.selectionEnd - el.selectionStart), fixtures.pending.payment.pix_payload.length);
      assert.ok(await page.locator('#lookup-dialog').evaluate(el => el.scrollWidth <= el.clientWidth), 'dialog has no horizontal overflow');
      assert.ok(await page.locator('#lookup-dialog').evaluate(el => el.getBoundingClientRect().height <= innerHeight), 'dialog fits viewport');
      await page.setViewportSize({ width, height: 300 });
      assert.ok(await page.locator('#lookup-dialog').evaluate(el => el.scrollHeight > el.clientHeight), 'internal scrolling on short viewport');
      assert.ok(await page.locator('#lookup-dialog').evaluate(el => el.getBoundingClientRect().height <= innerHeight), 'short viewport fits');
      await page.setViewportSize({ width, height: 640 });
      await page.locator('#lookup-new').click();
      assert.equal(await page.locator('#lookup-child-name').innerText(), '');
      assert.equal(await page.locator('#lookup-number').innerText(), '');
      assert.equal(await page.locator('#lookup-name').inputValue(), 'Criança Teste');
      assert.equal(await page.locator('#lookup-phone').inputValue(), '11900000000');
      assert.equal(await page.locator('#lookup-name').evaluate(el => document.activeElement === el), true);
      assert.equal(await payment.innerHTML(), '');
      await page.locator('#lookup-name').fill('Outra Criança');
      assert.equal(await payment.innerHTML(), '');
      assert.equal(await page.locator('#lookup-result').isVisible(), false);
      await search('different');
      assert.equal(await page.locator('#lookup-number').innerText(), '1008');
      assert.equal(await page.locator('#lookup-child-name').innerText(), fixtures.different.child_name);
      await payment.getByRole('button', { name: 'Copiar PIX de R$ 75,43' }).click();
      assert.equal(await payment.locator('textarea').inputValue(), fixtures.different.payment.pix_payload);
      assert.match(new URL(await payment.getByRole('link').getAttribute('href')).searchParams.get('text'), /Outra Criança.*1008.*R\$ 75,43/);
      for (const state of ['paid', 'cancelled']) {
        await search(state); assert.equal(await payment.innerHTML(), ''); assert.equal(await page.locator('#lookup-result').isVisible(), true);
        assert.equal(await page.locator('#lookup-child-name').innerText(), fixtures[state].child_name);
        assert.equal(await page.locator('#lookup-number').innerText(), fixtures[state].number);
        assert.ok(await page.locator('#lookup-child-name').evaluate(el => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight), 'complete name wraps without clipping');
        assert.ok(await page.locator('#lookup-dialog').evaluate(el => el.scrollWidth <= el.clientWidth), 'long name stays inside modal');
      }
      for (const state of ['network', 'limited']) {
        await search('pending'); await search(state);
        assert.equal(await payment.innerHTML(), ''); assert.equal(await page.locator('#lookup-result').isVisible(), false);
        assert.equal(await page.locator('#lookup-message').isVisible(), true);
      }
      mode = 'delayed'; const waiting = new Promise(resolve => { started = resolve; });
      await page.locator('#lookup-submit').click(); await waiting;
      await page.locator('#lookup-name').fill('Busca modificada'); release();
      await search('paid');
      assert.equal(await payment.innerHTML(), '');
      assert.equal(await page.locator('#lookup-payment').innerText(), 'Pagamento confirmado');
      const before = count;
      await page.locator('#lookup-new').click();
      await page.locator('#lookup-phone').fill('12'); await page.locator('#lookup-submit').click();
      assert.equal(count, before); assert.equal(await payment.innerHTML(), '');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#lookup-dialog').open);
      assert.equal(await page.locator('#lookup-open').evaluate(el => el === document.activeElement), true);
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS lookup ${width}px: pending/paid/cancelled, persisted amount, clipboard/manual, new search, network/429, stale response, validation, privacy and layout`);
    }
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
