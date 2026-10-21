import {test,expect} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import JSZip from 'jszip';
import fs from 'node:fs/promises';
import http from 'node:http';
const viewer=pathToFileURL(path.resolve('viewer.html')).href;
const account='synthetic-account',project='synthetic-project';
const conv=(uuid='c1',text='Synthetic answer')=>({uuid,name:'Synthetic '+uuid,account:{uuid:account},chat_messages:[{uuid:'m1',sender:'assistant',content:[{type:'text',text},{type:'thinking',thinking:'Available thought',thinking_hidden:true,truncated:true,summaries:[{summary:'Short thought'}]},{type:'injected_prompt_block',injection_source:'memory_block_head',prompt:'hidden-context@example.test'},{type:'tool_result',name:'Artifact',content:[{type:'text',text:'Published'}],structured_content:{artifact_id:'synthetic-artifact'}},{type:'future_block',payload:'Retained unknown'}]}]});
async function zip(name,entries){const z=new JSZip();for(const [file,value]of Object.entries(entries))z.file(file,typeof value==='string'?value:JSON.stringify(value));return{name,mimeType:'application/zip',buffer:await z.generateAsync({type:'nodebuffer'})};}
async function setup(page){await page.goto(viewer);await page.route('https://**',r=>r.abort());}
async function add(page,files,count){await page.setInputFiles('#zip-input',files);await page.waitForFunction(n=>exportSession.packages.length===n,count);}
test('manifest is an inert bilingual checklist with validated links and imported-package status',async({page})=>{
  await setup(page);const file={filename:'conversations-000.zip',category:'conversations',part:0,batch_index:0,export_url:'https://claude.ai/export/synthetic/download/example'};
  await expect(page.locator('#sidebar [data-ui-click="pick-manifest"]')).toHaveCount(0);await page.locator('#download-page-btn').click();await expect(page.locator('#messages .export-page')).toBeVisible();await expect(page.locator('#export-session-panel')).toContainText('兼容旧版导出');
  await page.setInputFiles('#manifest-input',{name:'manifest.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:'1.0',total_files:2,data_files:[file,{...file,filename:'unknown.zip',category:'future',batch_index:1,export_url:'https://evil.test/'}]}))});
  const link=page.locator('#export-session-panel a');await expect(link).toHaveCount(1);await expect(link).toHaveAttribute('target','_blank');await expect(link).toHaveAttribute('rel','noopener noreferrer');await expect(page.locator('#export-session-panel')).toContainText('尚未导入');
  expect(await page.evaluate(()=>featureWorkers.size)).toBe(0);await add(page,await zip(file.filename,{'conversations.json':[conv()]}),1);await expect(page.locator('#export-session-panel')).toContainText('已导入');
});
test('unordered packages append atomically; duplicates, conflicts and account mismatch preserve existing records',async({page})=>{
  await setup(page);const p=await zip('projects-000.zip',{['projects/'+project+'.json']:{uuid:project,name:'Project'}}),c=await zip('conversations-000.zip',{'conversations.json':[conv()]});
  await add(page,[p,c],2);expect(await page.evaluate(()=>allProjects.length)).toBe(1);expect(await page.evaluate(()=>allConvs.length)).toBe(1);
  await page.setInputFiles('#zip-input',c);await expect(page.locator('#load-zip-btn')).toContainText('重复');expect(await page.evaluate(()=>exportSession.packages.length)).toBe(2);
  await add(page,await zip('conversations-001.zip',{'conversations.json':[conv('c1','Conflicting answer')]}),3);expect(await page.evaluate(()=>allConvs.length)).toBe(2);
  await page.locator('#download-page-btn').click();const mismatch=conv('other');mismatch.account.uuid='different-account';await page.setInputFiles('#zip-input',await zip('wrong.zip',{'conversations.json':[mismatch]}));await expect(page.locator('#export-session-panel')).toContainText('Account mismatch');expect(await page.evaluate(()=>allConvs.length)).toBe(2);
  await page.setInputFiles('#zip-input',await zip('broken.zip',{'conversations.json':'[{'}));await expect(page.locator('#load-zip-btn')).toContainText('失败');expect(await page.evaluate(()=>allConvs.length)).toBe(2);
  await add(page,await zip('conversations-002.zip',{'conversations.json':[conv('c2')]}),4);expect(await page.evaluate(()=>allConvs.length)).toBe(3);
});
test('both memory entrances retain distinct versions and support explicit project association',async({page})=>{
  await setup(page);const body='---\nname: 中文主题\naliases: [示例]\n---\nAccount version';
  await add(page,await zip('memories-000.zip',{'memories/synthetic.json':{account_uuid:account,memory_files:[{path:'/areas/topic.md',content:body,updated_at:'2026-01-01'},{path:'/projects/'+project+'/areas/project.md',content:'Project UUID memory'}]}}),1);
  await expect(page.locator('#conv-list')).toContainText('Account version');
  await add(page,await zip('claude-memory.zip',{'claude-memory/areas/topic.md':body.replace('Account version','Standalone version'),'claude-memory/projects/Project/areas/project.md':'Name memory'}),2);
  const versions=page.locator('#conv-list select[aria-label="版本"]').first();await expect(versions.locator('option')).toHaveCount(2);await versions.selectOption('1');await expect(page.locator('#conv-list')).toContainText('Standalone version');await versions.selectOption('0');await expect(page.locator('#conv-list')).toContainText('Account version');
  await add(page,await zip('projects-000.zip',{['projects/'+project+'.json']:{uuid:project,name:'Project'}}),3);await expect(page.locator('#conv-list')).toContainText('Project');
});
test('artifact versions load lazily inside the existing sandbox and link from new tool fields',async({page})=>{
  await setup(page);const artifact={id:'synthetic-artifact',active_version:'v2',versions:[{id:'v1',title:'Old version',created_at:'2026-01-01'},{id:'v2',title:'New version',created_at:'2026-01-02'}]};
  await add(page,[await zip('conversations-000.zip',{'conversations.json':[conv()]}),await zip('frames-000.zip',{'artifacts/synthetic-artifact/artifact.json':artifact,'artifacts/synthetic-artifact/versions/v1.html':'<html><body>Old source</body></html>','artifacts/synthetic-artifact/versions/v2.html':'<html><body>New source<script>parent.postMessage("synthetic", "*")</script></body></html>'})],2);
  await page.evaluate(()=>openConv('c1'));await expect(page.locator('#messages')).toContainText('隐藏状态');await expect(page.locator('.injected-context')).toContainText('memory_block_head');await expect(page.locator('#messages')).toContainText('future_block');
  await page.locator('.tool-result-header').click();await page.locator('[data-ui-click="local-artifact"]').click();await expect(page.locator('#messages')).toContainText('New source');await expect(page.locator('#messages iframe')).toHaveAttribute('sandbox','allow-scripts');await page.locator('#messages select').selectOption('v1');await expect(page.locator('#messages')).toContainText('Old source');
  await page.evaluate(()=>newExportArchive());expect(await page.evaluate(()=>({workers:featureWorkers.size,media:zipEntries.size,artifacts:exportSession.artifacts.length,visuals:Object.keys(VISUALURLS).length}))).toEqual({workers:0,media:0,artifacts:0,visuals:0});
});
test('account and login data are paged without becoming conversations; appended data invalidates searches',async({page})=>{
  await setup(page);await add(page,await zip('light_metadata-000.zip',{'users.json':[{uuid:account,full_name:'Synthetic User'}],'login_history.json':{login_events:Array.from({length:55},(_,i)=>({account_uuid:account,timestamp:'2026-01-01',method:'synthetic-'+i}))}}),1);
  expect(await page.evaluate(()=>allConvs.length)).toBe(0);await expect(page.locator('#conv-list')).toContainText('Synthetic User');expect(await page.locator('#conv-list > pre').count()).toBe(50);await page.getByRole('button',{name:'下一页',exact:true}).click();expect(await page.locator('#conv-list > pre').count()).toBe(5);
  await add(page,await zip('conversations-000.zip',{'conversations.json':[conv()]}),2);const first=await page.evaluate(()=>dataWorkerRequest('search',{query:'secondneedle'}));expect(first.uuids).toEqual([]);
  await add(page,await zip('conversations-001.zip',{'conversations.json':[conv('c2','secondneedle')]}),3);expect((await page.evaluate(()=>dataWorkerRequest('search',{query:'secondneedle'}))).uuids).toEqual(['c2']);
});
test('injected prompts export and redact without entering ordinary reader search',async({page})=>{
  await setup(page);await add(page,await zip('conversations-000.zip',{'conversations.json':[conv()]}),1);await page.evaluate(()=>openConv('c1'));
  expect(await page.evaluate(async()=>{await readerSearch('hidden-context');return readerSearchState.total;})).toBe(0);
  const result=await page.evaluate(async()=>{const original=await featureRequest('task','export',{uuid:'c1'}),safe=await featureRequest('task','export',{uuid:'c1',safe:true,style:'standard'}),preview=await featureRequest('task','preview',{uuid:'c1'});return{original:await original.blob.text(),safe:await safe.blob.text(),findings:preview.total};});
  expect(result.original).toContain('hidden-context@example.test');expect(result.original).toContain('memory_block_head');expect(result.safe).not.toContain('hidden-context@example.test');expect(result.findings).toBeGreaterThan(0);
});
test('switching archive during extraction retires old work and preserves lazy worker creation',async({page})=>{
  await setup(page);const record=conv();record.chat_messages=Array.from({length:10000},(_,i)=>({uuid:'m'+i,sender:'assistant',content:[{type:'text',text:'large synthetic '.repeat(100)}]}));const big=await zip('conversations-000.zip',{'conversations.json':[record]});
  await page.setInputFiles('#zip-input',big);await page.waitForFunction(()=>featureWorkers.has('import'));await page.evaluate(async()=>{await newExportArchive();await exportQueue;});
  expect(await page.evaluate(()=>({conversations:allConvs.length,packages:exportSession.packages.length,workers:featureWorkers.size}))).toEqual({conversations:0,packages:0,workers:0});
  await add(page,await zip('new.zip',{'conversations.json':[conv('new')]}),1);expect(await page.evaluate(()=>allConvs.map(c=>c.uuid))).toEqual(['new']);expect(await page.evaluate(()=>[...featureWorkers.keys()])).toEqual(['import']);
});
test('Import worker recovery reattaches a duplicate package without duplicating records',async({page})=>{
  await setup(page);const file=await zip('recovery.zip',{'conversations.json':[conv()],'artifacts/synthetic-artifact/artifact.json':{id:'synthetic-artifact',active_version:'v1',versions:[{id:'v1',title:'Recovered'}]},'artifacts/synthetic-artifact/versions/v1.html':'<h1>Recovered source</h1>'});await add(page,file,1);
  await page.evaluate(()=>featureWorkers.get('import').worker.onerror({message:'Synthetic worker failure'}));await page.setInputFiles('#zip-input',file);await expect(page.locator('#load-zip-btn')).toContainText('重复');
  expect(await page.evaluate(()=>allConvs.length)).toBe(1);expect(await page.evaluate(async()=>{const a=exportSession.artifacts[0];return(await featureRequest('import','resource',{packageId:a.packageId,path:a.versions[0].path})).blob.size;})).toBeGreaterThan(0);
});
test('unsafe archive entry paths are rejected before touching the current archive',async({page})=>{
  await setup(page);await add(page,await zip('valid.zip',{'conversations.json':[conv()]}),1);await page.locator('#download-page-btn').click();await page.setInputFiles('#zip-input',await zip('unsafe.zip',{'../conversations.json':[conv('bad')]}));await expect(page.locator('#export-session-panel')).toContainText('Invalid export path');expect(await page.evaluate(()=>allConvs.map(c=>c.uuid))).toEqual(['c1']);
});

test('dedicated download page follows theme and language without interrupting reading',async({page})=>{
  await setup(page);await add(page,await zip('old-export.zip',{'conversations.json':[conv()]}),1);await page.evaluate(()=>openConv('c1'));await page.locator('#download-page-btn').click();
  await expect(page.locator('#messages .export-page')).toBeVisible();await expect(page.locator('#export-wrap')).toBeHidden();await expect(page.locator('#sidebar #export-session-panel')).toHaveCount(0);
  const button=page.locator('.export-toolbar .primary');expect(await button.evaluate(el=>getComputedStyle(el).borderRadius)).toBe('8px');await page.locator('#lang-btn').click();await expect(button).toHaveText('Import download manifest');await expect(page.locator('.export-page')).toContainText('Older exports supported');
  await page.locator('#theme-btn').click();await expect(page.locator('.export-page')).toBeVisible();await page.locator('.conv-item').first().click();await expect(page.locator('#messages')).toContainText('Synthetic answer');await expect(page.locator('#download-page-btn')).not.toHaveAttribute('aria-current','page');
});

test('modern folder paths survive worker transfer and invalid metadata cannot partly commit',async({page})=>{
  await setup(page);
  await page.evaluate(async()=>{const inputs=[['export/memories/a.json',JSON.stringify({memory_files:[{path:'/areas/topic.md',content:'Folder memory'}]})],['export/projects/p.json',JSON.stringify({uuid:'p',name:'Folder project'})]];const files=inputs.map(([name,text])=>{const f=new File([text],name.split('/').pop());Object.defineProperty(f,'webkitRelativePath',{value:name});return f;});await importExportFiles(files);});
  expect(await page.evaluate(()=>({project:allProjects[0].name,path:exportSession.topics[0].path}))).toEqual({project:'Folder project',path:'areas/topic.md'});await expect(page.locator('#conv-list')).toContainText('Folder memory');
  await page.setInputFiles('#zip-input',await zip('invalid-project.zip',{'conversations.json':[conv()],'projects/bad.json':null}));await expect(page.locator('#load-zip-btn')).toContainText('失败');expect(await page.evaluate(()=>allConvs.length)).toBe(0);
});

test('HTTP checklist and package import work without fetching official links',async({page})=>{
  const html=await fs.readFile('viewer.html'),server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(html);});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{const requests=[];await page.route('https://**',route=>{requests.push(route.request().url());return route.abort();});await page.goto('http://127.0.0.1:'+server.address().port);
    await page.setInputFiles('#manifest-input',{name:'manifest.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:'1.0',total_files:1,data_files:[{filename:'conversations.zip',category:'conversations',part:0,batch_index:0,export_url:'https://claude.ai/export/synthetic/download/test'}]}))});await expect(page.locator('.export-package')).toHaveCount(1);
    await add(page,await zip('conversations.zip',{'conversations.json':[conv()]}),1);await expect(page.locator('.export-status')).toContainText('已导入');expect(requests).toEqual([]);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('project data_files fields are not mistaken for a download manifest',async({page})=>{
  await setup(page);await add(page,await zip('valid.zip',{'conversations.json':[conv()]}),1);
  await page.evaluate(async()=>{const file=new File([JSON.stringify({uuid:'extra',name:'Project with custom fields',data_files:[]})],'extra.json');Object.defineProperty(file,'webkitRelativePath',{value:'export/projects/extra.json'});await importExportFiles([file]);});
  expect(await page.evaluate(()=>({conversations:allConvs.length,projects:allProjects.length,manifest:exportSession.manifest}))).toEqual({conversations:1,projects:1,manifest:null});
});

test('semantic duplicate commits yield and notify acknowledged record consumers before closing',async({page})=>{
  await setup(page);
  const result=await page.evaluate(async()=>{
    const data=Array.from({length:300},(_,i)=>({uuid:'duplicate-'+i,chat_messages:Array.from({length:200},(_,j)=>({uuid:'message-'+j,text:'synthetic '.repeat(15)}))}));
    const generation=++dataLoadGeneration;useDataWorkerGeneration(generation);await dataWorkerRequest('ingest',JSON.stringify(data));
    const channel=new MessageChannel(),events=[];channel.port2.onmessage=e=>events.push(e.data);await dataWorkerRequest('recordsConnect',{id:'commit-test',port:channel.port1},[channel.port1]);channel.port2.postMessage({type:'streamStart',generation,requestId:123});
    await dataWorkerRequest('packageStart',{id:'semantic',filename:'pretty.zip',accounts:[]});await dataWorkerRequest('ingestStart');const bytes=new TextEncoder().encode(JSON.stringify(data,null,2));await dataWorkerRequest('ingestChunk',bytes.buffer,[bytes.buffer]);await dataWorkerRequest('ingestEnd');
    const commit=dataWorkerRequest('packageCommit'),during=await dataWorkerRequest('debugState'),summary=await commit;await new Promise(resolve=>setTimeout(resolve,30));channel.port2.close();
    return{yielded:during.revision===0,count:summary.conversations.length,conflicts:summary.conflicts.length,notified:events.some(e=>e.type==='sourceChanged'&&e.requestId===123),consumers:(await dataWorkerRequest('debugState')).consumers};
  });expect(result).toEqual({yielded:true,count:300,conflicts:0,notified:true,consumers:0});
});

test('record source invalidation cancels a waiting Worker task',async({page})=>{
  await setup(page);
  const outcome=await page.evaluate(async()=>{
    const script='('+featureWorkerRuntime.toString()+')({configure(){}},async(type,payload,token)=>{for await(const record of token.records()){};return {done:true};})';
    const url=URL.createObjectURL(new Blob([script],{type:'text/javascript'})),worker=new Worker(url),channel=new MessageChannel();
    try{return await new Promise((resolve,reject)=>{worker.onerror=e=>reject(Error(e.message));worker.onmessage=e=>{if(e.data.type==='ready')worker.postMessage({type:'scan',generation:1,requestId:2});if(e.data.requestId===2&&['result','error','canceled'].includes(e.data.type))resolve(e.data.type);};channel.port2.onmessage=e=>{if(e.data.type==='streamStart')channel.port2.postMessage({type:'sourceChanged',generation:1});};worker.postMessage({type:'init',generation:1,requestId:1,port:channel.port1},[channel.port1]);});}finally{worker.terminate();channel.port2.close();URL.revokeObjectURL(url);}
  });expect(outcome).toBe('canceled');
});
