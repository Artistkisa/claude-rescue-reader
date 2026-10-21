function taskWorkerMain(){
  const core=workerDomainCore(),cache=new Map();let pdf=null;
  const materialize=async(payload,token)=>{
    if(payload.conversation)return structuredClone(payload.conversation);
    for await(const record of token.records([payload.uuid]))return JSON.parse(record.raw);
    throw new Error('Conversation not found');
  };
  featureWorkerRuntime(core,async(type,payload,token)=>{
    if(type==='memoryView'){await token.checkpoint();return{html:core.renderMarkdown(payload.text)};}
    if(type==='highlight'){await token.checkpoint();return{html:hljs.getLanguage(payload.language)?hljs.highlight(payload.code,{language:payload.language}).value:core.esc(payload.code)};}
    if(type==='behavior')return core.behavior(token.records(),()=>token.checkpoint({loaded:token.loadedRecords||0,total:token.totalRecords||0}));
    if(type==='preview'){
      const key=JSON.stringify([token.generation,payload.uuid,payload.conversation?null:payload.lang,payload.style,payload.strict,payload.ruleVersion||1]);
      if(!payload.conversation&&cache.has(key)){const hit=cache.get(key);cache.delete(key);cache.set(key,hit);return hit;}
      const result=await core.redactAsync(await materialize(payload,token),payload.style||'standard',!!payload.strict,token.checkpoint,true);
      if(!payload.conversation){cache.set(key,result);while(cache.size>4)cache.delete(cache.keys().next().value);}
      return result;
    }
    if(type==='quality'){
      const conversation=await materialize(payload,token),result=await core.quality({messages:conversation.chat_messages,title:payload.title||conversation.name},token.checkpoint);
      result.sensitive=(await core.redactAsync(conversation,'standard',false,token.checkpoint,true)).stats;return result;
    }
    if(type==='projectExport'){
      const p=payload.project,stats=payload.stats,parts=['# '+(p.name||core.t('项目（单数）'))+'\n\n'+(p.description||'')+'\n\n## '+core.t('项目统计')+'\n\n'];
      for(const [label,value]of [['关联对话',stats.conversations],['条消息',stats.messages],['字',stats.chars],['时间范围',stats.range]])parts.push('- '+core.t(label)+': '+value+'\n');
      if(payload.prompt)parts.push('\n## '+core.t('项目自定义指令')+'\n\n```text\n'+payload.prompt.replace(/```/g,'``\\`')+'\n```\n\n');
      parts.push('\n## '+core.t('项目文档')+'\n\n');for(const d of p.docs||[])parts.push('### '+(d.filename||core.t('未命名'))+'\n\n'+(d.content||'')+'\n\n');
      parts.push('## '+core.t('关联对话')+'\n\n');let done=0;
      for await(const record of token.records(payload.uuids)){
        const c=JSON.parse(record.raw);parts.push('### '+(c.name||core.t('无标题'))+'\n\n> UUID: '+(c.uuid||'')+'\n\n');
        let n=0;for(const m of core.tree(c).messages){if(n++%128===0)await token.checkpoint();parts.push('**'+(m.sender==='human'?core.t('你'):'Claude')+'** · '+core.fmtTime(m.created_at)+'\n\n');for(const b of m.content||[]){if(b?.type==='text')parts.push((b.text||'')+'\n\n');else if(b?.type==='thinking')parts.push('<details><summary>'+core.t('思考过程')+'</summary>\n\n'+(b.thinking||'')+'\n\n</details>\n\n');else if(b?.type==='tool_use')parts.push('> '+core.t('工具调用')+': `'+(b.name||'')+'`\n\n');}parts.push('---\n\n');}
        await token.checkpoint({loaded:++done,total:payload.uuids.length});
      }
      return {blob:new Blob(parts,{type:'text/markdown;charset=utf-8'})};
    }
    if(type==='pdfPage'&&pdf?.id===payload.pdfId){const start=payload.start||0,messages=pdf.messages.slice(start,start+50).map(message=>core.prepare(message,{},true)),total=pdf.messages.length;if(start+messages.length>=total)pdf=null;return {messages,total};}
    let conversation=await materialize(payload,token);
    if(payload.safe)conversation=(await core.redactAsync(conversation,payload.style||'standard',!!payload.strict,token.checkpoint)).conv;
    if(type==='export')return{blob:new Blob([await core.markdown(conversation,payload.mode,payload.choices,token.checkpoint)],{type:'text/markdown;charset=utf-8'})};
    if(type==='pdfPage'){
      const selected=core.tree(conversation,payload.mode,payload.choices),start=payload.start||0;
      if(start+50<selected.ids.length)pdf={id:payload.pdfId,messages:selected.messages};else pdf=null;
      return {messages:selected.messages.slice(start,start+50).map(message=>core.prepare(message,{},true)),total:selected.ids.length};
    }
    throw new Error('Unknown task: '+type);
  });
}
