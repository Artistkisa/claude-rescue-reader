function importWorkerMain(){
  let zip=null,generation=0,port=null,sequence=0,operation=0,attachmentQueue=Promise.resolve();
  const pending=new Map(),core=workerDomainCore(),format=exportFormatCore(),packages=new Map();
  const rpc=(type,payload,transfer=[])=>new Promise((resolve,reject)=>{const requestId=++sequence;pending.set(requestId,{resolve,reject});port.postMessage({type,payload,requestId,generation},transfer);});
  const emit=(type,request,extra={})=>self.postMessage({type,generation:request.generation,requestId:request.requestId,...extra});
  const check=async current=>{if(current!==operation)throw Object.assign(new Error('Canceled'),{canceled:true});await new Promise(resolve=>setTimeout(resolve,0));if(current!==operation)throw Object.assign(new Error('Canceled'),{canceled:true});};
  const digest=async bytes=>self.crypto?.subtle?new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)):format.sha256(bytes);
  async function packageFingerprint(inputs,current,request){
    let hash=new Uint8Array(32),done=0;const total=inputs.reduce((n,item)=>n+item.file.size,0);
    for(const item of inputs){
      if(item.path){const label=new TextEncoder().encode(item.path+':'+item.file.size),input=new Uint8Array(hash.length+label.length);input.set(hash);input.set(label,hash.length);hash=await digest(input);}
      for(let offset=0;offset<item.file.size;offset+=1024*1024){await check(current);const bytes=new Uint8Array(await item.file.slice(offset,offset+1024*1024).arrayBuffer()),input=new Uint8Array(hash.length+bytes.length);input.set(hash);input.set(bytes,hash.length);hash=await digest(input);done+=bytes.length;emit('progress',request,{progress:{phase:'fingerprint',percent:total?100*done/total:100}});}
    }
    return [...hash].map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  async function extractConversation(entry,request,current){
    await rpc('ingestStart');
    if(entry.file){
      const reader=entry.file.stream().getReader();try{for(;;){const {done,value}=await reader.read();if(done)break;await check(current);for(let offset=0;offset<value.length;offset+=4*1024*1024){const chunk=value.slice(offset,offset+4*1024*1024);await rpc('ingestChunk',chunk.buffer,[chunk.buffer]);}emit('progress',request,{progress:{phase:'extract'}});}}finally{reader.releaseLock();}
      return rpc('ingestEnd');
    }
    await new Promise((resolve,reject)=>{
      const stream=entry.internalStream('uint8array');let chunks=[],bytes=0,queued=0,ended=false,chain=Promise.resolve();
      const flush=percent=>{
        if(!bytes)return;const buffer=new Uint8Array(bytes);let at=0;for(const chunk of chunks){buffer.set(chunk,at);at+=chunk.length;}chunks=[];bytes=0;queued++;stream.pause();
        // Pako may emit several output chunks before a compressed input chunk finishes, even after pause.
        // Detach each bounded batch now; serialize sends and resume only after every queued batch is acknowledged.
        chain=chain.then(async()=>{if(current!==operation)throw Object.assign(new Error('Canceled'),{canceled:true});await rpc('ingestChunk',buffer.buffer,[buffer.buffer]);emit('progress',request,{progress:{phase:'extract',percent}});queued--;if(!queued&&!ended)stream.resume();});chain.catch(reject);
      };
      stream.on('data',(chunk,metadata)=>{
        if(current!==operation){stream.pause();reject(Object.assign(new Error('Canceled'),{canceled:true}));return;}
        for(let offset=0;offset<chunk.byteLength;){const size=Math.min(chunk.byteLength-offset,4*1024*1024-bytes);chunks.push(chunk.subarray(offset,offset+size));bytes+=size;offset+=size;if(bytes===4*1024*1024)flush(metadata.percent);}
      });
      stream.on('error',reject);stream.on('end',()=>{ended=true;flush(100);chain.then(resolve,reject);});stream.resume();
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
    if(request.type==='release'){operation++;zip=null;packages.clear();port?.close();port=null;return;}
    const current=request.type==='open'||request.type==='package'?++operation:operation;
    core.configure(request.context);
    Promise.resolve().then(async()=>{
      if(request.type==='resource'){
        const pkg=packages.get(request.payload.packageId);if(!pkg)throw new Error('Package not available; select its ZIP again');
        if(request.payload.memoryId!==undefined){const topic=pkg.memories[request.payload.memoryId];if(!topic)throw new Error('Memory not found');return{body:topic.body,raw:topic.raw};}
        const file=pkg.files[format.logicalPath(request.payload.path)];if(!file)throw new Error('Resource not found');return{blob:await file.async('blob')};
      }
      if(request.type==='package'){
        const file=request.payload.file;let id='',files;
        if(file){
          id=await packageFingerprint([{file}],current,request);
          if(packages.has(id))return{duplicate:true,id,filename:file.name};
          const archive=await JSZip.loadAsync(file);files=archive.files;
        }else{
          const selected=request.payload.files||[],paths=selected.map(f=>f.path||f.webkitRelativePath||f.name),root=paths[0]?.split('/')[0];
          const stripRoot=paths.every(p=>p.startsWith(root+'/'))&&!['areas','projects','artifacts','memories'].includes(root);
          files=Object.create(null);for(const [index,item]of selected.entries()){const f=item.file||item,name=stripRoot?paths[index].slice(root.length+1):paths[index];if(files[name])throw new Error('Duplicate export path');files[name]={file:f,async:type=>type==='blob'?Promise.resolve(f):f.text()};}
          id=await packageFingerprint(Object.keys(files).sort().map(path=>({path,file:files[path].file})),current,request);
          if(packages.has(id))return{duplicate:true,id,filename:'folder'};
        }
        const entries=Object.keys(files).filter(n=>!files[n].dir&&!n.startsWith('__MACOSX/'));for(const name of entries){if(/^\/|^[A-Za-z]:/.test(name))throw new Error('Invalid export path');format.logicalPath(files[name].unsafeOriginalName||name);}
        const convs=entries.filter(n=>/(^|\/)conversations(?:-\d+)?\.json$/i.test(n)),projects=[],memories=[],artifacts=[],users=[],logins=[],accounts=new Set();let legacyMemory=null;const designs=[];
        const filename=file?.name||'folder';
        for(const name of entries){await check(current);
          if(convs.includes(name))continue;
          if(/\.md$/i.test(name)){
            const logical=name.replace(/^.*?(?=(?:areas|projects)\/)/,'');
            if(/^(?:areas\/|projects\/[^/]+\/)/.test(logical))memories.push(format.memory(logical,await files[name].async('text'),'',filename));continue;
          }
          if(!/\.json$/i.test(name))continue;
          const value=JSON.parse(await files[name].async('text'));
          if(/(^|\/)projects\/[^/]+\.json$/i.test(name)){if(!value||typeof value.uuid!=='string'||!value.uuid||typeof value.name!=='string')throw new Error('Invalid project metadata');projects.push(value);continue;}
          if(value?.memory_files){memories.push(...format.memoryFiles(value,filename));if(value.account_uuid)accounts.add(value.account_uuid);continue;}
          if(/(^|\/)memories\.json$/i.test(name)){legacyMemory=(Array.isArray(value)?value[0]:value)||null;continue;}
          if(/(^|\/)users\.json$/i.test(name)){if(!Array.isArray(value)||value.some(u=>!u||typeof u!=='object'))throw new Error('Invalid account metadata');users.push(...value);for(const user of users)if(user.uuid)accounts.add(user.uuid);continue;}
          if(/(^|\/)login_history\.json$/i.test(name)){if(!Array.isArray(value?.login_events)||value.login_events.some(l=>!l||typeof l!=='object'))throw new Error('Invalid login metadata');logins.push(...value.login_events);for(const login of logins)if(login.account_uuid)accounts.add(login.account_uuid);continue;}
          if(/(^|\/)artifacts\/[^/]+\/artifact\.json$/i.test(name)){
            if(!value.id||!Array.isArray(value.versions)||value.versions.some(v=>!v||typeof v.id!=='string'||!/^[\w-]+$/.test(v.id)))throw new Error('Invalid artifact metadata');
            const base=name.slice(0,-'artifact.json'.length);artifacts.push({...value,versions:(value.versions||[]).map(v=>({...v,path:base+'versions/'+v.id+'.html',available:!!files[base+'versions/'+v.id+'.html']}))});continue;
          }
          designs.push(...core.parseDesignExports([JSON.stringify(value)]));
        }
        if(!convs.length&&!projects.length&&!memories.length&&!artifacts.length&&!users.length&&!logins.length&&!legacyMemory&&!designs.length)throw new Error('No supported export data in package');
        await check(current);await rpc('packageStart',{id,filename,accounts:[...accounts]});
        try{
          for(const name of convs){await check(current);await extractConversation(files[name],request,current);}
          // Design records use the same atomic append transaction as conversations.
          if(designs.length){await rpc('ingestStart');const bytes=new TextEncoder().encode(JSON.stringify(designs));for(let at=0;at<bytes.length;at+=4*1024*1024){const batch=bytes.slice(at,at+4*1024*1024);await rpc('ingestChunk',batch.buffer,[batch.buffer]);}await rpc('ingestEnd');}
          await check(current);const parsed=await rpc('packageCommit');packages.set(id,{files,memories});
          return{id,filename,parsed,projects,legacyMemory,users,logins,artifacts,memories:memories.map(({body,raw,...topic},memoryId)=>({...topic,memoryId,packageId:id})),images:entries.filter(n=>/\.(?:png|jpe?g|gif|webp|bmp|svg|avif|heic|tiff?)$/i.test(n)).map(path=>({packageId:id,path}))};
        }catch(error){await rpc('packageAbort').catch(()=>{});throw error;}
      }
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
