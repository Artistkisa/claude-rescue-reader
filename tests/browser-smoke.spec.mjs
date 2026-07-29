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
  const preview='<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="120" height="60" fill="#6b5cff"/><text x="10" y="35" fill="white">Synthetic</text></svg>';
  await fs.writeFile(path.join(fixtureDir,'synthetic-preview.svg'),preview);
  const zip=new JSZip();zip.file('claude-export/conversations.json',JSON.stringify(conversations));zip.file('claude-export/memories.json',JSON.stringify(memories));zip.file('claude-export/projects/synthetic-project.json',JSON.stringify(projects[0]));zip.file('claude-export/synthetic-design.json',JSON.stringify(design));
  zip.file('claude-export/assets/synthetic-preview.svg',preview);
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
  const lazyBefore=await page.evaluate(async()=>({metadataOnly:allConvs.every(c=>c._workerBacked&&!Object.prototype.hasOwnProperty.call(c,'chat_messages')),worker:await dataWorkerRequest('debugState')}));
  expect(lazyBefore.metadataOnly).toBe(true);expect(lazyBefore.worker.parsed).toBe(0);
  await page.locator('#search-fulltext').check();await page.locator('#search-box').fill('alternative synthetic answer');await expect(page.locator('.conv-item')).toHaveCount(1);
  await page.locator('#search-box').fill('worker-search-no-match');await expect(page.locator('.conv-item')).toHaveCount(0);await page.locator('#search-box').fill('');await expect(page.locator('.conv-item')).toHaveCount(1);
  await page.locator('.conv-item').first().click();await expect(page.locator('#chat-title')).toContainText('Synthetic');
  await expect(page.locator('#messages')).toContainText('synthetic widget');
  await expect(page.locator('[data-attachment-media] img')).toBeVisible();
  await expect(page.locator('[data-attachment-media]')).toContainText(/自动匹配|Automatically matched/);
  const chooserPromise=page.waitForEvent('filechooser');await page.locator('[data-attachment-media] button').click();const chooser=await chooserPromise;await chooser.setFiles(path.join(fixtureDir,'synthetic-preview.svg'));
  await expect(page.locator('[data-attachment-media]')).toContainText(/手动绑定|Manually attached/);
  expect(await page.evaluate(async()=>{const html=await preparePdfConversation(currentConv);return /attachment-preview[\s\S]*blob:/i.test(html);})).toBe(true);
  await page.locator('#tree-mode-btn').click();await expect(page.locator('#tree-mode-btn')).toContainText(/完整|Full/);
  await page.locator('.tab-btn').nth(4).click();await page.waitForFunction(()=>document.querySelector('.word-cloud'));
  await expect(page.locator('#messages')).toContainText(/你的 Claude 使用画像|Your Claude usage profile/);
  await expect(page.locator('#messages')).toContainText('project_knowledge_search');
  await expect(page.locator('#messages')).toContainText('Synthetic branching conversation');
  const custom=path.join(fixtureDir,'synthetic-stopwords.txt');await fs.writeFile(custom,'nebula\nobservatory');await page.setInputFiles('#custom-stopwords-input',custom);await page.waitForFunction(()=>analyticsCustomStopZh.length===2);
  expect(errors).toEqual([]);
});

test('ZIP import',async({page})=>{const errors=await openViewer(page);await page.setInputFiles('#zip-input',zipPath);await waitLoaded(page);await page.locator('.conv-item').first().click();await expect(page.locator('[data-attachment-media] img')).toBeVisible();expect(errors).toEqual([]);});

test('Claude behavior lab audits tools, hidden results and thinking integrity',async({page})=>{
  const errors=await openViewer(page);await page.setInputFiles('#file-input',fixtureDir);await waitLoaded(page);
  await page.locator('.tab-btn[onclick*="behavior"]').click();await page.waitForFunction(()=>behaviorResult!==null,{timeout:15_000});
  await expect(page.locator('#messages')).toContainText('工具调用时间线');
  await expect(page.locator('#messages')).toContainText('隐藏结果探针');
  await expect(page.locator('#messages')).toContainText('Thinking 完整性');
  const result=await page.evaluate(()=>behaviorResult);
  expect(result).toMatchObject({tools:2,toolResults:1,paired:1,unpairedUse:1,approvals:1,mcp:1,structured:1,hiddenResults:1,thinking:1,thinkingTruncated:1,thinkingSigned:1});
  expect(errors).toEqual([]);
});

test('project association explanations, local corrections, search, stats and export',async({page})=>{
  const errors=await openViewer(page);await page.setInputFiles('#file-input',fixtureDir);await waitLoaded(page);
  await page.locator('.tab-btn[onclick*="projects"]').click();await page.waitForFunction(()=>convProjectMapReady);
  await page.locator('.proj-card').first().click();
  await expect(page.locator('.project-prompt')).toContainText('Always use synthetic evidence');
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
  expect(await page.evaluate(()=>projectDownloadName(allProjects[0].docs[0].filename))).toBe('synthetic-blueprint.md');
  const docDownloadPromise=page.waitForEvent('download');await page.locator('.project-doc-head button').click();const docDownload=await docDownloadPromise;expect(docDownload.suggestedFilename()).toBe('synthetic-blueprint.md');expect(await fs.readFile(await docDownload.path(),'utf8')).toContain('Widget observatory');
  expect(errors).toEqual([]);
});

test('optional libraries stay off the initial path and load by feature',async({page})=>{
  const errors=await openViewer(page);
  expect(await page.evaluate(()=>performance.getEntriesByType('resource').filter(entry=>/marked|highlight|jszip|mermaid/i.test(entry.name)).map(entry=>entry.name))).toEqual([]);
  await page.setInputFiles('#file-input',fixtureDir);await waitLoaded(page);
  expect(await page.evaluate(()=>performance.getEntriesByType('resource').some(entry=>/jszip/i.test(entry.name)))).toBe(false);
  await page.locator('.conv-item').first().click();await expect(page.locator('#messages')).toContainText('synthetic widget');
  expect(await page.evaluate(()=>typeof marked!=='undefined')).toBe(true);
  await page.waitForFunction(()=>typeof hljs!=='undefined'&&typeof mermaid!=='undefined');
  await page.waitForFunction(()=>document.querySelector('.mermaid svg'));
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

test('persistent data worker accepts transferable chunks and returns metadata first',async({page})=>{
  const errors=await openViewer(page);
  const payload=JSON.stringify(conversations);
  const result=await page.evaluate(async({text,projectData,memoryData})=>{
    const generation=nextDataWorkerGeneration();
    const file=new File([text],'conversations.json',{type:'application/json'});
    const metadata=await streamConversationFileToWorker(file,generation,37);
    const before=await dataWorkerRequest('debugState',null,[],generation);
    const full=await dataWorkerRequest('getConversation',{uuid:metadata.conversations[0].uuid},[],generation);
    const after=await dataWorkerRequest('debugState',null,[],generation);
    const search=await dataWorkerRequest('search',{query:'synthetic widget'},[],generation);
    const analytics=await dataWorkerRequest('analytics',{customStopZh:[]},[],generation);
    const projectIndex=await dataWorkerRequest('projectIndex',{projects:projectData,memoryData},[],generation);
    return{metadata:metadata.conversations[0],fullMessages:full.chat_messages.length,search,before,after,analytics,projectIndex};
  },{text:payload,projectData:projects,memoryData:memories});
  expect(result.metadata._workerBacked).toBe(true);
  expect(result.metadata).not.toHaveProperty('chat_messages');
  expect(result.before).toMatchObject({records:1,parsed:0,lazy:true});
  expect(result.fullMessages).toBeGreaterThan(0);
  expect(result.after.parsed).toBe(1);
  expect(result.search.uuids).toContain(conversations[0].uuid);
  expect(result.analytics).toMatchObject({conversations:1,messages:5,human:2,assistant:3});
  expect(result.analytics.mostUsedTool[0]).toBe('project_knowledge_search');
  expect(result.analytics.mostToolErrors).toMatchObject({errors:1,title:'Synthetic branching conversation'});
  expect(result.analytics.longestThinking.durationMs).toBe(5000);
  expect(result.projectIndex.map[conversations[0].uuid]).toBe(projects[0].uuid);
  expect(result.projectIndex.evidence[conversations[0].uuid].method).toBe('file');
  expect(errors).toEqual([]);
});

test('persistent data worker rejects a truncated messages array',async({page})=>{
  const errors=await openViewer(page);
  const message=await page.evaluate(async()=>{
    const generation=nextDataWorkerGeneration();
    try{await dataWorkerRequest('ingest','[{"uuid":"broken","chat_messages":[{"uuid":"m1"}',[],generation);return'';}
    catch(error){return error.message;}
  });
  expect(message).toMatch(/Unterminated|Invalid|Unexpected/);
  expect(errors).toEqual([]);
});

test('IndexedDB parse cache hits only for the same source fingerprint',async({page})=>{
  const errors=await openViewer(page),payload=JSON.stringify(conversations);
  await expect(page.locator('#clear-cache-btn')).toBeVisible();await page.locator('#clear-cache-btn').click();await expect(page.locator('#clear-cache-btn')).toContainText(/已清除|cleared/i);
  const result=await page.evaluate(async text=>{
    const firstGeneration=nextDataWorkerGeneration();await dataWorkerRequest('cacheClear',null,[],firstGeneration).catch(()=>null);
    const first=await loadConversationSourceToWorker(new File([text],'conversations.json',{lastModified:1000}),firstGeneration);await dataWorkerCachePromise;
    const secondGeneration=nextDataWorkerGeneration();const second=await loadConversationSourceToWorker(new File([text],'conversations.json',{lastModified:1000}),secondGeneration);
    const thirdGeneration=nextDataWorkerGeneration();const third=await loadConversationSourceToWorker(new File([text],'conversations.json',{lastModified:2000}),thirdGeneration);
    return{first:first.cacheHit||false,second:second.cacheHit||false,third:third.cacheHit||false};
  },payload);
  expect(result).toEqual({first:false,second:true,third:false});expect(errors).toEqual([]);
});

test('drag import and safe exports',async({page})=>{
  const errors=await openViewer(page);
  await page.evaluate(payload=>{const file=new File([payload],'conversations.json',{type:'application/json'});routeDroppedFiles([file]);},JSON.stringify(conversations));
  await page.waitForFunction(()=>allConvs.length===1);await page.locator('.conv-item').first().click();
  await page.locator('#export-btn').click();page.once('dialog',d=>d.accept());const downloadPromise=page.waitForEvent('download');await page.locator('#export-menu button').nth(1).click();
  const download=await downloadPromise;expect(await download.suggestedFilename()).toMatch(/\.md$/);
  expect(errors).toEqual([]);
});
