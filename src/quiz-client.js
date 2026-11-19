// Only explicit quiz tool results become interactive; arbitrary JSON stays ordinary content.
function quizResult(block){return block?.type==='tool_result'&&!block.is_error&&/^quiz_display(?:_v\d+)?$/.test(String(block.name||block._quizToolName||'').split('.').pop());}
// Bound parsing, source serialization and DOM work: 256 Ki UTF-16 units, 8192 per string, 20k nodes.
function quizWithinBudget(value,maxString=8192){
  const stack=[value],seen=new Set();let size=0,nodes=0;
  while(stack.length){const item=stack.pop();if(++nodes>20000)return false;
    if(typeof item==='string'){if(item.length>maxString)return false;size+=item.length;}
    else if(item&&typeof item==='object'){if(seen.has(item))return false;seen.add(item);for(const key of Object.keys(item)){size+=key.length;stack.push(item[key]);if(stack.length>20000)return false;}}
    if(size>262144)return false;
  }return true;
}
function quizSource(block){const source={...block};for(const key of Object.keys(source))if(key.startsWith('_'))delete source[key];return source;}
function readQuiz(block){
  if(!quizResult(block))return null;
  const decode=value=>{if(typeof value!=='string')return value;if(value.length>262144)return null;try{return JSON.parse(value);}catch{return null;}};
  const candidates=[block.structured_content,block.display_content,block.content];
  if(Array.isArray(block.content))for(const item of block.content)if(item?.type==='text')candidates.push(item.text);
  for(const candidate of candidates){
    const value=decode(candidate);
    if(!quizWithinBudget(value))continue;
    if(!value||!Array.isArray(value.questions)||!value.questions.length||value.questions.length>200)continue;
    const questions=[];
    for(const question of value.questions){
      if(!question||question.question_type!=='multiple_choice'||typeof question.prompt!=='string'||!Array.isArray(question.options)||question.options.length<2||question.options.length>26)break;
      const options=question.options;
      if(options.some(o=>!o||typeof o.id!=='string'||typeof o.text!=='string')||new Set(options.map(o=>o.id)).size!==options.length||!options.some(o=>o.id===question.correct_option_id))break;
      questions.push({prompt:question.prompt,options:options.map(o=>({id:o.id,text:o.text})),answer:question.correct_option_id,hint:typeof question.hint==='string'?question.hint:'',explanation:typeof question.explanation==='string'?question.explanation:''});
    }
    if(questions.length===value.questions.length)return{title:typeof value.title==='string'?value.title:'',description:typeof value.description==='string'?value.description:typeof value.summary==='string'?value.summary:'',questions};
  }
  return null;
}
const quizStates=new Map();let quizStateSequence=0;
const quizLabel=(zh,en)=>currentLang==='en'?en:zh;
function quizButton(action,label,extra=''){return '<button type="button" data-quiz-action="'+action+'" '+extra+'>'+esc(label)+'</button>';}
function quizStage(state){
  const {quiz,index,answers,mode,results,hint,flipped}=state,q=quiz.questions[index],picked=answers[index],answered=picked!==undefined;
  let html='<div class="quiz-tabs" role="group" aria-label="'+escAttr(quizLabel('学习模式','Study mode'))+'">'+quizButton('quiz',quizLabel('测验','Quiz'),'aria-pressed="'+(mode==='quiz')+'"')+quizButton('flashcards',quizLabel('闪卡','Flashcards'),'aria-pressed="'+(mode==='flashcards')+'"')+'</div>';
  if(results&&mode==='quiz'){
    const score=quiz.questions.filter((question,i)=>answers[i]===question.answer).length;
    html+='<h4 tabindex="-1" class="quiz-focus">'+quizLabel('得分','Score')+': '+score+' / '+quiz.questions.length+' · '+Math.round(100*score/quiz.questions.length)+'%</h4><ol class="quiz-review">';
    for(let i=0;i<quiz.questions.length;i++){const question=quiz.questions[i],answer=question.options.find(o=>o.id===answers[i]),correct=question.options.find(o=>o.id===question.answer);html+='<li><p>'+esc(question.prompt)+'</p><p class="'+(answers[i]===question.answer?'quiz-correct':'quiz-incorrect')+'">'+esc(answers[i]===question.answer?quizLabel('回答正确','Correct'):quizLabel('回答错误','Incorrect'))+' · '+esc(answer?.text||quizLabel('未作答','Unanswered'))+'</p><p>'+esc(quizLabel('正确答案：','Correct answer: ')+correct.text)+'</p><p>'+esc(question.explanation)+'</p></li>';}
    return html+'</ol>'+quizButton('restart',quizLabel('重新开始','Try again'));
  }
  html+='<p class="quiz-progress">'+(index+1)+' / '+quiz.questions.length+'</p><h4 tabindex="-1" class="quiz-focus">'+esc(q.prompt)+'</h4>';
  if(mode==='flashcards'){
    if(flipped)html+='<div class="quiz-feedback"><strong>'+esc(q.options.find(o=>o.id===q.answer).text)+'</strong><p>'+esc(q.explanation)+'</p></div>';
    html+=quizButton('flip',flipped?quizLabel('隐藏答案','Hide answer'):quizLabel('显示答案','Show answer'));
  }else{
    html+='<div class="quiz-options" role="group" aria-label="'+escAttr(quizLabel('选择答案','Choose an answer'))+'">';
    q.options.forEach((option,i)=>{const status=answered?(option.id===q.answer?' quiz-correct':option.id===picked?' quiz-incorrect':''):'';html+='<button type="button" class="quiz-option'+status+'" data-quiz-action="answer" data-quiz-option="'+i+'" aria-pressed="'+(picked===option.id)+'"'+(answered?' disabled':'')+'><span>'+String.fromCharCode(65+i)+'</span>'+esc(option.text)+'</button>';});
    html+='</div>';
    if(answered)html+='<div class="quiz-feedback" role="status"><strong>'+esc(picked===q.answer?quizLabel('回答正确','Correct'):quizLabel('回答错误','Incorrect'))+'</strong><p>'+esc(q.explanation)+'</p></div>';
    else if(q.hint)html+=quizButton('hint',quizLabel('提示','Hint'))+(hint?'<p class="quiz-feedback">'+esc(q.hint)+'</p>':'');
  }
  html+='<div class="quiz-navigation">'+quizButton('previous',quizLabel('上一题','Back'),index===0?'disabled':'');
  html+=index+1<quiz.questions.length?quizButton('next',quizLabel('下一题','Next')):mode==='quiz'?quizButton('results',quizLabel('查看评分与解析','View results'),answers.filter(a=>a!==undefined).length!==quiz.questions.length?'disabled':''):'';
  return html+'</div>';
}
function renderQuiz(block,location=''){
  if(!quizResult(block))return '';
  const source=quizSource(block);
  if(!quizWithinBudget(source,262144))return '<p>'+esc(quizLabel('测验数据过大，请使用复制或导出查看原文。','Quiz data exceeds the display limit. Copy or export to read the source.'))+'</p>';
  const quiz=readQuiz(block);if(!quiz)return '';
  const signature=JSON.stringify(quiz),key=JSON.stringify([dataWorkerGeneration,currentConv?.uuid||'',location]);
  let state=quizStates.get(key);
  if(!state||state.signature!==signature){state={quiz,signature,id:String(++quizStateSequence),index:0,answers:[],mode:'quiz',results:false,hint:false,flipped:false};quizStates.set(key,state);}
  quizStates.delete(key);quizStates.set(key,state);while(quizStates.size>32)quizStates.delete(quizStates.keys().next().value);
  return '<section class="quiz-widget" data-quiz-state="'+state.id+'" aria-label="'+escAttr(quiz.title||quizLabel('测验','Quiz'))+'"><h3>'+esc(quiz.title||quizLabel('测验','Quiz'))+'</h3><p>'+esc(quiz.description)+'</p><div class="quiz-stage">'+quizStage(state)+'</div><details class="quiz-source"><summary>'+esc(quizLabel('查看原始测验数据','View original quiz data'))+'</summary><pre data-quiz-source>'+esc(JSON.stringify(source,null,2))+'</pre></details></section>';
}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-quiz-action]'),root=button?.closest('.quiz-widget');if(!root||button.disabled)return;
  const state=[...quizStates.values()].find(s=>s.id===root.dataset.quizState);if(!state)return;
  const action=button.dataset.quizAction;
  if(action==='answer'){const option=state.quiz.questions[state.index].options[Number(button.dataset.quizOption)];if(!option||state.answers[state.index]!==undefined)return;state.answers[state.index]=option.id;}
  else if(action==='hint')state.hint=!state.hint;
  else if(action==='flip')state.flipped=!state.flipped;
  else if(action==='previous'||action==='next'){state.index=Math.max(0,Math.min(state.quiz.questions.length-1,state.index+(action==='next'?1:-1)));state.hint=false;state.flipped=false;}
  else if(action==='results'){if(state.answers.filter(a=>a!==undefined).length!==state.quiz.questions.length)return;state.results=true;}
  else if(action==='restart'){state.answers=[];state.index=0;state.results=false;state.hint=false;state.flipped=false;}
  else if(action==='quiz'||action==='flashcards')state.mode=action==='quiz'?'quiz':'flashcards';
  else return;
  // quizStage emits only fixed markup and escaped text; imported values never become markup or handlers.
  root.querySelector('.quiz-stage').innerHTML=quizStage(state);
  root.querySelector('.quiz-focus')?.focus({preventScroll:true});
});
