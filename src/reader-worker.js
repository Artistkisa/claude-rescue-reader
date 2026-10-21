function readerWorkerMain(){
  const core=workerDomainCore();let conversation=null,selection=null,selectionKey='',fields=null,query='',queryCounts=[],total=0;const offsets=new Map();
  const select=payload=>{
    const key=JSON.stringify([payload.mode||'longest',payload.choices||{}]);
    if(key!==selectionKey){selectionKey=key;selection=core.tree(conversation,payload.mode,payload.choices);query='';}
    return selection;
  };
  featureWorkerRuntime(core,async(type,payload,token)=>{
    if(type==='open'){
      if(payload.conversation)conversation=payload.conversation;
      else{conversation=null;for await(const record of token.records([payload.uuid])){conversation=JSON.parse(record.raw);break;}}
      if(!conversation)throw new Error('Conversation not found');selectionKey='';fields=new Map();query='';offsets.clear();core.clearCodes();
      const {chat_messages,...meta}=conversation;select(payload);
      return {meta:{...meta,_summaryHtml:meta.summary?marked.parse(meta.summary):'',message_count:chat_messages?.length||0,_readerBacked:true},total:selection.ids.length};
    }
    if(!conversation)throw new Error('Reader not initialized');
    if(type==='copy'){const message=conversation.chat_messages[payload.sourceIndex];return{text:(message?.content||[]).filter(b=>b?.type==='text').map(b=>b.text||'').join('\n\n')||message?.text||''};}
    if(type==='code')return{text:core.code(payload.id)};
    if(type==='source'){
      const message=conversation.chat_messages[payload.sourceIndex],value=payload.key==='text'?message.text:message.content?.[payload.block]?.[payload.key];return{text:String(value||'')};
    }
    const selected=select(payload);
    if(type==='window'){
      if(payload.focus){const hit=payload.focus;if(!offsets.has(hit.sourceIndex))offsets.set(hit.sourceIndex,{});offsets.get(hit.sourceIndex)[hit.key]=Math.max(0,hit.offset-1024);}
      if(payload.segment){const part=payload.segment;if(!offsets.has(part.sourceIndex))offsets.set(part.sourceIndex,{});offsets.get(part.sourceIndex)[part.key]=Math.max(0,part.offset);}
      core.clearCodes();
      const end=payload.end===undefined?selected.ids.length:Math.min(selected.ids.length,payload.end);let start=payload.start===undefined?Math.max(0,end-40):Math.max(0,payload.start);
      if(payload.start===undefined){let budget=0,count=0;start=end;while(start>0&&count<100){const weight=1+Math.min(6,Math.floor(core.messageText(selected.messages[start-1]).length/2500));if(count>=8&&budget+weight>60)break;start--;count++;budget+=weight;}}
      const messages=[];let weight=0;
      for(let i=start;i<Math.min(end,start+100);i++){
        await token.checkpoint();const original=selected.messages[i],prepared=core.prepare(original,offsets.get(original._sourceIndex)||{});
        prepared._linearIndex=i;messages.push(prepared);weight+=1+Math.min(6,Math.floor(core.messageText(original).length/2500));
        if(messages.length>=8&&weight>=60)break;
      }
      return{messages,start,end:start+messages.length,total:selected.ids.length};
    }
    if(type==='search'){
      const needle=String(payload.query||'').trim().toLowerCase();
      if(query!==needle||payload.refresh){query=needle;queryCounts=[];total=0;
        for(let i=0;i<selected.ids.length;i++){
          if(i%128===0)await token.checkpoint({loaded:i,total:selected.ids.length});const id=selected.ids[i];
          if(!fields.has(id))fields.set(id,core.searchFields(conversation.chat_messages[id]));
          let count=0;if(needle)for(const f of fields.get(id))for(const hit of core.matches(f.text,needle))count++;
          queryCounts.push(count);total+=count;
        }
      }
      const page=Math.max(0,Number(payload.page)||0),offset=page*100,rows=[];let ordinal=0;
      if(needle)for(let i=0;i<selected.ids.length&&rows.length<100;i++){
        if(ordinal+queryCounts[i]<=offset){ordinal+=queryCounts[i];continue;}
        const id=selected.ids[i];for(const f of fields.get(id)){let fieldOrdinal=0;for(const hit of core.matches(f.text,needle)){if(ordinal>=offset&&rows.length<100)rows.push({ordinal,sourceIndex:id,linearIndex:i,key:f.key,...hit,fieldOrdinal});ordinal++;fieldOrdinal++;}}
      }
      return{total,page,rows};
    }
    throw new Error('Unknown reader request');
  });
}
