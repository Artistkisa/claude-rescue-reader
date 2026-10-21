// Local import session. Download tokens live only in this page's manifest state.
let exportSession={manifest:null,packages:[],topics:[],artifacts:[],users:[],logins:[],revision:0,errors:[],associations:{}},exportQueue=Promise.resolve(),exportViewVersion=0,exportPage=0,exportFreshSelection=false;
function cleanupExportVisuals(){for(const id of Object.keys(VISUALURLS)){URL.revokeObjectURL(VISUALURLS[id]);delete VISUALURLS[id];}for(const id of Object.keys(VISUALDOCS))delete VISUALDOCS[id];}
const exportFormat=exportFormatCore();
Object.assign(EN,{
  '导入下载清单':'Import download manifest','打开下载页':'Open download page','下载清单':'Download manifest','追加分包':'Add packages','打开新档案':'Open new archive','作品':'Artifacts','账户资料':'Account data','尚未导入':'Not imported','已导入':'Imported','链接不可用':'Invalid download link','链接可能在 24 小时内或使用后提前失效。请在登录 Claude 的浏览器中下载，再批量选择 ZIP。':'Links may expire within 24 hours or after use. Download in your signed-in Claude browser, then select the ZIP files together.','分包导入失败；已导入的数据仍然保留。':'Package import failed; previously imported data is preserved.','来源':'Source','版本':'Version','待关联项目':'Unlinked project','全局记忆':'Global memory','主题记忆':'Topic memories','记忆格式异常，保留原文':'Unrecognized memory header; original text preserved','当前活动版本不可用，显示最新可用版本':'Active version unavailable; showing latest available version','版本文件缺失':'Version file missing','这是当前作品版本，不代表消息当时的版本。':'This is the current artifact version, not necessarily its version at the time of this message.','账户':'Account','登录历史':'Login history','同一标识存在不同内容，已保留来源版本':'Conflicting content for the same ID; source variants preserved','隐藏':'Hidden','截断':'Truncated','摘要':'Summary','注入上下文':'Injected context','无导出的思考正文':'No exported thinking text','导出包含隐藏状态标记':'Export includes a hidden-state flag','未识别内容':'Unrecognized content','重新选择 ZIP 重试':'Select ZIP again to retry','当前档案':'Current archive','重复包，已跳过':'Duplicate package skipped','导入中':'Importing','分包':'Package','无可用下载链接':'No valid download link','匹配文件名后仍会校验实际内容':'File names are matched; package contents are also validated','重复或无效的分包':'Duplicate or invalid package','账户不匹配，请打开新档案':'Account mismatch; open as a new archive','下载清单版本不支持':'Unsupported manifest version','记忆':'Memory','元数据':'Metadata','对话':'Conversations','项目':'Projects','其他':'Other','不关联':'Unassigned','清除档案':'Clear archive'
});
function exportLabel(category){return t(({conversations:'对话',projects:'项目',memories:'记忆',frames:'作品',light_metadata:'元数据'})[category]||'其他');}
function exportMediaKey(name){
  const source=currentConv?._sourcePackage;
  const candidates=[...zipEntries].filter(([,entry])=>typeof entry==='object'&&(!source||entry.packageId===source)&&mediaKey(entry.path)===mediaKey(name));
  const unique=[...new Set(candidates.map(([,entry])=>entry.packageId+'/'+entry.path))];
  return unique.length===1?unique[0]:zipEntries.has(mediaKey(name))&&typeof zipEntries.get(mediaKey(name))==='string'?mediaKey(name):'';
}
Object.assign(EN,{'下载与导入':'Download & import','从清单到本地档案':'From manifest to local archive','选择 Claude 导出的 manifest JSON，逐项前往官方下载页，再将下载好的 ZIP 一起导入。':'Choose the manifest JSON exported by Claude, open each official download page, then import the downloaded ZIP files together.','01 · 导入清单':'01 · Choose manifest','02 · 官方下载':'02 · Download from Claude','03 · 本地阅读':'03 · Read locally','清单只用于展示文件与链接。':'The manifest lists files and download links.','在新标签页完成下载，返回这里继续。':'Download in a new tab, then return here.','批量选择 ZIP，可按任意顺序追加。':'Select ZIP files together; packages can be added in any order.','兼容旧版导出':'Older exports supported','旧版 ZIP 和导出文件夹仍可直接导入，无需下载清单；支持旧记忆和 Design。':'Import older ZIP files or export folders directly, without a manifest. Legacy memories and Design exports remain supported.','尚未选择下载清单':'No download manifest selected','选择清单查看分包列表，或直接导入已有 ZIP。':'Choose a manifest to view its packages, or import ZIP files you already have.','已导入文件':'Imported files','返回对话':'Back to conversations'});
function openDownloadPage(){
  exportViewVersion++;openConversationGeneration++;resetReaderSearch();cancelFeature('reader');
  if(currentView==='analytics')cancelAnalytics();
  if(currentView==='behavior'){cancelFeature('task','behavior');behaviorPromise=null;}
  currentView='downloads';currentConv=null;cleanupExportVisuals();
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('download-page-btn').setAttribute('aria-current','page');
  document.getElementById('chat-title').textContent=t('下载与导入');document.getElementById('chat-header-meta').textContent='';
  document.getElementById('chat-header').classList.remove('last-supper');document.getElementById('messages').classList.remove('last-supper-gallery');
  for(const id of ['csearch','csearch-count','cprev','cnext','toggle-summary','quality-btn','tree-mode-btn','quality-panel','export-wrap'])document.getElementById(id).style.display='none';
  qualityOpen=false;renderExportManifest();
}
function renderExportManifest(){
  if(currentView!=='downloads')return;
  const session=exportSession,host=document.getElementById('messages'),panel=document.createElement('section');panel.id='export-session-panel';panel.className='export-page';host.replaceChildren(panel);
  const make=(tag,cls,text,parent=panel)=>{const node=document.createElement(tag);node.className=cls;node.textContent=text;parent.append(node);return node;};
  const hero=make('header','export-hero','');make('div','export-kicker','Claude Rescue Reader',hero);make('h2','',t('从清单到本地档案'),hero);make('p','export-description',t('选择 Claude 导出的 manifest JSON，逐项前往官方下载页，再将下载好的 ZIP 一起导入。'),hero);
  const toolbar=make('div','export-toolbar','');
  for(const [action,label,primary]of [['pick-manifest','导入下载清单',true],['append-packages','追加分包'],['new-archive','打开新档案'],['clear-archive','清除档案']]){const button=make('button','export-button'+(primary?' primary':action==='clear-archive'?' quiet':''),t(label),toolbar);button.type='button';button.dataset.uiClick=action;}
  const steps=make('div','export-steps','');for(const [title,body]of [['01 · 导入清单','清单只用于展示文件与链接。'],['02 · 官方下载','在新标签页完成下载，返回这里继续。'],['03 · 本地阅读','批量选择 ZIP，可按任意顺序追加。']]){const step=make('div','export-step','',steps);make('strong','',t(title),step);make('p','export-description',t(body),step);}
  if(session.manifest){
    make('h3','',t('下载清单'));make('p','export-description',session.manifest.created_at+' · '+t('链接可能在 24 小时内或使用后提前失效。请在登录 Claude 的浏览器中下载，再批量选择 ZIP。'));
    const list=make('div','export-list','');
    for(const f of session.manifest.files){
      const row=make('article','export-package','',list),details=make('div','','',row),loaded=session.packages.some(p=>p.filename===f.filename);
      make('span','export-badge',exportLabel(f.category)+(f.category&&!['conversations','projects','memories','frames','light_metadata'].includes(f.category)?' · '+f.category:''),details);make('h3','',f.filename,details);make('div','export-status',t('分包')+' #'+f.part+' · '+t(loaded?'已导入':'尚未导入'),details);
      if(f.url){const link=make('a','export-button',t('打开下载页')+' ↗',row);link.href=f.url;link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';}else make('span','export-status',t('链接不可用'),row);
    }
  }else{const empty=make('div','export-empty','');make('strong','',t('尚未选择下载清单'),empty);make('p','export-description',t('选择清单查看分包列表，或直接导入已有 ZIP。'),empty);}
  if(session.packages.length){make('h3','',t('已导入文件'));for(const p of session.packages)make('p','export-meta','✓ '+p.filename);}
  if(session.errors.length){const errors=make('div','export-errors','');errors.setAttribute('role','status');for(const e of session.errors)make('p','',e,errors);}
  const compatibility=make('footer','export-empty','');compatibility.style.marginTop='24px';make('strong','',t('兼容旧版导出'),compatibility);make('p','export-description',t('旧版 ZIP 和导出文件夹仍可直接导入，无需下载清单；支持旧记忆和 Design。'),compatibility);
  const legacy=make('div','export-toolbar','',compatibility);for(const [action,label]of [['pick-folder','📂 选择导出文件夹'],['pick-zip','🗜️ 直接选择 ZIP 压缩包（免解压）']]){const button=make('button','export-button',t(label),legacy);button.dataset.uiClick=action;}
}
async function newExportArchive(){
  exportViewVersion++;exportSession={manifest:null,packages:[],topics:[],artifacts:[],users:[],logins:[],revision:0,errors:[],associations:{}};
  const session=exportSession,generation=++dataLoadGeneration;useDataWorkerGeneration(generation);await dataWorkerRequest('reset',null,[],generation);if(session!==exportSession)return;clearLocalMedia();
  allConvs=[];allDesigns=[];allProjects=[];memoryData=null;currentConv=null;loadedSummary={totalMsgs:0,minDate:'',maxDate:''};
  cleanupExportVisuals();document.getElementById('messages').replaceChildren();switchTab('convs',document.querySelector('.tab-btn[data-ui-value="convs"]'));refreshExportArchive();renderExportManifest();return session;
}
let exportManifestIntent=0;
async function openExportManifest(file){
  const intent=++exportManifestIntent,descriptor=exportFormat.manifest(JSON.parse(await file.text()));if(intent!==exportManifestIntent)return;const session=await newExportArchive();if(intent!==exportManifestIntent||session!==exportSession)return;exportSession.manifest=descriptor;openDownloadPage();
}
function invalidateExportViews(){
  exportViewVersion++;exportSession.revision++;openConversationGeneration++;fullTextSearchGeneration++;projectMapGeneration++;resetReaderSearch();destroyFeature('reader');destroyFeature('task');resetAnalytics();
  for(const [id,pending]of dataWorkerPending)if(['search','projectIndex'].includes(pending.type)){dataWorkerPending.delete(id);pending.reject(abortFeature());}
  currentConv=null;behaviorResult=null;behaviorPromise=null;qualityCache.clear();corpusCache.clear();convProjectMap={};convProjectEvidence={};projectIndexStats={};convProjectMapReady=!allProjects.length;convProjectMapPromise=null;projectConvSearchCache.clear();
  document.getElementById('messages').replaceChildren();
}
function refreshExportArchive(){
  document.getElementById('conv-total').textContent=allConvs.length;renderConvList(getSortedConvs());renderLoadedSummary();
  for(const [tab,visible]of [['projects',allProjects.length],['memory',memoryData||exportSession.topics.length],['design',allDesigns.length],['artifacts',exportSession.artifacts.length],['account',exportSession.users.length||exportSession.logins.length]]){const button=document.querySelector('.tab-btn[data-ui-value="'+tab+'"]');if(button)button.style.display=visible?'':'none';}
  if(currentView==='downloads')renderExportManifest();else if(currentView==='memory')renderMemoryTab();else if(currentView==='projects')renderProjectList();else if(currentView==='artifacts')renderExportArtifacts();else if(currentView==='account')renderExportAccount();else if(currentView==='analytics'){renderAnalyticsSide();renderAnalyticsPage();}
}
async function appendExportPackage(file,button,files){
  if(!dataWorkerGeneration){const generation=++dataLoadGeneration;useDataWorkerGeneration(generation);await dataWorkerRequest('reset',null,[],generation);}
  const session=exportSession,generation=dataWorkerGeneration;
  const result=await featureRequest('import','package',{file,files:files?.map(f=>({file:f,path:f.webkitRelativePath||f.name}))},progress=>{if(session===exportSession)button.textContent=t('导入中')+' '+Math.round(progress.percent||0)+'%';});
  if(session!==exportSession||generation!==dataWorkerGeneration)return;
  if(result.duplicate||result.parsed?.duplicate){button.textContent=t('重复包，已跳过');return;}
  const parsed=result.parsed;session.packages.push({id:result.id,filename:result.filename});
  for(const p of result.projects){const old=allProjects.find(x=>x.uuid===p.uuid);if(!old)allProjects.push(p);else if(JSON.stringify(old)!==JSON.stringify(p))session.errors.push(t('同一标识存在不同内容，已保留来源版本')+': '+p.name),old._sourceVariants=[...(old._sourceVariants||[]),{source:result.filename,value:p}];}
  if(result.legacyMemory){(session.legacyMemories??=[]).push({source:result.filename,value:result.legacyMemory});memoryData=memoryData?{...memoryData,conversations_memory:[memoryData.conversations_memory,result.legacyMemory.conversations_memory].filter(Boolean).join('\n\n'),project_memories:{...memoryData.project_memories,...result.legacyMemory.project_memories}}:result.legacyMemory;}
  session.topics.push(...result.memories);session.artifacts.push(...result.artifacts.map(a=>({...a,packageId:result.id,source:result.filename})));session.users.push(...result.users);session.logins.push(...result.logins);
  allConvs=parsed.conversations.filter(c=>!c._design);allDesigns=parsed.conversations.filter(c=>c._design);loadedSummary={totalMsgs:parsed.totalMsgs,minDate:parsed.minDate,maxDate:parsed.maxDate};lastConversationUuid=findLastConversationUuid(allConvs);
  for(const image of result.images){const key=image.packageId+'/'+image.path;zipEntries.set(key,image);const name=mediaKey(image.path);if(!zipEntries.has(name))zipEntries.set(name,image);}
  if(parsed.conflicts.length)session.errors.push(t('同一标识存在不同内容，已保留来源版本')+': '+parsed.conflicts.length);
  invalidateExportViews();renderExportManifest();refreshExportArchive();button.textContent='✓ '+t('已导入')+' '+result.filename;
  if(!allConvs.length&&currentView!=='downloads'){const tab=session.topics.length?'memory':session.artifacts.length?'artifacts':session.users.length||session.logins.length?'account':allProjects.length?'projects':allDesigns.length?'design':null;if(tab)switchTab(tab,document.querySelector('.tab-btn[data-ui-value="'+tab+'"]'));}
}
function importExportFiles(files,button=document.getElementById('load-zip-btn'),fresh=false){
  if(fresh)return newExportArchive().then(()=>importExportFiles(files,button));
  // Serialize batches, but a new archive immediately retires the previous source.
  const session=exportSession;
  const run=async()=>{
    if(session!==exportSession&&!fresh)return;
    if(fresh)await newExportArchive();
    let manifestFile=files.find(f=>/^manifest.*\.json$/i.test(f.name));
    if(!manifestFile)for(const f of files.filter(f=>/\.json$/i.test(f.name)&&f.size<1024*1024)){try{if(Array.isArray(JSON.parse(await f.text()).data_files)){manifestFile=f;break;}}catch{}}
    if(manifestFile)await openExportManifest(manifestFile);
    const active=exportSession,zips=files.filter(f=>/\.zip$/i.test(f.name));
    if(!zips.length&&manifestFile){button.textContent=t('下载清单');return;}
    const batches=zips.length?zips:[null];
    for(const file of batches){if(active!==exportSession)return;try{await appendExportPackage(file,button,file?undefined:files);}catch(error){if(error.name==='AbortError')return;active.errors.push((file?.name||'folder')+': '+errorMessage(error)+' · '+t('重新选择 ZIP 重试'));button.textContent='ZIP · '+t('分包导入失败；已导入的数据仍然保留。');renderExportManifest();}}
  };
  const job=exportQueue.catch(()=>{}).then(run);exportQueue=job;return job;
}
function memoryProject(topic){
  if(!topic.projectKey)return '';
  if(Object.hasOwn(exportSession.associations,topic.projectKey))return exportSession.associations[topic.projectKey];
  const exact=allProjects.find(p=>p.uuid===topic.projectKey);if(exact)return exact.uuid;
  const candidates=allProjects.filter(p=>p.name===topic.projectKey);return candidates.length===1?candidates[0].uuid:'?'+topic.projectKey;
}
async function renderTopicMemories(){
  const version=++exportViewVersion,session=exportSession,container=document.getElementById('conv-list');container.replaceChildren();
  const groups=new Map();for(const topic of session.topics){const project=memoryProject(topic),key=project+'|'+topic.path.replace(/^projects\/[^/]+\//,'');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(topic);}
  for(const topics of groups.values()){
    topics.sort((a,b)=>(Date.parse(b.updated_at)||0)-(Date.parse(a.updated_at)||0)||session.topics.indexOf(b)-session.topics.indexOf(a));
    const first=topics[0],project=memoryProject(first),card=document.createElement('section');card.className='mem-card';card.style.padding='10px';
    const title=document.createElement('h3');title.textContent=first.name;card.append(title);
    const meta=document.createElement('p');meta.textContent=first.path+' · '+(project?(allProjects.find(p=>p.uuid===project)?.name||t('待关联项目')):t('全局记忆'));card.append(meta);
    if(first.projectKey){const select=document.createElement('select');select.setAttribute('aria-label',t('待关联项目'));for(const [value,label]of [['?'+first.projectKey,t('待关联项目')],['',t('不关联')],...allProjects.map(p=>[p.uuid,p.name])]){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}select.value=project;select.onchange=()=>{session.associations[first.projectKey]=select.value;analyticsProjectVersion++;resetAnalytics();void renderTopicMemories();};card.append(select);}
    const selector=document.createElement('select');selector.setAttribute('aria-label',t('版本'));card.append(selector);const description=document.createElement('p'),body=document.createElement('div');card.append(description,body);container.append(card);
    const unique=[],byRaw=new Map();
    for(const topic of topics){const value=await featureRequest('import','resource',{packageId:topic.packageId,memoryId:topic.memoryId});if(version!==exportViewVersion||session!==exportSession)return;const existing=byRaw.get(value.body);if(existing){existing.sources.push(topic.source);continue;}const entry={topic,...value,sources:[topic.source]};byRaw.set(value.body,entry);unique.push(entry);}
    unique.forEach((entry,index)=>{const option=document.createElement('option');option.value=index;option.textContent=t('版本')+' '+(index+1)+' · '+entry.sources.join(', ')+' '+entry.topic.updated_at;selector.append(option);});
    let selection=0;const show=async()=>{const selected=++selection,entry=unique[Number(selector.value)||0];if(!entry)return;description.textContent=entry.topic.description+(entry.topic.warning?' · '+t('记忆格式异常，保留原文'):'');body.textContent=entry.body;try{if(!entry.topic.warning){const rendered=await featureRequest('task','memoryView',{text:entry.body});if(version!==exportViewVersion||selected!==selection)return;body.innerHTML=rendered.html;}}catch(error){if(error.name!=='AbortError')description.textContent+=' · '+errorMessage(error);}if(version!==exportViewVersion||selected!==selection)return;const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent=t('元数据');pre.textContent=JSON.stringify(entry.topic.fields,null,2);details.append(summary,pre);body.append(details);};selector.onchange=()=>void show();await show();
  }
  if(memoryData){const legacy=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent=t('记忆')+' · memories.json';pre.style.whiteSpace='pre-wrap';pre.textContent=JSON.stringify(session.legacyMemories||memoryData,null,2);legacy.append(summary,pre);container.append(legacy);}
}
function renderExportArtifacts(){
  exportViewVersion++;const container=document.getElementById('conv-list');container.replaceChildren();document.getElementById('messages').replaceChildren();
  exportSession.artifacts.forEach((artifact,index)=>{const button=document.createElement('button');button.className='conv-item';button.textContent=(artifact.versions.find(v=>v.id===artifact.active_version)?.title||artifact.versions[0]?.title||artifact.id)+' · '+artifact.source;button.onclick=()=>void openExportArtifact(index);container.append(button);});
}
async function openExportArtifact(index,versionId){
  const artifact=exportSession.artifacts[index];if(!artifact)return;const view=++exportViewVersion,generation=dataWorkerGeneration;
  const versions=[...artifact.versions].sort((a,b)=>(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0));const active=versions.find(v=>v.id===artifact.active_version&&v.available),selected=versionId?versions.find(v=>v.id===versionId):active||versions.find(v=>v.available);
  const container=document.getElementById('messages');cleanupExportVisuals();container.replaceChildren();const controls=document.createElement('div'),select=document.createElement('select');select.setAttribute('aria-label',t('版本'));
  for(const v of versions){const option=document.createElement('option');option.value=v.id;option.textContent=v.title+' · '+v.created_at+(v.available?'':' · '+t('版本文件缺失'));select.append(option);}select.value=selected?.id||'';select.onchange=()=>void openExportArtifact(index,select.value);controls.append(select);container.append(controls);
  const note=document.createElement('p');note.textContent=t('这是当前作品版本，不代表消息当时的版本。')+(!active?' '+t('当前活动版本不可用，显示最新可用版本'):'');container.append(note);
  if(!selected?.available){const missing=document.createElement('p');missing.textContent=t('版本文件缺失');container.append(missing);return;}
  try{const {blob}=await featureRequest('import','resource',{packageId:artifact.packageId,path:selected.path});const code=await blob.text();if(view!==exportViewVersion||generation!==dataWorkerGeneration)return;const wrapper=document.createElement('div');wrapper.innerHTML=renderVisual({kind:'html',code,title:selected.title});container.append(wrapper);initLazyVisuals(container);}catch(error){if(view===exportViewVersion){const retry=document.createElement('button');retry.textContent=errorMessage(error)+' · '+t('重试');retry.onclick=()=>void openExportArtifact(index,versionId);container.append(retry);}}
}
function renderExportAccount(){
  exportViewVersion++;document.getElementById('messages').replaceChildren();const container=document.getElementById('conv-list');container.replaceChildren();
  const title=document.createElement('h3');title.textContent=t('账户资料');container.append(title);
  for(const user of exportSession.users){const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent=user.full_name||user.uuid;pre.textContent=JSON.stringify(user,null,2);details.append(summary,pre);container.append(details);}
  const events=[...exportSession.logins].sort((a,b)=>(Date.parse(b.timestamp)||0)-(Date.parse(a.timestamp)||0));exportPage=Math.min(exportPage,Math.max(0,Math.ceil(events.length/50)-1));
  const heading=document.createElement('h4');heading.textContent=t('登录历史')+' ('+events.length+')';container.append(heading);
  for(const event of events.slice(exportPage*50,(exportPage+1)*50)){const pre=document.createElement('pre');pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';pre.textContent=JSON.stringify(event,null,2);container.append(pre);}
  for(const [delta,label]of [[-1,'上一页'],[1,'下一页']]){const button=document.createElement('button');button.textContent=t(label);button.disabled=exportPage+delta<0||(exportPage+delta)*50>=events.length;button.onclick=()=>{exportPage+=delta;renderExportAccount();};container.append(button);}
}
document.getElementById('manifest-input').addEventListener('change',async event=>{const file=event.target.files[0];event.target.value='';if(!file)return;try{await openExportManifest(file);}catch(error){exportSession.errors.push(errorMessage(error));renderExportManifest();}});
