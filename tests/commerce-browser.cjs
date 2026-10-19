// Servir o checkout na porta 8010. Usa uma API simulada; não toca no Supabase remoto.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/assets/js/app.js*',r=>r.fulfill({contentType:'text/javascript',body:''}));
 await page.route('**/assets/js/core/supabase-client.js',r=>r.fulfill({contentType:'text/javascript',body:`
 const products=[{id:'p',area:'papelaria',name:'Caderno <teste>',unit_price:25,stock:6},{id:'g',area:'gelinhos',name:'Kbom manga',unit_price:10,stock:0}];
 const moves=[{id:'s',product_id:'p',kind:'sale',quantity:4,total_amount:100,amount_paid:40,customer_name:'Cliente',movement_date:'2026-10-19',notes:''}];
 export const supabase={from(table){let area,ids;const q={select(){return q},eq(k,v){area=v;return q},in(k,v){ids=v;return q},order(){return q},range(){return q},then(resolve){resolve({data:table==='retail_stock'?products.filter(p=>p.area===area):moves.filter(m=>ids.includes(m.product_id))})}};return q},async rpc(name,args){window.lastRpc={name,args};return {error:null}}};
 `}));
 await page.goto('http://127.0.0.1:8010');
 await page.evaluate(async()=>{document.querySelector('#auth-view').hidden=true;document.querySelector('#app-view').hidden=false;const {renderRetail}=await import('/assets/js/pages/comercio.js');await renderRetail('papelaria')});
 assert.match(await page.locator('#page-content').innerText(),/40.00 MZN/);assert.match(await page.locator('#page-content').innerText(),/60.00 MZN/);
 assert.equal(await page.locator('#retail-sale-fields').isVisible(),false);
 await page.locator('[name=product_id]').selectOption('p');await page.locator('[name=kind]').selectOption('sale');
 assert.equal(await page.locator('#retail-sale-fields').isVisible(),true);
 assert.equal(await page.locator('[name=price]').inputValue(),'25');
 await page.locator('[name=quantity]').fill('2');await page.locator('[name=customer]').fill('Maria');await page.locator('[name=paid]').fill('20');
 await page.locator('#retail-movement button').click();await page.waitForFunction(()=>window.lastRpc);
 const call=await page.evaluate(()=>window.lastRpc);assert.equal(call.name,'register_retail_movement');assert.equal(call.args.p_paid,20);assert.equal(call.args.p_quantity,2);
 await page.evaluate(async()=>{const {renderRetail}=await import('/assets/js/pages/comercio.js');await renderRetail('gelinhos')});
 assert.match(await page.locator('#page-content').innerText(),/Kbom manga/);assert.doesNotMatch(await page.locator('#page-content').innerText(),/Caderno/);
 assert.deepEqual(errors,[]);console.log('PASS: renderização das duas áreas, valores recebidos/pendentes e formulário de venda no Chromium (API simulada).');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
