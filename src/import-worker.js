function importWorkerMain(){
  let zip=null,generation=0,port=null,sequence=0,operation=0,attachmentQueue=Promise.resolve();
  const pending=new Map(),core=workerDomainCore();
  const rpc=(type,payload,transfer=[])=>new Promise((resolve,reject)=>{const requestId=++sequence;pending.set(requestId,{resolve,reject});port.postMessage({type,payload,requestId,generation},transfer);});
  const emit=(type,request,extra={})=>self.postMessage({type,generation:request.generation,requestId:request.requestId,...extra});
  const check=async current=>{if(current!==operation)throw Object.assign(new Error('Canceled'),{canceled:true});await new Promise(resolve=>setTimeout(resolve,0));if(current!==operation)throw Object.assign(new Error('Canceled'),{canceled:true});};
  async function extractConversation(entry,request,current){
    await rpc('ingestStart');
    await new Promise((resolve,reject)=>{
      const stream=entry.internalStream('uint8array');let chunks=[],bytes=0,chain=Promise.resolve();
      const flush=()=>{if(!bytes)return;const buffer=new Uint8Array(bytes);let at=0;for(const chunk of chunks){buffer.set(chunk,at);at+=chunk.length;}chunks=[];bytes=0;return rpc('ingestChunk',buffer.buffer,[buffer.buffer]);};
      stream.on('data',(chunk,metadata)=>{
        if(current!==operation){stream.pause();reject(Object.assign(new Error('Canceled'),{canceled:true}));return;}
        chunks.push(chunk);bytes+=chunk.byteLength;
        if(bytes>=4*1024*1024){stream.pause();chain=chain.then(flush).then(()=>{emit('progress',request,{progress:{phase:'extract',percent:metadata.percent}});if(current!==operation)throw Object.assign(new Error('Canceled'),{canceled:true});stream.resume();}).catch(reject);}
      });
      stream.on('error',reject);stream.on('end',()=>{chain.then(flush).then(resolve,reject);});stream.resume();
    });
    await check(current);return rpc('ingestEnd');
  }
  self.onmessage=event=>{
    const request=event.data||{};
    if(request.type==='init'){
      operation++;generation=request.generation;port?.close();port=request.port;
      port.onmessage=event=>{const message=event.data,p= pending.get(message.requestId);if(!p)return;pending.delete(message.requestId);message.type==='error'?p.reject(new Error(message.error)):p.resolve(message.result);};port.start();emit('ready',request);return;
    }
    if(request.generation!==generation)return;
    if(request.type==='cancel'){operation++;return;}
    if(request.type==='release'){operation++;zip=null;port?.close();port=null;return;}
    const current=request.type==='open'?++operation:operation;
    core.configure(request.context);
    Promise.resolve().then(async()=>{
      if(request.type==='attachment'){
        const job=attachmentQueue.catch(()=>{}).then(async()=>{await check(current);const file=zip?.file(request.payload.name);if(!file)throw new Error('Attachment not found');const blob=await file.async('blob');await check(current);return{blob,name:request.payload.name};});attachmentQueue=job;return job;
      }
      if(request.type!=='open')throw new Error('Unknown import request');
      zip=await JSZip.loadAsync(request.payload.file);await check(current);
      const entries=Object.keys(zip.files).filter(name=>!name.startsWith('__MACOSX/')&&!zip.files[name].dir);
      const conv=entries.find(name=>/(^|\/)conversations\.json$/i.test(name)),memory=entries.find(name=>/(^|\/)memories\.json$/i.test(name));
      const projects=entries.filter(name=>/(^|\/)projects\/[^/]+\.json$/i.test(name)),known=new Set([conv,memory,...projects]),designs=entries.filter(name=>/\.json$/i.test(name)&&!known.has(name));
      const file=request.payload.file,sample=new Uint8Array(await new Blob([String(file.size)+':'+String(file.lastModified),file.slice(0,65536),file.slice(Math.max(0,file.size-65536))]).arrayBuffer());
      let fingerprint=2166136261;for(const byte of sample){fingerprint^=byte;fingerprint=Math.imul(fingerprint,16777619);}
      const digest=self.crypto?.subtle?[...new Uint8Array(await crypto.subtle.digest('SHA-256',sample))].map(byte=>byte.toString(16).padStart(2,'0')).join(''):(fingerprint>>>0).toString(16);
      const key='zip-v2-'+file.size+'-'+digest+'-'+conv;
      const cached=conv?await rpc('cacheLoad',{key}):null;
      const parsed=cached?.hit?cached:conv?await extractConversation(zip.files[conv],request,current):await rpc('ingest','[]');
      if(conv&&!cached?.hit)void rpc('cacheStore',{key}).catch(()=>{});
      const designConversations=[],projectData=[];let memoryData=null;
      for(const name of projects){await check(current);try{projectData.push(JSON.parse(await zip.files[name].async('text')));}catch{}}
      if(memory)try{const value=JSON.parse(await zip.files[memory].async('text'));memoryData=(Array.isArray(value)?value[0]:value)||null;}catch{}
      for(const name of designs){await check(current);try{designConversations.push(...core.parseDesignExports([await zip.files[name].async('text')]));}catch{}}
      const auxiliary=await rpc('auxiliary',designConversations);
      if(!conv&&!auxiliary.conversations.length)throw new Error('conversations.json not found in ZIP');
      const images=entries.filter(name=>/\.(?:png|jpe?g|gif|webp|bmp|svg|avif|heic|tiff?)$/i.test(name));
      await check(current);return{parsed,projects:projectData,memory:memoryData,designs:auxiliary.conversations,images};
    }).then(result=>emit('result',request,{result})).catch(error=>emit(error.canceled?'canceled':'error',request,{error:error.message}));
  };
}
