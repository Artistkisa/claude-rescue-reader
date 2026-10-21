import {test,expect} from '@playwright/test';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import JSZip from 'jszip';
import {conversations} from './fixtures/synthetic-export.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let fixtureDir;
test.beforeAll(async()=>{fixtureDir=await fs.mkdtemp(path.join(os.tmpdir(),'crr-offline-'));await fs.writeFile(path.join(fixtureDir,'conversations.json'),JSON.stringify(conversations));});
test.afterAll(async()=>{if(fixtureDir)await fs.rm(fixtureDir,{recursive:true,force:true});});

test('offline bundle loads all optional features without network',async({page})=>{
  const network=[];await page.route('http://**',route=>{network.push(route.request().url());return route.abort();});await page.route('https://**',route=>{network.push(route.request().url());return route.abort();});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(path.join(root,'dist','offline','viewer.html')).href);
  await page.setInputFiles('#file-input',fixtureDir);await page.waitForFunction(()=>allConvs.length===1);
  await page.locator('.conv-item').click();await page.waitForFunction(()=>messageRenderState?.total>0);
  await page.evaluate(()=>ensureMarked());await page.waitForFunction(()=>typeof marked!=='undefined');
  await page.evaluate(()=>ensureJSZip());await page.waitForFunction(()=>typeof JSZip!=='undefined');
  await page.evaluate(()=>ensureHighlight());await page.waitForFunction(()=>typeof hljs!=='undefined');await page.waitForFunction(()=>typeof mermaid!=='undefined');
  expect(await page.evaluate(()=>({marked:typeof marked,zip:typeof JSZip,highlight:typeof hljs,mermaid:typeof mermaid}))).toEqual({marked:'object',zip:'function',highlight:'object',mermaid:'object'});
  await expect(page.locator('.mermaid svg').first()).toBeVisible();
  const rendered=await page.evaluate(()=>marked.parse('# Synthetic heading\n\n<script>alert("synthetic")</script>\n\n```text\nsynthetic code\n```'));
  expect(rendered).toContain('<h1>Synthetic heading</h1>');
  expect(rendered).toContain('&lt;script&gt;');
  expect(rendered).not.toContain('<script>');
  expect(rendered).toContain('synthetic code');
  expect(await page.evaluate(()=>document.querySelector('meta[http-equiv="Content-Security-Policy"]').content)).not.toMatch(/https?:/);
  const blocked=await page.evaluate(()=>marked.parse('[blocked](javascript:window.offlineProbe=1)\n\n![remote](https://archive.example.invalid/image.png)'));
  expect(blocked).not.toContain('href="javascript:');expect(blocked).not.toContain('<img');
  const safe=await page.evaluate(async()=>{const payload={uuid:allConvs[0].uuid,style:'pseudonym',customTerms:'Synthetic'},scan=await featureRequest('task','preview',payload),exported=await featureRequest('task','export',{...payload,safe:true});return{count:scan.stats['自定义敏感词'],text:await exported.blob.text()};});expect(safe.count).toBeGreaterThan(0);expect(safe.text).not.toContain('Synthetic');expect(safe.text).toContain('[ID_');
  const contextSafe=await page.evaluate(async()=>{const payload={conversation:{name:'Synthetic',chat_messages:[{content:[{type:'text',text:'联系人：张三。\nＡＬＰＨＡＰＥＲＳＯＮ'}]}]},includeContextCandidates:true,customSimilarity:true,customTerms:['AlphaPerson'],safe:true};const scan=await featureRequest('task','preview',payload),exported=await featureRequest('task','export',payload);return{total:scan.total,complete:scan.complete,text:await exported.blob.text()};});expect(contextSafe.total).toBe(2);expect(contextSafe.complete).toBe(true);expect(contextSafe.text).not.toContain('张三');expect(contextSafe.text).not.toContain('ＡＬＰＨＡＰＥＲＳＯＮ');
  expect(await page.evaluate(()=>analyticsWorker)).toBeNull();
  await page.locator('[data-analytics-tab]').click();await page.waitForFunction(()=>analyticsExploreResult?.current.messages===5&&analyticsDrillResult?.total===1);
  await expect(page.locator('[data-analytics-comparison]')).toHaveCount(0);
  await expect(page.locator('[data-analytics-axis="average"]')).toContainText('日均移动平均');
  await expect(page.locator('[data-analytics-conversation]')).toHaveCount(1);
  await page.locator('[data-analytics-view="overview"]').click();await page.waitForFunction(()=>analyticsResult?.messages===5);
  await expect(page.locator('.word-cloud')).not.toHaveCount(0);
  const notices=await fs.readFile(path.join(root,'dist','offline','THIRD_PARTY_NOTICES.txt'),'utf8');
  for(const [dependency,label] of [['marked','marked'],['jszip','JSZip'],['@highlightjs/cdn-assets','highlight.js CDN assets'],['mermaid','Mermaid']]){
    const metadata=JSON.parse(await fs.readFile(path.join(root,'node_modules',dependency,'package.json'),'utf8'));
    expect(notices).toContain(`${label} ${metadata.version}`);
  }
  expect(network).toEqual([]);expect(errors).toEqual([]);
});

test('offline checklist and partitioned ZIP import need no network',async({page})=>{
  const network=[];await page.route(/^https?:/,route=>{network.push(route.request().url());return route.abort();});await page.goto(pathToFileURL(path.join(root,'dist','offline','viewer.html')).href);
  await page.locator('#download-page-btn').click();await expect(page.locator('.export-page')).toContainText('兼容旧版导出');
  const manifest={version:'1.0',total_files:1,data_files:[{filename:'memories.zip',category:'memories',part:0,batch_index:0,export_url:'https://claude.ai/export/synthetic/download/example'}]};await page.setInputFiles('#manifest-input',{name:'manifest.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(manifest))});await expect(page.locator('.export-package a')).toHaveAttribute('rel','noopener noreferrer');
  const archive=new JSZip();archive.file('memories/synthetic.json',JSON.stringify({memory_files:[{path:'/areas/offline.md',content:'Offline synthetic memory'}]}));await page.setInputFiles('#zip-input',{name:'memories.zip',mimeType:'application/zip',buffer:await archive.generateAsync({type:'nodebuffer'})});await page.waitForFunction(()=>exportSession.topics.length===1);await expect(page.locator('.export-status')).toContainText('已导入');
  await page.locator('.tab-btn[data-ui-value="memory"]').click();await expect(page.locator('#conv-list')).toContainText('Offline synthetic memory');expect(network).toEqual([]);
});
