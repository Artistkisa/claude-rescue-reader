// Fictional, privacy-safe demo history used only for README screenshots.
const root='10000000-0000-4000-8000-';
const msg=(id,sender,time,parent,content,extra={})=>({uuid:root+id,sender,created_at:time,parent_message_uuid:parent,content,...extra});

export const demoConversations=[
  {
    uuid:root+'000000000101',name:'北辰咖啡订阅服务：秋季发布方案',summary:'围绕虚构品牌“北辰咖啡”的产品定位、发布节奏与落地页方案展开。全部内容均为合成演示数据。',created_at:'2026-06-18T01:20:00Z',updated_at:'2026-06-18T02:16:00Z',chat_messages:[
      msg('000000000201','human','2026-06-18T01:20:00Z','00000000-0000-4000-8000-000000000000',[{type:'text',text:'我们准备上线一个咖啡豆月度订阅服务。请结合项目资料，先给我一份适合小团队执行的秋季发布方案，预算控制在 8 万以内。'}]),
      msg('000000000202','assistant','2026-06-18T01:22:00Z',root+'000000000201',[
        {type:'thinking',thinking:'我需要先确认品牌定位、目标人群和现有渠道，再把预算拆成内容、投放、样品与预备金。项目知识中应该有品牌手册和用户访谈摘要。',start_timestamp:'2026-06-18T01:20:08Z',stop_timestamp:'2026-06-18T01:20:31Z'},
        {type:'tool_use',id:'demo-tool-1',name:'project_knowledge_search',message:'正在检索品牌定位与用户访谈',input:{query:'北辰咖啡 品牌定位 用户访谈 订阅服务'}},
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
  {uuid:root+'000000000102',name:'客服知识库迁移：结构与验收清单',summary:'虚构客服知识库迁移计划。',created_at:'2026-06-12T03:00:00Z',updated_at:'2026-06-12T05:35:00Z',chat_messages:[msg('000000000211','human','2026-06-12T03:00:00Z','00000000-0000-4000-8000-000000000000',[{type:'text',text:'把旧客服文档整理成新的知识库结构。'}]),msg('000000000212','assistant','2026-06-12T03:03:00Z',root+'000000000211',[{type:'text',text:'建议按售前、订单、配送、订阅变更和售后五个入口重组，并为每篇文档增加适用范围与最后复核日期。'}])]},
  {uuid:root+'000000000103',name:'12 份用户访谈：需求信号归纳',summary:'虚构用户研究归纳。',created_at:'2026-06-08T06:10:00Z',updated_at:'2026-06-08T07:40:00Z',chat_messages:[msg('000000000221','human','2026-06-08T06:10:00Z','00000000-0000-4000-8000-000000000000',[{type:'text',text:'请归纳这些访谈里重复出现的购买障碍。'}]),msg('000000000222','assistant','2026-06-08T06:14:00Z',root+'000000000221',[{type:'text',text:'最稳定的三个信号是：担心选错口味、不清楚多久能喝完，以及不愿意被长期订阅绑定。'}])]},
  {uuid:root+'000000000104',name:'第二季度复盘：哪些实验值得保留',summary:'虚构季度实验复盘。',created_at:'2026-06-02T01:00:00Z',updated_at:'2026-06-02T02:20:00Z',chat_messages:[msg('000000000231','human','2026-06-02T01:00:00Z','00000000-0000-4000-8000-000000000000',[{type:'text',text:'根据实验记录写一份克制的季度复盘。'}]),msg('000000000232','assistant','2026-06-02T01:04:00Z',root+'000000000231',[{type:'text',text:'本季度最值得保留的不是折扣，而是口味问卷与首包可更换机制；两者同时提高了转化与留存。'}])]}
];

export const demoMemories={global_memory:'所有演示内容均为虚构。用户偏好结论先给摘要，再给可执行清单。',project_memories:{[root+'000000000301']:'## 项目定位\n北辰咖啡是虚构的城市精品咖啡订阅品牌。\n\n## 工作原则\n小团队可执行、预算透明、避免夸大营销效果。'}};
export const demoProjects=[{uuid:root+'000000000301',name:'北辰咖啡订阅服务',description:'虚构产品发布项目，用于 README 安全演示。',prompt_template:'所有建议必须给出依据、预算与可执行检查项；不确定时明确说明。',docs:[{uuid:root+'000000000302',filename:'brand-guide.md',content:'# 品牌手册\n\n品牌关键词：温暖、克制、可信。目标用户是希望稳定喝到好咖啡、但不想研究复杂参数的城市上班族。'},{uuid:root+'000000000303',filename:'interview-notes.md',content:'# 用户访谈摘要\n\n用户主要担心选错口味、囤积和订阅难以暂停。'}]}];
export const demoDesign={uuid:root+'000000000401',title:'订阅落地页视觉探索',project:{name:'北辰咖啡订阅服务'},messages:[{role:'user',content:'设计一个温暖、克制的咖啡订阅首屏。'},{role:'assistant',content:[{type:'thinking',thinking:'采用纸张暖色、有限选项和明确行动按钮。'},{type:'text',text:'首屏聚焦口味选择，不堆叠品牌宣言。'}]}]};
