import {test,expect} from '@playwright/test';
import {fileURLToPath,pathToFileURL} from 'node:url';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

function largeSyntheticExport(){
  const conversations=[];
  for(let ci=0;ci<240;ci++){
    const messages=[];
    for(let mi=0;mi<100;mi++)messages.push({uuid:`perf-${ci}-${mi}`,sender:mi%2?'assistant':'human',created_at:new Date(Date.UTC(2026,ci%7,1,mi%24,mi%60)).toISOString(),parent_message_uuid:mi?`perf-${ci}-${mi-1}`:'00000000-0000-0000-0000-000000000000',content:[{type:'text',text:`SyntheticWorkerNeedle ${ci}/${mi} escaped braces {[]} and quote \" only. `+'fictional payload '.repeat(18)}]});
    conversations.push({uuid:`perf-conversation-${ci}`,name:`Synthetic performance ${ci}`,summary:'Synthetic fixture only',created_at:messages[0].created_at,updated_at:messages.at(-1).created_at,chat_messages:messages});
  }
  return conversations;
}

test('large synthetic export remains metadata-first under throttled CPU',async({page})=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'crr-perf-'));
  try{
    await fs.writeFile(path.join(dir,'conversations.json'),JSON.stringify(largeSyntheticExport()));
    await page.goto(pathToFileURL(path.join(root,'viewer.html')).href);
    await page.evaluate(()=>{const RealWorker=Worker;window.analyticsWorkerCreations=0;window.Worker=class extends RealWorker{constructor(url,options){super(url,options);if(url===analyticsWorkerUrl)window.analyticsWorkerCreations++;}};});
    const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    const started=Date.now();await page.setInputFiles('#file-input',dir);await page.waitForFunction(()=>allConvs.length===240,{timeout:120000});
    expect(Date.now()-started).toBeLessThan(20_000);
    const state=await page.evaluate(async()=>({metadataOnly:allConvs.every(item=>item._workerBacked&&!('chat_messages'in item)),worker:await dataWorkerRequest('debugState')}));
    expect(state.metadataOnly).toBe(true);expect(state.worker).toMatchObject({records:240,parsed:0,lazy:true});
    const searchStarted=Date.now();const hits=await page.evaluate(async()=>(await dataWorkerRequest('search',{query:'syntheticworkerneedle'})).uuids.length);expect(hits).toBe(240);expect(Date.now()-searchStarted).toBeLessThan(15_000);
    await page.evaluate(async()=>{const target=[...allConvs].sort((a,b)=>b.message_count-a.message_count)[0];await openConv(target.uuid);});
    const rendered=await page.locator('#messages .msg-wrap').count();expect(rendered).toBeGreaterThan(0);expect(rendered).toBeLessThan(100);
    const metrics=await cdp.send('Performance.getMetrics'),heap=metrics.metrics.find(metric=>metric.name==='JSHeapUsedSize')?.value||0;expect(heap).toBeLessThan(80*1024*1024);
    expect(await page.evaluate(()=>window.analyticsWorkerCreations)).toBe(0);
    await page.locator('[data-analytics-tab]').click();await page.waitForFunction(()=>analyticsWorker!==null);
    await page.evaluate(()=>{window.analyticsProgressEvents=[];analyticsWorker.addEventListener('message',event=>{if(event.data.type==='progress')window.analyticsProgressEvents.push(event.data.loaded);});});
    await page.waitForFunction(()=>window.analyticsProgressEvents.length>=2);
    const concurrent=await page.evaluate(async()=>{
      const started=performance.now();
      const [conversation,search]=await Promise.all([dataWorkerRequest('getConversation',{uuid:'perf-conversation-1'}),dataWorkerRequest('search',{query:'syntheticworkerneedle'})]);
      return{elapsed:performance.now()-started,messages:conversation.chat_messages.length,hits:search.uuids.length};
    });
    expect(concurrent.messages).toBe(100);expect(concurrent.hits).toBe(240);expect(concurrent.elapsed).toBeLessThan(2000);
    const opened=await page.evaluate(async()=>{const started=performance.now();await openConv('perf-conversation-1');return performance.now()-started;});
    expect(opened).toBeLessThan(2000);
    expect(await page.evaluate(()=>window.analyticsWorkerCreations)).toBe(1);
    expect(await page.locator('#messages .msg-wrap').count()).toBeLessThan(100);
    await page.locator('[data-analytics-tab]').click();await page.waitForFunction(()=>analyticsExploreResult?.current.messages===24000);
    expect(await page.evaluate(()=>window.analyticsWorkerCreations)).toBe(1);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});
