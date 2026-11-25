const {chromium}=require('D:/soft/game-hub/node_modules/playwright');
const {resolve}=require('node:path');
const {pathToFileURL}=require('node:url');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
 const p=await b.newPage(),errors=[],external=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(!r.url().startsWith('file:'))external.push(r.url())});
 await p.addInitScript(()=>{window.GameHubBridge={saveFile:(name,content)=>{window.lastExport={name,content};return true}}});
 await p.goto(pathToFileURL(resolve(__dirname,'../web-dist/index.html')).href);await p.waitForFunction(()=>document.querySelector('#count').textContent==='600');await p.locator('#pause').click();
 await p.locator('#export-rule').click();const result=await p.evaluate(()=>window.lastExport);assert.ok(result.name.endsWith('.json'));const parsed=JSON.parse(result.content);assert.equal(parsed.format,'particle-life-rule');
 await p.locator('#import-rule-file').setInputFiles({name:'rule.json',mimeType:'application/json',buffer:Buffer.from(result.content)});await p.waitForFunction(()=>document.querySelector('#saved-count').textContent==='1 份收藏');
 await p.reload();assert.equal(await p.locator('#saved-count').textContent(),'1 份收藏');assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log('PASS: standalone hub entry works offline, exports via bridge, imports and persists rules');
 }finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
