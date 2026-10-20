function dataWorkerMain(){
  let generation=0,records=[],byUuid=new Map(),decoder=null,textChunks=[],searchIndex=null;
  const CACHE_DB='claude-rescue-reader-data-v1',CACHE_STORE='conversation-cache',CACHE_SCHEMA=1;
  const parsedCache=new Map(),PARSED_CACHE_LIMIT=3;
  const list=value=>Array.isArray(value)?value:[];
  const shared=archiveAnalysisCore();
  let analyticsPort=null,analyticsStream=null;
  function closeAnalyticsPort(){analyticsStream=null;if(analyticsPort)analyticsPort.close();analyticsPort=null;}
  function connectAnalytics(port){
    closeAnalyticsPort();analyticsPort=port;
    port.onmessage=event=>{
      const message=event.data||{};
      if(message.generation!==generation)return;
      if(message.type==='streamCancel'){if(analyticsStream?.requestId===message.requestId)analyticsStream=null;return;}
      if(message.type==='streamStart')analyticsStream={requestId:message.requestId,index:0,awaiting:false,batchId:0};
      else if(message.type==='batchAck'&&analyticsStream?.requestId===message.requestId&&message.batchId===analyticsStream.batchId)analyticsStream.awaiting=false;
      else return;
      const stream=analyticsStream;if(!stream||stream.awaiting)return;
      try{
        const items=[];let bytes=0;
        while(stream.index<records.length&&items.length<4){
          const record=records[stream.index],size=new TextEncoder().encode(record.raw).byteLength;
          if(items.length&&bytes+size>512*1024)break;
          items.push({raw:record.raw,meta:record.meta});bytes+=size;stream.index++;
          if(bytes>=512*1024)break;
        }
        stream.awaiting=true;
        port.postMessage({type:'batch',generation,requestId:stream.requestId,batchId:++stream.batchId,items,bytes,done:stream.index===records.length,total:records.length,loaded:stream.index});
      }catch(error){port.postMessage({type:'error',generation,requestId:stream.requestId,error:error.message});analyticsStream=null;}
    };
    port.start();
  }
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
    const value=JSON.parse(record.raw);parsedCache.set(record.meta.uuid,value);
    while(parsedCache.size>PARSED_CACHE_LIMIT)parsedCache.delete(parsedCache.keys().next().value);
    return value;
  }
  const messageText=message=>{
    const parts=[];if(typeof message?.text==='string')parts.push(message.text);
    for(const block of list(message?.content)){if(typeof block?.text==='string')parts.push(block.text);if(typeof block?.thinking==='string')parts.push(block.thinking);if(typeof block?.name==='string')parts.push(block.name);if(typeof block?.file_path==='string')parts.push(block.file_path);if(typeof block?.input?.query==='string')parts.push(block.input.query);}
    return parts.join('\n');
  };
  function buildSearchIndex(){
    if(searchIndex)return searchIndex;
    searchIndex=new Map();
    for(const record of records){const conversation=materialize(record),text=[record.meta.name,record.meta.summary,...list(conversation.chat_messages).map(messageText)].join('\n').toLowerCase();searchIndex.set(record.meta.uuid,text);}
    return searchIndex;
  }
  function calculateBehavior(){
    const out={conversations:records.length,messages:0,tools:0,toolResults:0,paired:0,unpairedUse:0,unpairedResult:0,errors:0,approvals:0,mcp:0,structured:0,hiddenResults:0,thinking:0,thinkingHidden:0,thinkingTruncated:0,thinkingCutoff:0,thinkingSummary:0,thinkingSigned:0,thinkingDurationMs:0,quality:{refusal:0,fallback:0,latency:0,empty:0,truncated:0},examples:[]};
    const stable=value=>{if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object'){const result={};for(const key of Object.keys(value).sort())result[key]=stable(value[key]);return result;}return value;},different=(a,b)=>JSON.stringify(stable(a))!==JSON.stringify(stable(b));
    const uses=new Map(),results=new Map(),refusal=/(?:我(?:不能|无法|不可以|不会)(?:帮助|协助|提供|执行|生成|完成)|抱歉[^。！？\n]{0,40}(?:不能|无法)|\b(?:can't|cannot|won't|unable to)\s+(?:help|assist|provide|comply|create|generate|do that)\b)/iu,fallback=/(?:当前模型|这个模型|能力受限|降级模式|只能提供[^。！？\n]{0,18}(?:概括|一般性信息|高层次建议))|\b(?:as an ai|language model|model limitation|not available in this mode)\b/iu;
    for(const record of records){const conversation=materialize(record),messages=list(conversation.chat_messages);out.messages+=messages.length;let previous=null;for(const message of messages){const text=messageText(message).trim(),time=Date.parse(message.created_at||message.updated_at||'')||0;if(!text&&!list(message.content).some(block=>/tool|thinking|result/i.test(String(block?.type||''))))out.quality.empty++;if(message.sender==='assistant'){if(refusal.test(text))out.quality.refusal++;if(fallback.test(text))out.quality.fallback++;if(/(?:\.\.\.|…|回答未完|to be continued)$/i.test(text))out.quality.truncated++;if(previous?.sender==='human'&&previous.time&&time&&time-previous.time>30*60*1000)out.quality.latency++;}previous={sender:message.sender,time};
        for(const block of list(message.content)){if(!block||typeof block!=='object')continue;const type=String(block.type||'');if(type==='tool_use'||type==='server_tool_use'){out.tools++;const id=block.id||block.tool_use_id;if(id)uses.set(id,block);if(block.approval_key||block.approval_key_legacy||block.approval_options)out.approvals++;if(block.is_mcp_app||block.mcp_server_url||block.integration_name)out.mcp++;if(out.examples.length<8)out.examples.push({name:block.name||block.tool_identifier||'unknown',status:'调用'});}else if(type==='tool_result'||type==='web_search_tool_result'||type==='web_search_result'){out.toolResults++;const id=block.tool_use_id||block.id;if(id)results.set(id,block);if(block.is_error)out.errors++;if(block.structured_content||block.meta)out.structured++;const hasDisplay=block.display_content!==undefined&&block.display_content!==null,hasContent=block.content!==undefined&&block.content!==null;if((hasDisplay&&hasContent&&different(block.display_content,block.content))||(!hasDisplay&&(block.structured_content||block.meta)))out.hiddenResults++;}else if(type==='thinking'){out.thinking++;if(block.hidden||block.thinking_hidden)out.thinkingHidden++;if(block.truncated||block.cut_off)out.thinkingTruncated++;if(block.cut_off)out.thinkingCutoff++;if(block.summaries||block.alternative_display_type)out.thinkingSummary++;if(block.signature)out.thinkingSigned++;const start=Date.parse(block.start_timestamp),stop=Date.parse(block.stop_timestamp);if(start&&stop&&stop>=start)out.thinkingDurationMs+=stop-start;}}
      }}
    for(const id of uses.keys())if(results.has(id))out.paired++;else out.unpairedUse++;for(const id of results.keys())if(!uses.has(id))out.unpairedResult++;return out;
  }
  const responseGeneration=request=>Number(request.generation)||generation;
  const reply=(request,result)=>self.postMessage({requestId:request.requestId,generation:responseGeneration(request),type:'result',result});
  const fail=(request,error)=>self.postMessage({requestId:request.requestId,generation:responseGeneration(request),type:'error',error:error?.message||String(error)});
  function reset(nextGeneration){closeAnalyticsPort();generation=Number(nextGeneration)||generation+1;records=[];byUuid=new Map();decoder=null;textChunks=[];searchIndex=null;parsedCache.clear();}
  function cacheDb(){return new Promise((resolve,reject)=>{if(!self.indexedDB){resolve(null);return;}const request=indexedDB.open(CACHE_DB,1);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(CACHE_STORE))db.createObjectStore(CACHE_STORE);};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
  async function cacheGet(key){const db=await cacheDb();if(!db)return null;try{return await new Promise((resolve,reject)=>{const request=db.transaction(CACHE_STORE,'readonly').objectStore(CACHE_STORE).get(key);request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error);});}finally{db.close();}}
  async function cachePut(key,value){const db=await cacheDb();if(!db)return false;try{await new Promise((resolve,reject)=>{const transaction=db.transaction(CACHE_STORE,'readwrite');transaction.objectStore(CACHE_STORE).put(value,key);transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error||new Error('cache transaction aborted'));});return true;}finally{db.close();}}
  async function cacheDeleteAll(){const db=await cacheDb();if(!db)return false;try{await new Promise((resolve,reject)=>{const request=db.transaction(CACHE_STORE,'readwrite').objectStore(CACHE_STORE).clear();request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);});return true;}finally{db.close();}}
  function ingestSummary(cacheHit=false){let totalMsgs=0,minDate='',maxDate='';for(const record of records){const meta=record.meta;totalMsgs+=meta.message_count;const date=meta.created_at;if(date&&(!minDate||date<minDate))minDate=date;if(date&&(!maxDate||date>maxDate))maxDate=date;}return{conversations:records.map(record=>record.meta),totalMsgs,minDate,maxDate,lazy:true,cacheHit};}
  function finishIngest(request,text){
    records=scanTopLevelArray(text);byUuid=new Map(records.map(record=>[record.meta.uuid,record]));searchIndex=null;parsedCache.clear();
    reply(request,ingestSummary(false));
  }
  self.onmessage=event=>{
    const request=event.data||{};
    Promise.resolve().then(async()=>{
      if(request.type==='reset'){reset(request.generation);reply(request,{ok:true});return;}
      if(request.type==='ingestStart'){reset(request.generation);decoder=new TextDecoder();reply(request,{ok:true});return;}
      if(request.type==='ingestChunk'){
        if(Number(request.generation)!==generation||!decoder)throw new Error('stale data generation');
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
        const cached=await cacheGet(request.payload?.key);if(!cached||cached.schema!==CACHE_SCHEMA||!Array.isArray(cached.records)){reply(request,{hit:false});return;}
        records=cached.records;byUuid=new Map(records.map(record=>[record.meta.uuid,record]));searchIndex=cached.searchIndex?new Map(cached.searchIndex):null;parsedCache.clear();reply(request,{hit:true,...ingestSummary(true)});return;
      }
      if(request.type==='cacheStore'){const key=request.payload?.key;if(!key)throw new Error('cache key missing');reply(request,{stored:await cachePut(key,{schema:CACHE_SCHEMA,createdAt:Date.now(),records,searchIndex:searchIndex?[...searchIndex]:null})});return;}
      if(request.type==='getConversation'){const record=byUuid.get(request.payload?.uuid);if(!record)throw new Error('conversation not found');reply(request,materialize(record));return;}
      if(request.type==='releaseConversation'){parsedCache.delete(request.payload?.uuid);reply(request,{ok:true});return;}
      if(request.type==='search'){
        const query=String(request.payload?.query||'').trim().toLowerCase(),matches=[];
        if(query)for(const [uuid,text]of buildSearchIndex())if(text.includes(query))matches.push(uuid);
        reply(request,{uuids:matches,indexed:searchIndex.size});return;
      }
      if(request.type==='analyticsConnect'){connectAnalytics(request.payload.port);reply(request,{ok:true});return;}
      if(request.type==='analyticsDisconnect'){closeAnalyticsPort();reply(request,{ok:true});return;}
      if(request.type==='behavior'){reply(request,calculateBehavior());return;}
      if(request.type==='projectIndex'){const result=await shared.calculateProjectIndex(records,materialize,request.payload?.projects||[],request.payload?.memoryData||null,()=>new Promise(resolve=>setTimeout(resolve,0)));parsedCache.clear();reply(request,result);return;}
      if(request.type==='debugState'){reply(request,{records:records.length,parsed:parsedCache.size,indexed:searchIndex?.size||0,lazy:true});return;}
      throw new Error('unknown data worker request: '+request.type);
    }).catch(error=>fail(request,error));
  };
}
