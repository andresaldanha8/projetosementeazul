// Read-only external resource check; do not repeat the registrations/payment scenario.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/Usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {base}=JSON.parse(fs.readFileSync(path.join(__dirname,'manual-preview.json')));
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});const errors=[],failed=[],consoleErrors=[],pages=[];try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}));page.on('console',m=>{if(m.type()==='error')consoleErrors.push({text:m.text(),url:m.location().url})});
 for(const pathname of ['/','/kids/?nova=1','/kids/admin/']){const response=await page.goto(base+pathname,{waitUntil:'domcontentloaded'});assert.equal(response.status(),200);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1200);pages.push({path:pathname,status:response.status()});}
 const result={base,pages,errors,failed,consoleErrors,scope:'read-only navigation; no new registrations, payments or credentials'};fs.writeFileSync(path.join(__dirname,'final-console-results.json'),JSON.stringify(result,null,2));assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(consoleErrors,[]);console.log('PASS three same-origin pages: external fonts loaded, no console errors, JS exceptions or failed requests');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
