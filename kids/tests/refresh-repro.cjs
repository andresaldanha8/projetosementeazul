// Historical reproduction against the pre-fix build and fresh fixture.
// These assertions describe the former bugs; use admin-flow.cjs for current regression.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/Usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const p=JSON.parse(fs.readFileSync(path.join(__dirname,'flow-preview.json'))),base=new URL(p.home_url).origin;
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const page=await browser.newPage();await page.goto(p.admin_url);await page.getByLabel('Usuário',{exact:true}).fill('admin.teste');await page.getByLabel('Senha',{exact:true}).fill('KidsTeste!2026');await page.getByRole('button',{name:'Entrar',exact:true}).click();
 const ready=async()=>{await page.waitForTimeout(350);await page.waitForFunction(()=>document.querySelector('#kids-results')?.getAttribute('aria-busy')==='false')};await ready();
 await page.route('**/kids/admin/api/registrations.php',route=>route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({sucesso:false,mensagem:'Falha simulada de atualização'})}));
 await page.getByRole('button',{name:'Atualizar',exact:true}).click();await ready();
 const rowsAfterFailure=await page.locator('tbody tr').count();
 await page.unroute('**/kids/admin/api/registrations.php');await page.getByRole('button',{name:'Atualizar',exact:true}).click();await ready();
 const staleErrorAfterSuccess=await page.getByRole('alert').allTextContents();
 await page.getByLabel('Pagamento',{exact:true}).selectOption('PENDENTE');await page.getByLabel('Inscrições por página').selectOption('10');await ready();
 await page.getByRole('button',{name:'Próxima',exact:true}).click();await ready();await page.getByRole('button',{name:'Próxima',exact:true}).click();await ready();
 execFileSync('C:/xampp/php/php.exe',[p.control,'shrink']);
 await page.getByRole('button',{name:'Atualizar',exact:true}).click();await ready();
 const pagination=await page.getByText(/inscrições encontradas · Página/).innerText();
 const report={rowsAfterFailure,staleErrorAfterSuccess,pagination,preview:base};
 assert.ok(rowsAfterFailure>0);assert.ok(staleErrorAfterSuccess.length>0);assert.match(pagination,/Página 3 de 1/);
 fs.writeFileSync(path.join(__dirname,'refresh-before-results.json'),JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
