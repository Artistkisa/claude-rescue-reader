function archiveAnalysisCore(){
  const list=value=>Array.isArray(value)?value:[];
  async function calculateAnalytics(records,materialize,customStopZh=[],checkpoint=async()=>{}){
    const state={conversations:0,messages:0,human:0,assistant:0,humanCharacters:0,assistantCharacters:0,characters:0,thinking:0,tools:0,toolErrors:0,attachments:0,textBlocks:0,imageBlocks:0,artifacts:0,webSearches:0,emptyMessages:0,branchPoints:0,alternativeMessages:0,branchedConversations:0,conversationDurationMs:0,months:{},activeDates:{},weekdays:Array(7).fill(0),hours:Array(24).fill(0),models:{},toolNames:{},depths:{},wordsZh:{},wordsEn:{},responseLatencies:[],longest:[],lateNightMessages:0,longestThinking:null,mostToolErrors:null};
    const add=(object,key,n=1)=>{object[key]=(object[key]||0)+n;};
    const stopEn=new Set('a an and are as at be been but by can could did do does for from had has have he her hers him his how i if in into is it its may me might more most my no not of on or our ours she should so some than that the their theirs them then there these they this those to too us was we were what when where which who why will with would you your yours'.split(' '));
    const stopZh=new Set(('的 了 和 是 在 我 有 就 不 人 都 一 一个 上 也 很 到 说 要 去 你 会 着 没有 看 好 自己 这 那 里 为 以 及 与 或 而 被 把 对 从 等 中 能 可以 进行 使用 需要 如果 这个 这些 我们 你们 他们 因为 所以 然后 而且 但是 还是 已经 可能 现在 之后 之前 其中 通过 对于 关于 根据 按照 什么 怎么 为什么 哪个 哪些 哪里 这里 那里 这样 那样 这么 那么 不是 不能 无法 不会 不同 一些 一种 本身 目前 当前 直接 完全 真正 真实 所有 全部 整个 完整 相关 具体 一般 通常 主要 核心 内容 问题 文章 说明 数据 文件 图片 标题 结构 技术 逻辑 工具 系统 服务 设计 代码 网站 产品 项目 章节 分类 部分 方面 东西 事情 你的 我的 他的 她的 它的 我们的 你们的 他们的 各种 某些 任何 其他 还有 因此 例如 吧 呢 啊 哦 嗯 呀 嘿 哈 哈哈 诶 哎 唉 这类 这次 这点 这个问题 这种情况 就是 那个 那些 知道 的是 存在 或者 开始 几个 这种 出来 只是 只是说 还有点 一下 一下子 一直 一定 一样 一起 一共 多个 少数 许多 多少 时候 以后 以前 现在的 之后的 起来 下来 上来 回来 过去').split(/\s+/));
    for(const word of customStopZh)if(word)stopZh.add(String(word).toLowerCase());
    const segmenter=typeof Intl!=='undefined'&&Intl.Segmenter?new Intl.Segmenter('zh',{granularity:'word'}):null;
    const countWords=async text=>{
      if(!text)return;
      let wordsProcessed=0;
      for(const word of text.toLowerCase().match(/[a-z][a-z0-9'-]{2,}/g)||[]){if(!stopEn.has(word))add(state.wordsEn,word);if(++wordsProcessed%1024===0)await checkpoint();}
      const chinese=(text.match(/[\u3400-\u9fff]+/g)||[]).join(' ');if(!chinese)return;
      if(segmenter){for(const part of segmenter.segment(chinese)){const word=part.segment.trim();if(part.isWordLike&&word.length>=2&&!stopZh.has(word))add(state.wordsZh,word);if(++wordsProcessed%1024===0)await checkpoint();}}
      else for(const word of chinese.match(/[\u3400-\u9fff]{2,4}/g)||[])if(!stopZh.has(word))add(state.wordsZh,word);
    };
    for await(const record of records){
      await checkpoint();
      const conversation=materialize(record),messages=list(conversation.chat_messages);state.conversations++;
      let convChars=0,convBranched=false,convToolErrors=0;const childCounts={},timed=[];
      for(let messageIndex=0;messageIndex<messages.length;messageIndex++){
        if(messageIndex%128===0)await checkpoint({done:state.conversations-1,messageIndex,totalMessages:messages.length});
        const message=messages[messageIndex];
        state.messages++;const sender=message?.sender||'assistant';if(sender==='human')state.human++;else if(sender==='assistant')state.assistant++;
        let characters=0,thinking=0,tools=0,textBlocks=0,imageBlocks=0,artifacts=0,webSearches=0,wordText='';
        for(const block of list(message?.content)){
          if(!block||typeof block!=='object')continue;const type=block.type||'',name=String(block.name||'');
          if(type==='text'){const text=String(block.text||'');textBlocks++;characters+=text.length;wordText+=' '+text;}
          else if(type==='thinking'){const text=String(block.thinking||'');thinking++;characters+=text.length;wordText+=' '+text;const start=Date.parse(block.start_timestamp||''),stop=Date.parse(block.stop_timestamp||'');if(Number.isFinite(start)&&Number.isFinite(stop)&&stop>=start){const duration=stop-start;if(!state.longestThinking||duration>state.longestThinking.durationMs)state.longestThinking={durationMs:duration,conversationUuid:record.meta.uuid,title:record.meta.name,messageUuid:message?.uuid||''};}}
          else if(type==='image')imageBlocks++;
          if(type==='tool_use'||type==='server_tool_use'){tools++;add(state.toolNames,name||'unknown');if(/show_widget|visualize|imagine|artifact/i.test(name))artifacts++;if(/web_search|web_fetch/i.test(name))webSearches++;}
          if((type==='tool_result'||type==='web_search_tool_result')&&block.is_error){state.toolErrors++;convToolErrors++;}
        }
        if(!list(message?.content).length&&message?.text){wordText=String(message.text);characters=wordText.length;}
        if(sender==='human')state.humanCharacters+=characters;else if(sender==='assistant')state.assistantCharacters+=characters;
        state.characters+=characters;convChars+=characters;state.thinking+=thinking;state.tools+=tools;state.textBlocks+=textBlocks;state.imageBlocks+=imageBlocks;state.artifacts+=artifacts;state.webSearches+=webSearches;
        const attachments=list(message?.attachments).length+list(message?.files).length;state.attachments+=attachments;if(!list(message?.content).length&&!message?.text&&!attachments)state.emptyMessages++;
        const date=new Date(message?.created_at||message?.updated_at||''),timestamp=date.getTime();
        if(!Number.isNaN(timestamp)){const dateKey=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');add(state.activeDates,dateKey);add(state.months,dateKey.slice(0,7));state.weekdays[date.getDay()]++;state.hours[date.getHours()]++;if(date.getHours()<5)state.lateNightMessages++;timed.push({sender,uuid:message?.uuid||'',parentUuid:message?.parent_message_uuid||'',timestamp});}
        const model=message?.model||message?.model_slug||message?.message?.model||'';if(model)add(state.models,model);await countWords(wordText);
        if(message?.parent_message_uuid)add(childCounts,message.parent_message_uuid);
      }
      for(const count of Object.values(childCounts))if(count>1){state.branchPoints++;state.alternativeMessages+=count-1;convBranched=true;}if(convBranched)state.branchedConversations++;
      timed.sort((a,b)=>a.timestamp-b.timestamp);if(timed.length>1)state.conversationDurationMs+=timed.at(-1).timestamp-timed[0].timestamp;
      const timedByUuid=Object.fromEntries(timed.filter(item=>item.uuid).map(item=>[item.uuid,item]));for(const item of timed){const parent=timedByUuid[item.parentUuid];if(item.sender==='assistant'&&parent?.sender==='human'){const latency=item.timestamp-parent.timestamp;if(latency>=0&&latency<=86400000)state.responseLatencies.push(latency);}}
      const depth=messages.length,depthKey=depth<=5?'1–5':depth<=10?'6–10':depth<=25?'11–25':depth<=50?'26–50':depth<=100?'51–100':'101+';add(state.depths,depthKey);
      state.longest.push({uuid:record.meta.uuid,title:record.meta.name,messages:depth,characters:convChars,updatedAt:record.meta.updated_at||record.meta.created_at});
      if(convToolErrors&&(!state.mostToolErrors||convToolErrors>state.mostToolErrors.errors))state.mostToolErrors={conversationUuid:record.meta.uuid,title:record.meta.name,errors:convToolErrors};
    }
    state.longest.sort((a,b)=>b.messages-a.messages||b.characters-a.characters);state.longest=state.longest.slice(0,10);state.wordsZh=Object.entries(state.wordsZh).sort((a,b)=>b[1]-a[1]).slice(0,40);state.wordsEn=Object.entries(state.wordsEn).sort((a,b)=>b[1]-a[1]).slice(0,40);state.responseLatencies.sort((a,b)=>a-b);state.medianResponseMs=state.responseLatencies.length?state.responseLatencies[Math.floor(state.responseLatencies.length/2)]:0;delete state.responseLatencies;
    const dates=Object.keys(state.activeDates).sort();let streak=0,longestStreak=0,previous=NaN,streakStart='',longestStart='',longestEnd='';for(const date of dates){const day=Date.parse(date+'T00:00:00Z')/86400000;if(day===previous+1)streak++;else{streak=1;streakStart=date;}if(streak>longestStreak){longestStreak=streak;longestStart=streakStart;longestEnd=date;}previous=day;}state.activeDays=dates.length;state.longestStreak=longestStreak;state.longestStreakStart=longestStart;state.longestStreakEnd=longestEnd;state.peakHour=state.hours.indexOf(Math.max(...state.hours));state.mostUsedTool=Object.entries(state.toolNames).sort((a,b)=>b[1]-a[1])[0]||null;delete state.activeDates;
    return state;
  }
  async function calculateProjectIndex(records,materialize,projects,memoryData,checkpoint=async()=>{}){
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
    for await(const record of records){
      await checkpoint();
      const conversation=materialize(record),messages=list(conversation.chat_messages),exactCandidates=new Set(),exactFiles=new Set(),queries=[];
      for(let messageIndex=0;messageIndex<messages.length;messageIndex++){
        if(messageIndex%128===0)await checkpoint();
        const message=messages[messageIndex];for(const block of list(message?.content)){
        if(!block)continue;
        if(block.type==='local_resource'){const owner=uniqueOwner(block.file_path);if(owner){exactCandidates.add(owner);exactFiles.add(normalize(block.file_path));}}
        if(block.type==='tool_result')for(const child of projectList(block.content)){if(child?.type!=='text')continue;for(const ref of String(child.text||'').match(/\/mnt\/project\/([^\n\t ]+)/g)||[]){const owner=uniqueOwner(ref);if(owner){exactCandidates.add(owner);exactFiles.add(normalize(ref));}}}
        if(block.type==='tool_use'&&block.name==='project_knowledge_search'&&block.input?.query)queries.push(String(block.input.query).toLowerCase());
      }
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
    return{map,evidence,stats};
  }
  return{calculateAnalytics,calculateProjectIndex};
}
