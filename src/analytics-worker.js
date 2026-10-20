function analyticsWorkerMain(){
  const shared=archiveAnalysisCore(),cache=new Map(),dayMs=86400000;
  let generation=0,port=null,active=null,index=null,settings={},stream=null,drillCache=null;
  const emit=(type,requestId,result)=>{
    if(type==='progress'){
      if(active?.requestId!==requestId)return;
      const now=performance.now();
      if(active.progressPhase===result.phase&&now-active.progressAt<50&&result.loaded<result.total)return;
      active.progressPhase=result.phase;active.progressAt=now;
    }
    self.postMessage({type,generation,requestId,...result});
  };
  const dayKey=date=>date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
  const dayNumber=text=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(text||''))return null;const value=Date.parse(text+'T00:00:00Z')/dayMs;return Number.isFinite(value)&&new Date(value*dayMs).toISOString().slice(0,10)===text?value:null;};
  const keyForDay=day=>new Date(day*dayMs).toISOString().slice(0,10);
  const canceled=()=>Object.assign(new Error('Canceled'),{canceled:true});
  async function checkpoint(token,force=false){
    if(token.canceled||active!==token)throw canceled();
    if(force||performance.now()>=token.yieldAt){
      await new Promise(resolve=>setTimeout(resolve,0));
      if(token.canceled||active!==token)throw canceled();
      token.yieldAt=performance.now()+8;
    }
  }
  function cancel(){
    if(!active)return;
    active.canceled=true;
    if(stream){port.postMessage({type:'streamCancel',generation,requestId:stream.requestId});stream.reject?.(canceled());stream=null;}
    emit('canceled',active.requestId,{});active=null;
  }
  async function* records(token){
    const receiver={requestId:token.requestId,pending:null,resolve:null,reject:null};stream=receiver;
    port.postMessage({type:'streamStart',generation,requestId:token.requestId});
    try{
      while(true){
        const batch=receiver.pending||await new Promise((resolve,reject)=>{receiver.resolve=resolve;receiver.reject=reject;});receiver.pending=null;receiver.resolve=null;receiver.reject=null;
        if(token.canceled)throw canceled();
        for(const record of batch.items)yield record;
        emit('progress',token.requestId,{loaded:batch.loaded,total:batch.total,phase:token.mode==='overview'?'overview':'index'});
        if(batch.done)break;
        await checkpoint(token);
        port.postMessage({type:'batchAck',generation,requestId:token.requestId,batchId:batch.batchId});
      }
    }finally{if(stream===receiver)stream=null;}
  }
  async function ensureIndex(token){
    if(index)return;
    const conversations=[],models=new Set(['']),roles=new Set();let min=null,max=null;
    async function* indexRecords(){
    for await(const record of records(token)){
      const conversation=JSON.parse(record.raw),messages=Array.isArray(conversation.chat_messages)?conversation.chat_messages:[],rows=[];
      for(let messageIndex=0;messageIndex<messages.length;messageIndex++){
        if(messageIndex%128===0){await checkpoint(token);emit('progress',token.requestId,{loaded:conversations.length+messageIndex/Math.max(1,messages.length),total:settings.totalConversations,phase:'index'});}
        const message=messages[messageIndex],timestamp=Date.parse(message.created_at||message.updated_at||''),day=Number.isFinite(timestamp)?dayNumber(dayKey(new Date(timestamp))):null;
        const model=String(message.model||message.model_slug||message.message?.model||''),role=String(message.sender||'assistant');
        let characters=0;const content=Array.isArray(message.content)?message.content:[];
        for(const block of content){if(block?.type==='text')characters+=String(block.text||'').length;else if(block?.type==='thinking')characters+=String(block.thinking||'').length;}
        if(!content.length&&message.text)characters=String(message.text).length;
        rows.push({day,timestamp:Number.isFinite(timestamp)?timestamp:null,model,role,characters});models.add(model);roles.add(role);
        if(day!==null){min=min===null?day:Math.min(min,day);max=max===null?day:Math.max(max,day);}
      }
      conversations.push({uuid:record.meta.uuid,title:record.meta.name,project:'',rows});
      yield{meta:record.meta,conversation};
    }
    }
    let inferred=settings.projectIndex;
    if(!inferred&&settings.projects?.length)inferred=await shared.calculateProjectIndex(indexRecords(),record=>record.conversation,settings.projects,settings.memoryData,()=>checkpoint(token));
    else for await(const record of indexRecords()){await checkpoint(token);}
    inferred=inferred||{map:{},evidence:{},stats:{}};
    for(const conversation of conversations)conversation.project=inferred.map[conversation.uuid]||'';
    await checkpoint(token);index={conversations,models:[...models].sort(),roles:[...roles].sort(),min,max};
    emit('projects',token.requestId,{result:inferred});
  }
  function effectiveProject(conversation,overrides){const value=overrides?.[conversation.uuid];return Object.prototype.hasOwnProperty.call(overrides||{},conversation.uuid)&&(value===null||(settings.projects||[]).some(project=>project.uuid===value))?value||'':conversation.project;}
  function bounds(filters){
    if(filters.range==='custom'){
      const start=dayNumber(filters.start),end=dayNumber(filters.end);
      if(start===null||end===null||end<start)throw new Error('Invalid date range');
      return{start,end,all:false};
    }
    const count=Number(filters.range);return count>0&&index.max!==null?{start:index.max-count+1,end:index.max,all:false}:{start:index.min,end:index.max,all:filters.range==='all'||!filters.range};
  }
  const emptySummary=()=>({messages:0,conversations:0,characters:0,invalidTime:0});
  const nonTimeMatch=(row,filters)=>(!filters.models?.length||filters.models.includes(row.model))&&(!filters.roles?.length||filters.roles.includes(row.role));
  const timeMatch=(row,range)=>row.day===null?range.all:range.start!==null&&row.day>=range.start&&row.day<=range.end;
  const bucketStart=(day,grain)=>{const date=new Date(day*dayMs);if(grain==='week')return day-(date.getUTCDay()+6)%7;if(grain==='month')return day-date.getUTCDate()+1;return day;};
  const nextBucket=(day,grain)=>{if(grain==='week')return day+7;if(grain==='month'){const date=new Date(day*dayMs);return Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,1)/dayMs;}return day+1;};
  const matchKey=(message,range)=>{
    const filters=message.filters||{},overrides=message.overrides||{};
    return JSON.stringify([generation,range,...['projects','models','roles'].map(field=>[...new Set(filters[field]||[])].sort()),message.projectVersion||0,message.stopwordVersion||0,Object.keys(overrides).sort().map(uuid=>[uuid,overrides[uuid]])]);
  };
  function rememberMatches(key,matches){
    matches.sort((first,second)=>(second.latest??-Infinity)-(first.latest??-Infinity)||first.uuid.localeCompare(second.uuid));
    drillCache={key,matches};
  }
  async function query(token,message){
    await ensureIndex(token);
    const filters=message.filters||{range:'all'},overrides=message.overrides||{},range=bounds(filters),span=range.start===null?0:range.end-range.start+1;
    const key=matchKey(message,range);
    if(cache.has(key)){const value=cache.get(key);cache.delete(key);cache.set(key,value);return{...value,cacheKey:key};}
    const previousRange=!range.all&&span?{start:range.start-span,end:range.start-1,all:false}:null,current=emptySummary(),previous=emptySummary(),daily=new Map(),bucketSets=new Map();
    const grain=span<=60?'day':span<=365?'week':'month',buckets=[];
    if(span)for(let day=bucketStart(range.start,grain);day<=range.end;day=nextBucket(day,grain))buckets.push({start:keyForDay(Math.max(day,range.start)),end:keyForDay(Math.min(nextBucket(day,grain)-1,range.end)),day,messages:0,characters:0,conversations:0,ma7:null,ma30:null});
    const bucketMap=new Map(buckets.map(bucket=>[bucket.day,bucket])),matches=[];let processed=0;
    for(const conversation of index.conversations){
      if(processed++%8===0){await checkpoint(token);emit('progress',token.requestId,{loaded:processed,total:index.conversations.length,phase:'query'});}
      if(filters.projects?.length&&!filters.projects.includes(effectiveProject(conversation,overrides)))continue;
      let currentHit=false,previousHit=false,hitMessages=0,hitCharacters=0,latest=null;
      for(let rowIndex=0;rowIndex<conversation.rows.length;rowIndex++){
        if(rowIndex%512===0)await checkpoint(token);
        const row=conversation.rows[rowIndex];if(!nonTimeMatch(row,filters))continue;
        if(timeMatch(row,range)){
          currentHit=true;current.messages++;current.characters+=row.characters;
          hitMessages++;hitCharacters+=row.characters;if(row.timestamp!==null)latest=Math.max(latest??-Infinity,row.timestamp);
          if(row.day===null){current.invalidTime++;continue;}
          let dailyValue=daily.get(row.day);if(!dailyValue){dailyValue={messages:0,characters:0,conversations:new Set()};daily.set(row.day,dailyValue);}dailyValue.messages++;dailyValue.characters+=row.characters;dailyValue.conversations.add(conversation.uuid);
          const bucket=bucketMap.get(bucketStart(row.day,grain));bucket.messages++;bucket.characters+=row.characters;
          if(!bucketSets.has(bucket.day))bucketSets.set(bucket.day,new Set());bucketSets.get(bucket.day).add(conversation.uuid);
        }
        if(previousRange&&timeMatch(row,previousRange)){previousHit=true;previous.messages++;previous.characters+=row.characters;}
      }
      if(currentHit)current.conversations++;if(previousHit)previous.conversations++;
      if(currentHit)matches.push({uuid:conversation.uuid,title:conversation.title,messages:hitMessages,characters:hitCharacters,latest});
    }
    const metrics=['messages','characters','conversations'],sums={messages:0,characters:0,conversations:0},rolling=[];
    for(let day=range.start;span&&day<=range.end;day++){
      if((day-range.start)%256===0)await checkpoint(token);
      const entry=daily.get(day),value={messages:entry?.messages||0,characters:entry?.characters||0,conversations:entry?.conversations.size||0};rolling.push(value);for(const metric of metrics)sums[metric]+=value[metric];
      if(rolling.length>30){const expired=rolling.shift();for(const metric of metrics)sums[metric]-=expired[metric];}
      const bucket=bucketMap.get(bucketStart(day,grain));
      if(day===dayNumber(bucket.end)){
        bucket.conversations=bucketSets.get(bucket.day)?.size||0;
        for(const window of [7,30])if(day-range.start+1>=window){const averages={};for(const metric of metrics)averages[metric]=(window===30?sums[metric]:rolling.slice(-7).reduce((sum,item)=>sum+item[metric],0))/window;bucket['ma'+window]=averages;}
      }
    }
    const comparison=previousRange?{}:null;if(comparison)for(const metric of metrics)comparison[metric]=previous[metric]?{percent:(current[metric]-previous[metric])/previous[metric]*100}:{status:current[metric]?'new':'unchanged'};
    const result={current,previous,comparison,buckets,grain,range:{start:span?keyForDay(range.start):'',end:span?keyForDay(range.end):'',all:range.all},previousRange:previousRange?{start:keyForDay(previousRange.start),end:keyForDay(previousRange.end)}:null,options:{models:index.models,roles:index.roles,projects:[{uuid:'',name:''},...(settings.projects||[]).map(project=>({uuid:project.uuid,name:project.name||''}))]},matchCount:current.conversations};
    await checkpoint(token);rememberMatches(key,matches);
    emit('progress',token.requestId,{loaded:index.conversations.length,total:index.conversations.length,phase:'query'});
    cache.set(key,result);while(cache.size>12)cache.delete(cache.keys().next().value);return{...result,cacheKey:key};
  }
  async function drilldown(token,message){
    await ensureIndex(token);const filters=message.filters||{range:'all'},range=bounds(filters),selected=message.selection;
    if(selected){range.start=dayNumber(selected.start);range.end=dayNumber(selected.end);range.all=false;}
    const key=matchKey(message,range);
    let matches=drillCache?.key===key?drillCache.matches:null,count=0;
    if(!matches){
      matches=[];
      for(const conversation of index.conversations){
        if(count++%8===0){await checkpoint(token);emit('progress',token.requestId,{loaded:count,total:index.conversations.length,phase:'drilldown'});}
        if(filters.projects?.length&&!filters.projects.includes(effectiveProject(conversation,message.overrides)))continue;
        let messages=0,characters=0,latest=null;
        for(let rowIndex=0;rowIndex<conversation.rows.length;rowIndex++){
          if(rowIndex%512===0)await checkpoint(token);
          const row=conversation.rows[rowIndex];if(nonTimeMatch(row,filters)&&timeMatch(row,range)){messages++;characters+=row.characters;if(row.timestamp!==null)latest=Math.max(latest??-Infinity,row.timestamp);}
        }
        if(messages)matches.push({uuid:conversation.uuid,title:conversation.title,messages,characters,latest});
      }
      await checkpoint(token);rememberMatches(key,matches);
      emit('progress',token.requestId,{loaded:index.conversations.length,total:index.conversations.length,phase:'drilldown'});
    }
    const page=Math.max(0,Math.min(Number(message.page)||0,Math.max(0,Math.ceil(matches.length/50)-1)));
    return{rows:matches.slice(page*50,page*50+50),total:matches.length,page,...(message.includeIds?{uuids:matches.map(item=>item.uuid)}:{})};
  }
  self.onmessage=event=>{
    const message=event.data||{};
    if(message.type==='init'){
      cancel();port?.close();generation=message.generation;settings=message;index=null;drillCache=null;cache.clear();port=message.port;
      port.onmessage=event=>{const batch=event.data||{};if(batch.generation!==generation||!stream||batch.requestId!==stream.requestId)return;if(batch.type==='error'){stream.reject?.(new Error(batch.error));return;}if(stream.resolve)stream.resolve(batch);else stream.pending=batch;};port.start();emit('ready',message.requestId,{});return;
    }
    if(message.generation!==generation)return;
    if(message.type==='cancel'){cancel();return;}
    if(message.type==='release'){cancel();index=null;drillCache=null;cache.clear();port?.close();port=null;return;}
    if(!['query','overview','drilldown'].includes(message.type))return;
    cancel();const token={requestId:message.requestId,canceled:false,mode:message.type,yieldAt:0};active=token;
    Promise.resolve().then(async()=>{
      let result;
      if(message.type==='overview'){
        const key='overview:'+JSON.stringify([generation,message.stopwordVersion,message.customStopZh]);
        result=cache.get(key);
        if(result){cache.delete(key);cache.set(key,result);}
        else{result=await shared.calculateAnalytics(records(token),record=>JSON.parse(record.raw),message.customStopZh,async detail=>{await checkpoint(token);if(detail)emit('progress',token.requestId,{loaded:detail.done+detail.messageIndex/Math.max(1,detail.totalMessages),total:settings.totalConversations,phase:'overview'});});cache.set(key,result);while(cache.size>12)cache.delete(cache.keys().next().value);}
      }else result=await(message.type==='query'?query(token,message):drilldown(token,message));
      await checkpoint(token,true);active=null;emit('result',message.requestId,{result,mode:message.type});
    }).catch(error=>{if(error.canceled)return;if(active===token){active=null;emit('error',message.requestId,{error:error.message});}});
  };
}
