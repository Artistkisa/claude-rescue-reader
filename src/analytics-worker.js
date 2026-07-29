function analyticsWorkerMain(){
  const state={conversations:0,messages:0,human:0,assistant:0,humanCharacters:0,assistantCharacters:0,characters:0,thinking:0,tools:0,attachments:0,textBlocks:0,imageBlocks:0,artifacts:0,webSearches:0,emptyMessages:0,branchPoints:0,alternativeMessages:0,branchedConversations:0,conversationDurationMs:0,months:{},activeDates:{},weekdays:Array(7).fill(0),hours:Array(24).fill(0),models:{},depths:{},wordsZh:{},wordsEn:{},responseLatencies:[],longest:[]};
  const add=(obj,key,n=1)=>{obj[key]=(obj[key]||0)+n;};
  const stopEn=new Set('a an and are as at be been but by can could did do does for from had has have he her hers him his how i if in into is it its may me might more most my no not of on or our ours she should so some than that the their theirs them then there these they this those to too us was we were what when where which who why will with would you your yours'.split(' '));
  const stopZh=new Set(('的 了 和 是 在 我 有 就 不 人 都 一 一个 上 也 很 到 说 要 去 你 会 着 没有 看 好 自己 这 那 里 为 以 及 与 或 而 被 把 对 从 等 中 能 可以 进行 使用 需要 如果 这个 这些 我们 你们 他们 '+
    '因为 所以 然后 而且 但是 还是 已经 可能 现在 之后 之前 其中 其中的 通过 对于 关于 根据 按照 以及 以及其 以及这 以及那 以及与 '+
    '什么 怎么 为什么 哪个 哪些 哪里 哪些个 这里 那里 这样 那样 这么 那么 不是 没有 不能 无法 不会 不同 一些 一种 一个 '+
    '本身 目前 当前 直接 完全 真正 真实 所有 全部 整个 完整 相关 具体 一般 通常 主要 核心 内容 问题 文章 说明 '+
    '数据 文件 图片 标题 结构 技术 逻辑 工具 系统 服务 设计 代码 网站 产品 项目 章节 分类 部分 方面 东西 事情 '+
    '你的 我的 他的 她的 它的 我们的 你们的 他们的 各种 某些 任何 其他 还有 以及 其中 因此 例如 '+
    '吧 呢 啊 哦 嗯 呀 嘿 哈 哈哈 诶 哎 唉 这类 这次 这点 这个问题 这种情况 就是 那个 那些 知道 的是 存在 或者 开始 几个 这种 出来 只是 只是说 还有点 '+
    '一下 一下子 一直 一定 一样 一起 一共 多个 少数 许多 多少 时候 以后 以前 现在的 之后的 起来 下来 上来 回来 过去').split(/\s+/));
  const zhSegmenter=typeof Intl!=='undefined'&&Intl.Segmenter?new Intl.Segmenter('zh',{granularity:'word'}):null;
  function countWords(text){
    if(!text)return;
    for(const word of text.toLowerCase().match(/[a-z][a-z0-9'-]{2,}/g)||[])if(!stopEn.has(word))add(state.wordsEn,word);
    const chinese=(text.match(/[\u3400-\u9fff]+/g)||[]).join(' ');
    if(!chinese)return;
    if(zhSegmenter){for(const part of zhSegmenter.segment(chinese)){const word=part.segment.trim();if(part.isWordLike&&word.length>=2&&!stopZh.has(word))add(state.wordsZh,word);}}
    else for(const word of chinese.match(/[\u3400-\u9fff]{2,4}/g)||[])if(!stopZh.has(word))add(state.wordsZh,word);
  }
  self.onmessage=e=>{
    const msg=e.data||{};
    if(msg.type==='init'){for(const word of msg.customStopZh||[])if(word)stopZh.add(String(word).toLowerCase());return;}
    if(msg.type==='batch'){
      for(const c of msg.items||[]){
        state.conversations++;
        let convChars=0,convBranched=false;
        const childCounts={},timed=[];
        for(const m of c.messages||[]){
          state.messages++;
          if(m.sender==='human'){state.human++;state.humanCharacters+=m.characters||0;}
          else if(m.sender==='assistant'){state.assistant++;state.assistantCharacters+=m.characters||0;}
          state.characters+=m.characters||0;convChars+=m.characters||0;
          state.thinking+=m.thinking||0;state.tools+=m.tools||0;state.attachments+=m.attachments||0;
          state.textBlocks+=m.textBlocks||0;state.imageBlocks+=m.imageBlocks||0;state.artifacts+=m.artifacts||0;state.webSearches+=m.webSearches||0;
          if(m.empty)state.emptyMessages++;
          if(m.month)add(state.months,m.month);
          if(m.date)add(state.activeDates,m.date);
          if(Number.isInteger(m.weekday)&&m.weekday>=0&&m.weekday<7)state.weekdays[m.weekday]++;
          if(Number.isInteger(m.hour)&&m.hour>=0&&m.hour<24)state.hours[m.hour]++;
          if(m.model)add(state.models,m.model);
          countWords(m.wordText);
          if(m.parentUuid)add(childCounts,m.parentUuid);
          if(Number.isFinite(m.timestamp))timed.push(m);
        }
        for(const count of Object.values(childCounts))if(count>1){state.branchPoints++;state.alternativeMessages+=count-1;convBranched=true;}
        if(convBranched)state.branchedConversations++;
        timed.sort((a,b)=>a.timestamp-b.timestamp);
        if(timed.length>1)state.conversationDurationMs+=timed[timed.length-1].timestamp-timed[0].timestamp;
        const byUuid=Object.fromEntries(timed.filter(m=>m.uuid).map(m=>[m.uuid,m]));
        for(const m of timed){const parent=byUuid[m.parentUuid];if(m.sender==='assistant'&&parent?.sender==='human'){
          const latency=m.timestamp-parent.timestamp;if(latency>=0&&latency<=86400000)state.responseLatencies.push(latency);
        }}
        const depth=(c.messages||[]).length,depthKey=depth<=5?'1–5':depth<=10?'6–10':depth<=25?'11–25':depth<=50?'26–50':depth<=100?'51–100':'101+';
        add(state.depths,depthKey);
        state.longest.push({uuid:c.uuid,title:c.title,messages:(c.messages||[]).length,characters:convChars,updatedAt:c.updatedAt});
      }
      self.postMessage({type:'batchDone',id:msg.id});
    }else if(msg.type==='finish'){
      state.longest.sort((a,b)=>b.messages-a.messages||b.characters-a.characters);state.longest=state.longest.slice(0,10);
      state.wordsZh=Object.entries(state.wordsZh).sort((a,b)=>b[1]-a[1]).slice(0,40);
      state.wordsEn=Object.entries(state.wordsEn).sort((a,b)=>b[1]-a[1]).slice(0,40);
      state.responseLatencies.sort((a,b)=>a-b);state.medianResponseMs=state.responseLatencies.length?state.responseLatencies[Math.floor(state.responseLatencies.length/2)]:0;delete state.responseLatencies;
      const dates=Object.keys(state.activeDates).sort();let streak=0,longestStreak=0,previous=NaN;
      for(const date of dates){const day=Date.parse(date+'T00:00:00Z')/86400000;streak=day===previous+1?streak+1:1;longestStreak=Math.max(longestStreak,streak);previous=day;}
      state.activeDays=dates.length;state.longestStreak=longestStreak;delete state.activeDates;
      self.postMessage({type:'result',result:state});
    }
  };
}
