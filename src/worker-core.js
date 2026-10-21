function workerDomainCore(){
let currentLang='zh',labels={},markedConfigured=false;const codes=new Map();
const ROOT_ID='00000000-0000-4000-8000-000000000000';
function isDesignExport(value){return !!(value&&typeof value==='object'&&!Array.isArray(value)&&Array.isArray(value.messages)&&value.messages.some(m=>m&&typeof m.role==='string'&&'content'in m));}
function designContentBlocks(raw){
  if(Array.isArray(raw))return raw.flatMap(b=>{
    if(!b||typeof b!=='object')return typeof b==='string'?[{type:'text',text:b}]:[];
    if(b.type==='tool_call'&&b.toolCall)return[{type:'tool_use',id:b.toolCall.id||'',name:b.toolCall.name||'tool',input:b.toolCall.input||{},output:b.toolCall.output||''}];
    if(b.type==='thinking'||b.type==='redacted_thinking')return[{...b,thinking:b.thinking||b.text||''}];
    return[b];
  });
  if(typeof raw==='string')return[{type:'text',text:raw}];
  if(!raw||typeof raw!=='object')return[];
  const blocks=[];
  if(typeof raw.content==='string')blocks.push({type:'text',text:raw.content});
  else if(typeof raw.text==='string')blocks.push({type:'text',text:raw.text});
  if(Array.isArray(raw.contentBlocks))blocks.push(...designContentBlocks(raw.contentBlocks));
  return blocks;
}
function designChatToConversation(d,index){
  const msgs=(d.messages||[]).map((m,i)=>{const raw=m.content,record=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};const created=m.created_at||m.timestamp||record.created_at||record.timestamp||'';return{uuid:m.uuid||record.id||'design-'+index+'-'+i,sender:m.role==='user'?'human':'assistant',created_at:created,updated_at:created,parent_message_uuid:i?(m.parent_message_uuid||(d.messages[i-1].uuid||'design-'+index+'-'+(i-1))):ROOT_ID,content:designContentBlocks(raw),attachments:Array.isArray(record.attachments)?record.attachments:[],text:typeof raw==='string'?raw:(typeof record.content==='string'?record.content:'')}});
  return{uuid:d.uuid||'design-chat-'+index,name:(d.title&&d.title!=='Chat'?d.title:t('Design'))+(d.project&&d.project.name?' · '+d.project.name:''),created_at:d.created_at||msgs[0]?.created_at||'',updated_at:d.updated_at||msgs[msgs.length-1]?.created_at||'',chat_messages:msgs,project:d.project||null,_design:true};
}
function parseDesignExports(texts){const out=[];for(const text of texts||[]){try{const value=JSON.parse(text);if(isDesignExport(value))out.push(designChatToConversation(value,out.length));}catch(e){}}return out;}


const list=value=>Array.isArray(value)?value:[];
const t=(key,vars)=>{let value=currentLang==='en'?(labels[key]||key):key;if(vars)for(const [k,v]of Object.entries(vars))value=value.replaceAll('{'+k+'}',String(v));return value;};
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const escAttr=s=>esc(s).replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const fmtDate=iso=>iso?new Date(iso).toLocaleDateString(currentLang==='en'?'en-US':'zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
const fmtTime=iso=>iso?new Date(iso).toLocaleTimeString(currentLang==='en'?'en-US':'zh-CN',{hour:'2-digit',minute:'2-digit'}):'';
const SENSITIVE_PATTERNS=[
  ['API 密钥',/\b(?:sk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|AKIA[0-9A-Z]{16})\b/g],
  ['Bearer 令牌',/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi],
  ['私钥',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['邮箱',/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi],
  ['手机号',/(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)/g],
  ['本地路径',/(?:[A-Z]:\\|file:\/\/|\/Users\/|\/home\/|\/mnt\/)[^\s"'<>]+/gi]
];
const STRICT_SENSITIVE_PATTERNS=[
  ['身份证件',/(?<!\d)\d{6}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[0-9X](?!\d)/gi],
  ['银行卡号',/(?:卡号|银行卡|借记卡|信用卡|card(?:\s*(?:no|number))?)\s*[：:=]?\s*(?:\d[ -]?){16,19}(?!\d)/gi],
  ['网络地址',/(?<!\d)(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?!\d)/g],
  ['车牌号',/[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼][A-Z][·A-Z0-9][A-Z0-9]{4,5}/g],
  ['社交账号',/https?:\/\/(?:www\.)?(?:weibo\.com|twitter\.com|x\.com|facebook\.com|instagram\.com|tiktok\.com|douyin\.com|bilibili\.com|zhihu\.com|linkedin\.com|github\.com|reddit\.com|t\.me|discord\.gg|youtube\.com)\/[A-Za-z0-9_@?&=.%\/-]+/gi],
  ['详细地址',/(?:[\u4e00-\u9fff]{2,}(?:省|自治区|市|区|县)){1,3}[\u4e00-\u9fff0-9-]{2,}(?:街道|路|街|巷|小区|村|镇|乡|号|栋|幢|楼|单元|室)/g],
  ['详细地址',/[\u4e00-\u9fff]{2,}(?:路|街|巷|小区|大道)\d{1,4}号(?:\d{1,3}(?:栋|幢|楼|单元|室))?/g],
  ['链接',/(?:https?:\/\/|www\.)[^\s<>"'）)\]}]+|\b(?:[A-Za-z0-9-]+\.)+(?:com|net|org|cn|io|dev|app|ai|edu|gov|co|me)(?:\/[A-Za-z0-9_?&=.%+\/-]*)?/gi]
];
const CONTEXT_SECRET_RE=/((?:device[_ -]?id|user[_ -]?id|visitor[_ -]?id|fingerprint|session[_ -]?id|storage[_ -]?key|access[_ -]?token|refresh[_ -]?token|auth[_ -]?token|token|secret|api[_ -]?key|did)\s*["']?\s*[:=]\s*["']?)([A-Za-z0-9_%+\/=.-]{6,})/gi;
const QUERY_SECRET_RE=/([?&](?:token|access_token|auth|key|sid|session|device_id|did|t)=)([A-Za-z0-9_%+\/=.-]{6,})/gi;
const STRICT_CONTEXT_RE=/((?:姓名|名字|联系人|老师|教师|教授|班主任|校长|学校|学院|大学|中学|小学|幼儿园|公司|单位|部门|微信|wechat|qq|微博|抖音|uid|用户[_ -]?id|account[_ -]?id|open[_ -]?id|social[_ -]?id|身份证|住址|地址|家庭住址|工作地址)\s*[：:=]\s*["']?)([^\s,"'，。；;]{2,80})/gi;
function redactionToken(label,value,style){if(style==='scp')return /^metadata$/i.test(label)?(currentLang==='en'?'[DATA EXPUNGED]':'[数据删除]'):'█'.repeat(Math.max(6,Math.min(24,String(value||'').length)));return '[REDACTED:'+label+']';}
function maskedSecret(value){const s=String(value||'');if(s.length<=6)return '█'.repeat(s.length||4);return s.slice(0,2)+'…'+s.slice(-2)+' ('+s.length+')';}
function addRedactionFinding(state,label,value,path,reason){state.stats[label]=(state.stats[label]||0)+1;state.total=(state.total||0)+1;if(state.matches.length<100)state.matches.push({label,path:path||'conversation',preview:maskedSecret(value),reason});}
function redactText(text,state,path,style,strict=false){let out=String(text||'');out=out.replace(CONTEXT_SECRET_RE,(whole,prefix,value)=>{let label=/device|fingerprint|did/i.test(prefix)?'设备标识':/user/i.test(prefix)?'用户标识':/session|storage/i.test(prefix)?'会话标识':'凭据或令牌';addRedactionFinding(state,label,value,path,'敏感字段名与高熵标识值同时出现');return prefix+redactionToken(label,value,style);});out=out.replace(QUERY_SECRET_RE,(whole,prefix,value)=>{addRedactionFinding(state,'URL 查询令牌',value,path,'敏感查询参数');return prefix+redactionToken('URL 查询令牌',value,style);});for(const [label,re] of SENSITIVE_PATTERNS){re.lastIndex=0;out=out.replace(re,value=>{addRedactionFinding(state,label,value,path,'匹配 '+label+' 格式');return redactionToken(label,value,style);});}if(strict){STRICT_CONTEXT_RE.lastIndex=0;out=out.replace(STRICT_CONTEXT_RE,(whole,prefix,value)=>{const label=/老师|教师|教授|班主任|校长|姓名|名字|联系人/i.test(prefix)?'个人姓名':/学校|学院|大学|中学|小学|幼儿园|公司|单位|部门/i.test(prefix)?'学校或单位':/微信|wechat|qq|微博|抖音/i.test(prefix)?'社交账号':/uid|用户|account|open|social/i.test(prefix)?'用户标识':/地址|住址/i.test(prefix)?'详细地址':'身份证件';addRedactionFinding(state,label,value,path,'宽泛隐私规则，可能误伤普通文本');return prefix+redactionToken(label,value,style);});for(const [label,re] of STRICT_SENSITIVE_PATTERNS){re.lastIndex=0;out=out.replace(re,value=>{addRedactionFinding(state,label,value,path,'宽泛隐私规则，可能误伤普通文本');return redactionToken(label,value,style);});}}return out;}
function redactConversation(conv,style='standard',strict=false){const clone=typeof structuredClone==='function'?structuredClone(conv):JSON.parse(JSON.stringify(conv));const state={stats:{},matches:[]};const metadataKeys=new Set(['tool_input','input','metadata','file_path','path']);const walk=(v,path)=>{if(typeof v==='string')return redactText(v,state,path,style,strict);if(Array.isArray(v))return v.map((item,i)=>walk(item,path+'['+i+']'));if(v&&typeof v==='object'){for(const k of Object.keys(v)){const next=path?path+'.'+k:k;if(metadataKeys.has(k)){const raw=typeof v[k]==='string'?v[k]:JSON.stringify(v[k]??'');redactText(raw,state,next,style,strict);addRedactionFinding(state,'metadata',raw,next,'安全导出会移除工具参数、路径或系统元数据');v[k]=redactionToken('metadata',raw,style);}else v[k]=walk(v[k],next);}}return v;};walk(clone,'conversation');return{conv:clone,stats:state.stats,matches:state.matches,total:state.matches.length,style,strict};}

  const plain=m=>{let s=String(m?.text||'');for(const b of(m?.content||[]))if(b&&typeof b==='object')s+=' '+String(b.text||b.thinking||b.content||'');return s.replace(/\s+/g,' ').trim();};
  const hasType=(m,re)=>((m?.content||[]).some(b=>b&&re.test(String(b.type||'')+' '+String(b.name||''))));
  async function quality(data,checkpoint){const msgs=Array.isArray(data?.messages)?e.data.messages:[],title=String(data?.title||''),issues=[],counts={empty:0,repeated:0,truncated:0,toolOnly:0,refusal:0,refusalAlternative:0,fallback:0,reverse:0,orphan:0,incompleteAttachment:0,unparseable:0,latency:0,internalMetadata:0};let prevTime=0,prevAssistant='';const ids=new Set(msgs.map(m=>m.uuid));let processed=0;
    const securityTitle=/(安全|网安|漏洞|CVE|XSS|SQL|RCE|渗透|提权|木马|恶意|钓鱼|凭证|密码|入侵|攻击|payload|exploit|shell|WAF|防火墙|越狱|SSH|RDP|端口|API|代理|DNS|爬虫)/iu;
    const refusal=/((?:我|我们)?\s*(?:没办法|不能|无法|不可以|不便|不予|拒绝|不协助|不提供|不帮助|抱歉)[^。！？\n]{0,120}(?:帮|为你|提供|协助|回答|完成|执行|生成|教|绕过|提取|破解|攻击|入侵|密码|锁屏|加密数据|请求|任务))|(\b(?:can't|cannot|won't) +(?:help|assist|provide|comply|create|generate|bypass|extract|do that)\b)|(\b(?:unable to|i can’t|i cannot)\s+(?:help|assist|provide|comply|create|generate|bypass|extract)\b)/iu;
    const fallback=/\b(as an ai|language model|try again later|model limitation|not available in this mode)\b|(?:当前|暂时|目前|受限于当前模型|这个模型)?(?:无法访问|功能受限|服务受限|能力有限|降级模式|不具备(?:执行|访问|处理|完成)[^。！？\n]{0,24}能力)|(?:我只能|我目前只能|只能提供)[^。！？\n]{0,18}(?:概括|一般性信息|高层次建议)/iu,truncated=/(\.\.\.|…|回答未完|to be continued|继续$)/i;
    for(const m of msgs){if(processed++%128===0)await checkpoint();const text=plain(m),time=Date.parse(m.created_at||m.updated_at||'')||0;if(time&&prevTime&&time<prevTime){counts.reverse++;issues.push({kind:'reverse',uuid:m.uuid,label:'时间倒序'});}prevTime=time;
      if(!text&&!hasType(m,/tool|thinking|result/i)){counts.empty++;issues.push({kind:'empty',uuid:m.uuid,label:'空消息'});}
      if(m.parent_message_uuid&&!ids.has(m.parent_message_uuid)&&m.parent_message_uuid!=='00000000-0000-0000-0000-000000000000'){counts.orphan++;issues.push({kind:'orphan',uuid:m.uuid,label:'孤立消息'});}
      if(m.sender==='assistant'){if(text&&text===prevAssistant){counts.repeated++;issues.push({kind:'repeated',uuid:m.uuid,label:'重复回答'});}const directRefusal=/\b(?:can't|cannot|won't)\s+do that\b/i.test(text);const refusalHit=refusal.test(text)&&(directRefusal||securityTitle.test(title)||/(请求|任务|帮|提供|协助|生成|绕过|提取|锁屏|加密数据)/u.test(text));if(refusalHit){counts.refusal++;const alternative=/(合法|安全替代|可以尝试|建议|改为|官方|防御|恢复出厂|维修店)/u.test(text);if(alternative){counts.refusalAlternative++;issues.push({kind:'refusalAlternative',uuid:m.uuid,label:'拒答并给出替代方案'});}else issues.push({kind:'refusal',uuid:m.uuid,label:'疑似拒答'});}if(fallback.test(text)){counts.fallback++;issues.push({kind:'fallback',uuid:m.uuid,label:'疑似降级回答'});}if(truncated.test(text)){counts.truncated++;issues.push({kind:'truncated',uuid:m.uuid,label:'被截断回答'});}if(!text&&hasType(m,/tool|server_tool/)){counts.toolOnly++;issues.push({kind:'toolOnly',uuid:m.uuid,label:'仅工具无正文'});}prevAssistant=text;}
      for(const a of(m.attachments||m.files||[])){if(!a||!(a.file_name||a.name||a.file_id||a.data||a.content)){counts.incompleteAttachment++;issues.push({kind:'attachment',uuid:m.uuid,label:'不完整附件'});}}
      if((m.content||[]).some(b=>!b||typeof b!=='object'||!b.type)){counts.unparseable++;issues.push({kind:'unparseable',uuid:m.uuid,label:'不可解析内容块'});}
      const raw=JSON.stringify(m);if(/"(?:safety|moderation|policy|risk|flag|restriction|model_tier|stop_reason|internal_metadata)"\s*:/i.test(raw)){counts.internalMetadata++;issues.push({kind:'internalMetadata',uuid:m.uuid,label:'内部元数据'});}
    }
    for(let i=1;i<msgs.length;i++){const a=Date.parse(msgs[i-1].created_at||'')||0,b=Date.parse(msgs[i].created_at||'')||0;if(msgs[i-1].sender==='human'&&msgs[i].sender==='assistant'&&a&&b&&b-a>30*60*1000){counts.latency++;issues.push({kind:'latency',uuid:msgs[i].uuid,label:'回复延迟异常'});}}
    return {counts,issues};
  }
  async function behavior(records,checkpoint){
    const out={conversations:0,messages:0,tools:0,toolResults:0,paired:0,unpairedUse:0,unpairedResult:0,errors:0,approvals:0,mcp:0,structured:0,hiddenResults:0,thinking:0,thinkingHidden:0,thinkingTruncated:0,thinkingCutoff:0,thinkingSummary:0,thinkingSigned:0,thinkingDurationMs:0,quality:{refusal:0,fallback:0,latency:0,empty:0,truncated:0},examples:[]};
    const stable=value=>{if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object'){const result={};for(const key of Object.keys(value).sort())result[key]=stable(value[key]);return result;}return value;},different=(a,b)=>JSON.stringify(stable(a))!==JSON.stringify(stable(b));
    const uses=new Map(),results=new Map(),refusal=/(?:我(?:不能|无法|不可以|不会)(?:帮助|协助|提供|执行|生成|完成)|抱歉[^。！？\n]{0,40}(?:不能|无法)|\b(?:can't|cannot|won't|unable to)\s+(?:help|assist|provide|comply|create|generate|do that)\b)/iu,fallback=/(?:当前模型|这个模型|能力受限|降级模式|只能提供[^。！？\n]{0,18}(?:概括|一般性信息|高层次建议))|\b(?:as an ai|language model|model limitation|not available in this mode)\b/iu;
    for await(const record of records){out.conversations++;const conversation=JSON.parse(record.raw),messages=list(conversation.chat_messages);out.messages+=messages.length;let previous=null,processed=0;for(const message of messages){if(processed++%128===0)await checkpoint();const text=messageText(message).trim(),time=Date.parse(message.created_at||message.updated_at||'')||0;if(!text&&!list(message.content).some(block=>/tool|thinking|result/i.test(String(block?.type||''))))out.quality.empty++;if(message.sender==='assistant'){if(refusal.test(text))out.quality.refusal++;if(fallback.test(text))out.quality.fallback++;if(/(?:\.\.\.|…|回答未完|to be continued)$/i.test(text))out.quality.truncated++;if(previous?.sender==='human'&&previous.time&&time&&time-previous.time>30*60*1000)out.quality.latency++;}previous={sender:message.sender,time};
        for(const block of list(message.content)){if(!block||typeof block!=='object')continue;const type=String(block.type||'');if(type==='tool_use'||type==='server_tool_use'){out.tools++;const id=block.id||block.tool_use_id;if(id)uses.set(id,true);if(block.approval_key||block.approval_key_legacy||block.approval_options)out.approvals++;if(block.is_mcp_app||block.mcp_server_url||block.integration_name)out.mcp++;if(out.examples.length<8)out.examples.push({name:block.name||block.tool_identifier||'unknown',status:'调用'});}else if(type==='tool_result'||type==='web_search_tool_result'||type==='web_search_result'){out.toolResults++;const id=block.tool_use_id||block.id;if(id)results.set(id,true);if(block.is_error)out.errors++;if(block.structured_content||block.meta)out.structured++;const hasDisplay=block.display_content!==undefined&&block.display_content!==null,hasContent=block.content!==undefined&&block.content!==null;if((hasDisplay&&hasContent&&different(block.display_content,block.content))||(!hasDisplay&&(block.structured_content||block.meta)))out.hiddenResults++;}else if(type==='thinking'){out.thinking++;if(block.hidden||block.thinking_hidden)out.thinkingHidden++;if(block.truncated||block.cut_off)out.thinkingTruncated++;if(block.cut_off)out.thinkingCutoff++;if(block.summaries||block.alternative_display_type)out.thinkingSummary++;if(block.signature)out.thinkingSigned++;const start=Date.parse(block.start_timestamp),stop=Date.parse(block.stop_timestamp);if(start&&stop&&stop>=start)out.thinkingDurationMs+=stop-start;}}
      }}
    for(const id of uses.keys())if(results.has(id))out.paired++;else out.unpairedUse++;for(const id of results.keys())if(!uses.has(id))out.unpairedResult++;return out;
  }

async function markdown(conv,mode,choices,checkpoint){  // Build linear thread (same logic as renderMessages)
  const msgs=conv.chat_messages||[];
  const linear=tree(conv,mode,choices).messages.flatMap(message=>message._warning?[message._warning,message]:[message]); // 与当前浏览模式保持一致
  const msgCount=linear.filter(m=>m&&!m._divider).length;

  let md='# '+((conv.name||t('对话')).replace(/[<>]/g,''))+'\n\n';
  md+='> '+t('创建时间')+': '+fmtDate(conv.created_at)+' · '+t('更新时间')+': '+fmtDate(conv.updated_at)+' · '+t('消息数')+': '+msgCount+'\n\n';
  if(conv.summary)md+='## '+t('摘要')+'\n\n'+conv.summary+'\n\n---\n\n';
  md+='## '+t('对话内容')+'\n\n';

  let processed=0;for(const msg of linear){if(processed++%128===0)await checkpoint();
    if(!msg||typeof msg!=='object')continue;
    if(msg._divider==='linear'){md+='## ⚠️ '+t('对话分支结构异常，已按时间顺序展示全部消息')+'\n\n';continue;}
    if(msg._divider==='orphan'){md+='## 🧩 '+t('以下消息无法归入对话分支（可能是已删除分支的残留）')+' ('+msg.count+')\n\n';continue;}
    const role=msg.sender==='human'?'**'+t('你')+'**':'**Claude**';
    md+=role+' · '+fmtTime(msg.created_at)+'\n\n';
    // Attachments
    for(const att of[...(msg.attachments||[]),...(msg.files||[])]){
      md+='> 📎 '+t('附件')+': '+(att.file_name||att.name||t('文件'))+'\n\n';
    }
    // Content blocks
    const content=msg.content||[];
    let hasContent=false;
    for(const b of content){
      if(!b||typeof b!=='object')continue;
      if(b.type==='text'){md+=(b.text||'')+'\n\n';hasContent=true;}
      else if(b.type==='thinking'){md+='<details>\n<summary>💭 '+t('思考过程')+'</summary>\n\n'+(b.thinking||'')+'\n\n</details>\n\n';hasContent=true;}
      else if(b.type==='tool_use'){md+='> ⚙ '+t('工具调用')+': `'+(b.name||'unknown')+'`'+(b.message?' — '+b.message:'')+'\n\n';hasContent=true;}
      else if(b.type==='tool_result'){md+='> ✅ '+t('工具结果')+': `'+(b.name||'')+'`\n\n';hasContent=true;}
    }
    if(!hasContent&&msg.text)md+=msg.text+'\n\n';
    md+='---\n\n';
  }


return md;}
function safeLinkUrl(value){
  const raw=String(value||'').trim();
  if(!raw||/[\u0000-\u0020\u007f]/.test(raw))return '';
  try{const url=new URL(raw);return /^(https?:|mailto:|tel:|blob:)$/.test(url.protocol)?url.href:'';}catch{return '';}
}
function safeImageUrl(value){
  const raw=String(value||'');
  return /^blob:/i.test(raw)||/^data:image\/(?:png|jpeg|gif|webp|avif|bmp);base64,[a-z0-9+/=\s]+$/i.test(raw)?raw:'';
}
function importedLink(url,label){
  const href=safeLinkUrl(url);
  return href?'<a href="'+escAttr(href)+'" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">'+esc(label)+'</a>':esc(label);
}


function configureMarked(){
  if(markedConfigured||typeof marked==='undefined')return;
  markedConfigured=true;
  marked.setOptions({breaks:true,gfm:true});
  const renderer=new marked.Renderer();
  renderer.html=function(html){
    const raw=html&&typeof html==='object'?html.text:html;
    return esc(raw==null?'':raw);
  };
  renderer.link=function(token){
    const label=this.parser.parseInline(token.tokens||[]),href=safeLinkUrl(token.href);
    return href?'<a href="'+escAttr(href)+'" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer"'+(token.title?' title="'+escAttr(token.title)+'"':'')+'>'+label+'</a>':label;
  };
  renderer.image=function(token){
    const src=safeImageUrl(token.href),label=token.text||t('图片');
    if(src)return '<img src="'+escAttr(src)+'" alt="'+escAttr(label)+'"'+(token.title?' title="'+escAttr(token.title)+'"':'')+'>';
    return '<span class="img-placeholder">🖼 '+esc(t('外部图片不会自动加载'))+' · '+importedLink(token.href,label)+'</span>';
  };
  renderer.code=function(code,lang){
    // marked v5+ passes a token object {text,lang,escaped}; older versions pass (code,lang) directly
    let rawCode, l;
    if(code&&typeof code==='object'){
      rawCode=code.text||'';
      l=(code.lang||lang||'').trim();
    } else {
      rawCode=String(code||'');
      l=(lang||'').trim();
    }
    l=String(l).split(/\s/,1)[0];
    const safeCode=esc(rawCode);
    if(l==='mermaid')return '<div class="visual"><div class="mermaid">'+safeCode+'</div><details class="vsrc"><summary>'+t('查看 Mermaid 源码')+'</summary><pre><code>'+safeCode+'</code></pre></details></div>';
    const id='cb_'+Math.random().toString(36).slice(2);codes.set(id,rawCode);
    const highlighted=rawCode.length<=65536&&typeof hljs!=='undefined'&&l&&hljs.getLanguage(l)
      ?hljs.highlight(rawCode,{language:l}).value
      :safeCode;
    return '<div class="code-block">'
      +'<div class="code-block-header">'
      +'<span class="code-lang">'+esc(l)+'</span>'
      +'<button class="copy-btn" data-ui-click="copy-code" data-ui-value="'+id+'">'+t('复制')+'</button>'
      +'</div>'
      +'<pre><code id="'+id+'" class="'+(l?'language-'+escAttr(l):'')+'">'+highlighted+'</code></pre>'
      +'</div>';
  };
  marked.setOptions({renderer});
}


const trees=new WeakMap();
function tree(conv,mode='longest',choices={}){
  const messages=conv.chat_messages||[];
  let index=trees.get(messages);
  if(!index){
    const byId=new Map(),children=new Map(),roots=[],times=messages.map(m=>Date.parse(m?.created_at||'')||0);
    messages.forEach((m,i)=>{if(m?.uuid&&!byId.has(m.uuid))byId.set(m.uuid,i);});
    messages.forEach((m,i)=>{const parent=byId.get(m?.parent_message_uuid);if(parent===undefined||parent===i)roots.push(i);else{if(!children.has(parent))children.set(parent,[]);children.get(parent).push(i);}});
    const sort=a=>a.sort((a,b)=>times[a]-times[b]||a-b);sort(roots);for(const a of children.values())sort(a);
    const depth=new Map(),color=new Set();
    for(let i=0;i<messages.length;i++){
      const stack=[[i,false]];
      while(stack.length){const [id,done]=stack.pop();if(depth.has(id))continue;if(done){let d=1;for(const child of children.get(id)||[])if(depth.has(child))d=Math.max(d,1+depth.get(child));depth.set(id,d);color.delete(id);continue;}if(color.has(id))continue;color.add(id);stack.push([id,true]);for(const child of children.get(id)||[])if(!color.has(child)&&!depth.has(child))stack.push([child,false]);}
    }
    index={byId,children,roots,times,depth};trees.set(messages,index);
  }
  const {children,roots,times,depth}=index,ids=[],depths=new Map(),navigation={},seen=new Set();let warning=null,orphanStart=-1,orphanCount=0;
  const push=(id,d)=>{seen.add(id);ids.push(id);depths.set(id,d);};
  if(mode==='full'){
    const stack=roots.map(id=>[id,0]).reverse();
    while(stack.length){const [id,d]=stack.pop();if(seen.has(id))continue;push(id,d);for(const child of [...(children.get(id)||[])].reverse())stack.push([child,d+1]);}
    messages.forEach((_,id)=>{if(!seen.has(id))push(id,0);});
  }else{
    const canonical='00000000-0000-4000-8000-000000000000';
    let siblings=roots.filter(id=>(messages[id]?.parent_message_uuid||canonical)===canonical),key=canonical;
    if(!siblings.length){warning='linear';messages.map((_,id)=>id).sort((a,b)=>times[a]-times[b]||a-b).forEach(id=>push(id,0));}
    else{
      while(siblings.length){let selected=choices[key];if(selected===undefined){selected=0;for(let i=1;i<siblings.length;i++){const a=siblings[i],b=siblings[selected],content=m=>!!(m?.text||m?.content?.some(b=>b?.type==='text'&&b.text));if((depth.get(a)||0)>(depth.get(b)||0)||depth.get(a)===depth.get(b)&&content(messages[a])&&!content(messages[b]))selected=i;}}selected=Math.max(0,Math.min(siblings.length-1,selected));const id=siblings[selected];if(seen.has(id))break;push(id,0);if(siblings.length>1)navigation[id]={key,index:selected,count:siblings.length};key=messages[id]?.uuid||String(id);siblings=children.get(id)||[];}
      const reachable=new Set(),stack=[...roots.filter(id=>(messages[id]?.parent_message_uuid||canonical)===canonical)];while(stack.length){const id=stack.pop();if(reachable.has(id))continue;reachable.add(id);for(const child of children.get(id)||[])stack.push(child);}
      const orphans=messages.map((_,id)=>id).filter(id=>!reachable.has(id)).sort((a,b)=>times[a]-times[b]||a-b);
      if(orphans.length>ids.length){warning='linear';ids.length=0;messages.map((_,id)=>id).sort((a,b)=>times[a]-times[b]||a-b).forEach(id=>push(id,0));}else{orphanStart=ids.length;orphanCount=orphans.length;for(const id of orphans)if(!seen.has(id))push(id,0);}
    }
  }
  return {ids,navigation,messages:ids.map((id,i)=>({...messages[id],_warning:i===0&&warning?{_divider:warning}:i===orphanStart&&orphanCount?{_divider:'orphan',count:orphanCount}:null,_sourceIndex:id,_treeDepth:depths.get(id)||0,_branch:navigation[id]||null}))};
}
async function redactAsync(conv,style,strict,checkpoint,preview=false){
  // Work on the task-owned materialization; never clone the archive on the UI thread.
  const state={stats:{},matches:[],total:0},metadata=new Set(['tool_input','input','metadata','file_path','path']);
  const stack=[{parent:{value:conv},key:'value',path:'conversation'}];let n=0;
  while(stack.length){if(n++%128===0)await checkpoint({processed:n});const {parent,key,path}=stack.pop(),value=parent[key];if(typeof value==='string')parent[key]=redactText(value,state,path,style,strict);else if(value&&typeof value==='object'){const entries=Object.keys(value);for(let i=entries.length-1;i>=0;i--){const k=entries[i],p=Array.isArray(value)?path+'['+k+']':path+'.'+k;if(metadata.has(k)){const raw=typeof value[k]==='string'?value[k]:JSON.stringify(value[k]??'');redactText(raw,state,p,style,strict);addRedactionFinding(state,'metadata',raw,p,'Metadata removed');value[k]=redactionToken('metadata',raw,style);}else stack.push({parent:value,key:k,path:p});}}}
  return {...(!preview?{conv}:{}),stats:state.stats,matches:state.matches,total:state.total,style,strict};
}
function messageText(message){const parts=[message?.text||''];for(const b of list(message?.content)){if(typeof b?.text==='string')parts.push(b.text);if(typeof b?.thinking==='string')parts.push(b.thinking);if(typeof b?.content==='string')parts.push(b.content);if(b?.input?.query)parts.push(b.input.query);}return parts.join('\n');}
function* matches(text,needle){
  text=String(text);needle=String(needle).toLowerCase();if(!needle)return;
  const lower=text.toLowerCase();let starts=null,ends=null;
  // Lowercasing can expand a code point (e.g. dotted capital I). Locations remain source UTF-16 offsets.
  if(lower.length!==text.length){starts=[];ends=[];let offset=0;for(const point of text){const size=point.toLowerCase().length;for(let i=0;i<size;i++){starts.push(offset);ends.push(offset+point.length);}offset+=point.length;}}
  let at=0;while((at=lower.indexOf(needle,at))!==-1){const offset=starts?starts[at]:at,end=ends?ends[at+needle.length-1]:at+needle.length;yield{offset,length:end-offset};at+=needle.length;}
}
function markdownPlain(text){
  const tokens=marked.lexer(String(text||''));
  const plain=tokens=>tokens.map(token=>token.type==='code'?token.text:token.tokens?plain(token.tokens):token.items?token.items.map(item=>plain(item.tokens||[])).join('\n'):token.type==='table'?[...token.header,...token.rows.flat()].map(cell=>plain(cell.tokens||[])).join(' '):token.text||'').join('');
  return plain(tokens);
}
function searchFields(message){const fields=[];if(message.text)fields.push({key:'text',text:markdownPlain(message.text)});for(let i=0;i<(message.content||[]).length;i++){const b=message.content[i];if(b?.type==='text')fields.push({key:'content.'+i+'.text',text:markdownPlain(b.text||'')});else if(b?.type==='thinking')fields.push({key:'content.'+i+'.thinking',text:String(b.thinking||'')});else if(typeof b?.content==='string')fields.push({key:'content.'+i+'.content',text:b.content});}return fields;}
function readArtifact(b){
  if(!b||typeof b!=='object')return null;
  const inp=(b.type==='tool_use'||b.type==='server_tool_use')?(b.input||{}):b;
  const mime=(inp.type||inp.mimeType||inp.media_type||'')+'';
  let code=inp.widget_code!=null?inp.widget_code
    :inp.content!=null?inp.content
    :inp.source!=null?inp.source
    :inp.code!=null?inp.code
    :inp.svg!=null?inp.svg
    :inp.html!=null?inp.html:'';
  if(typeof code!=='string')code=(code&&code.text)?code.text:'';
  const title=inp.title||inp.name||'';
  if(!code){
    const rc=b.content;
    if(Array.isArray(rc)){for(const x of rc){if(x&&typeof x.text==='string'&&x.text){code=x.text;break;}}}
    else if(typeof rc==='string')code=rc;
  }
  if(!code)return null;
  const t=code.trim();
  if(/svg\+xml/i.test(mime)||/^<svg[\s>]/i.test(t))return{kind:'svg',code,title};
  if(/mermaid/i.test(mime)||/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|mindmap|timeline)\b/.test(t))return{kind:'mermaid',code,title};
  if(/html/i.test(mime)||/^<!doctype html|^<html[\s>]/i.test(t)||/<(?:style|div|section|main|canvas|script|table|article)[\s>]/i.test(t))return{kind:'html',code,title};
  return null;
}

function extractHeredocFiles(cmd){
  const out=[];
  const re=/cat\s+>{1,2}\s*([^\s<]+)\s*<<\s*['"]?([A-Za-z0-9_]+)['"]?\s*\n([\s\S]*?)\n\2\b/g;
  let m;
  while((m=re.exec(cmd))){
    const path=m[1].replace(/['"]/g,''),body=m[3];
    if(path&&body&&body.length>1)out.push({path,name:path.split('/').pop(),content:body});
  }
  return out;
}

// ── 生成文件存储（blob URL，可下载/打开）──
const FILESTORE={};let _fid=0;

function prepare(message,offsets={},full=false){
  const copy=structuredClone(message),msg=copy,content=copy.content||[];
  const visuals=[],files=[],searchQueries=[],searchResults=[];
  for(const b of content){
    if(!b||typeof b!=='object')continue;
    const ty=b.type,nm=(b.name||'')+'';
    if((ty==='tool_use'||ty==='server_tool_use')&&/show_widget|visualize|imagine|artifact/i.test(nm)){
      const art=readArtifact(b);
      if(art){visuals.push(art);b._consumed=true;}
      continue;
    }
    if(ty==='tool_use'||ty==='server_tool_use'){
      if(/web_search|web_fetch/i.test(nm)){
        const q=(b.input||{}).query||(b.input||{}).url||'';
        if(q)searchQueries.push(q+'');
        b._consumed=true;continue;
      }
      const inp=b.input||{};
      const fcontent=inp.file_text!=null?inp.file_text
        :(typeof inp.content==='string'&&/^(create|write)/i.test(nm)?inp.content:null);
      const path=inp.path||inp.file_path||inp.filename||inp.output_path||'';
      if(/create_file|write_file|create/i.test(nm)&&fcontent!=null&&path){
        files.push({path,name:path.split('/').pop(),content:fcontent});
        b._consumed=true; // 文件卡片已完整承载（含全部内容），不再渲染原始工具块
      }else if(/bash/i.test(nm)&&typeof inp.command==='string'){
        extractHeredocFiles(inp.command).forEach(f=>files.push(f));
        // bash 命令本身是上下文，保留原始工具块
      }else if(/present_files|present_fs_item/i.test(nm)){
        const fps=inp.filepaths||inp.paths||inp.files||(path?[path]:[]);
        (Array.isArray(fps)?fps:[fps]).forEach(p=>{
          if(p&&!files.some(f=>f.path===p))files.push({path:p+'',name:(p+'').split('/').pop(),content:null});
        });
        b._consumed=true; // 路径列表已由文件卡片展示
      }
      continue;
    }
    if(ty==='tool_result'||ty==='web_search_tool_result'||ty==='web_search_result'){
      if(/web_search|web_fetch/i.test(nm)||ty!=='tool_result'){
        const items=Array.isArray(b.content)?b.content:(b.content?[b.content]:[]);
        for(const r of items){
          const x=r&&(r.url||r.title)?r:(r&&r.content);
          if(x&&(x.url||x.title))searchResults.push({title:x.title||x.url,url:x.url||''});
        }
        b._consumed=true; // 查询与来源已由搜索面板承载，不再渲染原始工具结果块（避免重复展示）
      }
    }
  }

copy._prepared={visuals,files,searchQueries,searchResults};
  const partial=(text,key,markdown=true)=>{
    const tokens=markdown?marked.lexer(String(text)).filter(token=>token.type!=='space'):[],singleCode=tokens.length===1&&tokens[0].type==='code'?tokens[0]:null;
    const plain=markdown?markdownPlain(text):String(text),offset=Math.max(0,Math.min(offsets[key]||0,Math.max(0,plain.length-1))),slice=plain.slice(offset,offset+32768);
    const id='cb_'+Math.random().toString(36).slice(2),language=String(singleCode?.lang||'').split(/\s/,1)[0];codes.set(id,singleCode?singleCode.text:plain);
    return {text:slice,html:'<pre class="reader-partial"><code id="'+id+'"'+(language?' data-large-code="'+id+'" data-language="'+escAttr(language)+'"':'')+'>'+esc(slice)+'</code></pre>',key,start:offset,end:offset+slice.length,total:plain.length};
  };
  if(copy.text){if(!full&&copy.text.length>65536){copy._partial=partial(copy.text,'text');copy.text=copy._partial.text;copy._html=copy._partial.html;}else copy._html=marked.parse(copy.text);}
  for(let i=0;i<(copy.content||[]).length;i++){
    const block=copy.content[i];if(!block||typeof block!=='object')continue;const key='content.'+i+'.'+(block.type==='thinking'?'thinking':'text');block._field=key;
    if(block.type==='text'){if(!full&&String(block.text||'').length>65536){block._partial=partial(block.text,key);block.text=block._partial.text;block._html=block._partial.html;}else block._html=marked.parse(String(block.text||''));}
    else if(!full&&block.type==='thinking'&&String(block.thinking||'').length>65536){block._partial=partial(block.thinking,key,false);block.thinking=block._partial.text;}
  }
  return copy;
}

return {code:id=>codes.get(id)||'',clearCodes:()=>codes.clear(),parseDesignExports,configure(context={}){currentLang=context.lang||'zh';labels=context.labels||{};if(typeof marked!=='undefined')configureMarked();},tree,redactConversation,redactAsync,quality,behavior,markdown,prepare,searchFields,matches,esc,escAttr,t,fmtTime,messageText};
}
