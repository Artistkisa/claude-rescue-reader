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
  expect(network).toEqual([]);expect(errors).toEqual([]);
});
