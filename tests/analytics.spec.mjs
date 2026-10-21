import {test,expect} from '@playwright/test';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test.use({timezoneId:'America/Los_Angeles'});
const message=(uuid,date,model='model-a',sender='human',text='test')=>({uuid,created_at:date,sender,model,content:[{type:'text',text}]});
const conversation=(uuid,messages,name=uuid)=>({uuid,name,summary:'',created_at:messages[0]?.created_at||'',updated_at:messages.at(-1)?.created_at||'',chat_messages:messages});
async function load(page,conversations,projects=[]){
  await page.goto(pathToFileURL(path.join(root,'viewer.html')).href);
  await page.evaluate(async({conversations,projects})=>{
    const generation=nextDataWorkerGeneration();
    const result=await dataWorkerRequest('ingest',JSON.stringify(conversations),[],generation);
    allConvs=result.conversations;allProjects=projects;projectOverrides={};convProjectMapReady=false;projectMapGeneration++;
    renderConvList(getSortedConvs());
  },{conversations,projects});
}
async function query(page,filters={range:'all'},extra={}){
  return page.evaluate(({filters,extra})=>analyticsRequest('query',{filters,overrides:projectOverrides,...extra}),{filters,extra});
}
async function openAnalytics(page){
  await page.locator('[data-analytics-tab]').click();
  await page.waitForFunction(()=>analyticsExploreResult&&analyticsDrillResult);
}

test('local dates, zero buckets, Monday weeks, months and invalid timestamps',async({page})=>{
  await load(page,[
    conversation('first',[message('a','2025-12-31T23:30:00-08:00'),message('b','2026-01-01T00:30:00-08:00'),message('c','2026-01-05T00:01:00-08:00'),message('bad','invalid')]),
    conversation('second',[message('d','2026-01-05T07:59:00Z','')])
  ]);
  const all=await query(page);
  expect(all.current).toMatchObject({messages:5,conversations:2,invalidTime:1});
  expect(all.comparison).toBeNull();expect(all.previousRange).toBeNull();
  expect(all.range).toMatchObject({start:'2025-12-31',end:'2026-01-05'});
  const daily=await query(page,{range:'custom',start:'2025-12-31',end:'2026-01-06'});
  expect(daily.current.messages).toBe(4);expect(daily.buckets.map(bucket=>bucket.messages)).toEqual([1,1,0,0,1,1,0]);
  expect(daily.buckets[5].ma7).toBeNull();expect(daily.buckets[6].ma7.messages).toBeCloseTo(4/7);
  const weekly=await query(page,{range:'custom',start:'2025-12-01',end:'2026-01-31'});
  expect(weekly.grain).toBe('week');
  expect(weekly.buckets.find(bucket=>bucket.start==='2026-01-05').messages).toBe(1);
  const monthly=await query(page,{range:'custom',start:'2025-01-01',end:'2026-01-31'});
  expect(monthly.grain).toBe('month');expect(monthly.buckets).toHaveLength(13);
  expect(monthly.buckets.slice(-2).map(bucket=>bucket.messages)).toEqual([1,3]);
  const recent=await query(page,{range:'7'});expect(recent.range).toMatchObject({start:'2025-12-30',end:'2026-01-05'});
  expect(recent.current.invalidTime).toBe(0);
});

test('complete moving windows, equal prior period and zero baselines',async({page})=>{
  const messages=Array.from({length:60},(_,index)=>message('day-'+index,new Date(Date.UTC(2025,11,1+index,20)).toISOString(),'model-a','human',index<30?'a':'aa'));
  await load(page,[conversation('daily',messages)]);
  const result=await query(page,{range:'30'});
  expect(result.current).toMatchObject({messages:30,characters:60,conversations:1});
  expect(result.previous).toMatchObject({messages:30,characters:30,conversations:1});
  expect(result.comparison.characters.percent).toBe(100);
  expect(result.buckets[5].ma7).toBeNull();expect(result.buckets[6].ma7.messages).toBe(1);
  expect(result.buckets[28].ma30).toBeNull();expect(result.buckets[29].ma30.conversations).toBe(1);
  const fresh=await query(page,{range:'custom',start:'2025-12-01',end:'2025-12-07'});
  expect(fresh.comparison.messages).toEqual({status:'new'});
  const none=await query(page,{range:'custom',start:'2025-01-01',end:'2025-01-07'});
  expect(none.comparison.messages).toEqual({status:'unchanged'});
});

test('calendar-day comparisons survive DST and granularity thresholds are inclusive',async({page})=>{
  await load(page,[conversation('dst',[
    message('old-a','2026-03-06T20:00:00-08:00'),message('old-b','2026-03-07T20:00:00-08:00'),
    message('before-jump','2026-03-08T01:30:00-08:00'),message('after-jump','2026-03-08T03:30:00-07:00'),message('next','2026-03-09T00:30:00-07:00')
  ])]);
  const result=await query(page,{range:'custom',start:'2026-03-08',end:'2026-03-09'});
  expect(result.current.messages).toBe(3);expect(result.previous.messages).toBe(2);
  expect(result.buckets.map(bucket=>bucket.messages)).toEqual([2,1]);
  expect((await query(page,{range:'custom',start:'2026-01-01',end:'2026-03-01'})).grain).toBe('day');
  expect((await query(page,{range:'custom',start:'2026-01-01',end:'2026-03-02'})).grain).toBe('week');
  expect((await query(page,{range:'custom',start:'2025-01-01',end:'2025-12-31'})).grain).toBe('week');
  expect((await query(page,{range:'custom',start:'2024-01-01',end:'2024-12-31'})).grain).toBe('month');
});

test('archives with no valid dates retain totals without inventing dates or models',async({page})=>{
  await load(page,[conversation('invalid',[message('bad','broken',''),message('missing','','')]),conversation('empty',[])]);
  const all=await query(page);
  expect(all.current).toMatchObject({messages:2,conversations:1,invalidTime:2});
  expect(all.buckets).toEqual([]);expect(all.options.models).toEqual(['']);
  const limited=await query(page,{range:'7'});
  expect(limited.current.messages).toBe(0);expect(limited.comparison).toBeNull();expect(limited.previousRange).toBeNull();
  const rows=await page.evaluate(()=>analyticsRequest('drilldown',{filters:{range:'all'}}));
  expect(rows.rows[0]).toMatchObject({messages:2,latest:null});
});

test('combined filters share project inference, manual overrides and summary-only drilldown',async({page})=>{
  const first=message('p','2026-01-01T20:00:00Z','model-a');first.content.push({type:'local_resource',file_path:'/mnt/project/synthetic.md'});
  await load(page,[conversation('assigned',[first,message('q','2026-01-02T20:00:00Z','model-b','assistant')]),conversation('unassigned',[message('r','2026-01-02T20:00:00Z','')])],[{uuid:'project',name:'Synthetic project',docs:[{filename:'synthetic.md',content:'Synthetic document'}]}]);
  const filters={range:'custom',start:'2026-01-01',end:'2026-01-01',projects:['project'],models:['model-a'],roles:['human']};
  const result=await query(page,filters);
  expect(result.current).toMatchObject({messages:1,conversations:1,characters:4});
  expect(await page.evaluate(()=>convProjectMap.assigned)).toBe('project');
  const drill=await page.evaluate(filters=>analyticsRequest('drilldown',{filters,includeIds:true}),filters);
  expect(drill.total).toBe(result.matchCount);expect(drill.uuids).toEqual(['assigned']);
  expect(drill.rows[0]).toMatchObject({uuid:'assigned',messages:1,characters:4});
  expect(drill.rows[0]).not.toHaveProperty('chat_messages');
  const missing=await query(page,{range:'all',models:[''],projects:['']});
  expect(missing.current.messages).toBe(1);expect(missing.options.models).toContain('');
  await page.evaluate(()=>setProjectOverride('assigned',''));
  const overridden=await query(page,filters,{projectVersion:1});
  expect(overridden.current.messages).toBe(0);expect(overridden.cacheKey).not.toBe(result.cacheKey);
  await page.evaluate(()=>setProjectOverride('assigned','__auto__'));
  expect((await query(page,filters,{projectVersion:2})).current.messages).toBe(1);
  const stopwordChange=await query(page,filters,{projectVersion:2,stopwordVersion:1});
  expect(stopwordChange.cacheKey).not.toBe(overridden.cacheKey);
});

test('chart, paged table and conversation list agree and preserve exploration state',async({page})=>{
  await load(page,Array.from({length:56},(_,index)=>conversation('conv-'+index,[message('msg-'+index,'2026-01-02T20:00:00Z')],index===0?'<img src=x onerror=alert(1)>':'Synthetic '+index)));
  expect(await page.evaluate(()=>analyticsWorker)).toBeNull();
  await openAnalytics(page);
  await expect(page.locator('[data-analytics-metric="conversations"] .metric-value')).toHaveText('56');
  await expect(page.locator('[data-analytics-conversation]')).toHaveCount(50);
  await page.locator('[data-analytics-bucket]').first().click();await page.waitForFunction(()=>analyticsDrillResult?.total===56);
  await page.getByRole('button',{name:'下一页',exact:true}).click();await page.waitForFunction(()=>analyticsDrillResult?.page===1);
  await expect(page.locator('[data-analytics-conversation]')).toHaveCount(6);
  await page.getByRole('button',{name:'在对话列表中查看',exact:true}).click();
  await expect(page.locator('.conv-item')).toHaveCount(56);await expect(page.locator('#conv-list')).toContainText('统计筛选');
  await page.locator('.conv-item').first().click();await expect(page.locator('#messages')).toContainText('test');
  await page.getByRole('button',{name:'返回统计',exact:true}).click();
  expect(await page.evaluate(()=>({page:analyticsPage,selection:analyticsSelection,range:analyticsFilters.range}))).toMatchObject({page:1,selection:{start:'2026-01-02'},range:'all'});
  await expect(page.locator('[data-analytics-conversation]')).toHaveCount(6);
  await page.locator('[data-analytics-view="overview"]').click();await page.waitForFunction(()=>analyticsResult);
  await expect(page.locator('#messages')).toContainText('统计范围：全档案');
  await page.locator('[data-analytics-view="explore"]').click();
  await expect(page.locator('#messages img')).toHaveCount(0);
  await page.locator('#lang-btn').click();
  await expect(page.locator('[data-analytics-view="explore"]')).toHaveText('Explore');
});

test('all-history comparisons stay hidden across date changes, reset and language changes',async({page})=>{
  await load(page,[conversation('history',[message('valid','2026-01-02T20:00:00Z'),message('invalid','broken')])]);
  await openAnalytics(page);
  await expect(page.locator('[data-analytics-metric="messages"] .metric-value')).toHaveText('2');
  await expect(page.locator('[data-analytics-comparison]')).toHaveCount(0);
  await expect(page.locator('#messages')).toContainText('全部历史不比较上一周期；选择日期范围可查看对比');
  await page.locator('#analytics-range').selectOption('7');
  await page.waitForFunction(()=>analyticsExploreResult?.range.all===false&&analyticsDrillResult);
  await expect(page.locator('[data-analytics-comparison]')).toHaveCount(3);
  await expect(page.locator('[data-analytics-metric="messages"] .metric-value')).toHaveText('1');
  await expect(page.locator('[data-analytics-metric="messages"] [data-analytics-comparison]')).toContainText('新增');
  await page.getByRole('button',{name:'清除筛选',exact:true}).click();
  await page.waitForFunction(()=>analyticsExploreResult?.range.all&&analyticsDrillResult);
  await expect(page.locator('[data-analytics-comparison]')).toHaveCount(0);
  await page.locator('#lang-btn').click();
  await expect(page.locator('#messages')).toContainText('All history has no previous-period comparison; select a date range to compare');
});

test('weekly and monthly averages use their labeled daily scale for every metric',async({page})=>{
  const messages=Array.from({length:400},(_,index)=>message('day-'+index,new Date(Date.UTC(2025,0,1+index,20)).toISOString()));
  await load(page,[conversation('steady',messages)]);
  await openAnalytics(page);
  for(const [range,grain]of [['all','month'],['90','week']]){
    await page.locator('#analytics-range').selectOption(range);
    await page.waitForFunction(grain=>analyticsExploreResult?.grain===grain&&analyticsDrillResult,grain);
    for(const metric of ['messages','characters','conversations']){
      await page.locator('#analytics-metric').selectOption(metric);
      await expect(page.locator('[data-analytics-axis="total"]')).toContainText('桶总量');
      await expect(page.locator('[data-analytics-axis="average"]')).toContainText('日均移动平均');
      for(const window of [7,30]){
        const geometry=await page.locator('[data-analytics-average="'+window+'"]').evaluate(element=>({
          top:element.getBBox().y,
          axisTop:Number(element.closest('svg').querySelector('[data-analytics-axis="average"] line').getAttribute('y1')),
          path:element.getAttribute('d')
        }));
        expect(geometry.path).not.toMatch(/NaN|Infinity/);
        expect(geometry.top).toBeCloseTo(geometry.axisTop);
      }
    }
  }
  await page.locator('#lang-btn').click();
  await expect(page.locator('[data-analytics-axis="total"]')).toContainText('Bucket totals');
  await expect(page.locator('[data-analytics-axis="average"]')).toContainText('Daily moving averages');
  await expect(page.locator('#messages')).toContainText('independent scales');
  await page.locator('[data-analytics-bucket]').last().click();
  await page.waitForFunction(()=>analyticsDrillResult?.total===1);
  await expect(page.locator('[data-analytics-conversation]')).toHaveCount(1);
});

test('cancel, debounce, stale generations, failure retry and bounded cache',async({page})=>{
  await load(page,Array.from({length:70},(_,index)=>conversation('cancel-'+index,Array.from({length:30},(_,item)=>message('m-'+item,'2026-01-02T20:00:00Z',item%2?'model-a':'model-b')))));
  await page.evaluate(()=>{document.querySelector('[data-analytics-tab]').click();document.querySelector('.tab-btn[data-ui-value="convs"]').click();});
  await page.waitForTimeout(50);
  expect(await page.evaluate(()=>analyticsExploreResult)).toBeNull();
  await openAnalytics(page);
  await page.evaluate(()=>{changeAnalyticsFilter('models',['model-a']);changeAnalyticsFilter('models',['model-b']);changeAnalyticsFilter('models',['absent']);});
  await page.waitForFunction(()=>analyticsExploreResult?.current.messages===0);
  expect(await page.evaluate(()=>analyticsFilters.models)).toEqual(['absent']);
  await page.evaluate(()=>{analyticsWorker.dispatchEvent(new ErrorEvent('error',{message:'Synthetic worker failure',cancelable:true}));});
  await expect(page.locator('#messages')).toContainText('Synthetic worker failure');
  expect(await page.evaluate(()=>analyticsWorker)).toBeNull();
  await page.getByRole('button',{name:'重新计算',exact:true}).click();await page.waitForFunction(()=>analyticsExploreResult?.current.messages===0);
  await page.evaluate(async()=>{
    for(let days=1;days<=15;days++)await analyticsRequest('query',{filters:{range:String(days)}});
    window.cacheProgress=0;
    analyticsWorker.addEventListener('message',event=>{if(event.data.type==='progress')window.cacheProgress++;});
    await analyticsRequest('query',{filters:{range:'15'}});
  });
  expect(await page.evaluate(()=>window.cacheProgress)).toBe(0);
  await page.evaluate(()=>analyticsRequest('query',{filters:{range:'1'}}));
  expect(await page.evaluate(()=>window.cacheProgress)).toBeGreaterThan(0);
  const reload=await page.evaluate(async()=>{
    const old=analyticsGeneration,generation=nextDataWorkerGeneration();
    const result=await dataWorkerRequest('ingest',JSON.stringify([{uuid:'new-source',name:'New source',chat_messages:[{sender:'human',created_at:'2026-05-01T20:00:00Z',text:'new'}]}]),[],generation);
    allConvs=result.conversations;return{old,next:analyticsGeneration,worker:analyticsWorker===null};
  });
  expect(reload.worker).toBe(true);expect(reload.next).toBeGreaterThan(reload.old);
  expect((await query(page)).current.messages).toBe(1);
});

test('Worker creation failure exposes retry and retains a local execution path',async({page})=>{
  await load(page,[conversation('creation',[message('m','2026-01-01T20:00:00Z')])]);
  await page.evaluate(()=>{window.RealWorker=Worker;window.Worker=class{constructor(){throw new Error('Synthetic creation failure');}};});
  await page.locator('[data-analytics-tab]').click();await expect(page.locator('#messages')).toContainText('Synthetic creation failure');
  await page.evaluate(()=>{window.Worker=window.RealWorker;});
  await page.getByRole('button',{name:'重新计算',exact:true}).click();
  await page.waitForFunction(()=>analyticsExploreResult?.current.messages===1);
});

test('drilldown reuses summaries across pages and invalidates every matching input',async({page})=>{
  await load(page,Array.from({length:56},(_,index)=>conversation('cached-'+index,[
    message('first-'+index,'2026-01-01T20:00:00Z','model-a'),
    message('second-'+index,'2026-01-02T20:00:00Z','model-b','assistant')
  ])),[{uuid:'project',name:'Synthetic project',docs:[]}]);
  await query(page);
  await page.evaluate(()=>{
    window.drillScans=0;
    analyticsWorker.addEventListener('message',event=>{if(event.data.type==='progress'&&event.data.phase==='drilldown')window.drillScans++;});
  });
  const request=(extra={})=>page.evaluate(extra=>analyticsRequest('drilldown',{filters:{range:'all'},...extra}),extra);
  expect((await request()).total).toBe(56);
  const second=await request({page:1,includeIds:true});
  expect(second.rows).toHaveLength(6);expect(second.uuids).toHaveLength(56);
  const explicitEmpty=await request({filters:{range:'all',models:[],roles:[],projects:[]},page:1});
  expect(explicitEmpty.rows).toEqual(second.rows);
  expect(await page.evaluate(()=>window.drillScans)).toBe(0);
  let scans=0;
  for(const extra of [
    {selection:{start:'2026-01-01',end:'2026-01-01'}},
    {filters:{range:'all',models:['model-a']}},
    {filters:{range:'all',roles:['assistant']}},
    {filters:{range:'all',projects:['project']},overrides:{'cached-0':'project'}},
    {filters:{range:'all',projects:['project']},overrides:{'cached-1':'project'}},
    {projectVersion:1},
    {projectVersion:1,stopwordVersion:1}
  ]){
    const cold=await request(extra);
    expect(cold.total).toBe(extra.filters?.projects?1:56);
    expect(cold.rows[0].messages).toBe(extra.selection||extra.filters?.models||extra.filters?.roles?1:2);
    const current=await page.evaluate(()=>window.drillScans);expect(current).toBeGreaterThan(scans);scans=current;
    const warm=await request({...extra,page:1,includeIds:true});
    expect(warm.total).toBe(cold.total);expect(warm.uuids).toHaveLength(cold.total);
    expect(await page.evaluate(()=>window.drillScans)).toBe(scans);
  }
  const evicted=await request({selection:{start:'2026-01-01',end:'2026-01-01'}});
  expect(evicted.total).toBe(56);expect(evicted.rows[0].messages).toBe(1);
  expect(await page.evaluate(()=>window.drillScans)).toBeGreaterThan(scans);
  await load(page,[conversation('replacement',[message('only','2026-01-01T20:00:00Z')])]);
  expect((await request()).rows.map(row=>row.uuid)).toEqual(['replacement']);
});

test('returning to a cached aggregate rebuilds only the evicted matching summary',async({page})=>{
  await load(page,[conversation('alternating',[
    message('a','2026-01-01T20:00:00Z','model-a'),
    message('b','2026-01-02T20:00:00Z','model-b')
  ])]);
  const first=await query(page,{range:'all',models:['model-a']});
  const original=await page.evaluate(()=>analyticsRequest('drilldown',{filters:{range:'all',models:['model-a']}}));
  await query(page,{range:'all',models:['model-b']});
  await page.evaluate(()=>{
    window.alternatingProgress=[];
    analyticsWorker.addEventListener('message',event=>{if(event.data.type==='progress')window.alternatingProgress.push(event.data.phase);});
  });
  expect((await query(page,{range:'all',models:['model-a']})).cacheKey).toBe(first.cacheKey);
  expect(await page.evaluate(()=>window.alternatingProgress)).toEqual([]);
  const rebuilt=await page.evaluate(()=>analyticsRequest('drilldown',{filters:{range:'all',models:['model-a']}}));
  expect(rebuilt.rows).toEqual(original.rows);
  const scans=await page.evaluate(()=>window.alternatingProgress.length);
  expect(scans).toBeGreaterThan(0);
  const reused=await page.evaluate(()=>analyticsRequest('drilldown',{filters:{range:'all',models:['model-a']},includeIds:true}));
  expect(reused.uuids).toEqual(['alternating']);
  expect(await page.evaluate(()=>window.alternatingProgress.length)).toBe(scans);
});

test('equivalent filter order shares aggregates and drilldown summaries',async({page})=>{
  await load(page,[conversation('ordered',[message('first','2026-01-01T20:00:00Z','model-a'),message('second','2026-01-02T20:00:00Z','model-b')])]);
  const first=await query(page,{range:'all',models:['model-b','model-a','model-a'],roles:['human']});
  await page.evaluate(()=>{
    window.orderProgress=0;
    analyticsWorker.addEventListener('message',event=>{if(event.data.type==='progress')window.orderProgress++;});
  });
  const second=await query(page,{roles:['human'],models:['model-a','model-b'],range:'all'});
  expect(second.cacheKey).toBe(first.cacheKey);expect(second.current.messages).toBe(2);
  const drill=await page.evaluate(()=>analyticsRequest('drilldown',{filters:{range:'all',models:['model-a','model-b'],roles:['human']}}));
  expect(drill.rows[0].messages).toBe(2);
  expect(await page.evaluate(()=>window.orderProgress)).toBe(0);
});

test('raw records travel only between Workers with bounded acknowledged batches',async({page})=>{
  const data=Array.from({length:9},(_,index)=>conversation('batch-'+index,[message('m','2026-01-01T20:00:00Z','model-a','human','Synthetic '.repeat(index===4?80000:20000))]));
  await load(page,data);
  const result=await page.evaluate(async()=>{
    const code="self.onmessage=event=>{const port=event.data.port;let batches=0,records=0,oversized=0,awaiting=false,overlap=false,maxItems=0;port.onmessage=event=>{const batch=event.data;if(batch.type!=='batch')return;if(awaiting)overlap=true;awaiting=true;batches++;records+=batch.items.length;maxItems=Math.max(maxItems,batch.items.length);if(batch.bytes>512*1024){if(batch.items.length!==1)overlap=true;oversized++;}if(batch.done){self.postMessage({batches,records,oversized,maxItems,overlap});return;}setTimeout(()=>{awaiting=false;port.postMessage({type:'batchAck',generation:batch.generation,requestId:batch.requestId,batchId:batch.batchId});},35);};port.start();port.postMessage({type:'streamStart',generation:event.data.generation,requestId:42});};";
    const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'})),probe=new Worker(url),channel=new MessageChannel();
    try{
      const result=new Promise((resolve,reject)=>{probe.onmessage=event=>resolve(event.data);probe.onerror=reject;});
      await dataWorkerRequest('analyticsConnect',{port:channel.port1},[channel.port1]);
      probe.postMessage({port:channel.port2,generation:dataWorkerGeneration},[channel.port2]);
      return await result;
    }finally{probe.terminate();URL.revokeObjectURL(url);await dataWorkerRequest('analyticsDisconnect');}
  });
  expect(result).toMatchObject({records:9,oversized:1,overlap:false});
  expect(result.maxItems).toBeLessThanOrEqual(4);expect(result.batches).toBeGreaterThan(3);
  expect((await query(page)).current.messages).toBe(9);
});
