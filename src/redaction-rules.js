// Pure, local rules. Offsets always refer to original UTF-16 source text.
function redactionRules(){
  const WINDOW=32768,OVERLAP=512,LIMIT=4096;
  const separators=/[\s\u200b-\u200d\u2060\ufeff._,，。:：;；'"“”‘’()（）\[\]{}<>《》/\\\-–—]/u;
  function normalize(text){
    const chars=[],starts=[],ends=[];let offset=0;
    for(const character of text){const end=offset+character.length;for(let c of character.normalize('NFKC')){if(c>='A'&&c<='Z')c=c.toLowerCase();if(!separators.test(c)){chars.push(c);starts.push(offset);ends.push(end);}}offset=end;}
    return{chars,starts,ends};
  }
  function grams(chars){const result=new Map();for(let i=1;i<chars.length;i++){const gram=chars[i-1]+chars[i];result.set(gram,(result.get(gram)||0)+1);}return result;}
  function dice(a,b){const left=grams(a),right=grams(b);let common=0;for(const [gram,n]of left)common+=Math.min(n,right.get(gram)||0);return a.length+b.length>2?2*common/(a.length+b.length-2):0;}
  function distance(a,b,limit){
    if(Math.abs(a.length-b.length)>limit)return limit+1;
    let previous=Array.from({length:b.length+1},(_,i)=>i);
    for(let i=1;i<=a.length;i++){const next=new Array(b.length+1).fill(limit+1);next[0]=i;let minimum=limit+1;for(let j=Math.max(1,i-limit);j<=Math.min(b.length,i+limit);j++){next[j]=Math.min(previous[j]+1,next[j-1]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));minimum=Math.min(minimum,next[j]);}if(minimum>limit)return limit+1;previous=next;}
    return previous[b.length];
  }
  function compile(terms){
    const normalized=terms.map(term=>normalize(term).chars),index=new Map();
    normalized.forEach((chars,id)=>{if(chars.length<4)return;for(let p=1;p<chars.length;p++){const gram=chars[p-1]+chars[p];if(!index.has(gram))index.set(gram,[]);index.get(gram).push({id,offset:p-1});}});
    return{normalized,index};
  }
  const rules=[
    {label:'个人姓名',trigger:/(?:我(?:名)?叫|我的名字是|你可以叫我|(?:姓名|名字|联系人(?:姓名)?)[ \t]*(?:是|为|[:：])|\bmy name is[ \t]+|\bcontact name[ \t]*[:=][ \t]*)/giu,kind:'name',owned:/我|my name/i},
    {label:'个人姓名',trigger:/(?:(?:我的)?导师是|\bmy supervisor is[ \t]+)/giu,kind:'supervisor',owned:/我的|\bmy /i},
    {label:'详细地址',trigger:/(?:我住在|我的住址(?:是|为)|收货地址[ \t]*(?:是|为|[:：])?[ \t]*|地址[ \t]*[:：]|寄到|\bmy address is[ \t]+|\bsend it to[ \t]+)/giu,kind:'address',owned:/我|my|收货|寄到|send/i},
    {label:'学校或单位',trigger:/(?:我在|目前就读于|我就读于|我的(?:公司|学校)(?:是|为)|(?:公司|学校)[ \t]*[:：][ \t]*|\bI (?:work|study) at[ \t]+|\bmy (?:company|school) is[ \t]+)/giu,kind:'organization',owned:/我|目前就读于|\bI |\bmy /i},
    {label:'社交账号',trigger:/(?:(?:我的[ \t]*)?(?:微信|QQ|Twitter|推特|社交账号)[ \t]*(?:号|账号)?[ \t]*(?:是|为|[:：])[ \t]*|\bmy (?:wechat|twitter|social handle) is[ \t]+)/giu,kind:'social',owned:/我的|\bmy /i},
    {label:'凭据或令牌',trigger:/(?:登录(?:用的)?(?:密码|口令)(?:是|为|[:：])|临时口令(?:是|为|[:：])|\b(?:my )?(?:login password|temporary passphrase) is[ \t]+)/giu,kind:'secret',owned:/./},
    {label:'联系方式',trigger:/(?:联系我[ \t]*(?:用|请拨打|[:：])|\breach me at[ \t]+|\bcontact me at[ \t]+)/giu,kind:'contact',owned:/./}
  ];
  const excluded=/(?:叫什么|怎么|如何|哪里|什么|是否|例如|示例|假设|教学|变量|函数|研究|学习|\b(?:what|where|how|example|suppose|variable|function|tutorial)\b)/i;
  function contextSpans(text,emit){
    for(const rule of rules){rule.trigger.lastIndex=0;for(const match of text.matchAll(rule.trigger)){
      const from=match.index+match[0].length+(text.slice(match.index+match[0].length).match(/^[ \t]*/)?.[0].length||0),tail=text.slice(from,from+160),prefix=text.slice(Math.max(0,match.index-160),match.index).split(/[\n。！？!?]/).pop();
      if(/^[^\n。！？!?]{0,160}[？?]/.test(tail)||excluded.test(prefix)||excluded.test(tail.split(/[\n。！？!?,，;；]/)[0]||''))continue;
      let value=null;
      if(rule.kind==='name')value=tail.match(/^(?:[\p{Script=Han}]{2,4}(?=$|[\s，。！？,.;!?])|[A-Z][a-z]{1,29}(?: [A-Z][a-z]{1,29}){0,2}(?=$|[\s,.;!?]))/u)?.[0];
      if(rule.kind==='supervisor')value=tail.match(/^(?:[\p{Script=Han}]{2,4}?(?=教授|老师|[\s，。！？,.;!?]|$)|[A-Z][a-z]{1,29}(?: [A-Z][a-z]{1,29}){0,2}(?=$|[\s,.;!?]))/u)?.[0];
      if(rule.kind==='address'){value=tail.match(/^[^\n。！？!?,，;；]{3,120}/u)?.[0];if(value&&!/(?:[路街巷号楼室]|\b\d+\s+[\w .-]+\b(?:street|road|avenue|lane|st|rd)\b)/i.test(value))value=null;}
      if(rule.kind==='organization')value=tail.match(/^(?:[\p{Script=Han}\w·（）() -]{2,60}?(?:公司|集团|实验室|大学|学院|中学|小学)|[A-Z][\w &.-]{1,70}?\b(?:University|College|School|Labs|Inc|Ltd|Company)\b)/u)?.[0];
      if(rule.kind==='social'){value=tail.match(/^@?[A-Za-z0-9_][A-Za-z0-9_.-]{4,31}(?![A-Za-z0-9_.-])/)?.[0]?.replace(/[.-]+$/,'');if(value&&/^(?:short|private|unknown|hidden|none|微信|账号)$/i.test(value))value=null;}
      if(rule.kind==='contact')value=tail.match(/^(?:\+\d{1,3}[ .-])?\d(?:[ .-]?\d){7,13}(?!\d)/)?.[0];
      if(rule.kind==='secret')value=tail.match(/^(?:"([^"\r\n]{1,128})"|'([^'\r\n]{1,128})'|([^\s，。！？,;!?]{1,128}))/)?.[0];
      if(value&&/^(?:外卖|出租车|网约车|救护车|大家|朋友|同事|助手|机器人|anonymous|unknown|someone|somebody)$/i.test(value))value=null;
      if(value&&rule.kind==='organization'&&/^(?:某某|一家|一所|某个|这家|这所|那家|那所|some |a |the )/i.test(value))value=null;
      if(value){const trimmed=value.trimEnd();emit({anchor:match.index,start:from,end:from+trimmed.length,label:rule.label,evidence:rule.owned.test(match[0])?'definite':'candidate',method:'context',reason:'语境句式与类别结构匹配'});}
    }}
    // Explicitly obfuscated email syntax, not arbitrary substitutions in prose.
    for(const match of text.matchAll(/[A-Z0-9._%+-]{1,64}[ \t]*(?:\[at\]|\(at\)|＠)[ \t]*[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:[ \t]*(?:\[dot\]|\(dot\)|[.．])[ \t]*[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+/gi))emit({start:match.index,end:match.index+match[0].length,label:'邮箱',evidence:'definite',method:'format',reason:'邮箱混淆写法'});
    for(const match of text.matchAll(/(?<![\d０-９])(?:[+＋]?[８8][６6][ .-]?)?[１1][ \t.\-\u200b-\u200d]?[３-９3-9](?:[ \t.\-\u200b-\u200d]?[０-９0-9]){9}(?![\d０-９])/gu)){const normalized=match[0].normalize('NFKC');if(/[０-９\s.\-\u200b-\u200d]/u.test(match[0])&&/^(?:\+?86[ .-]?)?1[ \t.\-\u200b-\u200d]?[3-9](?:[ \t.\-\u200b-\u200d]?\d){9}$/.test(normalized))emit({start:match.index,end:match.index+match[0].length,label:'手机号',evidence:'definite',method:'format',reason:'号码结构与变体匹配'});}
  }
  function* scan(text,compiled,emit,incomplete){
    const stride=WINDOW-2*OVERLAP;
    for(let base=0;base<text.length;base+=stride){
      const offset=Math.max(0,base-OVERLAP),chunk=text.slice(offset,base+stride+OVERLAP),ownedEnd=base+stride;
      const output=span=>{const anchor=(span.anchor??span.start)+offset;if(anchor>=base&&anchor<ownedEnd)emit({...span,start:span.start+offset,end:span.end+offset});};
      contextSpans(chunk,output);yield;
      if(compiled){let consumed=0;const seen=new Set();
        for(const lineMatch of chunk.matchAll(/[^\r\n]+/g)){
          const line=lineMatch[0],map=normalize(line),chars=map.chars;
          for(let position=0;position+1<chars.length;position++){
            for(const ref of compiled.index.get(chars[position]+chars[position+1])||[]){
              const term=compiled.normalized[ref.id],limit=term.length>=8&&term.length<=128?(term.length>=16?2:1):0;
              for(let delta=-limit;delta<=limit;delta++){
                const start=position-ref.offset+delta;if(start<0)continue;
                for(let size=term.length-limit;size<=term.length+limit;size++){
                  const end=start+size;if(end>chars.length)continue;
                  const key=ref.id+':'+lineMatch.index+':'+start+':'+end;if(seen.has(key))continue;seen.add(key);
                  if(++consumed>LIMIT){incomplete();yield;return;}if(consumed%64===0)yield;
                  const a=map.starts[start],b=map.ends[end-1];if(b-a>512||start>0&&map.starts[start-1]===a||end<chars.length&&map.ends[end]===b)continue;
                  const candidate=chars.slice(start,end),equal=candidate.join('')===term.join('');
                  const boundary=(!/[a-z0-9]/.test(term[0])||!/[a-z0-9]/i.test(line[a-1]||''))&&(!/[a-z0-9]/.test(term[term.length-1])||!/[a-z0-9]/i.test(line[b]||''));
                  const similarity=equal?1:limit&&boundary?dice(term,candidate):0,edits=equal?0:similarity>=0.85?distance(term,candidate,limit):limit+1;
                  if(equal||limit&&similarity>=0.85&&edits<=limit)output({start:lineMatch.index+a,end:lineMatch.index+b,label:'自定义敏感词',evidence:'definite',method:equal?'normalized':'similar',edits,similarity,reason:equal?'自定义词归一化等值匹配':'自定义词二元组与编辑距离匹配'});
                }
              }
            }
            if(position%128===0)yield;
          }
        }
      }
      yield;
      if(ownedEnd>=text.length)break;
    }
  }
  return{scan,compile,normalize,dice,distance};
}
