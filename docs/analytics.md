# 本地统计 / Local analytics

统计页默认显示探索分析；全档案总览及中英文词频另行按需计算。统计状态和缓存只存在当前页面内存。已有项目手动修正仍使用原有本地设置，并优先于推断。

Explore is the default view. Archive overview and word frequency are computed separately on demand. Analytics state and caches remain in page memory. Existing local project corrections override inference.

## 统计口径 / Semantics

- 全历史包含无效时间消息并显示其数量；限定日期时排除。模型缺失显示“未提供”，不推断模型；没有项目证据的对话为“未归属”。
- 日期使用浏览器本地时区，含首尾两天。快捷范围以整份档案最新有效消息日期为终点。周一为周起点；不超过 60 天按日、61–365 天按周、更长按月分桶，并补零。边界周/月截取到所选范围。
- 项目条件作用于整条对话；时间、模型、角色作用于消息。活跃对话数是至少含一条匹配消息的去重对话数。字符包括文本和 Thinking，按 JavaScript 字符串长度计数，与原总览一致。
- 7/30 日移动平均使用所选范围内的每日值，只从完整窗口开始显示。周/月图在桶的最后一天采样每日移动平均，柱形表示桶总量；活跃对话的移动平均使用每日去重数量。
- 前期为紧邻当前范围之前的等长日历区间，沿用非时间条件。全历史使用有效日期跨度确定对比区间；无效时间不进入前期。零基期显示“新增”或“无变化”。
- 下钻每页 50 条，按最近命中时间降序；无有效时间的记录排在最后。图表下钻只匹配选中桶中的消息。“在对话列表中查看”应用同一批 UUID，标记可清除；对话列表中的消息数仍为原对话总消息数。

- All history includes invalid timestamps and reports their count; date-limited queries exclude them. Missing models remain “Not provided”; projects without evidence are “Unassigned”.
- Dates use the browser's local time zone and inclusive boundaries. Presets end on the latest valid message date in the entire archive. Weeks start Monday; buckets are daily through 60 days, weekly through 365 days, and monthly thereafter. Empty buckets are filled; boundary buckets are clipped.
- Projects filter entire conversations; dates, models and roles filter messages. Active conversations are distinct conversations containing a match. Characters count text and Thinking using JavaScript string length.
- Moving averages use complete 7/30-day windows inside the selected range. Weekly/monthly charts sample daily averages at bucket end; bars show bucket totals. Conversation averages use each day's distinct active-conversation count.
- Comparisons use the immediately preceding equal-length calendar interval with identical non-date filters. All history uses its valid-date span. Invalid dates never enter the previous interval. Zero baselines show “New” or “Unchanged”.
- Drilldown returns 50 summaries per page, ordered by latest match, with invalid-only matches last. A selected bucket restricts matching messages. The list marker applies the same UUIDs and can be cleared; list message counts still describe entire original conversations.

## Worker 协议 / Worker protocol

所有统计控制、事件、批次均带来源 `generation` 与 `requestId`。UI 版本额外丢弃取消、切换视图、重新导入后的旧结果。筛选变化立即取消，250 ms 防抖后提交。

All controls, events and batches carry source `generation` and `requestId`. A UI revision additionally discards results after cancellation, navigation or reimport. Filter changes cancel immediately and query after a 250 ms debounce.

| Request | Purpose |
| --- | --- |
| `init` | Transfer a port; supply projects, memory and conversation count |
| `query` | Lazily index, then aggregate filters, current/prior totals, buckets and options |
| `overview` | Stream again for archive totals and stopwords; retain no raw copy |
| `drilldown` | Return one page of summaries, optionally matching UUIDs for the list |
| `cancel` | Interrupt unfinished work and stop its stream |
| `release` | Clear index/cache and close the port before termination |

事件：`ready`、`progress`、`result`、`projects`（共享项目推断）、`canceled`、`error`。进度由实际处理记录/消息及筛选扫描推进；分段让出事件循环以便取消。

Events: `ready`, `progress`, `result`, `projects` (shared inferred assignments), `canceled`, `error`. Progress follows consumed records/messages and query scans; processing yields between chunks for cancellation.

Data Worker 的 `analyticsConnect` 接收另一端口；`analyticsDisconnect` 释放。Analytics 发送 `streamStart`，Data 返回 `batch`：最多 4 条，UTF-8 目标上限 512 KiB，超大单条独立发送。消费后才发送 `batchAck`，允许读取下一批；`streamCancel` 停止供数。原始记录仅跨两个 Worker，不经过主线程。

Data Worker's `analyticsConnect` receives the peer port; `analyticsDisconnect` closes it. Analytics sends `streamStart`; Data replies with `batch` (at most 4 records, targeting 512 KiB in UTF-8; oversized records alone). After consumption, `batchAck` allows the next batch; `streamCancel` stops delivery. Raw records travel directly between Workers.

索引仅含对话摘要、项目及消息时间/模型/角色/字符数，不含正文。聚合 LRU 最多 12 项，键含来源、条件、项目及停用词版本。离页取消但保留空闲 Worker；重新导入、失败或卸载时终止并关闭端口。创建失败提供重试，不在主线程扫描。

The compact index stores summaries, projects and message time/model/role/character counts, without message bodies. The 12-entry aggregate LRU keys include source, filters, project and stopword versions. Navigation cancels work and keeps the idle Worker. Reimport, failure and unload terminate it and close ports. Creation failure offers retry without a main-thread scan.

验证：`npm run test:smoke` 包括统计合成样本、背压、取消、缓存、重试及 4× CPU 性能回归；`npm run build:offline` 和 `npm run test:offline` 验证离线运行。

Validation: `npm run test:smoke` covers fixtures, backpressure, cancellation, cache, retry and 4× CPU performance. `npm run build:offline` and `npm run test:offline` verify offline operation.
