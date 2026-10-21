import {test,expect} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import JSZip from 'jszip';
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
test('workers are lazy; 10k search and cross-page navigation only mount a window',async({page})=>{
  await load(page);
  expect(await page.evaluate(()=>[...featureWorkers.keys()])).toEqual([]);
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
    await featureRequest('reader','open',{conversation:{uuid:'branches',chat_messages:[{uuid:'r',parent_message_uuid:'00000000-0000-4000-8000-000000000000',text:'root'},{uuid:'a',parent_message_uuid:'r',text:'branchNeedle'},{uuid:'b',parent_message_uuid:'r',text:'branchNeedle'}]}});
    currentConv={uuid:'branches',_readerBacked:true};
    const longest=await featureRequest('reader','search',{query:'branchNeedle',mode:'longest'}),full=await featureRequest('reader','search',{query:'branchNeedle',mode:'full'});
    const stale=featureRequest('task','behavior').then(()=>false,error=>error.name==='AbortError');
    nextDataWorkerGeneration();await dataWorkerRequest('reset');
    return{longest:longest.total,full:full.total,stale:await stale,workers:featureWorkers.size,consumers:(await dataWorkerRequest('debugState')).consumers};
  });
  expect(result).toEqual({longest:1,full:2,stale:true,workers:0,consumers:0});
});
