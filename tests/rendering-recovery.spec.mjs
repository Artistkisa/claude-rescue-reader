import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import http from 'node:http';

const root=path.resolve(import.meta.dirname,'..');
let server,origin;
test.beforeAll(async()=>{
  server=http.createServer(async(req,res)=>{res.setHeader('Content-Type','text/html');res.end(await fs.readFile(path.join(root,'viewer.html')));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
});
test.afterAll(async()=>{await new Promise(resolve=>server.close(resolve));});

for(const mode of ['file','http'])test(mode+' viewer keeps imported rendering inert and remote images local',async({page})=>{
  const requests=[];await page.route('https://archive.example.invalid/**',route=>{requests.push(route.request().url());return route.abort();});
  await page.goto(mode==='file'?pathToFileURL(path.join(root,'viewer.html')).href:origin);
  expect(await page.evaluate(()=>ensureMarked())).toBe(true);
  await page.evaluate(()=>{
    const text='```text"<img/src=x/onerror=window.renderProbe=1> extra\ncode <tag>\n```\n\n[x](javascript:window.renderProbe=2)\n\n<javascript:window.renderProbe=3>\n\n![outside](https://archive.example.invalid/image.png)\n\n[safe](https://example.invalid/path?q=1 "a quote")';
    document.getElementById('messages').innerHTML=renderMd(text)+renderBlock({type:'rich_link',url:'javascript:window.renderProbe=4',title:'inert'})+renderBlock({type:'knowledge',url:'https://example.invalid/" onmouseover="window.renderProbe=5',title:'quoted'});
    allDesigns=[{uuid:'design" onmouseover="window.renderProbe=6',name:'quoted',chat_messages:[]}];renderDesignList();
  });
  const state=await page.evaluate(()=>({probe:window.renderProbe,events:[...document.querySelectorAll('#messages *,#conv-list *')].flatMap(el=>[...el.attributes].filter(a=>a.name.startsWith('on')).map(a=>a.name)),links:[...document.querySelectorAll('#messages a')].map(a=>a.getAttribute('href')),images:[...document.querySelectorAll('#messages img')].map(el=>el.src),uuid:document.querySelector('[data-design-uuid]').dataset.designUuid}));
  expect(state.probe).toBeUndefined();expect(state.events).toEqual([]);expect(state.links.every(url=>url.startsWith('https:'))).toBe(true);expect(state.images).toEqual([]);expect(state.uuid).toBe('design" onmouseover="window.renderProbe=6');expect(requests).toEqual([]);
  await expect(page.locator('.code-lang')).toHaveText('text"<img/src=x/onerror=window.renderProbe=1>');
  await page.locator('#theme-btn').click();expect(await page.evaluate(()=>document.documentElement.dataset.theme)).toBe('dark');
  await page.evaluate(()=>{const script=document.createElement('script');script.textContent='window.cspProbe=1';document.body.appendChild(script);const img=document.createElement('img');img.setAttribute('onerror','window.cspProbe=2');img.src='data:image/png;base64,broken';document.body.appendChild(img);});
  await page.waitForTimeout(100);expect(await page.evaluate(()=>window.cspProbe)).toBeUndefined();
});

test('optional dependency failure can retry, shares concurrent attempts and enforces integrity',async({page})=>{
  let fail=true,requests=0;
  const bytes=await fs.readFile(path.join(root,'node_modules/jszip/dist/jszip.min.js'));
  await page.route(/https:\/\/(?:cdn\.jsdelivr\.net|unpkg\.com)\/(?:npm\/)?jszip@/,async route=>{requests++;if(fail)await route.abort();else await route.fulfill({body:bytes,contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});});
  await page.goto(origin);
  expect(await page.evaluate(()=>Promise.all([ensureJSZip(),ensureJSZip()]))).toEqual([false,false]);expect(requests).toBe(2);
  fail=false;expect(await page.evaluate(()=>ensureJSZip())).toBe(true);expect(requests).toBe(3);
  expect(await page.evaluate(()=>document.querySelector('script[src*="jszip"]').integrity)).toMatch(/^sha384-/);
});

test('ZIP selection recovers in the same page and falls back to the second CDN',async({page})=>{
  let offline=true,attempts=0;const bytes=await fs.readFile(path.join(root,'node_modules/jszip/dist/jszip.min.js'));
  await page.route(/https:\/\/(?:cdn\.jsdelivr\.net|unpkg\.com)\/(?:npm\/)?jszip@/,route=>{
    attempts++;return offline||route.request().url().includes('jsdelivr')?route.abort():route.fulfill({body:bytes,contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});
  });
  await page.goto(origin);const zip=path.join(root,'docs/demo/claude-rescue-reader-synthetic-demo.zip');
  await page.setInputFiles('#zip-input',zip);await expect(page.locator('#load-zip-btn')).toContainText('重试');expect(attempts).toBe(2);
  offline=false;await page.setInputFiles('#zip-input',zip);await page.waitForFunction(()=>allConvs.length===40);expect(attempts).toBe(4);
});

test('tampered optional scripts fail integrity and can recover without refresh',async({page})=>{
  let tampered=true;const bytes=await fs.readFile(path.join(root,'node_modules/jszip/dist/jszip.min.js'));
  await page.route(/https:\/\/(?:cdn\.jsdelivr\.net|unpkg\.com)\/(?:npm\/)?jszip@/,route=>route.fulfill({body:tampered?'window.sriProbe=1;':bytes,contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}}));
  await page.goto(origin);expect(await page.evaluate(()=>ensureJSZip())).toBe(false);expect(await page.evaluate(()=>window.sriProbe)).toBeUndefined();
  tampered=false;expect(await page.evaluate(()=>ensureJSZip())).toBe(true);
});

for(const mode of ['file','http'])test(mode+' artifact scripts stay interactive inside an opaque sandbox without network',async({page})=>{
  const network=[];await page.route('https://archive.example.invalid/**',route=>{network.push(route.request().url());return route.abort();});
  await page.route('https://cdn.jsdelivr.net/blocked-artifact-probe.js',route=>{network.push(route.request().url());return route.abort();});
  await page.goto(mode==='file'?pathToFileURL(path.join(root,'viewer.html')).href:origin);
  await page.evaluate(()=>{
    document.getElementById('messages').innerHTML=renderVisual({kind:'html',title:'Local preview',code:'<button id="inside" onclick="this.textContent=\'clicked\'">ready</button><script>try{parent.document.title="escaped"}catch{document.body.dataset.isolated="true"}document.body.dataset.ran="true";fetch("https://archive.example.invalid/collect").catch(()=>{});const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/blocked-artifact-probe.js";document.head.appendChild(s);<\/script>'});
    activateVisualFrame(document.querySelector('iframe'));
  });
  const frame=page.frameLocator('iframe');await expect(frame.locator('body')).toHaveAttribute('data-ran','true');await expect(frame.locator('body')).toHaveAttribute('data-isolated','true');
  await frame.locator('#inside').click();await expect(frame.locator('#inside')).toHaveText('clicked');expect(await page.title()).not.toBe('escaped');expect(network).toEqual([]);
});

test('generated HTML files preview in the sandbox and still download their source',async({page})=>{
  await page.goto(origin);
  await page.evaluate(()=>{
    document.getElementById('messages').innerHTML=renderFileCards([{name:'synthetic.html',content:'<button id="local" onclick="this.textContent=\'done\'">ready</button>'}]);
    activateVisualFrame(document.querySelector('iframe'));
  });
  await page.locator('.files > details > summary').click();const frame=page.frameLocator('iframe');await frame.locator('#local').click();await expect(frame.locator('#local')).toHaveText('done');
  expect(await page.locator('.files .fbtns a[target="_blank"]').count()).toBe(0);
  const download=page.waitForEvent('download');await page.locator('.files .fbtns a[download]').click();expect((await download).suggestedFilename()).toBe('synthetic.html');
});
