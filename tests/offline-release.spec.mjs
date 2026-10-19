import {test,expect} from '@playwright/test';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
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
  await page.locator('.conv-item').click();await page.waitForFunction(()=>typeof marked!=='undefined');
  await page.evaluate(()=>ensureJSZip());await page.waitForFunction(()=>typeof JSZip!=='undefined');
  await page.waitForFunction(()=>typeof hljs!=='undefined');await page.waitForFunction(()=>typeof mermaid!=='undefined');
  expect(await page.evaluate(()=>({marked:typeof marked,zip:typeof JSZip,highlight:typeof hljs,mermaid:typeof mermaid}))).toEqual({marked:'object',zip:'function',highlight:'object',mermaid:'object'});
  await expect(page.locator('.mermaid svg').first()).toBeVisible();
  const rendered=await page.evaluate(()=>marked.parse('# Synthetic heading\n\n<script>alert("synthetic")</script>\n\n```text\nsynthetic code\n```'));
  expect(rendered).toContain('<h1>Synthetic heading</h1>');
  expect(rendered).toContain('&lt;script&gt;');
  expect(rendered).not.toContain('<script>');
  expect(rendered).toContain('synthetic code');
  expect(await page.evaluate(()=>analyticsWorker)).toBeNull();
  await page.locator('[data-analytics-tab]').click();await page.waitForFunction(()=>analyticsExploreResult?.current.messages===5&&analyticsDrillResult?.total===1);
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
