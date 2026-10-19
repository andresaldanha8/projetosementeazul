// Exercise automatic app return; no public refresh control or application test bypass.
const installed = new WeakSet();
module.exports = async function resume(page) {
  if (!installed.has(page)) { await page.clock.install(); installed.add(page); }
  await page.clock.fastForward(16001);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await page.clock.runFor(250);
};
