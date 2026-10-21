function dataWorkerMain(){
  let generation=0,records=[],byUuid=new Map(),decoder=null,textChunks=[],searchIndex=null;
  const CACHE_DB='claude-rescue-reader-data-v1',CACHE_STORE='conversation-cache',CACHE_SCHEMA=1;
  const parsedCache=new Map(),PARSED_CACHE_LIMIT=3;
  const list=value=>Array.isArray(value)?value:[];
  const shared=archiveAnalysisCore();
  const consumers=new Set();let auxiliaryRecords=[],largestImportChunk=0;
  let analyticsPort=null,analyticsStream=null,importPort=null;
  function closeRecordPort(state){state.port.postMessage({type:'sourceChanged',generation,requestId:state.stream?.requestId});state.port.close();consumers.delete(state);}
  function closeAnalyticsPort(){analyticsStream=null;if(analyticsPort){for(const state of consumers)if(state.port===analyticsPort)closeRecordPort(state);analyticsPort.close();}analyticsPort=null;}
  function connectRecords(port,id){
    const state={port,id,stream:null};consumers.add(state);
    port.onmessage=event=>{
      const message=event.data||{};if(message.generation!==generation)return;
      if(message.type==='streamCancel'){if(state.stream?.requestId===message.requestId)state.stream=null;return;}
      if(message.type==='streamStart')state.stream={requestId:message.requestId,index:0,awaiting:false,batchId:0,source:message.uuids?message.uuids.map(id=>byUuid.get(id)).filter(Boolean):records.filter(r=>!r.meta._design)};
      else if(message.type==='batchAck'&&state.stream?.requestId===message.requestId&&message.batchId===state.stream.batchId){if(state.stream.index>=state.stream.source.length){state.stream=null;return;}state.stream.awaiting=false;}else return;
      const stream=state.stream;if(!stream||stream.awaiting)return;
      try{const items=[];let bytes=0;while(stream.index<stream.source.length&&items.length<4){const record=stream.source[stream.index],size=(record.bytes??=new TextEncoder().encode(record.raw).byteLength);if(items.length&&bytes+size>512*1024)break;items.push({raw:record.raw,meta:record.meta});bytes+=size;stream.index++;if(bytes>=512*1024)break;}stream.awaiting=true;port.postMessage({type:'batch',generation,requestId:stream.requestId,batchId:++stream.batchId,items,bytes,done:stream.index===stream.source.length,total:stream.source.length,loaded:stream.index});}catch(error){port.postMessage({type:'error',generation,requestId:stream.requestId,error:error.message});state.stream=null;}
    };port.start();return state;
  }
  function connectAnalytics(port){closeAnalyticsPort();analyticsPort=port;connectRecords(port);}
  const skipWs=(text,index)=>{while(index<text.length&&/\s/.test(text[index]))index++;return index;};
  function stringEnd(text,index){
    if(text[index]!=='"')throw new Error('Invalid JSON string');
    for(index++;index<text.length;index++){
      if(text[index]==='\\'){index++;continue;}
      if(text[index]==='"')return index+1;
    }
    throw new Error('Unterminated JSON string');
  }
  function valueEnd(text,index){
    index=skipWs(text,index);const first=text[index];
    if(first==='"')return stringEnd(text,index);
    if(first==='{'||first==='['){
      const opens=[first],close={'}':'{',']':'['};
      for(index++;index<text.length;index++){
        const char=text[index];
        if(char==='"'){index=stringEnd(text,index)-1;continue;}
        if(char==='{'||char==='[')opens.push(char);
        else if(char==='}'||char===']'){
          if(opens.pop()!==close[char])throw new Error('Mismatched JSON container');
          if(!opens.length)return index+1;
        }
      }
      throw new Error('Unterminated JSON container');
    }
    while(index<text.length&&!/[\s,}\]]/.test(text[index]))index++;
    return index;
  }
  function countArrayItems(text,start,end){
    let index=skipWs(text,start+1),count=0;
    if(text[index]===']')return 0;
    while(index<end){index=valueEnd(text,index);count++;index=skipWs(text,index);if(text[index]===','){index=skipWs(text,index+1);continue;}if(text[index]===']')break;throw new Error('Invalid JSON array');}
    if(text[index]!==']')throw new Error('Unterminated chat_messages array');
    return count;
  }
  function inspectConversation(raw){
    const meta={uuid:'',name:'',summary:'',created_at:'',updated_at:'',message_count:0,_workerBacked:true};
    let index=skipWs(raw,0);if(raw[index]!=='{')throw new Error('Conversation entry is not an object');index=skipWs(raw,index+1);
    while(index<raw.length&&raw[index]!=='}'){
      const keyEnd=stringEnd(raw,index),key=JSON.parse(raw.slice(index,keyEnd));
      index=skipWs(raw,keyEnd);if(raw[index++]!==':')throw new Error('Invalid conversation object');index=skipWs(raw,index);
      const start=index,end=valueEnd(raw,index);
      if(key==='chat_messages'&&raw[start]==='[')meta.message_count=countArrayItems(raw,start,end);
      else if(key==='account')meta.accountUuid=JSON.parse(raw.slice(start,end))?.uuid||'';
      else if(key==='_design')meta._design=JSON.parse(raw.slice(start,end));
      else if(key==='uuid'||key==='name'||key==='summary'||key==='created_at'||key==='updated_at'){
        const value=JSON.parse(raw.slice(start,end));meta[key]=typeof value==='string'?value:'';
      }
      index=skipWs(raw,end);if(raw[index]===',')index=skipWs(raw,index+1);else if(raw[index]!=='}')throw new Error('Invalid conversation delimiter');
    }
    return meta;
  }
  function scanTopLevelArray(text){
    let index=skipWs(text,0);if(text[index]!=='[')throw new Error('conversations.json 格式不正确');index=skipWs(text,index+1);
    const result=[];
    if(text[index]===']')return result;
    while(index<text.length){
      const end=valueEnd(text,index),raw=text.slice(index,end),meta=inspectConversation(raw);
      if(!meta.uuid)throw new Error('Conversation UUID is missing');
      result.push({raw,meta});index=skipWs(text,end);
      if(text[index]===','){index=skipWs(text,index+1);continue;}
      if(text[index]===']')return result;
      throw new Error('conversations.json 格式不正确');
    }
    throw new Error('conversations.json 格式不正确');
  }
  function materialize(record){
    if(parsedCache.has(record.meta.uuid)){
      const value=parsedCache.get(record.meta.uuid);parsedCache.delete(record.meta.uuid);parsedCache.set(record.meta.uuid,value);return value;
    }
    const value=JSON.parse(record.raw);if(record.meta._sourcePackage)value._sourcePackage=record.meta._sourcePackage;parsedCache.set(record.meta.uuid,value);
    while(parsedCache.size>PARSED_CACHE_LIMIT)parsedCache.delete(parsedCache.keys().next().value);
    return value;
  }
  const messageText=message=>{
    const parts=[];if(typeof message?.text==='string')parts.push(message.text);
    for(const block of list(message?.content)){if(typeof block?.text==='string')parts.push(block.text);if(typeof block?.thinking==='string')parts.push(block.thinking);if(typeof block?.name==='string')parts.push(block.name);if(typeof block?.file_path==='string')parts.push(block.file_path);if(typeof block?.input?.query==='string')parts.push(block.input.query);}
    return parts.join('\n');
  };
  let searchPromise=null;
  async function buildSearchIndex(){
    if(searchIndex)return searchIndex;if(searchPromise)return searchPromise;
    const source=records,sourceGeneration=generation,revision=contentRevision;
    const job=(async()=>{const index=new Map();let processed=0;for(const record of source){const conversation=materialize(record),parts=[record.meta.name,record.meta.summary];for(const message of list(conversation.chat_messages)){if(processed++%128===0){await new Promise(resolve=>setTimeout(resolve,0));if(generation!==sourceGeneration||revision!==contentRevision)throw new Error('stale data generation');}parts.push(messageText(message));}index.set(record.meta.uuid,parts.join('\n').toLowerCase());}if(generation!==sourceGeneration||revision!==contentRevision)throw new Error('stale data generation');searchIndex=index;return index;})();searchPromise=job;try{return await job;}finally{if(searchPromise===job)searchPromise=null;}
  }
  const responseGeneration=request=>Number(request.generation)||generation;
  const reply=(request,result)=>(request._port||self).postMessage({requestId:request.requestId,generation:responseGeneration(request),type:'result',result});
  const fail=(request,error)=>(request._port||self).postMessage({requestId:request.requestId,generation:responseGeneration(request),type:'error',error:error?.message||String(error)});
  function reset(nextGeneration){closeAnalyticsPort();for(const state of consumers)state.port.close();consumers.clear();auxiliaryRecords=[];largestImportChunk=0;searchPromise=null;generation=Number(nextGeneration)||generation+1;records=[];byUuid=new Map();decoder=null;textChunks=[];searchIndex=null;parsedCache.clear();}
  function cacheDb(){return new Promise((resolve,reject)=>{if(!self.indexedDB){resolve(null);return;}const request=indexedDB.open(CACHE_DB,1);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(CACHE_STORE))db.createObjectStore(CACHE_STORE);};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
  async function cacheGet(key){const db=await cacheDb();if(!db)return null;try{return await new Promise((resolve,reject)=>{const request=db.transaction(CACHE_STORE,'readonly').objectStore(CACHE_STORE).get(key);request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error);});}finally{db.close();}}
  async function cachePut(key,value){const db=await cacheDb();if(!db)return false;try{await new Promise((resolve,reject)=>{const transaction=db.transaction(CACHE_STORE,'readwrite');transaction.objectStore(CACHE_STORE).put(value,key);transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error||new Error('cache transaction aborted'));});return true;}finally{db.close();}}
  async function cacheDeleteAll(){const db=await cacheDb();if(!db)return false;try{await new Promise((resolve,reject)=>{const request=db.transaction(CACHE_STORE,'readwrite').objectStore(CACHE_STORE).clear();request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);});return true;}finally{db.close();}}
  function ingestSummary(cacheHit=false){let totalMsgs=0,minDate='',maxDate='';for(const record of records){const meta=record.meta;if(meta._design)continue;totalMsgs+=meta.message_count;const date=meta.created_at;if(date&&(!minDate||date<minDate))minDate=date;if(date&&(!maxDate||date>maxDate))maxDate=date;}return{conversations:records.map(record=>record.meta),totalMsgs,minDate,maxDate,lazy:true,cacheHit};}
  let packageStage=null,contentRevision=0,archiveAccounts=new Set(),packageIds=new Set();
  function finishIngest(request,text){
    if(packageStage){packageStage.records.push(...scanTopLevelArray(text));reply(request,{staged:true});return;}
    records=scanTopLevelArray(text);byUuid=new Map(records.map(record=>[record.meta.uuid,record]));searchIndex=null;parsedCache.clear();
    reply(request,ingestSummary(false));
  }
  self.onmessage=event=>{
    const request=event.data||{};
    Promise.resolve().then(async()=>{
      if(Number(request.generation)<generation||request._port&&(request._port!==importPort||Number(request.generation)!==generation))throw new Error('stale data generation');
      if(request.type==='importConnect'){importPort?.close();const port=importPort=request.payload.port;port.onmessage=event=>self.onmessage({data:{...event.data,_port:port}});port.start();reply(request,{ok:true});return;}
      if(request.type==='packageAbort'){packageStage=null;decoder=null;textChunks=[];reply(request,{ok:true});return;}
      if(request.type==='packageStart'){
        if(packageStage)throw new Error('Another package is being imported');
        for(const record of records)if(record.meta.accountUuid)archiveAccounts.add(record.meta.accountUuid);
        const incoming=request.payload.accounts||[];
        if(archiveAccounts.size&&incoming.some(id=>!archiveAccounts.has(id)))throw new Error('Account mismatch: open as a new archive');
        packageStage={...request.payload,records:[]};reply(request,{ok:true});return;
      }
      if(request.type==='packageCommit'){
        const stage=packageStage;if(!stage)throw new Error('No package transaction');
        if(packageIds.has(stage.id)){packageStage=null;reply(request,{...ingestSummary(false),revision:contentRevision,conflicts:[],duplicate:true});return;}
        const accounts=new Set(stage.accounts||[]);
        for(const record of stage.records){const id=record.meta.accountUuid;if(id)accounts.add(id);}
        if(accounts.size>1||archiveAccounts.size&&[...accounts].some(id=>!archiveAccounts.has(id)))throw new Error('Account mismatch: open as a new archive');
        const additions=[],conflicts=[],sourceGeneration=generation,revision=contentRevision;let yieldedAt=performance.now();const next=new Map(byUuid);
        for(const record of stage.records){
          // Semantic dedup can parse large records. Yield between records so a batch
          // of conflicts cannot monopolize Data Worker, and retire stale transactions.
          if(performance.now()-yieldedAt>=8){await new Promise(resolve=>setTimeout(resolve,0));yieldedAt=performance.now();}
          if(packageStage!==stage||generation!==sourceGeneration||contentRevision!==revision)throw new Error('Canceled package transaction');
          const previous=next.get(record.meta.uuid);if(previous){if(previous.raw===record.raw||JSON.stringify(JSON.parse(previous.raw))===JSON.stringify(JSON.parse(record.raw)))continue;
            const original=record.meta.uuid,alias=original+'~'+stage.id;const value=JSON.parse(record.raw);value.uuid=alias;record.raw=JSON.stringify(value);record.meta={...record.meta,uuid:alias,name:record.meta.name+' ['+stage.filename+']',original_uuid:original};conflicts.push(original);
          }
          record.meta.source=stage.filename;record.meta._sourcePackage=stage.id;next.set(record.meta.uuid,record);additions.push(record);
        }
        records=records.concat(additions);byUuid=next;for(const id of accounts)archiveAccounts.add(id);packageIds.add(stage.id);packageStage=null;contentRevision++;searchIndex=null;searchPromise=null;parsedCache.clear();closeAnalyticsPort();for(const consumer of consumers)closeRecordPort(consumer);
        reply(request,{...ingestSummary(false),revision:contentRevision,conflicts});return;
      }
      if(request.type==='reset'){
packageStage=null;contentRevision=0;archiveAccounts.clear();packageIds.clear();
importPort?.close();importPort=null;reset(request.generation);reply(request,{ok:true});return;}
      if(request.type==='ingestStart'){if(!packageStage)reset(request.generation);decoder=new TextDecoder();textChunks=[];reply(request,{ok:true});return;}
      if(request.type==='ingestChunk'){
        if(Number(request.generation)!==generation||!decoder)throw new Error('stale data generation');
        largestImportChunk=Math.max(largestImportChunk,request.payload?.byteLength||0);
        textChunks.push(decoder.decode(request.payload,{stream:true}));reply(request,{received:request.payload?.byteLength||0});return;
      }
      if(request.type==='ingestEnd'){
        if(Number(request.generation)!==generation||!decoder)throw new Error('stale data generation');
        textChunks.push(decoder.decode());const text=textChunks.join('');decoder=null;textChunks=[];finishIngest(request,text);return;
      }
      if(request.type==='ingest'){reset(request.generation);finishIngest(request,typeof request.payload==='string'?request.payload:new TextDecoder().decode(request.payload));return;}
      if(request.type==='cacheClear'){reply(request,{cleared:await cacheDeleteAll()});return;}
      if(Number(request.generation)!==generation)throw new Error('stale data generation');
      if(request.type==='cacheLoad'){
        const cached=await cacheGet(request.payload?.key);if(Number(request.generation)!==generation)throw new Error('stale data generation');if(!cached||cached.schema!==CACHE_SCHEMA||!Array.isArray(cached.records)){reply(request,{hit:false});return;}
        records=cached.records;byUuid=new Map(records.map(record=>[record.meta.uuid,record]));searchIndex=cached.searchIndex?new Map(cached.searchIndex):null;parsedCache.clear();reply(request,{hit:true,...ingestSummary(true)});return;
      }
      if(request.type==='cacheStore'){const key=request.payload?.key;if(!key)throw new Error('cache key missing');reply(request,{stored:await cachePut(key,{schema:CACHE_SCHEMA,createdAt:Date.now(),records,searchIndex:searchIndex?[...searchIndex]:null})});return;}
      if(request.type==='recordsDisconnect'){for(const state of consumers)if(state.id===request.payload.id){state.port.close();consumers.delete(state);}reply(request,{ok:true});return;}
      if(request.type==='recordsConnect'){connectRecords(request.payload.port,request.payload.id);reply(request,{ok:true});return;}
      if(request.type==='auxiliary'||request.type==='auxiliaryTexts'){
        const core=workerDomainCore();core.configure(request.context);const values=request.type==='auxiliaryTexts'?core.parseDesignExports(request.payload||[]):request.payload||[];
        auxiliaryRecords=values.map(value=>{const raw=JSON.stringify(value),{chat_messages,...meta}=value;return{raw,meta:{...meta,message_count:chat_messages?.length||0,_workerBacked:true}};});for(const record of auxiliaryRecords)byUuid.set(record.meta.uuid,record);reply(request,{conversations:auxiliaryRecords.map(r=>r.meta)});return;
      }
      if(request.type==='getConversation'){
const record=byUuid.get(request.payload?.uuid);if(!record)throw new Error('conversation not found');reply(request,materialize(record));return;}
      if(request.type==='releaseConversation'){parsedCache.delete(request.payload?.uuid);reply(request,{ok:true});return;}
      if(request.type==='search'){
        const query=String(request.payload?.query||'').trim().toLowerCase(),matches=[];
        if(!query){reply(request,{uuids:matches,indexed:searchIndex?.size||0});return;}
        const index=await buildSearchIndex();
        if(Number(request.generation)!==generation)throw new Error('stale data generation');
        for(const [uuid,text]of index)if(text.includes(query))matches.push(uuid);
        reply(request,{uuids:matches,indexed:index.size});return;
      }
      if(request.type==='analyticsConnect'){connectAnalytics(request.payload.port);reply(request,{ok:true});return;}
      if(request.type==='analyticsDisconnect'){closeAnalyticsPort();reply(request,{ok:true});return;}
      if(request.type==='projectIndex'){const result=await shared.calculateProjectIndex(records,materialize,request.payload?.projects||[],request.payload?.memoryData||null,()=>new Promise(resolve=>setTimeout(resolve,0)));parsedCache.clear();reply(request,result);return;}
      if(request.type==='debugState'){reply(request,{records:records.length,revision:contentRevision,packages:packageIds.size,parsed:parsedCache.size,indexed:searchIndex?.size||0,consumers:consumers.size,largestImportChunk,lazy:true});return;}
      throw new Error('unknown data worker request: '+request.type);
    }).catch(error=>fail(request,error));
  };
}
