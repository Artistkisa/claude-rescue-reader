import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {parseRuns,median} from './benchmark-utils.mjs';
const runs=parseRuns(process.argv.find(arg=>arg.startsWith('--runs='))?.slice(7));
const base=process.argv.find(arg=>arg.startsWith('--base='))?.slice(7)||'ea4458011ae186445a4599a716abbaeccee2a450';
const before=execFileSync('git',['show',base+':viewer.html'],{maxBuffer:16*1024*1024});
const after=await fs.readFile('viewer.html');
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/before'?before:after);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch();
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'crr-worker-benchmark-'));
const fixture=Array.from({length:60},(_,ci)=>({uuid:'bench'+ci,name:'Synthetic benchmark '+ci,chat_messages:Array.from({length:ci===0?10000:100},(_,i)=>({uuid:ci+'-'+i,parent_message_uuid:i?ci+'-'+(i-1):'00000000-0000-0000-0000-000000000000',sender:i%2?'assistant':'human',content:[{type:'text',text:'SyntheticNeedle '+i+' fictional'+(' payload'.repeat(25))}]}))}));
const input=path.join(temp,'conversations.json');await fs.writeFile(input,JSON.stringify(fixture));
const results={baseline:base,runs,cpuThrottle:4,fixture:{conversations:60,messages:15900,bytes:(await fs.stat(input)).size},browser:browser.version(),samples:{before:[],after:[]}};
try{
  for(const version of ['before','after'])for(let run=0;run<runs;run++){
    const context=await browser.newContext();const page=await context.newPage();
    await page.route('https://**',async route=>{
      const url=route.request().url();const file=url.includes('marked')?'node_modules/marked/lib/marked.umd.js':url.includes('highlight')&&url.endsWith('.js')?'node_modules/@highlightjs/cdn-assets/highlight.min.js':null;
      if(file)await route.fulfill({path:file,contentType:'text/javascript'});else await route.abort();
    });
    await page.goto(origin+'/'+version);const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    await page.evaluate(()=>{window.benchLongTasks=[];new PerformanceObserver(list=>benchLongTasks.push(...list.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:false});});
    const start=performance.now();await page.setInputFiles('#file-input',temp);await page.waitForFunction(()=>allConvs.length===60);const importMs=performance.now()-start;
    const openStart=performance.now();await page.evaluate(()=>openConv('bench1'));await page.waitForFunction(()=>document.querySelectorAll('#messages .msg-wrap').length>0);const openMs=performance.now()-openStart;
    await page.evaluate(()=>openConv('bench0'));await page.waitForFunction(()=>document.querySelectorAll('#messages .msg-wrap').length>0);
    const searchStart=performance.now();
    await page.evaluate(()=>{if(typeof readerSearch==='function')return readerSearch('SyntheticNeedle');return cSearch('SyntheticNeedle');});
    await page.waitForFunction(()=>typeof readerSearchState!=='undefined'
      ?readerSearchState.total===10000&&document.getElementById('csearch-count').textContent==='1 / 10000'&&!!document.querySelector('mark.cs.active')
      :CS.matches.length===10000&&!!document.querySelector('mark.cs.active'));
    const searchMs=performance.now()-searchStart;
    const state=await page.evaluate(()=>({mounted:document.querySelectorAll('#messages .msg-wrap').length,longTasks:benchLongTasks.length,longTaskMs:benchLongTasks.reduce((a,b)=>a+b,0),maxLongTaskMs:Math.max(0,...benchLongTasks)}));
    const metrics=await cdp.send('Performance.getMetrics');state.mainHeapMiB=metrics.metrics.find(m=>m.name==='JSHeapUsedSize').value/1024/1024;
    results.samples[version].push({importMs,openMs,searchMs,...state});await context.close();
  }
  results.bytes={before:before.length,after:after.length};results.medians={};
  for(const version of ['before','after'])results.medians[version]=Object.fromEntries(Object.keys(results.samples[version][0]).map(key=>[key,Math.round(median(results.samples[version].map(sample=>sample[key]))*10)/10]));
  await fs.mkdir('docs/benchmarks',{recursive:true});await fs.writeFile('docs/benchmarks/worker-pipelines.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify({bytes:results.bytes,medians:results.medians},null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));await fs.rm(temp,{recursive:true,force:true});}
