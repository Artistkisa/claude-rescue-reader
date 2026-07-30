// Fictional, privacy-safe demo history used only for README screenshots.
const root='10000000-0000-4000-8000-';
const msg=(id,sender,time,parent,content,extra={})=>({uuid:root+id,sender,created_at:time,parent_message_uuid:parent,content,...extra});

export const demoConversations=[
  {
    uuid:root+'000000000101',name:'北辰咖啡订阅服务：秋季发布方案',summary:'**Conversation Overview**\n\nThis conversation was a focused product-launch collaboration for the fictional Beichen Coffee subscription service. The user asked Claude to synthesize the project brand guide and interview notes into a launch plan that a small team could execute within an ¥80,000 budget. Claude searched project knowledge, translated positioning into a staged acquisition and retention plan, built a Mermaid launch timeline, proposed an interactive landing-page concept, and finished with an operational launch-day checklist.\n\nThe working style emphasized restrained claims, explicit budgets, practical ownership, and clear separation between evidence from project files and new recommendations. The conversation also shows how the viewer preserves Thinking blocks, project knowledge calls, structured tool results, attachments, rich Markdown, generated interactive content, and follow-up revisions in one readable thread. All names, files, organizations, and numbers in this demo are synthetic.',created_at:'2026-06-18T01:20:00Z',updated_at:'2026-06-18T02:16:00Z',chat_messages:[
      msg('000000000201','human','2026-06-18T01:20:00Z','00000000-0000-4000-8000-000000000000',[{type:'text',text:'我们准备上线一个咖啡豆月度订阅服务。请结合项目资料，先给我一份适合小团队执行的秋季发布方案，预算控制在 8 万以内。'}]),
      msg('000000000202','assistant','2026-06-18T01:22:00Z',root+'000000000201',[
        {type:'thinking',thinking:'我需要先确认品牌定位、目标人群和现有渠道，再把预算拆成内容、投放、样品与预备金。项目知识中应该有品牌手册和用户访谈摘要。',start_timestamp:'2026-06-18T01:20:08Z',stop_timestamp:'2026-06-18T01:20:31Z'},
        {type:'tool_use',id:'demo-tool-1',name:'project_knowledge_search',message:'正在检索品牌定位与用户访谈',input:{query:'品牌定位 目标用户 订阅体验'}},
        {type:'text',text:'我先读取项目中的品牌手册与访谈摘要，再给出可执行版本。'}
      ]),
      msg('000000000203','assistant','2026-06-18T01:24:00Z',root+'000000000202',[
        {type:'tool_result',tool_use_id:'demo-tool-1',structured_content:{matches:2,files:['brand-guide.md','interview-notes.md']},display_content:'找到 2 份相关项目资料',is_error:false},
        {type:'text',text:'## 发布策略概览\n\n核心不是“更便宜的咖啡”，而是让忙碌的城市用户每月都能稳定喝到**有产地故事、但不需要研究参数**的豆子。\n\n| 阶段 | 时间 | 目标 | 预算 |\n|---|---:|---|---:|\n| 预热 | 2 周 | 收集 800 个候补名单 | ¥12,000 |\n| 首发 | 1 周 | 获得 200 位付费订阅者 | ¥38,000 |\n| 留存 | 5 周 | 首月续订率达到 70% | ¥18,000 |\n| 预备金 | — | 素材补拍与履约波动 | ¥12,000 |\n\n### 三个最先执行的动作\n\n1. 用“每月一封产地来信”建立内容记忆点。\n2. 先向老客开放 100 个创始席位，换取真实开箱素材。\n3. 落地页只保留口味偏好、烘焙度和配送频率三个选择。'}
      ]),
      msg('000000000204','human','2026-06-18T01:48:00Z',root+'000000000203',[{type:'text',text:'方向可以。把发布节奏画成 Mermaid，再给落地页首屏做一个可交互草图。'}],{attachments:[{file_name:'包装视觉参考.pdf',file_size:482000}]}),
      msg('000000000205','assistant','2026-06-18T01:52:00Z',root+'000000000204',[
        {type:'text',text:'```mermaid\ngraph LR\nA[老客预告] --> B[候补名单]\nB --> C[创始席位]\nC --> D[公开发布]\nD --> E[首月续订]\n```\n\n首屏建议用“选择你的日常口味”代替泛泛的品牌口号，让用户第一眼就知道下一步要做什么。'},
        {type:'tool_use',id:'demo-tool-2',name:'visualize:show_widget',is_mcp_app:true,message:'生成订阅偏好交互草图',input:{code:'<section style="font-family:system-ui;padding:24px;background:#fffaf2;color:#35251d"><p style="color:#9a5a2a;font-weight:700">北辰咖啡 · 月度订阅</p><h1 style="font-size:30px;margin:8px 0">下一包豆子，按你的日常来。</h1><p>选择风味，我们每月替你完成剩下的研究。</p><div style="display:flex;gap:8px;margin-top:18px"><button style="padding:10px 16px">明亮果香</button><button style="padding:10px 16px">坚果可可</button><button style="padding:10px 16px">均衡耐喝</button></div></section>'}}
      ]),
      msg('000000000206','human','2026-06-18T02:08:00Z',root+'000000000205',[{type:'text',text:'再补一份上线检查清单，重点避免小团队首发当天手忙脚乱。'}]),
      msg('000000000207','assistant','2026-06-18T02:16:00Z',root+'000000000206',[{type:'text',text:'## 首发日检查清单\n\n- [ ] 库存、批次与预计发货日已同步到客服话术\n- [ ] 支付失败、地址修改和暂停订阅流程已走通\n- [ ] 落地页埋点只保留必要事件，并完成隐私检查\n- [ ] 预先准备“售罄”“延迟发货”“口味售罄”三套公告\n- [ ] 安排一人只看履约，一人只看客服，一人负责最终决策\n\n> 建议首发当天不要临时改价格或套餐结构；把新想法记录下来，次日再评估。'}])
    ]
  },
  {uuid:root+'000000000102',name:'客服知识库迁移：结构与验收清单',summary:'依据北辰咖啡项目文件重组客服知识库，并设计迁移验收规则。',created_at:'2026-06-12T03:00:00Z',updated_at:'2026-06-12T05:35:00Z',chat_messages:[msg('000000000211','human','2026-06-12T03:00:00Z','00000000-0000-4000-8000-000000000000',[{type:'text',text:'把旧客服文档整理成新的知识库结构。'}]),msg('000000000212','assistant','2026-06-12T03:03:00Z',root+'000000000211',[{type:'local_resource',file_path:'/mnt/project/brand-guide.md'},{type:'text',text:'我会以项目品牌手册为唯一口径，按售前、订单、配送、订阅变更和售后五个入口重组，并为每篇文档增加适用范围与最后复核日期。'}])]},
  {uuid:root+'000000000103',name:'口味问卷与首包更换：12 份访谈信号',summary:'访谈持续指向城市精品咖啡用户的三个障碍：害怕选错、担心囤积，以及希望首包更换足够简单。建议把口味问卷与首包更换作为订阅服务的核心承诺。',created_at:'2026-06-08T06:10:00Z',updated_at:'2026-06-08T07:40:00Z',chat_messages:[msg('000000000221','human','2026-06-08T06:10:00Z','00000000-0000-4000-8000-000000000000',[{type:'text',text:'请归纳这些访谈里重复出现的购买障碍。'}]),msg('000000000222','assistant','2026-06-08T06:14:00Z',root+'000000000221',[{type:'text',text:'最稳定的三个信号是：担心选错口味、不清楚多久能喝完，以及不愿意被长期订阅绑定。'}])]},
  {uuid:root+'000000000104',name:'第二季度复盘：哪些实验值得保留',summary:'虚构季度实验复盘。',created_at:'2026-06-02T01:00:00Z',updated_at:'2026-06-02T02:20:00Z',chat_messages:[msg('000000000231','human','2026-06-02T01:00:00Z','00000000-0000-4000-8000-000000000000',[{type:'text',text:'根据实验记录写一份克制的季度复盘。'}]),msg('000000000232','assistant','2026-06-02T01:04:00Z',root+'000000000231',[{type:'text',text:'本季度最值得保留的不是折扣，而是口味问卷与首包可更换机制；两者同时提高了转化与留存。'}])]}
];

const extendedScenarios=[
  ['北辰咖啡订阅服务','创始席位邮件：三版语气对比','创始席位邀请邮件','比较克制、温暖与偏销售的三套语气，并保留品牌可信感','project_knowledge_search'],
  ['北辰咖啡订阅服务','首月续订下降：客服记录与访谈交叉分析','首月续订率下降','从客服标签、暂停原因和访谈记录中拆出可验证假设','view'],
  ['北辰咖啡订阅服务','包装卡片文案：产地故事不应该像说明书','包装内页产地故事','把复杂处理法改写成普通用户愿意读完的短文','str_replace'],
  ['北辰咖啡订阅服务','订阅暂停流程：减少客服往返','暂停与恢复订阅流程','设计清晰状态机与客服兜底话术','visualize:show_widget'],
  ['北辰咖啡订阅服务','门店试饮活动复盘与下轮实验','线下试饮活动复盘','区分样本偏差、执行问题与真实需求信号','create_file'],
  ['雾港档案局世界设定','雾港第七码头：失踪船员案时间线','虚构港口悬疑案件时间线','核对人物行踪、潮汐窗口和证词矛盾','project_knowledge_search'],
  ['雾港档案局世界设定','城防厅、商会与灯塔局的权限冲突','虚构机构权限设计','建立三个机构既合作又互相制衡的制度逻辑','view'],
  ['雾港档案局世界设定','“白潮病”设定档案：症状与社会影响','虚构疾病世界观','把医学表象、民间误解和政治利用分层记录','create_file'],
  ['雾港档案局世界设定','审讯场景重写：不要让反派主动解释一切','悬疑小说审讯场景','通过回避、错词和物证推进，而不是信息倾倒','str_replace'],
  ['雾港档案局世界设定','完全背离主线的 IF 线：灯塔从未熄灭','架空故事分支','保留人物核心动机，同时重建事件因果','conversation_search'],
  ['开源迁移台账','单文件查看器的 Worker 消息协议评审','Worker 消息协议','检查传输所有权、取消机制和错误恢复边界','bash_tool'],
  ['开源迁移台账','大型 JSON 懒解析：基准结果与下一步','大型 JSON 性能','比较全量解析、分块扫描与按需 materialize','bash_tool'],
  ['开源迁移台账','浏览器 file:// 模式下的 CDN 与 ORB 问题','离线依赖兼容性','复现资源拦截并设计本地依赖回退','web_search'],
  ['开源迁移台账','隐私扫描规则：高召回与低误报如何分层','本地隐私扫描','把标准规则与明确会误伤的强力模式分开','ask_user_input_v0'],
  ['开源迁移台账','发布包校验：ZIP、SHA-256 与离线依赖','离线发行验证','生成产物清单并验证不包含 fixture 与本地路径','present_files'],
  ['海岬旅行研究','雨季前往海岬群岛：七天路线可行性','虚构群岛旅行路线','结合渡轮、天气与体力留出缓冲日','web_search'],
  ['海岬旅行研究','三家虚构旅馆比较：位置、噪声与取消政策','住宿比较','把营销描述改写成可比较的决策表','web_fetch'],
  ['海岬旅行研究','海边徒步装备清单：轻量但不冒险','徒步装备取舍','按必要、共享、可选与当地租赁四层整理','create_file'],
  ['海岬旅行研究','旅行预算超支 18%：问题出在哪里','旅行预算复盘','区分汇率、临时交通、餐饮和错误预订','bash_tool'],
  ['海岬旅行研究','把旅行笔记整理成一篇克制的长文','旅行写作整理','保留现场细节，删除流水账和夸张感叹','str_replace'],
  ['', '如何给 200 个 Markdown 文件做可逆批量重命名','批量文件重命名','设计预览、冲突检测、回滚清单和 dry-run','bash_tool'],
  ['', '读完一本虚构城市史后，我真正记住了什么','阅读笔记整理','围绕制度、空间和普通人经验重组笔记','create_file'],
  ['', '比较三种家庭照片备份方案','本地照片备份','权衡成本、隐私、去重和灾难恢复','web_search'],
  ['', '一个周末能完成的个人网站改版范围','个人网站改版','压缩范围并确定必须上线与可以延期的内容','ask_user_input_v0'],
  ['北辰咖啡订阅服务','从最近讨论里找出尚未关闭的发布问题','发布遗留问题','检索近期对话并建立负责人清单','recent_chats'],
  ['北辰咖啡订阅服务','更新项目记忆：哪些结论已经被验证','项目记忆维护','区分稳定事实、临时决定和过期假设','memory_user_edits'],
  ['雾港档案局世界设定','给共同作者写一封设定冲突说明','共同创作沟通','用不带指责的方式解释三处连续性冲突','message_compose_v1'],
  ['雾港档案局世界设定','搜索适合管理虚构年表的 MCP 工具','世界观工具选择','比较本地数据库、图谱和时间线工具','search_mcp_registry'],
  ['开源迁移台账','依赖升级后代码高亮为什么失效','前端依赖回归','从加载顺序、API 变化和样式缺失逐层定位','bash_tool'],
  ['开源迁移台账','给新贡献者写一份不吓人的架构导读','贡献者文档','用数据流和常见任务解释代码边界','create_file'],
  ['开源迁移台账','CI 偶发失败：到底是产品缺陷还是测试竞态','浏览器测试竞态','通过日志、等待条件和重复运行定位根因','bash_tool'],
  ['海岬旅行研究','如果渡轮连续停航两天，路线怎么重排','交通中断预案','保留核心体验并控制额外住宿成本','ask_user_input_v0'],
  ['海岬旅行研究','给家人发送一份简短但完整的行程说明','旅行信息同步','压缩路线、住宿和紧急联系人信息','message_compose_v1'],
  ['', '把 40 条零散想法整理成半年计划','个人计划整理','识别真正承诺、依赖关系和可以删除的愿望','recent_chats'],
  ['', '为虚构播客设计三期连续选题','播客内容策划','让三期内容各自成立又形成递进','visualize:show_widget'],
  ['', '为什么这段数据分析结论听起来很确定但证据很弱','分析论证审查','拆分观察、相关性、因果推断和建议','view']
];

const projectByName=()=>Object.fromEntries(demoProjects.map(project=>[project.name,project]));
function syntheticSummary(title,subject,outcome,projectName){return `**Conversation Overview**\n\nThis was a multi-step Chinese-language collaboration about ${subject}. The user asked Claude to ${outcome}. The conversation moved from scoping and evidence collection into a concrete draft, then through targeted revision and a final operational checklist. ${projectName?`Claude used the fictional “${projectName}” project context and clearly separated project evidence from newly proposed material.`:'The conversation was intentionally left outside any project so the demo also contains unassigned history.'}\n\nThe user consistently pushed back on generic wording and asked for concrete counterexamples, named decision criteria, ownership, deadlines, and fallback paths. Claude responded by separating confirmed evidence from inference, revising broad recommendations into checklists, and preserving the reasons behind important choices. Where a tool result was incomplete or failed, the response continued with a narrower claim instead of silently presenting uncertain material as fact.\n\nThe resulting thread contains a realistic mixture of short confirmations, longer Markdown deliverables, Thinking, tool calls and results, generated files, attachments, and revision branches. It also records which portions came from project knowledge or user-provided material and which were newly proposed during the conversation. This level of summary detail mirrors the dense overview metadata found in mature exports while remaining entirely fictional.\n\nThe user preferred concise conclusions followed by evidence, explicit uncertainty, and reusable Markdown deliverables. Tool calls, intermediate results, attachments, branching alternatives, and occasional empty export records are included to reproduce the shape of a mature Claude archive. This entire overview and every referenced entity are synthetic.`;}
function buildExtendedConversation(spec,index){
  const[projectName,title,subject,outcome,toolName]=spec,base=1000+index,convUuid=root+String(base).padStart(12,'0'),start=new Date(Date.UTC(2026,2+(index%3),3+(index%24),1+(index%12),index%60));
  const at=minutes=>new Date(start.getTime()+minutes*60000).toISOString(),mid=n=>root+String(6000+index*20+n).padStart(12,'0'),messages=[];
  const rootParent='00000000-0000-4000-8000-000000000000',project=projectName?projectByName()[projectName]:null,doc=project?.docs?.[index%project.docs.length];
  messages.push(msg(mid(1).slice(-12),'human',at(0),rootParent,[{type:'text',text:`我们继续处理“${subject}”。先不要直接写最终稿，请先列出需要核实的材料、关键假设和最容易误判的地方。`}],index%3===0?{attachments:[{file_name:`${subject.slice(0,10)}_参考资料.pdf`,file_size:180000+index*7311}]}:{}));
  const toolId=`demo-${index}-tool-1`,toolInput=toolName==='project_knowledge_search'?{query:`${subject} ${projectName} 工作原则`}:toolName==='web_search'?{query:`${subject} 公开资料 核实`}:toolName==='web_fetch'?{url:'https://example.invalid/fictional-reference'}:toolName==='str_replace'?{path:doc?.filename||'draft.md',old_str:'初稿段落',new_str:'修订段落'}:toolName==='bash_tool'?{command:'demo-command --dry-run'}:toolName==='ask_user_input_v0'?{question:'更看重准确性还是完成速度？'}:{path:doc?.filename||'working-notes.md'};
  messages.push(msg(mid(2).slice(-12),'assistant',at(2),mid(1),[{type:'thinking',thinking:`需要围绕${subject}建立证据层级，先检查已有材料，再决定交付结构。不能把假设写成事实。`,summaries:[{summary:'先核实证据，再组织交付结构。'}],signature:`synthetic-signature-${index}`,start_timestamp:at(1),stop_timestamp:at(2)},{type:'tool_use',id:toolId,name:toolName,message:`正在处理：${subject}`,input:toolInput,integration_name:toolName.startsWith('web_')?'Synthetic Web':'',is_mcp_app:toolName==='visualize:show_widget'}]));
  messages.push(msg(mid(3).slice(-12),'assistant',at(4),mid(2),[{type:'tool_result',tool_use_id:toolId,is_error:index%9===0,structured_content:{status:index%9===0?'partial':'ok',items:2,source:'synthetic'},display_content:index%9===0?'部分材料不可用，已使用现有证据继续':'已找到 2 条可用证据',content:[{type:'text',text:doc?`/mnt/project/${doc.filename} 提供了相关项目背景。`:'使用虚构公开资料与用户提供的上下文。'}]},{type:'text',text:`## 第一轮结论\n\n围绕 **${subject}**，最重要的不是一次性写得很满，而是先把“已确认”“合理推断”“待验证”分开。\n\n| 层级 | 当前内容 | 下一步 |\n|---|---|---|\n| 已确认 | 用户目标与现有材料 | 保持原意 |\n| 推断 | 执行顺序与风险 | 小范围验证 |\n| 未知 | 外部条件与边界 | 明确标注 |\n\n建议接下来以${outcome}为主线完成第二稿。`} ]));
  messages.push(msg(mid(4).slice(-12),'human',at(18),mid(3),[{type:'text',text:'结构对了，但现在还太像通用模板。请加入一个具体反例，并把最后部分改成可以直接执行的检查清单。'}]));
  messages.push(msg(mid(5).slice(-12),'assistant',at(21),mid(4),[{type:'thinking',thinking:'用户需要的是具体性和可执行性。应保留证据边界，同时减少抽象术语。',start_timestamp:at(20),stop_timestamp:at(21)},{type:'text',text:`### 具体反例\n\n如果团队只追求“内容完整”，却没有指定负责人和验收条件，${subject}会在交付时变成一份没人敢采用的长文档。\n\n### 执行检查清单\n\n- [ ] 每项结论都能指出来源或明确标注为推断\n- [ ] 至少保留一个失败路径与回退方案\n- [ ] 为关键动作指定负责人、截止时间和验收条件\n- [ ] 删除无法改变决策的背景信息\n- [ ] 最终交付可在五分钟内完成第一次审阅`} ]));
  if(index%4===0)messages.push(msg(mid(6).slice(-12),'assistant',at(22),mid(4),[{type:'text',text:`另一种版本会把${subject}写成更短的决策备忘录，只保留背景、选择、风险和下一步四段。`} ]));
  messages.push(msg(mid(7).slice(-12),'human',at(35),mid(5),[{type:'text',text:'可以。保存一份 Markdown，并告诉我哪些内容来自项目资料，哪些是你补充的建议。'}]));
  messages.push(msg(mid(8).slice(-12),'assistant',at(38),mid(7),[{type:'tool_use',id:`demo-${index}-tool-2`,name:index%2?'create_file':'present_files',message:'生成最终交付文件',input:{filename:`${subject.slice(0,14)}_最终版.md`,content:'synthetic markdown deliverable'}},{type:'text',text:`已整理完成。项目或用户材料提供了主题背景、约束和已确认事实；结构设计、风险分层、反例与检查清单属于本轮新增建议。\n\n> 所有演示文件均为合成内容，不对应真实个人或组织。`}],{files:[{file_name:`${subject.slice(0,14)}_最终版.md`,file_type:'text/markdown',file_size:3200+index*47}]}));
  if(index%6===0)messages.push(msg(mid(9).slice(-12),'assistant',at(39),mid(8),[]));
  return{uuid:convUuid,name:title,summary:syntheticSummary(title,subject,outcome,projectName),created_at:at(0),updated_at:at(39),chat_messages:messages};
}

export const demoMemories={conversations_memory:'**Work context**\n\n用户正在推进一个虚构消费品牌的产品、内容与客服知识库工作，偏好先给结论，再给证据和可执行清单。\n\n**Personal context**\n\n涉及预算时应明确假设与预备金；涉及用户研究时应区分原始信号与推断。\n\n**Top of mind**\n\n当前重点是秋季发布、首月留存和客服知识库迁移。\n\n**Brief history**\n\n所有品牌、人物、文件、账号和数值均为虚构合成数据。',project_memories:{[root+'000000000301']:'**Purpose & context**\n\n北辰咖啡是虚构的 **城市精品咖啡** 订阅品牌，强调 **每月产地来信** 与不需要研究复杂参数的轻松体验。\n\n**Current state**\n\n已确认 **口味问卷**、**首包更换**、可随时暂停，是用户最在意的服务承诺。\n\n**On the horizon**\n\n完成创始席位预热、公开发布和首月续订验证。\n\n**Key learnings & principles**\n\n不把折扣作为核心卖点，所有营销判断都要能追溯到访谈或项目文件。\n\n**Approach & patterns**\n\n小团队可执行、预算透明、避免夸大效果。\n\n**Tools & resources**\n\n品牌手册、访谈摘要、客服知识库和发布检查清单。'}};
export const demoProjects=[{uuid:root+'000000000301',name:'北辰咖啡订阅服务',description:'虚构产品发布项目，用于 README 安全演示。',prompt_template:'所有建议必须给出依据、预算与可执行检查项；不确定时明确说明。',docs:[{uuid:root+'000000000302',filename:'brand-guide.md',content:'# 品牌手册\n\n品牌定位：温暖、克制、可信。目标用户是希望稳定喝到好咖啡、但不想研究复杂参数的城市上班族；订阅体验必须简单、可暂停。'},{uuid:root+'000000000303',filename:'interview-notes.md',content:'# 用户访谈摘要\n\n目标用户主要担心选错口味、囤积和订阅难以暂停，因此订阅体验应突出低风险试用。'}]}];
demoProjects.push(
  {uuid:root+'000000000311',name:'雾港档案局世界设定',description:'虚构悬疑世界观项目，包含机构、案件、人物与城市规则。',prompt_template:'事实档案、人物推断和作者决定必须分层标注；避免用解释性独白代替情节证据。',docs:[{uuid:root+'000000000312',filename:'fog-harbor-timeline.md',content:'# 雾港年表\n\n第七码头失踪案发生在白潮季前夜，灯塔局、城防厅与商会各自掌握不同记录。'},{uuid:root+'000000000313',filename:'agency-jurisdiction.md',content:'# 机构权限\n\n城防厅负责治安，灯塔局管理航道信号，商会控制仓储与船期。'},{uuid:root+'000000000314',filename:'white-tide-notes.md',content:'# 白潮病档案\n\n所有症状与机构均为虚构设定。'}]},
  {uuid:root+'000000000321',name:'开源迁移台账',description:'虚构软件工程项目，记录大型文件解析、离线发行和隐私安全设计。',prompt_template:'先测量再重构；每项优化必须提供可复现基准、失败回退和隐私边界。',docs:[{uuid:root+'000000000322',filename:'worker-protocol.md',content:'# Worker 协议\n\n采用可取消请求、Transferable 分块和按需 materialize。'},{uuid:root+'000000000323',filename:'offline-release.md',content:'# 离线发行\n\n固定依赖版本，验证 ZIP 内容与 SHA-256。'},{uuid:root+'000000000324',filename:'privacy-rules.md',content:'# 隐私规则\n\n标准模式控制误报，强力模式明确告知可能误伤。'}]},
  {uuid:root+'000000000331',name:'海岬旅行研究',description:'虚构群岛旅行研究项目，用于展示网页检索、预算和行程文档。',prompt_template:'所有地点均为虚构；路线建议必须包含天气、交通中断和体力缓冲。',docs:[{uuid:root+'000000000332',filename:'cape-islands-route.md',content:'# 海岬群岛路线\n\n渡轮每周四班，雨季可能临时取消。'},{uuid:root+'000000000333',filename:'packing-and-budget.md',content:'# 装备与预算\n\n预算分为固定交通、住宿、餐饮和应急金。'}]}
);
Object.assign(demoMemories.project_memories,{
  [root+'000000000311']:'**Purpose & context**\n\n构建虚构的 **雾港档案局**、**第七码头** 与 **白潮病** 世界观。\n\n**Current state**\n\n机构权限、案件年表和人物动机已建立。\n\n**Key learnings & principles**\n\n线索必须先于解释出现，IF 线不能改变人物核心动机。',
  [root+'000000000321']:'**Purpose & context**\n\n维护虚构的 **持久 Worker**、**离线发行** 和 **隐私规则** 工程台账。\n\n**Current state**\n\n已完成分块解析、按需渲染和安全导出。\n\n**Approach & patterns**\n\n先建立基线，再做可验证优化。',
  [root+'000000000331']:'**Purpose & context**\n\n研究虚构的 **海岬群岛** 路线、住宿和预算。\n\n**Current state**\n\n已整理渡轮、雨季风险和徒步装备。\n\n**Key learnings & principles**\n\n路线必须留有中断缓冲，不把宣传材料当作事实。'
});
demoConversations.push(...extendedScenarios.map(buildExtendedConversation));
export const demoDesign={uuid:root+'000000000401',title:'订阅落地页视觉探索',project:{name:'北辰咖啡订阅服务'},messages:[{role:'user',content:'设计一个温暖、克制的咖啡订阅首屏。'},{role:'assistant',content:[{type:'thinking',thinking:'采用纸张暖色、有限选项和明确行动按钮。'},{type:'text',text:'首屏聚焦口味选择，不堆叠品牌宣言。'}]}]};
