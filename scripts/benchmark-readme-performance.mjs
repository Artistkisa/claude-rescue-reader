import {chromium} from 'playwright';
import {fileURLToPath,pathToFileURL} from 'node:url';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'docs','benchmarks','readme-performance.json');
const systemChrome=process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined;
const executablePath=process.env.CHROME_PATH||systemChrome;
const runs=Math.max(1,Number(process.argv.find(arg=>arg.startsWith('--runs='))?.split('=')[1]||3));
const requested=(process.argv.find(arg=>arg.startsWith('--sizes='))?.split('=')[1]||'50,150,300').split(',').map(Number).filter(Boolean);
const scenarios=requested.map(sizeMiB=>({sizeMiB,cpuThrottle:sizeMiB===50?4:6}));
const rootParent='00000000-0000-4000-8000-000000000000';
const payload='SyntheticBenchmarkNeedle fictional local-only payload for reproducible performance measurement. '.repeat(36);

function conversation(index){
  const messages=[];
  for(let mi=0;mi<100;mi++)messages.push({
    uuid:`00000000-0000-4000-8000-${String(index*100+mi).padStart(12,'0')}`,
    sender:mi%2?'assistant':'human',
    created_at:new Date(Date.UTC(2026,index%6,1+(index%27),mi%24,mi%60)).toISOString(),
    parent_message_uuid:mi?`00000000-0000-4000-8000-${String(index*100+mi-1).padStart(12,'0')}`:rootParent,
    content:[{type:'text',text:`SyntheticBenchmarkNeedle ${index}/${mi}. ${payload}`}]
  });
  return{uuid:`10000000-0000-4000-8000-${String(index).padStart(12,'0')}`,name:`Synthetic benchmark conversation ${index}`,summary:'Synthetic fixture generated locally for a reproducible benchmark.',created_at:messages[0].created_at,updated_at:messages.at(-1).created_at,chat_messages:messages};
}

async function buildFixture(file,targetBytes){
  const handle=await fs.open(file,'w');let bytes=1,index=0;
  try{
    await handle.write('[');
    while(true){
      const json=JSON.stringify(conversation(index)),separator=index?',':'';
      if(bytes+Buffer.byteLength(separator+json)+2>targetBytes)break;
      await handle.write(separator+json);bytes+=Buffer.byteLength(separator+json);index++;
    }
    const tail=JSON.stringify({uuid:`20000000-0000-4000-8000-${String(index).padStart(12,'0')}`,name:'Synthetic benchmark padding record',summary:'Synthetic padding only',created_at:'2026-01-01T00:00:00.000Z',updated_at:'2026-01-01T00:00:00.000Z',chat_messages:[],padding:''});
    const separator=index?',':'';const baseBytes=Buffer.byteLength(separator+tail)+1;
    const paddingLength=Math.max(0,targetBytes-bytes-baseBytes);
    const padded=tail.replace('"padding":""',`"padding":"${'x'.repeat(paddingLength)}"`);
    await handle.write(separator+padded+']');index++;
  }finally{await handle.close();}
  return{records:index,bytes:(await fs.stat(file)).size};
}

const median=values=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)];};
const round=value=>Math.round(value*10)/10;
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'crr-readme-benchmark-'));
const results=[];
try{
  for(const scenario of scenarios){
    const dir=path.join(temp,`${scenario.sizeMiB}mib`);await fs.mkdir(dir);
    const fixture=await buildFixture(path.join(dir,'conversations.json'),scenario.sizeMiB*1024*1024);
    const samples=[];
    for(let run=1;run<=runs;run++){
      const context=await browser.newContext({viewport:{width:1440,height:960}});const page=await context.newPage();
      await page.goto(pathToFileURL(path.join(root,'viewer.html')).href);
      const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');await cdp.send('Emulation.setCPUThrottlingRate',{rate:scenario.cpuThrottle});
      const initialStart=performance.now();await page.setInputFiles('#file-input',dir);await page.waitForFunction(expected=>allConvs.length===expected,fixture.records,{timeout:180_000});const initialListMs=performance.now()-initialStart;
      const openStart=performance.now();await page.evaluate(async()=>openConv(allConvs.find(item=>item.message_count===100)?.uuid||allConvs[0].uuid));await page.waitForFunction(()=>currentConv&&document.querySelectorAll('#messages .msg-wrap').length>0,{timeout:60_000});const openConversationMs=performance.now()-openStart;
      const searchStart=performance.now();const hits=await page.evaluate(async()=>(await dataWorkerRequest('search',{query:'syntheticbenchmarkneedle'})).uuids.length);const searchMs=performance.now()-searchStart;
      const metrics=await cdp.send('Performance.getMetrics');const heapBytes=metrics.metrics.find(item=>item.name==='JSHeapUsedSize')?.value||0;
      samples.push({run,initialListMs:round(initialListMs),openConversationMs:round(openConversationMs),searchMs:round(searchMs),hits,heapMiB:round(heapBytes/1024/1024)});
      await context.close();
    }
    results.push({...scenario,actualBytes:fixture.bytes,records:fixture.records,runs,samples,median:{initialListMs:median(samples.map(x=>x.initialListMs)),openConversationMs:median(samples.map(x=>x.openConversationMs)),searchMs:median(samples.map(x=>x.searchMs)),heapMiB:median(samples.map(x=>x.heapMiB))}});
    console.log(`${scenario.sizeMiB} MiB @ ${scenario.cpuThrottle}x: list ${results.at(-1).median.initialListMs} ms, open ${results.at(-1).median.openConversationMs} ms, search ${results.at(-1).median.searchMs} ms`);
  }
  const report={generatedAt:new Date().toISOString(),browser:browser.version(),playwright:'1.62.0',node:process.version,method:{runs,aggregation:'median',fixture:'ASCII-only synthetic conversations; 100 alternating human/assistant messages per full record; exact target byte size; one shared search needle per message.',privacy:'No real export, title, path, account data, or hardware model is read or recorded.'},results};
  await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
  console.log(`Benchmark report written to ${path.relative(root,output)}`);
}finally{await browser.close();await fs.rm(temp,{recursive:true,force:true});}
