import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import http from 'node:http';

const root=path.resolve(import.meta.dirname,'..');
// Synthetic quiz with the same exported schema as quiz_display_v0, never an executable widget.
const historyQuiz={title:'历史小知识测试',description:'5道中外历史小题',questions:[
  ['秦始皇统一六国后，下列哪项不是他推行的措施？',['统一文字、度量衡','废除分封制，设立郡县制','推行科举制选拔官员','修筑驰道，统一车轨'],'c','科举制创立于隋唐时期。','想想科举制最早出现在哪个朝代。'],
  ['哥伦布第一次横渡大西洋到达美洲是在哪一年？',['1392年','1492年','1592年','1692年'],'b','1492年抵达加勒比海地区。','1492，哥伦布航行蓝色海洋。'],
  ['四大发明中，哪项用于文字的大规模复制？',['指南针','火药','印刷术','造纸术'],'c','印刷术让书籍可以大量复制。','题目问的是复制文字。'],
  ['古埃及的金字塔主要是用来做什么的？',['法老的陵墓','军事瞭望塔','粮食仓库','天文观测台'],'a','金字塔是法老和王室的陵墓。','与来世观念有关。'],
  ['欧洲战事以哪一年德国投降而结束？',['1943年','1944年','1945年','1946年'],'c','1945年5月，德国无条件投降。','和日本投降是同一年。']
].map(([prompt,texts,correct_option_id,explanation,hint],i)=>({id:'q'+i,question_type:'multiple_choice',prompt,options:texts.map((text,j)=>({id:'abcd'[j],text})),correct_option_id,explanation,hint}))};
let server,origin;
test.beforeAll(async()=>{
  const viewer=await fs.readFile(path.join(root,'viewer.html'));
  server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(viewer);});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});origin='http://127.0.0.1:'+server.address().port;
});
test.afterAll(async()=>{if(server?.listening)await new Promise(resolve=>server.close(resolve));});

for(const mode of ['file','http'])test(mode+' quiz tool renders offline with hints, grading and flashcards',async({page})=>{
  await page.route('https://**',route=>route.abort());
  await page.goto(mode==='file'?pathToFileURL(path.join(root,'viewer.html')).href:origin);
  await page.evaluate(async quiz=>{
    await ingestData(JSON.stringify([{uuid:'synthetic-quiz',name:'History quiz',chat_messages:[
      {uuid:'call',sender:'assistant',content:[{type:'tool_use',id:'quiz-call',name:'quiz_display_v0',input:quiz}]},
      {uuid:'result',parent_message_uuid:'call',sender:'assistant',content:[{type:'tool_result',tool_use_id:'quiz-call',content:[{type:'text',text:JSON.stringify(quiz)}]}]}
    ]}]),[],null,[],{textContent:''});await openConv('synthetic-quiz');
  },historyQuiz);
  const widget=page.locator('.quiz-widget');await expect(widget).toHaveCount(1);await expect(widget.locator('h3')).toHaveText(historyQuiz.title);
  await expect(widget.locator('[data-quiz-action="previous"]')).toBeDisabled();
  await expect(widget.locator('.quiz-feedback')).toHaveCount(0);
  await widget.getByRole('button',{name:'提示',exact:true}).click();await expect(widget.locator('.quiz-feedback')).toHaveText(historyQuiz.questions[0].hint);
  await widget.screenshot({path:test.info().outputPath('quiz-widget.png')});
  const choices=[2,1,2,0,0];
  for(let i=0;i<5;i++){
    await expect(widget.locator('h4')).toHaveText(historyQuiz.questions[i].prompt);
    await widget.locator('.quiz-option').nth(choices[i]).click();await expect(widget.locator('.quiz-option:disabled')).toHaveCount(4);
    await widget.locator('.quiz-option').nth((choices[i]+1)%4).evaluate(button=>button.dispatchEvent(new MouseEvent('click',{bubbles:true})));
    await expect(widget.locator('.quiz-option[aria-pressed="true"]')).toHaveText(new RegExp(historyQuiz.questions[i].options[choices[i]].text));
    await expect(widget.locator('.quiz-feedback')).toContainText(historyQuiz.questions[i].explanation);
    if(i<4)await widget.getByRole('button',{name:'下一题',exact:true}).click();
  }
  await widget.getByRole('button',{name:'查看评分与解析',exact:true}).click();await expect(widget.locator('h4')).toContainText('4 / 5 · 80%');await expect(widget.locator('.quiz-review li')).toHaveCount(5);
  await widget.getByRole('button',{name:'闪卡',exact:true}).click();await expect(widget.locator('.quiz-option')).toHaveCount(0);
  await widget.getByRole('button',{name:'显示答案',exact:true}).click();await expect(widget.locator('.quiz-feedback')).toContainText('1945年');
  await widget.getByRole('button',{name:'测验',exact:true}).click();await expect(widget.locator('h4')).toContainText('80%');
  await widget.getByRole('button',{name:'重新开始',exact:true}).click();await expect(widget.locator('.quiz-progress')).toHaveText('1 / 5');await expect(widget.locator('.quiz-option').first()).toBeEnabled();
  await widget.getByRole('button',{name:'下一题',exact:true}).click();await expect(widget.locator('.quiz-option:enabled')).toHaveCount(4);await expect(widget.locator('.quiz-option[aria-pressed="true"]')).toHaveCount(0);await widget.getByRole('button',{name:'上一题',exact:true}).click();await expect(widget.locator('.quiz-progress')).toHaveText('1 / 5');
  await widget.locator('.quiz-source summary').click();await expect(widget.locator('[data-quiz-source]')).toContainText('correct_option_id');
});

test('quiz limits, result type, source fidelity and progress survive rerender',async({page})=>{
  await page.goto(origin);
  await page.evaluate(quiz=>{window.syntheticQuizBlock={type:'tool_result',_quizToolName:'quiz_display_v0',content:[{type:'text',text:JSON.stringify(quiz)}]};document.getElementById('messages').innerHTML=renderBlock(window.syntheticQuizBlock,'stable');},historyQuiz);
  const widget=page.locator('.quiz-widget');await widget.locator('.quiz-option').nth(2).click();await widget.getByRole('button',{name:'下一题',exact:true}).click();
  await page.evaluate(()=>{currentLang='en';document.getElementById('messages').innerHTML=renderBlock(window.syntheticQuizBlock,'stable');});
  await expect(widget.locator('.quiz-progress')).toHaveText('2 / 5');await widget.getByRole('button',{name:'Back',exact:true}).click();await expect(widget.locator('.quiz-option:disabled')).toHaveCount(4);
  const result=await page.evaluate(quiz=>{
    const source=JSON.parse(document.querySelector('[data-quiz-source]').textContent);
    const huge={type:'tool_result',name:'quiz_display_v0',content:'x'.repeat(300000)};
    const nonResult=renderBlock({type:'text',name:'quiz_display_v0',structured_content:quiz});
    const oversized=renderBlock(huge);
    const long=structuredClone(quiz);long.questions[0].prompt='x'.repeat(9000);
    const rejected=readQuiz({type:'tool_result',name:'quiz_display_v0',structured_content:long});
    return{source,nonResult,oversized,rejected};
  },historyQuiz);
  expect(result.source).not.toHaveProperty('name');expect(result.source).not.toHaveProperty('_quizToolName');expect(result.nonResult).not.toContain('quiz-widget');expect(result.oversized.length).toBeLessThan(300);expect(result.rejected).toBeNull();
  await page.evaluate(()=>{resetFeatureWorkers();document.getElementById('messages').innerHTML=renderBlock(window.syntheticQuizBlock,'stable');});await expect(widget.locator('.quiz-progress')).toHaveText('1 / 5');await expect(widget.locator('.quiz-option:enabled')).toHaveCount(4);
});

test('quiz validation keeps unsupported data readable and renders imported strings inert',async({page})=>{
  await page.goto(origin);
  const state=await page.evaluate(quiz=>{
    const result=content=>({type:'tool_result',name:'quiz_display_v0',content});
    const invalid=structuredClone(quiz);invalid.questions[0].correct_option_id='missing';
    const duplicate=structuredClone(quiz);duplicate.questions[0].options[1].id='a';
    const unsupported=structuredClone(quiz);unsupported.questions[0].question_type='free_text';
    const negative=[renderBlock(result('not JSON')),renderBlock(result(JSON.stringify(invalid))),renderBlock(result(JSON.stringify(duplicate))),renderBlock(result(JSON.stringify(unsupported))),renderBlock({...result(JSON.stringify(quiz)),name:'ordinary_tool'})];
    const malicious=structuredClone(quiz);malicious.title='<img src=x onerror="window.quizProbe=1">';malicious.questions[0].prompt='<script>window.quizProbe=1<\/script>';malicious.questions[0].options[0].text='<a href="javascript:window.quizProbe=1">answer</a>';
    document.getElementById('messages').innerHTML=renderBlock(result([{type:'text',text:JSON.stringify(malicious)}]))+renderBlock({type:'tool_result',name:'quiz_display_v0',structured_content:quiz});
    return{negative,probe:window.quizProbe,imgs:document.querySelectorAll('.quiz-widget img,.quiz-widget script,.quiz-widget a').length};
  },historyQuiz);
  expect(state.negative.every(html=>!html.includes('quiz-widget'))).toBe(true);expect(state.negative[0]).toContain('not JSON');expect(state.probe).toBeUndefined();expect(state.imgs).toBe(0);
  await expect(page.locator('.quiz-widget')).toHaveCount(2);
  await page.locator('.quiz-widget').first().locator('.quiz-option').first().click();expect(await page.evaluate(()=>window.quizProbe)).toBeUndefined();
  await page.evaluate(()=>{currentLang='en';document.getElementById('messages').innerHTML=renderBlock({type:'tool_result',name:'quiz_display_v0',structured_content:JSON.parse(document.querySelectorAll('[data-quiz-source]')[1].textContent).structured_content});});
  await expect(page.getByRole('button',{name:'Flashcards',exact:true})).toBeVisible();
});

for(const mode of ['file','http'])test(mode+' viewer keeps imported rendering inert and remote images local',async({page})=>{
  const requests=[];await page.route('https://archive.example.invalid/**',route=>{requests.push(route.request().url());return route.abort();});
  const markdown=await fs.readFile(path.join(root,'node_modules/marked/lib/marked.umd.js'));
  await page.route(/https:\/\/(?:cdn\.jsdelivr\.net|unpkg\.com)\/(?:npm\/)?marked@/,route=>route.fulfill({body:markdown,contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}}));
  await page.goto(mode==='file'?pathToFileURL(path.join(root,'viewer.html')).href:origin);
  expect(await page.evaluate(()=>ensureMarked())).toBe(true);
  await page.evaluate(()=>{
    const text='```text"<img/src=x/onerror=window.renderProbe=1> extra\ncode <tag>\n```\n\n[x](javascript:window.renderProbe=2)\n\n<javascript:window.renderProbe=3>\n\n![outside](https://archive.example.invalid/image.png)\n\n[safe](https://example.invalid/path?q=1 "a quote")';
    document.getElementById('messages').innerHTML=renderMd(text)+renderBlock({type:'rich_link',url:'javascript:window.renderProbe=4',title:'inert'})+renderBlock({type:'knowledge',url:'https://example.invalid/" onmouseover="window.renderProbe=5',title:'quoted'});
    allDesigns=[{uuid:'design" onmouseover="window.renderProbe=6',name:'quoted',chat_messages:[]}];renderDesignList();
  });
  const state=await page.evaluate(()=>({probe:window.renderProbe,events:[...document.querySelectorAll('#messages *,#conv-list *')].flatMap(el=>[...el.attributes].filter(a=>a.name.startsWith('on')).map(a=>a.name)),links:[...document.querySelectorAll('#messages a')].map(a=>a.getAttribute('href')),images:[...document.querySelectorAll('#messages img')].map(el=>el.src),uuid:document.querySelector('[data-design-uuid]').dataset.designUuid}));
  expect(state.probe).toBeUndefined();expect(state.events).toEqual([]);expect(state.links.every(url=>url.startsWith('https:'))).toBe(true);expect(state.images).toEqual([]);expect(state.uuid).toBe('design" onmouseover="window.renderProbe=6');expect(requests).toEqual([]);
  expect(state.links).toContain('https://example.invalid/path?q=1');expect(state.links).toContain('https://archive.example.invalid/image.png');
  await expect(page.locator('.code-lang')).toHaveText('text"<img/src=x/onerror=window.renderProbe=1>');
  await page.locator('#theme-btn').click();expect(await page.evaluate(()=>document.documentElement.dataset.theme)).toBe('dark');
  await page.evaluate(()=>{const script=document.createElement('script');script.textContent='window.cspProbe=1';document.body.appendChild(script);const img=document.createElement('img');img.setAttribute('onerror','window.cspProbe=2');img.src='data:image/png;base64,broken';document.body.appendChild(img);});
  await page.waitForTimeout(100);expect(await page.evaluate(()=>window.cspProbe)).toBeUndefined();
});

test('optional dependency failure can retry, shares concurrent attempts and enforces integrity',async({page})=>{
  let fail=true,requests=0;
  const bytes=await fs.readFile(path.join(root,'node_modules/jszip/dist/jszip.min.js'));
  await page.route(/https:\/\/(?:cdn\.jsdelivr\.net|unpkg\.com)\/(?:npm\/)?jszip@/,async route=>{requests++;if(fail)await route.abort();else await route.fulfill({body:bytes,contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});});
  await page.goto(origin);
  expect(await page.evaluate(()=>Promise.all([ensureJSZip(),ensureJSZip()]))).toEqual([false,false]);expect(requests).toBe(2);
  fail=false;expect(await page.evaluate(()=>ensureJSZip())).toBe(true);expect(requests).toBe(3);
  expect(await page.evaluate(()=>document.querySelector('script[src*="jszip"]').integrity)).toMatch(/^sha384-/);
});

test('embedded ZIP import works offline and retries a damaged selection without refresh',async({page})=>{
  let attempts=0;await page.route(/https:\/\/(?:cdn\.jsdelivr\.net|unpkg\.com)\/(?:npm\/)?jszip@/,route=>{attempts++;return route.abort();});
  await page.goto(origin);
  await page.setInputFiles('#zip-input',{name:'synthetic-broken.zip',mimeType:'application/zip',buffer:Buffer.from('synthetic invalid zip')});
  await expect(page.locator('#load-zip-btn')).toContainText('ZIP');
  await page.waitForFunction(()=>!document.querySelector('#load-zip-btn .spinner'));
  await page.setInputFiles('#zip-input',path.join(root,'docs/demo/claude-rescue-reader-synthetic-demo.zip'));
  await page.waitForFunction(()=>allConvs.length===40);expect(attempts).toBe(0);
});

test('tampered optional scripts fail integrity and can recover without refresh',async({page})=>{
  let tampered=true;const bytes=await fs.readFile(path.join(root,'node_modules/jszip/dist/jszip.min.js'));
  await page.route(/https:\/\/(?:cdn\.jsdelivr\.net|unpkg\.com)\/(?:npm\/)?jszip@/,route=>route.fulfill({body:tampered?'window.sriProbe=1;':bytes,contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}}));
  await page.goto(origin);expect(await page.evaluate(()=>ensureJSZip())).toBe(false);expect(await page.evaluate(()=>window.sriProbe)).toBeUndefined();
  tampered=false;expect(await page.evaluate(()=>ensureJSZip())).toBe(true);
});

for(const mode of ['file','http'])test(mode+' artifact scripts stay interactive inside an opaque sandbox without network',async({page})=>{
  const network=[];await page.route('https://archive.example.invalid/**',route=>{network.push(route.request().url());return route.abort();});
  await page.route('https://cdn.jsdelivr.net/blocked-artifact-probe.js',route=>{network.push(route.request().url());return route.abort();});
  await page.goto(mode==='file'?pathToFileURL(path.join(root,'viewer.html')).href:origin);
  await page.evaluate(()=>{
    document.getElementById('messages').innerHTML=renderVisual({kind:'html',title:'Local preview',code:'<button id="inside" onclick="this.textContent=\'clicked\'">ready</button><script>try{parent.document.title="escaped"}catch{document.body.dataset.isolated="true"}document.body.dataset.ran="true";fetch("https://archive.example.invalid/collect").catch(()=>{});const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/blocked-artifact-probe.js";document.head.appendChild(s);<\/script>'});
    activateVisualFrame(document.querySelector('iframe'));
  });
  const frame=page.frameLocator('iframe');await expect(frame.locator('body')).toHaveAttribute('data-ran','true');await expect(frame.locator('body')).toHaveAttribute('data-isolated','true');
  // Opaque iframe input routing can lag its script execution until the first compositor frames.
  await frame.locator('body').evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await frame.locator('#inside').click();await expect(frame.locator('#inside')).toHaveText('clicked');expect(await page.title()).not.toBe('escaped');expect(network).toEqual([]);
});

test('generated HTML files preview in the sandbox and still download their source',async({page})=>{
  await page.goto(origin);
  await page.evaluate(()=>{
    document.getElementById('messages').innerHTML=renderFileCards([{name:'synthetic.html',content:'<button id="local" onclick="this.textContent=\'done\'">ready</button>'}]);
    activateVisualFrame(document.querySelector('iframe'));
  });
  await page.locator('.files > details > summary').click();const frame=page.frameLocator('iframe');await frame.locator('#local').click();await expect(frame.locator('#local')).toHaveText('done');
  expect(await page.locator('.files .fbtns a[target="_blank"]').count()).toBe(0);
  const download=page.waitForEvent('download');await page.locator('.files .fbtns a[download]').click();expect((await download).suggestedFilename()).toBe('synthetic.html');
});

test('sandbox location changes cannot navigate to a remote destination',async({page})=>{
  const requests=[];await page.route('https://archive.example.invalid/**',route=>{requests.push(route.request().url());return route.abort();});
  await page.goto(origin);await page.evaluate(()=>{
    window.navigationAttempted=false;window.addEventListener('message',event=>{if(event.source===document.querySelector('iframe').contentWindow&&event.data==='synthetic-navigation-attempt')window.navigationAttempted=true;});
    document.getElementById('messages').innerHTML=renderVisual({kind:'html',code:'<script>parent.postMessage("synthetic-navigation-attempt","*");setTimeout(()=>location.href="https://archive.example.invalid/navigation?probe=synthetic",20)<\/script>'});activateVisualFrame(document.querySelector('iframe'));
  });await page.waitForFunction(()=>window.navigationAttempted);await page.waitForTimeout(300);expect(requests).toEqual([]);
});

for(const mode of ['file','http'])test(mode+' redaction controls use CSP-compatible code listeners',async({page})=>{
  await page.goto(mode==='file'?pathToFileURL(path.join(root,'viewer.html')).href:origin);
  const sample={name:'Synthetic export',chat_messages:[{sender:'human',content:[{type:'text',text:'Contact synthetic@example.invalid\n联系人：张三。\nＡＬＰＨＡＰＥＲＳＯＮ'}]}]};
  await page.evaluate(sample=>{window.dialogResult=undefined;void redactionDialog(sample).then(result=>window.dialogResult=result);},sample);
  expect(await page.locator('#redaction-modal [onclick]').count()).toBe(0);
  await page.locator('[data-style="scp"]').click();await expect(page.locator('[data-style="scp"]')).toHaveClass(/active/);
  await page.locator('[data-action="strength"]').click();await expect(page.locator('[data-action="strength"]')).toHaveClass(/active/);
  await page.locator('[data-action="cancel"]').click();expect(await page.evaluate(()=>window.dialogResult)).toBeNull();
  await page.evaluate(sample=>{void redactionDialog(sample).then(result=>window.dialogResult=result);},sample);
  await expect(page.locator('[data-action="context"]')).toHaveAttribute('aria-pressed','false');await expect(page.locator('[data-action="similarity"]')).toHaveAttribute('aria-pressed','false');
  await page.locator('[data-action="context"]').click();await page.locator('[data-action="similarity"]').click();await page.locator('#redaction-custom').fill('AlphaPerson');
  await page.locator('[data-action="export"]').click();expect(await page.evaluate(()=>window.dialogResult)).toMatchObject({style:'standard',strict:false,total:3,includeContextCandidates:true,customSimilarity:true});
});
