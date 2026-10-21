import {test,expect} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import JSZip from 'jszip';
import fs from 'node:fs/promises';
const viewer=pathToFileURL(path.resolve('viewer.html')).href;
const root='00000000-0000-4000-8000-000000000000';
async function load(page,count=10000){
  await page.goto(viewer);
  await page.route('https://**',route=>route.abort());
  await page.evaluate(async count=>{
    const messages=Array.from({length:count},(_,i)=>({uuid:'m'+i,parent_message_uuid:i?'m'+(i-1):'00000000-0000-4000-8000-000000000000',sender:i%2?'assistant':'human',created_at:'2026-01-01T00:00:00Z',content:[{type:'text',text:'**SyntheticNeedle** '+i+'\n\n```js\nconst codeNeedle = "中文🙂";\n```'},{type:'thinking',thinking:'thoughtNeedle '+i}]}));
    await ingestData(JSON.stringify([{uuid:'large',name:'Synthetic giant',chat_messages:messages},{uuid:'small',name:'Synthetic small',chat_messages:messages.slice(0,2)}]),[],null,[],{textContent:''});
  },count);
}
test('custom redaction uses consistent aliases, debounces scans and protects exported filenames',async({page})=>{
  await load(page,2);await page.evaluate(async()=>{const conversation={uuid:'private',name:'synthetic@example.invalid',chat_messages:[{uuid:'one',sender:'human',content:[{type:'text',text:'Alice Alice Bob'}]}]};await ingestData(JSON.stringify([conversation]),[],null,[],{textContent:''});await openConv('private');});
  await page.evaluate(()=>void exportConv('safe'));const modal=page.locator('#redaction-modal');await expect(modal.locator('[data-action="export"]')).toBeEnabled();await modal.locator('[data-style="pseudonym"]').click();await modal.locator('textarea').fill('Alice\nBob');await expect(modal.locator('[data-action="export"]')).toBeDisabled();await expect(modal.locator('.redaction-results')).toContainText('自定义敏感词');
  const pending=page.waitForEvent('download');await modal.locator('[data-action="export"]').click();const download=await pending,body=await fs.readFile(await download.path(),'utf8');expect(download.suggestedFilename()).not.toContain('synthetic@example.invalid');expect(body).not.toContain('Alice');expect(body).not.toContain('Bob');expect(body).toMatch(/(\[ID_\d+\]) \1/);
  await page.evaluate(()=>void redactionDialog(currentConv));await expect(modal.locator('textarea')).toHaveValue('');await modal.locator('textarea').fill(Array.from({length:101},(_,i)=>'term-'+i).join('\n'));await expect(modal.locator('.redaction-status')).toContainText('limit');await expect(modal.locator('[data-action="export"]')).toBeDisabled();await modal.locator('textarea').fill('Alice');await expect(modal.locator('[data-action="export"]')).toBeEnabled();await page.keyboard.press('Escape');await expect(modal).toBeHidden();
});

test('preview cache includes custom rules and keeps original values out of summaries',async({page})=>{
  await load(page,2);const result=await page.evaluate(async()=>{const conversation={uuid:'cache',name:'Synthetic',chat_messages:[{uuid:'one',content:[{type:'text',text:'AlphaPerson BetaPerson'}]}]};await ingestData(JSON.stringify([conversation]),[],null,[],{textContent:''});const scans=[];for(const customTerms of ['AlphaPerson','','BetaPerson','AlphaPerson'])scans.push(await featureRequest('task','preview',{uuid:'cache',customTerms}));return scans;});expect(result.map(s=>s.total)).toEqual([1,0,1,1]);expect(JSON.stringify(result)).not.toContain('AlphaPerson');expect(JSON.stringify(result)).not.toContain('BetaPerson');
});

test('a completed redaction preview cannot confirm an export after the source changes',async({page})=>{
  await load(page,2);await page.evaluate(()=>{window.staleRedaction=undefined;void redactionDialog({name:'old@example.invalid',chat_messages:[]}).then(value=>window.staleRedaction=value);});await expect(page.locator('#redaction-modal [data-action="export"]')).toBeEnabled();await page.evaluate(()=>newExportArchive());await page.locator('#redaction-modal [data-action="export"]').click();expect(await page.evaluate(()=>window.staleRedaction)).toBeNull();
});

test('safe PDF redacts its title and omits cached original attachment images',async({page,context})=>{
  await load(page,2);await page.evaluate(async()=>{const conversation={uuid:'pdf-private',name:'person@example.invalid',chat_messages:[{uuid:'one',sender:'human',attachments:[{file_name:'synthetic.svg',file_type:'image/svg+xml'}],content:[{type:'text',text:'PrivatePerson'}]}]};await ingestData(JSON.stringify([conversation]),[],null,[],{textContent:''});addLocalMedia(new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><text>Private pixels</text></svg>'],{type:'image/svg+xml'}),'synthetic.svg','auto');await openConv('pdf-private');void exportPDF('safe');});
  const modal=page.locator('#redaction-modal');await modal.locator('textarea').fill('PrivatePerson');await expect(modal.locator('[data-action="export"]')).toBeEnabled();const pending=context.waitForEvent('page');await modal.locator('[data-action="export"]').click();const popup=await pending;await expect(popup.locator('.pdf-title')).toContainText('REDACTED');expect(await popup.title()).not.toContain('person@example.invalid');await expect(popup.locator('.pdf-conversation')).toContainText('附件图片已从安全导出中省略');await expect(popup.locator('.pdf-conversation img')).toHaveCount(0);await expect(popup.locator('body')).not.toContainText('PrivatePerson');await popup.close();
});

test('workers are lazy; 10k search and cross-page navigation only mount a window',async({page})=>{
  await load(page);
  expect(await page.evaluate(()=>[...featureWorkers.keys()])).toEqual([]);
  expect(await page.evaluate(()=>dataWorkerRequest('search',{query:'  '}))).toEqual({uuids:[],indexed:0});
  expect(await page.evaluate(async()=>(await dataWorkerRequest('debugState')).indexed)).toBe(0);
  await page.evaluate(()=>openConv('large'));
  await page.waitForFunction(()=>messageRenderState?.total===10000);
  expect(await page.evaluate(()=>({keys:[...featureWorkers.keys()],raw:'chat_messages' in currentConv}))).toEqual({keys:['reader'],raw:false});
  await page.evaluate(()=>readerSearch('codeNeedle'));
  expect(await page.evaluate(()=>readerSearchState.total)).toBe(10000);
  await page.evaluate(async()=>{readerSearchState.index=9999;await focusReaderMatch();});
  await expect(page.locator('#csearch-count')).toHaveText('10000 / 10000');
  await expect(page.locator('mark.cs.active')).toHaveText('codeNeedle');
  expect(await page.locator('#messages .msg-wrap').count()).toBeLessThanOrEqual(100);
  await page.evaluate(()=>readerSearch('thoughtNeedle'));
  await expect(page.locator('mark.cs.active')).toHaveText('thoughtNeedle');
  await page.evaluate(()=>openConv('small'));
  await page.waitForFunction(()=>currentConv?.uuid==='small'&&messageRenderState.total===2);
  expect(await page.evaluate(()=>readerSearchState.total)).toBe(0);
});
test('giant code segments navigate to the final match and retain complete copy/export/PDF',async({page})=>{
  await load(page,1);
  const result=await page.evaluate(async()=>{
    const text='```js\n'+'const line=1;\n'.repeat(10000)+'// END_NEEDLE\n```';
    await featureRequest('reader','open',{conversation:{uuid:'giant',chat_messages:[{uuid:'x',content:[{type:'text',text}]}]}});
    currentConv={uuid:'giant',_readerBacked:true};await renderReaderWindow();await readerSearch('END_NEEDLE');
    const copy=await featureRequest('reader','copy',{sourceIndex:0});
    const conv={uuid:'giant',chat_messages:[{content:[{type:'text',text}]}]};
    const exported=await featureRequest('task','export',{conversation:conv});
    const pdf=await featureRequest('task','pdfPage',{conversation:conv,pdfId:1});
    return{copy:copy.text===text,exported:(await exported.blob.text()).includes('END_NEEDLE'),pdf:pdf.messages[0].content[0].text===text};
  });
  expect(result).toEqual({copy:true,exported:true,pdf:true});
  await expect(page.locator('mark.cs.active')).toHaveText('END_NEEDLE');
  expect((await page.locator('#messages').textContent()).length).toBeLessThan(40000);
});
test('preview is bounded and masked, cancellation recovers, reading runs alongside task scans',async({page})=>{
  await load(page);
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  const result=await page.evaluate(async()=>{
    let progress=0;const scan=featureRequest('task','behavior',{},()=>progress++).catch(error=>error.name);
    const start=performance.now();await openConv('small');await renderReaderWindow();const elapsed=performance.now()-start;
    await scan;
    const canceled=await featureRequest('task','behavior',{},()=>cancelFeature('task','behavior')).catch(error=>error.name);
    const preview=await featureRequest('task','preview',{conversation:{chat_messages:[{text:Array.from({length:150},(_,i)=>'fake'+i+'@example.invalid').join('\n')}]}});
    const exportResult=await featureRequest('task','export',{uuid:'small'});
    return{elapsed,progress,canceled:typeof canceled==='string',total:preview.total,count:preview.matches.length,raw:JSON.stringify(preview).includes('fake0@example.invalid'),hasConv:'conv'in preview,exported:(await exportResult.blob.text()).includes('SyntheticNeedle')};
  });
  expect(result.elapsed).toBeLessThan(2000);expect(result.progress).toBeGreaterThan(0);
  expect(result).toMatchObject({canceled:true,total:150,count:100,raw:false,hasConv:false,exported:true});
});
test('raw record streams enforce acknowledgements and independent cancellation',async({page})=>{
  await load(page,1);
  const result=await page.evaluate(async()=>{
    const generation=dataWorkerGeneration;
    const payload=JSON.stringify(Array.from({length:10},(_,i)=>({uuid:'raw'+i,chat_messages:[{text:'中'.repeat(i===0?200000:50000)}]})));
    await dataWorkerRequest('ingest',payload,[],generation);
    const a=new MessageChannel(),b=new MessageChannel();
    await dataWorkerRequest('recordsConnect',{port:a.port1,id:'test-a'},[a.port1]);await dataWorkerRequest('recordsConnect',{port:b.port1,id:'test-b'},[b.port1]);
    const seenA=[],seenB=[];a.port2.onmessage=e=>seenA.push(e.data);b.port2.onmessage=e=>seenB.push(e.data);
    a.port2.postMessage({type:'streamStart',generation,requestId:1});b.port2.postMessage({type:'streamStart',generation,requestId:2});
    await new Promise(r=>setTimeout(r,100));const first=seenA[0],blocked=seenA.length===1;
    a.port2.postMessage({type:'streamCancel',generation,requestId:1});
    b.port2.postMessage({type:'batchAck',generation,requestId:2,batchId:seenB[0].batchId});
    await new Promise(r=>setTimeout(r,100));
    const valid=seenB.every(batch=>batch.items.length<=4&&(batch.bytes<=512*1024||batch.items.length===1));
    await dataWorkerRequest('recordsDisconnect',{id:'test-a'});await dataWorkerRequest('recordsDisconnect',{id:'test-b'});a.port2.close();b.port2.close();
    return{blocked,largeSingle:first.items.length===1&&first.bytes>512*1024,independent:seenB.length===2,valid,consumers:(await dataWorkerRequest('debugState')).consumers};
  });
  expect(result).toEqual({blocked:true,largeSingle:true,independent:true,valid:true,consumers:0});
});
test('ZIP works without network, lazily extracts nested attachments and resets resources',async({page})=>{
  await page.goto(viewer);await page.route('https://**',route=>route.abort());
  const zip=new JSZip();zip.file('nested/conversations.json',JSON.stringify([{uuid:'zip',name:'Zip synthetic',chat_messages:[{uuid:'z',content:[{type:'text',text:'Local image'}],attachments:[{file_name:'pixel.png'}]}]}]));
  zip.file('nested/images/pixel.png',Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY1sAAAAASUVORK5CYII=','base64'));
  await page.setInputFiles('#zip-input',{name:'synthetic.zip',mimeType:'application/zip',buffer:await zip.generateAsync({type:'nodebuffer'})});
  await page.waitForFunction(()=>allConvs.length===1);
  expect(await page.evaluate(()=>({workers:[...featureWorkers.keys()],media:LOCAL_MEDIA.size}))).toEqual({workers:['import'],media:0});
  await page.evaluate(()=>openConv('zip'));
  await page.waitForFunction(()=>LOCAL_MEDIA.size===1);
  expect(await page.locator('#messages img').count()).toBe(1);
  await page.evaluate(async()=>{nextDataWorkerGeneration();clearLocalMedia();await dataWorkerRequest('reset');});
  expect(await page.evaluate(()=>({workers:featureWorkers.size,media:LOCAL_MEDIA.size,entries:zipEntries.size}))).toEqual({workers:0,media:0,entries:0});
});
test('worker errors show retry and retry creates an independent replacement',async({page})=>{
  await load(page,2);await page.evaluate(()=>openConv('small'));await page.waitForFunction(()=>messageRenderState.total===2);
  const result=await page.evaluate(async()=>{
    const previous=featureWorkers.get('reader');previous.worker.onerror({message:'Synthetic failure'});
    await openConv('small');await renderReaderWindow();
    return{replaced:featureWorkers.get('reader')!==previous,consumers:(await dataWorkerRequest('debugState')).consumers,total:messageRenderState.total};
  });
  expect(result).toEqual({replaced:true,consumers:1,total:2});
});
test('attachment cache evicts oldest unmounted entries while pinning mounted images',async({page})=>{
  await page.goto(viewer);
  const result=await page.evaluate(()=>{
    const root=document.getElementById('messages');
    for(let i=0;i<35;i++){const url=URL.createObjectURL(new Blob(['synthetic']));LOCAL_MEDIA.set(String(i),{zip:true,size:1024,url});if(i===0){const image=document.createElement('img');image.src=url;root.appendChild(image);}}
    trimZipMedia();const pinned=LOCAL_MEDIA.has('0'),evicted=!LOCAL_MEDIA.has('1')&&!LOCAL_MEDIA.has('2')&&!LOCAL_MEDIA.has('3'),count=LOCAL_MEDIA.size;
    const transient=URL.createObjectURL(new Blob(['synthetic']));zipUncachedUrls.add(transient);trimZipMedia();
    clearLocalMedia();return{pinned,evicted,count,transient:zipUncachedUrls.size,cleared:LOCAL_MEDIA.size};
  });
  expect(result).toEqual({pinned:true,evicted:true,count:32,transient:0,cleared:0});
});
test('branch changes and source changes invalidate search without stale page updates',async({page})=>{
  await load(page,2);
  const result=await page.evaluate(async()=>{
    await featureRequest('reader','open',{conversation:{uuid:'branches',chat_messages:[{uuid:'r',parent_message_uuid:'00000000-0000-4000-8000-000000000000',text:'İ中文🙂tail'},{uuid:'a',parent_message_uuid:'r',text:'branchNeedle'},{uuid:'b',parent_message_uuid:'r',text:'branchNeedle'}]}});
    currentConv={uuid:'branches',_readerBacked:true};
    await renderReaderWindow();await readerSearch('tail');const unicode=document.querySelector('mark.cs.active')?.textContent;
    const longest=await featureRequest('reader','search',{query:'branchNeedle',mode:'longest'}),full=await featureRequest('reader','search',{query:'branchNeedle',mode:'full'});
    const stale=featureRequest('task','behavior').then(()=>false,error=>error.name==='AbortError');
    nextDataWorkerGeneration();await dataWorkerRequest('reset');
    return{unicode,longest:longest.total,full:full.total,stale:await stale,workers:featureWorkers.size,consumers:(await dataWorkerRequest('debugState')).consumers};
  });
  expect(result).toEqual({unicode:'tail',longest:1,full:2,stale:true,workers:0,consumers:0});
});
test('explicit task operations keep reading and archive search responsive at 4x CPU',async({page})=>{
  await load(page);await page.evaluate(()=>openConv('small'));
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  const results=await page.evaluate(async()=>{
    const operations=[['preview',{uuid:'large',strict:true}],['export',{uuid:'large',safe:true}],['projectExport',{project:{name:'Synthetic project'},stats:{conversations:2,messages:10002,chars:1,range:'Synthetic'},uuids:['large','small']}],['quality',{uuid:'large'}]];
    const rows=[];
    for(const [type,payload]of operations){
      let progress=0;const task=featureRequest('task',type,payload,()=>progress++);
      const started=performance.now();await openConv('small');const search=await dataWorkerRequest('search',{query:'syntheticneedle'});const elapsed=performance.now()-started;
      const output=await task;rows.push({type,elapsed,progress,hits:search.uuids.length,output:type==='preview'?output.total>=0:type==='quality'?!!output.counts:output.blob.size>0});
    }
    return rows;
  });
  for(const result of results){expect(result.elapsed,result.type).toBeLessThan(2000);expect(result.hits).toBe(2);expect(result.progress).toBeGreaterThan(0);expect(result.output).toBe(true);}
});
test('large compressed ZIP streams progress without delivering raw records to main',async({page})=>{
  const messages=Array.from({length:10000},(_,i)=>({uuid:'zip'+i,parent_message_uuid:i?'zip'+(i-1):root,sender:'assistant',content:[{type:'text',text:'Synthetic ZIP '+i+' payload'.repeat(150)}]}));
  const zip=new JSZip();zip.file('nested/conversations.json',JSON.stringify([{uuid:'zip-large',name:'Large synthetic ZIP',chat_messages:messages},{uuid:'zip-small',name:'Small synthetic ZIP',chat_messages:messages.slice(0,2)}]));
  const buffer=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
  await page.goto(viewer);await page.route('https://**',route=>route.abort());
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.evaluate(()=>{window.importProbe={progress:0,raw:false};const original=ensureFeature;ensureFeature=async kind=>{const state=await original(kind);if(kind==='import'&&!state.observed){state.observed=true;state.worker.addEventListener('message',event=>{if(event.data.type==='progress')importProbe.progress++;if(JSON.stringify(event.data).includes('"chat_messages"'))importProbe.raw=true;});}return state;};});
  const started=Date.now();await page.setInputFiles('#zip-input',{name:'large-synthetic.zip',mimeType:'application/zip',buffer});
  await page.waitForFunction(()=>allConvs.length===2);expect(Date.now()-started).toBeLessThan(20000);
  const probe=await page.evaluate(async()=>({...importProbe,worker:await dataWorkerRequest('debugState')}));
  expect(probe.raw).toBe(false);expect(probe.progress).toBeGreaterThanOrEqual(2);
  expect(probe.worker.largestImportChunk).toBe(4*1024*1024);
  const opened=await page.evaluate(async()=>{const start=performance.now();await openConv('zip-small');return performance.now()-start;});
  expect(opened).toBeLessThan(2000);expect(await page.locator('#messages .msg-wrap').count()).toBe(2);
});
