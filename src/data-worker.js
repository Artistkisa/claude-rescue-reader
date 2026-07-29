function dataWorkerMain(){
  let generation=0,records=[],byUuid=new Map(),decoder=null,textChunks=[],searchIndex=null;
  const CACHE_DB='claude-rescue-reader-data-v1',CACHE_STORE='conversation-cache',CACHE_SCHEMA=1;
  const parsedCache=new Map(),PARSED_CACHE_LIMIT=3;
  const list=value=>Array.isArray(value)?value:[];
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
    parsedCache.clear();return searchIndex;
  }
  function calculateAnalytics(customStopZh=[]){
    const state={conversations:0,messages:0,human:0,assistant:0,humanCharacters:0,assistantCharacters:0,characters:0,thinking:0,tools:0,attachments:0,textBlocks:0,imageBlocks:0,artifacts:0,webSearches:0,emptyMessages:0,branchPoints:0,alternativeMessages:0,branchedConversations:0,conversationDurationMs:0,months:{},activeDates:{},weekdays:Array(7).fill(0),hours:Array(24).fill(0),models:{},depths:{},wordsZh:{},wordsEn:{},responseLatencies:[],longest:[]};
    const add=(object,key,n=1)=>{object[key]=(object[key]||0)+n;};
    const stopEn=new Set('a an and are as at be been but by can could did do does for from had has have he her hers him his how i if in into is it its may me might more most my no not of on or our ours she should so some than that the their theirs them then there these they this those to too us was we were what when where which who why will with would you your yours'.split(' '));
    const stopZh=new Set(('的 了 和 是 在 我 有 就 不 人 都 一 一个 上 也 很 到 说 要 去 你 会 着 没有 看 好 自己 这 那 里 为 以 及 与 或 而 被 把 对 从 等 中 能 可以 进行 使用 需要 如果 这个 这些 我们 你们 他们 因为 所以 然后 而且 但是 还是 已经 可能 现在 之后 之前 其中 通过 对于 关于 根据 按照 什么 怎么 为什么 哪个 哪些 哪里 这里 那里 这样 那样 这么 那么 不是 不能 无法 不会 不同 一些 一种 本身 目前 当前 直接 完全 真正 真实 所有 全部 整个 完整 相关 具体 一般 通常 主要 核心 内容 问题 文章 说明 数据 文件 图片 标题 结构 技术 逻辑 工具 系统 服务 设计 代码 网站 产品 项目 章节 分类 部分 方面 东西 事情 你的 我的 他的 她的 它的 我们的 你们的 他们的 各种 某些 任何 其他 还有 因此 例如 吧 呢 啊 哦 嗯 呀 嘿 哈 哈哈 诶 哎 唉 这类 这次 这点 这个问题 这种情况 就是 那个 那些 知道 的是 存在 或者 开始 几个 这种 出来 只是 只是说 还有点 一下 一下子 一直 一定 一样 一起 一共 多个 少数 许多 多少 时候 以后 以前 现在的 之后的 起来 下来 上来 回来 过去').split(/\s+/));
    for(const word of customStopZh)if(word)stopZh.add(String(word).toLowerCase());
    const segmenter=typeof Intl!=='undefined'&&Intl.Segmenter?new Intl.Segmenter('zh',{granularity:'word'}):null;
    const countWords=text=>{
      if(!text)return;
      for(const word of text.toLowerCase().match(/[a-z][a-z0-9'-]{2,}/g)||[])if(!stopEn.has(word))add(state.wordsEn,word);
      const chinese=(text.match(/[\u3400-\u9fff]+/g)||[]).join(' ');if(!chinese)return;
      if(segmenter){for(const part of segmenter.segment(chinese)){const word=part.segment.trim();if(part.isWordLike&&word.length>=2&&!stopZh.has(word))add(state.wordsZh,word);}}
      else for(const word of chinese.match(/[\u3400-\u9fff]{2,4}/g)||[])if(!stopZh.has(word))add(state.wordsZh,word);
    };
    for(const record of records){
      const conversation=materialize(record),messages=list(conversation.chat_messages);state.conversations++;
      let convChars=0,convBranched=false;const childCounts={},timed=[];
      for(const message of messages){
        state.messages++;const sender=message?.sender||'assistant';if(sender==='human')state.human++;else if(sender==='assistant')state.assistant++;
        let characters=0,thinking=0,tools=0,textBlocks=0,imageBlocks=0,artifacts=0,webSearches=0,wordText='';
        for(const block of list(message?.content)){
          if(!block||typeof block!=='object')continue;const type=block.type||'',name=String(block.name||'');
          if(type==='text'){const text=String(block.text||'');textBlocks++;characters+=text.length;wordText+=' '+text;}
          else if(type==='thinking'){const text=String(block.thinking||'');thinking++;characters+=text.length;wordText+=' '+text;}
          else if(type==='image')imageBlocks++;
          if(type==='tool_use'||type==='server_tool_use'){tools++;if(/show_widget|visualize|imagine|artifact/i.test(name))artifacts++;if(/web_search|web_fetch/i.test(name))webSearches++;}
        }
        if(!list(message?.content).length&&message?.text){wordText=String(message.text);characters=wordText.length;}
        if(sender==='human')state.humanCharacters+=characters;else if(sender==='assistant')state.assistantCharacters+=characters;
        state.characters+=characters;convChars+=characters;state.thinking+=thinking;state.tools+=tools;state.textBlocks+=textBlocks;state.imageBlocks+=imageBlocks;state.artifacts+=artifacts;state.webSearches+=webSearches;
        const attachments=list(message?.attachments).length+list(message?.files).length;state.attachments+=attachments;if(!list(message?.content).length&&!message?.text&&!attachments)state.emptyMessages++;
        const date=new Date(message?.created_at||message?.updated_at||''),timestamp=date.getTime();
        if(!Number.isNaN(timestamp)){const dateKey=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');add(state.activeDates,dateKey);add(state.months,dateKey.slice(0,7));state.weekdays[date.getDay()]++;state.hours[date.getHours()]++;timed.push({sender,uuid:message?.uuid||'',parentUuid:message?.parent_message_uuid||'',timestamp});}
        const model=message?.model||message?.model_slug||message?.message?.model||'';if(model)add(state.models,model);countWords(wordText);
        if(message?.parent_message_uuid)add(childCounts,message.parent_message_uuid);
      }
      for(const count of Object.values(childCounts))if(count>1){state.branchPoints++;state.alternativeMessages+=count-1;convBranched=true;}if(convBranched)state.branchedConversations++;
      timed.sort((a,b)=>a.timestamp-b.timestamp);if(timed.length>1)state.conversationDurationMs+=timed.at(-1).timestamp-timed[0].timestamp;
      const timedByUuid=Object.fromEntries(timed.filter(item=>item.uuid).map(item=>[item.uuid,item]));for(const item of timed){const parent=timedByUuid[item.parentUuid];if(item.sender==='assistant'&&parent?.sender==='human'){const latency=item.timestamp-parent.timestamp;if(latency>=0&&latency<=86400000)state.responseLatencies.push(latency);}}
      const depth=messages.length,depthKey=depth<=5?'1–5':depth<=10?'6–10':depth<=25?'11–25':depth<=50?'26–50':depth<=100?'51–100':'101+';add(state.depths,depthKey);
      state.longest.push({uuid:record.meta.uuid,title:record.meta.name,messages:depth,characters:convChars,updatedAt:record.meta.updated_at||record.meta.created_at});
    }
    parsedCache.clear();state.longest.sort((a,b)=>b.messages-a.messages||b.characters-a.characters);state.longest=state.longest.slice(0,10);state.wordsZh=Object.entries(state.wordsZh).sort((a,b)=>b[1]-a[1]).slice(0,40);state.wordsEn=Object.entries(state.wordsEn).sort((a,b)=>b[1]-a[1]).slice(0,40);state.responseLatencies.sort((a,b)=>a-b);state.medianResponseMs=state.responseLatencies.length?state.responseLatencies[Math.floor(state.responseLatencies.length/2)]:0;delete state.responseLatencies;
    const dates=Object.keys(state.activeDates).sort();let streak=0,longestStreak=0,previous=NaN;for(const date of dates){const day=Date.parse(date+'T00:00:00Z')/86400000;streak=day===previous+1?streak+1:1;longestStreak=Math.max(longestStreak,streak);previous=day;}state.activeDays=dates.length;state.longestStreak=longestStreak;delete state.activeDates;
    return state;
  }
  function calculateProjectIndex(projects,memoryData){
    projects=list(projects);const map={},evidence={},stats={};
    const normalize=value=>String(value||'').trim().replace(/^\/mnt\/project\//,'').toLowerCase().replace(/[?#].*/,''),projectList=value=>Array.isArray(value)?value:(value&&typeof value==='object'?Object.values(value):[]);
    const docOwners=new Map();for(const project of projects){stats[project.uuid]={conversations:0,messages:0,chars:0,minDate:'',maxDate:''};for(const doc of projectList(project.docs)){if(!doc?.filename)continue;const filename=normalize(doc.filename);if(!docOwners.has(filename))docOwners.set(filename,new Set());docOwners.get(filename).add(project.uuid);}}
    const uniqueOwner=value=>{const owners=docOwners.get(normalize(value));return owners?.size===1?[...owners][0]:'';};
    const projectDocText={};for(const project of projects)projectDocText[project.uuid]=projectList(project.docs).flatMap(doc=>[doc?.filename||'',String(doc?.content||'').slice(0,2000)]).join(' ').toLowerCase();
    const stopWords=new Set('the and for with from this that project system analysis research review story world character characters setting design create help'.split(' '));
    const memoryKeywords=new Map(),keywordOwners=new Map();
    for(const project of projects){
      const raw=memoryData?.project_memories?.[project.uuid],memory=typeof raw==='string'?raw:JSON.stringify(raw||'');const words=new Set();
      for(const match of memory.matchAll(/\*\*([^*]+)\*\*/g))for(const part of match[1].replace(/[()（）：:,，、/\s]+/g,' ').split(' ')){const clean=part.toLowerCase().replace(/[^\w\u4e00-\u9fff]/g,'');if(clean.length>=2&&clean.length<=30&&!stopWords.has(clean)&&!/^[a-z]{1,4}$/.test(clean)&&!/^\d+$/.test(clean))words.add(clean);}
      memoryKeywords.set(project.uuid,[...words]);for(const keyword of words){if(!keywordOwners.has(keyword))keywordOwners.set(keyword,new Set());keywordOwners.get(keyword).add(project.uuid);}
    }
    const appears=(text,keyword)=>{if(/[\u4e00-\u9fff]/.test(keyword))return text.includes(keyword);const escaped=keyword.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp('(^|[^a-z0-9_])'+escaped+'([^a-z0-9_]|$)','i').test(text);};
    for(const record of records){
      const conversation=materialize(record),messages=list(conversation.chat_messages),exactCandidates=new Set(),exactFiles=new Set(),queries=[];
      for(const message of messages)for(const block of list(message?.content)){
        if(!block)continue;
        if(block.type==='local_resource'){const owner=uniqueOwner(block.file_path);if(owner){exactCandidates.add(owner);exactFiles.add(normalize(block.file_path));}}
        if(block.type==='tool_result')for(const child of projectList(block.content)){if(child?.type!=='text')continue;for(const ref of String(child.text||'').match(/\/mnt\/project\/([^\n\t ]+)/g)||[]){const owner=uniqueOwner(ref);if(owner){exactCandidates.add(owner);exactFiles.add(normalize(ref));}}}
        if(block.type==='tool_use'&&block.name==='project_knowledge_search'&&block.input?.query)queries.push(String(block.input.query).toLowerCase());
      }
      if(exactCandidates.size===1){map[record.meta.uuid]=[...exactCandidates][0];evidence[record.meta.uuid]={method:'file',confidence:.98,files:[...exactFiles],queries:[],keywords:[]};}
      if(!map[record.meta.uuid]&&queries.length){
        const scores={};for(const project of projects){let score=0,text=projectDocText[project.uuid]||'';for(const query of queries)for(const token of query.split(/\s+/).map(value=>value.replace(/[^\w\u4e00-\u9fff]/g,'')).filter(value=>value.length>=2&&!stopWords.has(value)))if(text.includes(token))score++;if(score)scores[project.uuid]=score;}
        const ranked=Object.entries(scores).sort((a,b)=>b[1]-a[1]),best=ranked[0],runner=ranked[1]?.[1]||0;if(best&&best[1]>=2&&best[1]>runner){map[record.meta.uuid]=best[0];evidence[record.meta.uuid]={method:'knowledge',confidence:Math.min(.94,.68+best[1]*.05+(best[1]-runner)*.04),files:[],queries:[...new Set(queries)],keywords:[]};}
      }
      if(!map[record.meta.uuid]){
        const title=record.meta.name.toLowerCase(),summary=record.meta.summary.toLowerCase(),ranked=[];
        for(const project of projects){let score=0;for(const keyword of memoryKeywords.get(project.uuid)||[]){if(keywordOwners.get(keyword)?.size!==1)continue;if(appears(title,keyword))score+=3;else if(appears(summary,keyword))score++;}const name=String(project.name||'').trim().toLowerCase();if(name.length>=2&&appears(title,name))score+=8;if(score)ranked.push([project.uuid,score]);}
        ranked.sort((a,b)=>b[1]-a[1]);const best=ranked[0],runner=ranked[1]?.[1]||0;if(best&&best[1]>=4&&best[1]-runner>=2){const matched=(memoryKeywords.get(best[0])||[]).filter(keyword=>appears(title,keyword)||appears(summary,keyword));map[record.meta.uuid]=best[0];evidence[record.meta.uuid]={method:'keyword',confidence:Math.min(.88,.52+best[1]*.035+(best[1]-runner)*.025),files:[],queries:[],keywords:matched.slice(0,12)};}
      }
      const projectUuid=map[record.meta.uuid],stat=stats[projectUuid];if(stat){stat.conversations++;stat.messages+=messages.length;for(const message of messages){for(const block of list(message?.content)){if(typeof block?.text==='string')stat.chars+=block.text.length;if(typeof block?.thinking==='string')stat.chars+=block.thinking.length;}const date=message?.created_at||'';if(date&&(!stat.minDate||date<stat.minDate))stat.minDate=date;if(date&&(!stat.maxDate||date>stat.maxDate))stat.maxDate=date;}}
    }
    parsedCache.clear();return{map,evidence,stats};
  }
  const reply=(request,result)=>self.postMessage({requestId:request.requestId,generation,type:'result',result});
  const fail=(request,error)=>self.postMessage({requestId:request.requestId,generation,type:'error',error:error?.message||String(error)});
  function reset(nextGeneration){generation=Number(nextGeneration)||generation+1;records=[];byUuid=new Map();decoder=null;textChunks=[];searchIndex=null;parsedCache.clear();}
  function cacheDb(){return new Promise((resolve,reject)=>{if(!self.indexedDB){resolve(null);return;}const request=indexedDB.open(CACHE_DB,1);request.onupgradeneeded=()=>request.result.createObjectStore(CACHE_STORE);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
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
      if(request.type==='analytics'){reply(request,calculateAnalytics(request.payload?.customStopZh||[]));return;}
      if(request.type==='projectIndex'){reply(request,calculateProjectIndex(request.payload?.projects||[],request.payload?.memoryData||null));return;}
      if(request.type==='debugState'){reply(request,{records:records.length,parsed:parsedCache.size,indexed:searchIndex?.size||0,lazy:true});return;}
      throw new Error('unknown data worker request: '+request.type);
    }).catch(error=>fail(request,error));
  };
}
