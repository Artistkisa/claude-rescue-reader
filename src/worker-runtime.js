function featureWorkerRuntime(core,handler){
  let generation=0,port=null,active=null,stream=null;
  const emit=(type,token,payload={},transfer=[])=>self.postMessage({type,generation:token.generation,requestId:token.requestId,...payload},transfer);
  const stop=()=>{if(active){active.canceled=true;stream?.reject?.(Object.assign(new Error('Canceled'),{canceled:true}));stream=null;}};
  async function checkpoint(token,detail){
    if(token.canceled||token.generation!==generation)throw Object.assign(new Error('Canceled'),{canceled:true});
    if(detail)emit('progress',token,{progress:detail});
    if(performance.now()-token.yieldAt>=8){await new Promise(resolve=>setTimeout(resolve,0));token.yieldAt=performance.now();}
    if(token.canceled||token.generation!==generation)throw Object.assign(new Error('Canceled'),{canceled:true});
  }
  async function* records(token,uuids){
    if(!port)throw new Error('Data channel unavailable');
    stream={requestId:token.requestId,pending:null};
    port.postMessage({type:'streamStart',requestId:token.requestId,generation,uuids});
    try{
      while(true){await checkpoint(token);const batch=stream?.pending||await new Promise((resolve,reject)=>{if(!stream){reject(Object.assign(new Error('Canceled'),{canceled:true}));return;}stream.resolve=resolve;stream.reject=reject;});if(!stream)await checkpoint(token);stream.pending=null;stream.resolve=null;
        token.totalRecords=batch.total;
        for(const record of batch.items||[]){await checkpoint(token);yield record;token.loadedRecords=(token.loadedRecords||0)+1;}
        await checkpoint(token);port.postMessage({type:'batchAck',generation,requestId:token.requestId,batchId:batch.batchId});if(batch.done)return;
      }
    }finally{port?.postMessage({type:'streamCancel',generation,requestId:token.requestId});if(stream?.requestId===token.requestId)stream=null;}
  }
  self.onmessage=event=>{
    const message=event.data||{};
    if(message.type==='init'){
      stop();port?.close();generation=message.generation;port=message.port||null;
      if(port){port.onmessage=event=>{const batch=event.data||{};if(batch.generation!==generation)return;if(batch.type==='sourceChanged'){stop();port.close();port=null;return;}if(batch.requestId!==stream?.requestId)return;if(batch.type==='error'){stream.reject?.(new Error(batch.error));return;}if(stream.resolve)stream.resolve(batch);else stream.pending=batch;};port.start();}
      emit('ready',message);return;
    }
    if(message.generation!==generation)return;
    if(message.type==='cancel'){if(!message.taskType||active?.type===message.taskType)stop();return;}
    if(message.type==='release'){stop();port?.close();port=null;handler.release?.();return;}
    if(message.payload?.priority==='background'&&active&&!active.canceled){emit('result',message,{result:{skipped:true}});return;}
    stop();const token={requestId:message.requestId,generation,canceled:false,yieldAt:performance.now(),type:message.type};active=token;
    core.configure(message.context);
    token.checkpoint=detail=>checkpoint(token,detail);token.records=uuids=>records(token,uuids);
    Promise.resolve().then(()=>handler(message.type,message.payload||{},token)).then(async result=>{
      await checkpoint(token);if(active===token)active=null;
      const transfer=result?.bytes instanceof ArrayBuffer?[result.bytes]:[];emit('result',token,{result},transfer);
    }).catch(error=>{if(active===token)active=null;emit(error.canceled?'canceled':'error',token,{error:error.message});});
  };
}
