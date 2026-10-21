const featureWorkers=new Map();let featureSequence=0,readerWindowVersion=0,readerSearchVersion=0,readerFocusVersion=0,readerSearchTimer=null,readerSearchState={query:'',total:0,index:-1,page:0,rows:[]};
const zipEntries=new Map(),zipMediaPending=new Map(),zipUncachedUrls=new Set();let zipMediaObserver=null;
let backgroundFeatures=Promise.resolve();
function queueBackgroundHighlight(payload,valid){
  const generation=dataWorkerGeneration;
  const job=backgroundFeatures.catch(()=>{}).then(async()=>{
    while(featureWorkers.get('task')?.pending.size){if(generation!==dataWorkerGeneration||!valid())return{skipped:true};await new Promise(resolve=>setTimeout(resolve,25));}
    if(generation!==dataWorkerGeneration||!valid())return{skipped:true};
    return featureRequest('task','highlight',{...payload,priority:'background'});
  });backgroundFeatures=job;return job;
}
const abortFeature=()=>Object.assign(new Error(t('已取消：已选择更新的数据')),{name:'AbortError'});
function destroyFeature(kind,expected){
  const state=featureWorkers.get(kind);if(!state||expected&&state!==expected)return;featureWorkers.delete(kind);if(kind!=='import'&&dataWorker&&state.generation===dataWorkerGeneration)void dataWorkerRequest('recordsDisconnect',{id:state.id}).catch(()=>{});state.worker.terminate();URL.revokeObjectURL(state.url);state.port?.close();for(const p of state.pending.values())p.reject(abortFeature());state.pending.clear();state.rejectReady?.(abortFeature());
}
function resetFeatureWorkers(){for(const kind of [...featureWorkers.keys()])destroyFeature(kind);openConversationGeneration++;readerWindowVersion++;readerSearchVersion++;clearTimeout(readerSearchTimer);readerSearchState={query:'',total:0,index:-1,page:0,rows:[]};zipEntries.clear();zipMediaPending.clear();for(const url of zipUncachedUrls)URL.revokeObjectURL(url);zipUncachedUrls.clear();zipMediaObserver?.disconnect();behaviorResult=null;behaviorPromise=null;qualityCache.clear();}
function cancelFeature(kind,type){const state=featureWorkers.get(kind);if(state)state.worker.postMessage({type:'cancel',generation:state.generation,taskType:type});}
function resetReaderSearch(){readerSearchVersion++;readerWindowVersion++;clearTimeout(readerSearchTimer);readerSearchState={query:'',total:0,index:-1,page:0,rows:[]};clearCSearchMarks();const input=document.getElementById('csearch');if(input)input.value='';}
async function ensureFeature(kind){
  let state=featureWorkers.get(kind);if(state&&state.generation!==dataWorkerGeneration){destroyFeature(kind);state=null;}
  if(state){await state.ready;return state;}
  const libraries=kind==='import'?['zip']:kind==='reader'?['markdown','highlight']:['markdown','highlight'];
  const sources=libraries.map(name=>Uint8Array.from(atob(WORKER_LIBRARIES[name].base64),char=>char.charCodeAt(0)));
  const main=kind==='import'?importWorkerMain:kind==='reader'?readerWorkerMain:taskWorkerMain;
  const url=URL.createObjectURL(new Blob([...sources,'\n',exportFormatCore.toString(),'\n',workerDomainCore.toString(),'\n',featureWorkerRuntime.toString(),'\n('+main.toString()+')()'],{type:'text/javascript'}));
  let worker;try{worker=new Worker(url);}catch(error){URL.revokeObjectURL(url);throw error;}
  state={worker,url,id:kind+':'+(++featureSequence),generation:dataWorkerGeneration,pending:new Map(),port:null};
  state.ready=new Promise((resolve,reject)=>{state.resolveReady=resolve;state.rejectReady=reject;});state.ready.catch(()=>{});featureWorkers.set(kind,state);
  worker.onmessage=event=>{
    const message=event.data||{};if(message.generation!==state.generation||state.generation!==dataWorkerGeneration)return;
    if(message.type==='ready'){state.resolveReady();state.rejectReady=null;return;}
    const pending=state.pending.get(message.requestId);if(!pending)return;
    if(message.type==='progress'){pending.progress?.(message.progress);return;}
    state.pending.delete(message.requestId);
    if(message.type==='result')pending.resolve(message.result);else pending.reject(message.type==='canceled'?abortFeature():new Error(message.error||'Worker error'));
  };
  worker.onerror=event=>{const error=new Error(event.message||'Worker error');state.rejectReady?.(error);for(const p of state.pending.values())p.reject(error);state.pending.clear();destroyFeature(kind,state);};
  try{const channel=new MessageChannel();state.port=channel.port1;await dataWorkerRequest(kind==='import'?'importConnect':'recordsConnect',{port:channel.port1,id:state.id},[channel.port1]);worker.postMessage({type:'init',generation:state.generation,requestId:0,port:channel.port2},[channel.port2]);await state.ready;return state;}catch(error){destroyFeature(kind,state);throw error;}
}
async function featureRequest(kind,type,payload={},progress){
  const state=await ensureFeature(kind),requestId=++featureSequence;
  if(state.generation!==dataWorkerGeneration||featureWorkers.get(kind)!==state)throw abortFeature();
  if(kind==='task'&&type==='behavior'&&state.pending.size)throw new Error(t('任务进行中，请稍后重试'));
  return new Promise((resolve,reject)=>{state.pending.set(requestId,{resolve,reject,progress});state.worker.postMessage({type,generation:state.generation,requestId,payload:{...payload,lang:currentLang},context:{lang:currentLang,labels:EN}});});
}
function conversationTaskPayload(conv=currentConv){return{uuid:conv?.uuid,...(!conv?{}:conv._readerBacked||conv._workerBacked?{}:{conversation:conv}),mode:conversationTreeMode,choices:{...branchChoices}};}
async function startZipImport(file,button){
  const generation=++dataLoadGeneration;useDataWorkerGeneration(generation);await dataWorkerRequest('reset',null,[],generation);clearLocalMedia();
  const result=await featureRequest('import','open',{file},progress=>{if(generation===dataWorkerGeneration)button.textContent=t('解压中，请稍候…')+' '+Math.round(progress.percent||0)+'%';});
  if(generation!==dataWorkerGeneration)return;
  for(const entry of result.images)zipEntries.set(mediaKey(entry),entry);
  await ingestData({_importResult:result,_generation:generation},[],null,[],button);
}
function trimZipMedia(){
  const mounted=new Set([...document.querySelectorAll('#messages img')].map(el=>el.src));let entries=[...LOCAL_MEDIA.entries()].filter(([,item])=>item.zip),bytes=entries.reduce((n,[,item])=>n+item.size,0);
  for(const url of zipUncachedUrls)if(!mounted.has(url)){URL.revokeObjectURL(url);zipUncachedUrls.delete(url);}
  for(const [key,item]of entries){if(entries.length<=32&&bytes<=64*1024*1024&&item.size<=64*1024*1024)break;if(mounted.has(item.url))continue;URL.revokeObjectURL(item.url);LOCAL_MEDIA.delete(key);bytes-=item.size;entries=entries.filter(([k])=>k!==key);}
}
function initZipMedia(root){
  zipMediaObserver?.disconnect();trimZipMedia();
  const load=async element=>{
    const key=element.dataset.zipMedia,entry=zipEntries.get(key),generation=dataWorkerGeneration;if(!entry)return;
    try{let cached=LOCAL_MEDIA.get(key);if(cached){LOCAL_MEDIA.delete(key);LOCAL_MEDIA.set(key,cached);}else{let promise=zipMediaPending.get(key);if(!promise){promise=featureRequest('import',typeof entry==='string'?'attachment':'resource',typeof entry==='string'?{name:entry}:entry);zipMediaPending.set(key,promise);}const {blob}=await promise;zipMediaPending.delete(key);if(generation!==dataWorkerGeneration||!element.isConnected)return;if(blob.size>64*1024*1024){cached={url:URL.createObjectURL(blob),name:typeof entry==='string'?entry:entry.path,size:blob.size};zipUncachedUrls.add(cached.url);}else{cached=LOCAL_MEDIA.get(key)||addLocalMedia(blob,typeof entry==='string'?entry:entry.path);if(!cached)throw new Error('Unsupported attachment');if(key!==mediaKey(cached.name)){LOCAL_MEDIA.delete(mediaKey(cached.name));LOCAL_MEDIA.set(key,cached);}cached.zip=true;cached.size=blob.size;}}
      if(!element.isConnected)return;const old=element.querySelector('.file-icon'),image=document.createElement('img');image.src=cached.url;image.alt=cached.name;if(old)old.replaceWith(image);trimZipMedia();
    }catch(error){zipMediaPending.delete(key);if(error.name!=='AbortError'){element.title=error.message;const retry=document.createElement('button');retry.className='fbtn';retry.textContent=t('重试');retry.onclick=()=>{retry.remove();void load(element);};element.appendChild(retry);}}
  };
  const elements=[...root.querySelectorAll('[data-zip-media]')];
  if(typeof IntersectionObserver==='undefined'){elements.forEach(load);return;}
  zipMediaObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){zipMediaObserver.unobserve(entry.target);void load(entry.target);}},{root,rootMargin:'300px'});elements.forEach(el=>zipMediaObserver.observe(el));
}
async function renderReaderWindow(options={}){
  if(!currentConv?._readerBacked)return;const version=++readerWindowVersion,uuid=currentConv.uuid;
  const payload={mode:conversationTreeMode,choices:{...branchChoices}};
  if(options.focus)payload.focus=options.focus;if(options.segment)payload.segment=options.segment;
  if(Number.isInteger(options.startIndex)){payload.start=options.startIndex;payload.end=options.startIndex+100;}
  try{const result=await featureRequest('reader','window',payload);if(version!==readerWindowVersion||uuid!==currentConv?.uuid)return;
    renderMessages(result.messages.flatMap(message=>message._warning?[message._warning,message]:[message]),{...options,startIndex:0,_mountOnly:true});messageRenderState={convUuid:uuid,linear:[],start:result.start,end:result.end,total:result.total};
    const container=document.getElementById('messages'),nav=document.createElement('div');nav.className='load-earlier-wrap';
    for(const message of result.messages){
      const parts=[message._partial,...(message.content||[]).map(block=>block?._partial)].filter(Boolean);
      for(const part of parts){const field=container.querySelector('[data-source-index="'+message._sourceIndex+'"] [data-reader-field="'+part.key+'"]');if(!field)continue;field.dataset.partialStart=part.start;field.dataset.partialEnd=part.end;
        const code=field.querySelector('code[id]');if(code){const copy=document.createElement('button');copy.className='fbtn';copy.textContent=t('复制');copy.onclick=()=>void copyCode(copy,code.id);field.appendChild(copy);}
        for(const [label,offset]of [[t('上一段'),Math.max(0,part.start-32768)],[t('下一段'),part.end]]){if(offset===part.start||offset>=part.total)continue;const button=document.createElement('button');button.textContent=label;button.className='fbtn';button.onclick=()=>void renderReaderWindow({startIndex:result.start,segment:{sourceIndex:message._sourceIndex,key:part.key,offset}});field.appendChild(button);}
        const count=document.createElement('small');count.textContent=' '+(part.start+1)+'–'+part.end+' / '+part.total;field.appendChild(count);
      }
    }
    for(const element of container.querySelectorAll('[data-large-code]')){
      const id=element.dataset.largeCode,language=element.dataset.language,code=element.textContent;
      void queueBackgroundHighlight({code,language},()=>version===readerWindowVersion&&element.isConnected).then(response=>{if(!response.skipped&&version===readerWindowVersion&&element.isConnected)element.innerHTML=response.html;}).catch(()=>{});
    }
    if(result.start>0){const button=document.createElement('button');button.className='load-earlier-btn';button.textContent='↑ '+t('加载更早消息')+' ('+result.start+')';button.onclick=()=>void renderReaderWindow({startIndex:Math.max(0,result.start-40)});nav.appendChild(button);container.prepend(nav);}
    if(result.end<result.total){const button=document.createElement('button');button.className='load-earlier-btn';button.textContent='↓ '+t('加载更新消息');button.onclick=()=>void renderReaderWindow({startIndex:result.end});container.appendChild(button);}
    initZipMedia(container);return result;
  }catch(error){if(error.name==='AbortError')return;const container=document.getElementById('messages');container.textContent=error.message;const retry=document.createElement('button');retry.textContent=t('重试');retry.onclick=()=>void openConv(uuid);container.appendChild(retry);}
}
async function readerSearch(query){
  const version=++readerSearchVersion;clearCSearchMarks();readerSearchState={query:query.trim(),total:0,index:-1,page:0,rows:[]};if(!query.trim())return;
  try{const result=await featureRequest('reader','search',{query,mode:conversationTreeMode,choices:{...branchChoices},page:0});if(version!==readerSearchVersion)return;Object.assign(readerSearchState,result,{index:result.total?0:-1});await focusReaderMatch();}catch(error){if(error.name!=='AbortError')document.getElementById('csearch-count').textContent=error.message;}
}
async function focusReaderMatch(){
  const state=readerSearchState;if(!state.total){document.getElementById('csearch-count').textContent='0 '+t('匹配');return;}
  const version=readerSearchVersion,focusVersion=++readerFocusVersion,page=Math.floor(state.index/100);
  try{
    if(page!==state.page){const result=await featureRequest('reader','search',{query:state.query,mode:conversationTreeMode,choices:{...branchChoices},page});if(version!==readerSearchVersion||focusVersion!==readerFocusVersion)return;state.page=page;state.rows=result.rows;}
    const hit=state.rows[state.index%100];if(!hit)return;
    const previousField=document.querySelector('[data-source-index="'+hit.sourceIndex+'"] [data-reader-field="'+hit.key+'"]');
    if(hit.linearIndex<messageRenderState.start||hit.linearIndex>=messageRenderState.end||previousField?.hasAttribute('data-partial-start'))await renderReaderWindow({startIndex:Math.max(0,hit.linearIndex-3),focus:hit});
    if(version!==readerSearchVersion||focusVersion!==readerFocusVersion)return;clearCSearchMarks();
    const message=document.querySelector('[data-source-index="'+hit.sourceIndex+'"]'),field=message?.querySelector('[data-reader-field="'+hit.key+'"]');
    if(field){for(let parent=field;parent&&parent!==message;parent=parent.parentElement){if(parent.style.display==='none')parent.style.display='';if(parent.tagName==='DETAILS')parent.open=true;}for(const element of field.querySelectorAll('details,.code-block-body')){if(element.tagName==='DETAILS')element.open=true;else element.style.display='';}
      const walker=document.createTreeWalker(field,NodeFilter.SHOW_TEXT,{acceptNode:node=>node.parentElement.closest('.code-block-header,button,.vsrc')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT}),nodes=[];let node,text='';while(node=walker.nextNode()){nodes.push({node,start:text.length});text+=node.nodeValue;}
      const positions=[...workerDomainCore().matches(text,state.query)],match=positions[hit.fieldOrdinal||0];
      const target=field.hasAttribute('data-partial-start')?hit.offset-Number(field.dataset.partialStart):match?.offset,length=field.hasAttribute('data-partial-start')?hit.length:match?.length;if(target!==undefined&&target>=0){for(const {node,start}of nodes.reverse()){const from=Math.max(0,target-start),to=Math.min(node.length,target+length-start);if(to<=from)continue;const range=document.createRange();range.setStart(node,from);range.setEnd(node,to);const mark=document.createElement('mark');mark.className='cs active';range.surroundContents(mark);CS.matches.push(mark);}CS.matches[0]?.scrollIntoView({block:'center',behavior:'auto'});}else message?.scrollIntoView({block:'center'});
    }
    document.getElementById('csearch-count').textContent=(state.index+1)+' / '+state.total;
  }catch(error){if(error.name!=='AbortError')document.getElementById('csearch-count').textContent=error.message;}
}
window.addEventListener('pagehide',()=>{resetFeatureWorkers();cleanupAnalyticsWorker();cleanupDataWorker(abortFeature());});
