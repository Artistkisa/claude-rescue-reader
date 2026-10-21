// Shared, dependency-free parsing for Claude export manifests and memory files.
function exportFormatCore(){
  // SHA-256 fallback for HTTP origins without SubtleCrypto. Inputs are bounded chunks.
  function sha256(bytes){
    const primes=[];for(let n=2;primes.length<64;n++){if(primes.every(p=>n%p!==0))primes.push(n);}
    const frac=x=>Math.floor((x-Math.floor(x))*0x100000000)>>>0,k=primes.map(p=>frac(Math.cbrt(p))),h=primes.slice(0,8).map(p=>frac(Math.sqrt(p)));
    const size=Math.ceil((bytes.length+9)/64)*64,data=new Uint8Array(size);data.set(bytes);data[bytes.length]=128;const view=new DataView(data.buffer);view.setUint32(size-8,Math.floor(bytes.length/0x20000000));view.setUint32(size-4,bytes.length*8>>>0);
    const rotate=(x,n)=>(x>>>n)|(x<<(32-n)),w=new Uint32Array(64);
    for(let at=0;at<size;at+=64){
      for(let i=0;i<16;i++)w[i]=view.getUint32(at+i*4);
      for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(rotate(a,7)^rotate(a,18)^(a>>>3))+w[i-7]+(rotate(b,17)^rotate(b,19)^(b>>>10)))>>>0;}
      let [a,b,c,d,e,f,g,j]=h;
      for(let i=0;i<64;i++){const t1=(j+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^(~e&g))+k[i]+w[i])>>>0,t2=((rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c)))>>>0;j=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
      for(const [i,v]of [a,b,c,d,e,f,g,j].entries())h[i]=(h[i]+v)>>>0;
    }
    const result=new Uint8Array(32),out=new DataView(result.buffer);h.forEach((v,i)=>out.setUint32(i*4,v));return result;
  }
  const array=value=>Array.isArray(value)?value:[];
  function downloadUrl(value){
    if(typeof value!=='string'||!/^https:\/\/claude\.ai\//.test(value)||/[\s\\]/.test(value))return '';
    try{const u=new URL(value);return u.hostname==='claude.ai'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&/^\/export\/[A-Za-z0-9-]+\/download\/[A-Za-z0-9-]+$/.test(u.pathname)?u.href:'';}catch{return '';}
  }
  function manifest(value){
    if(!value||value.version!=='1.0'||!Array.isArray(value.data_files))throw new Error('Unsupported export manifest');
    const files=value.data_files.map((f,index)=>{
      if(!f||typeof f.filename!=='string'||!f.filename||/[\\/]/.test(f.filename)||!Number.isInteger(f.part)||f.part<0||!Number.isInteger(f.batch_index)||f.batch_index<0)throw new Error('Invalid manifest file');
      return{filename:f.filename,category:String(f.category||'unknown'),part:f.part,batch_index:f.batch_index,url:downloadUrl(f.export_url),index};
    });
    if(new Set(files.map(f=>f.filename)).size!==files.length||value.total_files!==files.length)throw new Error('Inconsistent manifest file list');
    return{created_at:typeof value.created_at==='string'?value.created_at:'',files};
  }
  function logicalPath(path){
    const parts=String(path||'').replace(/\\/g,'/').replace(/^\/+/, '').split('/');
    if(parts.some(p=>p==='..'||p==='.'||!p)||parts.some(p=>/[\u0000-\u001f]/.test(p)))throw new Error('Invalid export path');
    return parts.join('/');
  }
  function frontmatter(content){
    const raw=String(content||'').replace(/^\uFEFF/,'');const match=raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if(!match)return{fields:{},body:raw,warning:raw.startsWith('---\n')||raw.startsWith('---\r\n')};
    const fields=Object.create(null);let warning=false;
    const scalar=s=>{s=s.trim();if(/^".*"$/.test(s)){try{return JSON.parse(s);}catch{throw Error();}}if(/^'.*'$/.test(s))return s.slice(1,-1).replace(/''/g,"'");if(/^[!&*{|>]/.test(s))throw Error();return s;};
    let listKey=null;
    for(const line of match[1].split(/\r?\n/)){
      if(!line.trim()||line.trim().startsWith('#'))continue;
      const item=line.match(/^\s+-\s+(.*)$/);if(item&&listKey){try{fields[listKey].push(scalar(item[1]));}catch{warning=true;}continue;}
      const m=line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);if(!m){warning=true;continue;}
      listKey=null;try{if(!m[2]){fields[m[1]]=[];listKey=m[1];}else if(m[2].startsWith('[')){if(!m[2].endsWith(']'))throw Error();const parts=m[2].slice(1,-1).match(/"(?:\\.|[^"\\])*"|'(?:''|[^'])*'|[^,]+/g)||[];fields[m[1]]=parts.map(scalar);}else fields[m[1]]=scalar(m[2]);}catch{warning=true;}
    }
    return{fields,body:warning?raw:raw.slice(match[0].length),warning};
  }
  function memory(path,content,updated_at='',source=''){
    path=logicalPath(path);const parsed=frontmatter(content),project=path.match(/^projects\/([^/]+)\//);
    return{path,projectKey:project?.[1]||'',isIndex:!!project&&path.endsWith('/index.md'),name:String(parsed.fields.name||path.split('/').pop().replace(/\.md$/i,'')),description:String(parsed.fields.description||''),fields:parsed.fields,body:parsed.body,raw:String(content||''),warning:parsed.warning,updated_at,source};
  }
  function memoryFiles(value,source){return array(value?.memory_files).map(f=>memory(f.path,f.content,f.updated_at||'',source));}
  return{sha256,downloadUrl,manifest,logicalPath,frontmatter,memory,memoryFiles};
}
