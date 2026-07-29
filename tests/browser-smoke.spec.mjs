import {test,expect} from '@playwright/test';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import JSZip from 'jszip';
import {conversations,memories,projects,design} from './fixtures/synthetic-export.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let fixtureDir,zipPath;

test.beforeAll(async()=>{
  fixtureDir=await fs.mkdtemp(path.join(os.tmpdir(),'crr-synthetic-'));
  await fs.mkdir(path.join(fixtureDir,'projects'));
  await fs.writeFile(path.join(fixtureDir,'conversations.json'),JSON.stringify(conversations));
  await fs.writeFile(path.join(fixtureDir,'memories.json'),JSON.stringify(memories));
  await fs.writeFile(path.join(fixtureDir,'projects','synthetic-project.json'),JSON.stringify(projects[0]));
  await fs.writeFile(path.join(fixtureDir,'synthetic-design.json'),JSON.stringify(design));
  const zip=new JSZip();zip.file('claude-export/conversations.json',JSON.stringify(conversations));zip.file('claude-export/memories.json',JSON.stringify(memories));zip.file('claude-export/projects/synthetic-project.json',JSON.stringify(projects[0]));zip.file('claude-export/synthetic-design.json',JSON.stringify(design));
  zipPath=path.join(fixtureDir,'synthetic-export.zip');await fs.writeFile(zipPath,await zip.generateAsync({type:'nodebuffer'}));
});
test.afterAll(async()=>{if(fixtureDir)await fs.rm(fixtureDir,{recursive:true,force:true});});

async function openViewer(page){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(pathToFileURL(path.join(root,'viewer.html')).href);
  return errors;
}
async function waitLoaded(page){await page.waitForFunction(()=>allConvs.length===1&&allDesigns.length===1);}

test('folder import and core views',async({page})=>{
  const errors=await openViewer(page);await page.setInputFiles('#file-input',fixtureDir);await waitLoaded(page);
  await page.locator('.conv-item').first().click();await expect(page.locator('#chat-title')).toContainText('Synthetic');
  await expect(page.locator('#messages')).toContainText('synthetic widget');
  await page.locator('#tree-mode-btn').click();await expect(page.locator('#tree-mode-btn')).toContainText(/完整|Full/);
  await page.locator('.tab-btn').nth(4).click();await page.waitForFunction(()=>document.querySelector('.word-cloud'));
  const custom=path.join(fixtureDir,'synthetic-stopwords.txt');await fs.writeFile(custom,'nebula\nobservatory');await page.setInputFiles('#custom-stopwords-input',custom);await page.waitForFunction(()=>analyticsCustomStopZh.length===2);
  expect(errors).toEqual([]);
});

test('ZIP import',async({page})=>{const errors=await openViewer(page);await page.setInputFiles('#zip-input',zipPath);await waitLoaded(page);expect(errors).toEqual([]);});

test('project association explanations, local corrections, search, stats and export',async({page})=>{
  const errors=await openViewer(page);await page.setInputFiles('#file-input',fixtureDir);await waitLoaded(page);
  await page.locator('.tab-btn[onclick*="projects"]').click();await page.waitForFunction(()=>convProjectMapReady);
  await page.locator('.proj-card').first().click();
  await expect(page.locator('.match-panel')).toContainText(/\d+%/);
  await expect(page.locator('.match-panel')).toContainText('synthetic-blueprint.md');
  await expect(page.locator('.project-graph')).toContainText(/syntheticnebula/i);
  await expect(page.locator('.project-stat').first()).toContainText('1');
  await page.locator('.project-tools input').fill('not-present');await expect(page.locator('[data-project-conv]')).toBeHidden();
  await page.locator('.project-tools input').fill('widget');await expect(page.locator('[data-project-conv]')).toBeVisible();
  const assignment=page.locator('[data-project-conv] .project-assign');await assignment.selectOption('');
  await expect(page.locator('[data-project-conv]')).toHaveCount(0);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('claude-rescue-reader-project-overrides-v1'))['00000000-0000-4000-8000-000000000101'])).toBeNull();
  await page.locator('details summary').click();
  await page.locator('details .project-assign').first().selectOption('00000000-0000-4000-8000-000000000301');
  await expect(page.locator('[data-project-conv]')).toHaveCount(1);
  const downloadPromise=page.waitForEvent('download');await page.locator('.project-tools button').click();const download=await downloadPromise;expect(download.suggestedFilename()).toMatch(/\.md$/);const markdown=await fs.readFile(await download.path(),'utf8');expect(markdown).toContain('Synthetic Project');expect(markdown).toContain('Synthetic branching conversation');
  expect(errors).toEqual([]);
});

test('keyword-only project inference keeps evidence generation in scope',async({page})=>{
  const errors=await openViewer(page);await page.setInputFiles('#file-input',fixtureDir);await waitLoaded(page);
  const result=await page.evaluate(async()=>{
    const original=allConvs;
    allConvs=[{uuid:'00000000-0000-4000-8000-000000000199',name:'Synthetic Project SyntheticNebula',summary:'SyntheticNebula memory match',chat_messages:[]}];
    try{return await buildConvProjectMap(projectMapGeneration);}finally{allConvs=original;}
  });
  expect(result.map['00000000-0000-4000-8000-000000000199']).toBe('00000000-0000-4000-8000-000000000301');
  expect(result.evidence['00000000-0000-4000-8000-000000000199'].method).toBe('keyword');
  expect(errors).toEqual([]);
});

test('drag import and safe exports',async({page})=>{
  const errors=await openViewer(page);
  await page.evaluate(payload=>{const file=new File([payload],'conversations.json',{type:'application/json'});routeDroppedFiles([file]);},JSON.stringify(conversations));
  await page.waitForFunction(()=>allConvs.length===1);await page.locator('.conv-item').first().click();
  await page.locator('#export-btn').click();page.once('dialog',d=>d.accept());const downloadPromise=page.waitForEvent('download');await page.locator('#export-menu button').nth(1).click();
  const download=await downloadPromise;expect(await download.suggestedFilename()).toMatch(/\.md$/);
  expect(errors).toEqual([]);
});
