import {chromium} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const runs=Math.max(1,Number(process.argv.find(argument=>argument.startsWith('--runs='))?.split('=')[1]||3));
const output=process.argv.find(argument=>argument.startsWith('--output='))?.slice('--output='.length);
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const samples=[];
try{
  for(let run=0;run<runs;run++){
    const page=await browser.newPage({timezoneId:'America/Los_Angeles'});
    try{
      await page.goto(pathToFileURL(path.join(root,'viewer.html')).href);
      const session=await page.context().newCDPSession(page);
      await session.send('Emulation.setCPUThrottlingRate',{rate:4});
      samples.push(await page.evaluate(async()=>{
        const conversations=Array.from({length:1200},(_,conversation)=>({
          uuid:'bench-'+conversation,name:'Synthetic benchmark '+conversation,
          chat_messages:Array.from({length:100},(_,message)=>({
            uuid:'message-'+conversation+'-'+message,sender:message%2?'assistant':'human',
            created_at:new Date(Date.UTC(2026,0,1+message%60,20)).toISOString(),
            model:message%2?'model-a':'model-b',text:'Synthetic benchmark text'
          }))
        }));
        const generation=nextDataWorkerGeneration(),result=await dataWorkerRequest('ingest',JSON.stringify(conversations),[],generation);
        allConvs=result.conversations;allProjects=[];projectOverrides={};convProjectMapReady=true;
        const timed=async(type,payload)=>{
          const started=performance.now(),result=await analyticsRequest(type,payload);
          return{ms:Math.round((performance.now()-started)*10)/10,count:result.current?.messages??result.total};
        };
        const filters={range:'all'};
        const first=await timed('query',{filters});
        const filtered=await timed('query',{filters:{range:'all',models:['model-a']}});
        const firstDrill=await timed('drilldown',{filters,page:0});
        const nextPage=await timed('drilldown',{filters,page:1});
        const listIds=await timed('drilldown',{filters,page:1,includeIds:true});
        return{first,filtered,firstDrill,nextPage,listIds};
      }));
    }finally{await page.close();}
  }
  const median=values=>[...values].sort((first,second)=>first-second)[Math.floor(values.length/2)];
  const report={
    browser:browser.version(),node:process.version,cpuThrottleRequested:4,conversations:1200,messages:120000,
    method:'Three fresh pages by default; synthetic text only; ingestion excluded. First query builds the index. Filtered query changes model. First drilldown changes back to all models (cold); next page and UUID list repeat those conditions. CDP requests 4x page CPU throttling; it does not guarantee throttling of every Worker thread. Timings include browser timer clamping and are machine-dependent.',
    samples,medianMs:Object.fromEntries(Object.keys(samples[0]).map(key=>[key,median(samples.map(sample=>sample[key].ms))]))
  };
  if(output){await fs.mkdir(path.dirname(path.resolve(output)),{recursive:true});await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');}
  console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
