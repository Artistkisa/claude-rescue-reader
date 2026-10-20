# 本地统计 / Local analytics

统计页默认显示探索分析；全档案总览及中英文词频另行按需计算。统计状态和缓存只存在当前页面内存。已有项目手动修正仍使用原有本地设置，并优先于推断。

Explore is the default view. Archive overview and word frequency are computed separately on demand. Analytics state and caches remain in page memory. Existing local project corrections override inference.

## 统计口径 / Semantics

- 全历史包含无效时间消息并显示其数量；限定日期时排除。模型缺失显示“未提供”，不推断模型；没有项目证据的对话为“未归属”。
- 日期使用浏览器本地时区，含首尾两天。快捷范围以整份档案最新有效消息日期为终点。周一为周起点；不超过 60 天按日、61–365 天按周、更长按月分桶，并补零。边界周/月截取到所选范围。
- 项目条件作用于整条对话；时间、模型、角色作用于消息。活跃对话数是至少含一条匹配消息的去重对话数。字符包括文本和 Thinking，按 JavaScript 字符串长度计数，与原总览一致。
- 7/30 日移动平均使用所选范围内的每日值，只从完整窗口开始显示。周/月图在桶的最后一天采样每日移动平均，柱形表示桶总量；活跃对话的移动平均使用每日去重数量。柱形使用左轴，日均移动平均使用独立右轴，均从零起算；双轴高度不可直接比较数值。
- 前期为紧邻当前范围之前的等长日历区间，沿用非时间条件。全历史不提供前期比较；无有效日期跨度时也不提供比较，接口的 `comparison` 和 `previousRange` 为 `null`。限定日期的零基期仍显示“新增”或“无变化”，无效时间不进入前期。
- 下钻每页 50 条，按最近命中时间降序；无有效时间的记录排在最后。图表下钻只匹配选中桶中的消息。“在对话列表中查看”应用同一批 UUID，标记可清除；对话列表中的消息数仍为原对话总消息数。

- All history includes invalid timestamps and reports their count; date-limited queries exclude them. Missing models remain “Not provided”; projects without evidence are “Unassigned”.
- Dates use the browser's local time zone and inclusive boundaries. Presets end on the latest valid message date in the entire archive. Weeks start Monday; buckets are daily through 60 days, weekly through 365 days, and monthly thereafter. Empty buckets are filled; boundary buckets are clipped.
- Projects filter entire conversations; dates, models and roles filter messages. Active conversations are distinct conversations containing a match. Characters count text and Thinking using JavaScript string length.
- Moving averages use complete 7/30-day windows inside the selected range. Weekly/monthly charts sample daily averages at bucket end; bars show bucket totals. Conversation averages use each day's distinct active-conversation count. Bars use the left axis; daily averages use an independent right axis. Both start at zero; heights across axes do not imply equal values.
- Comparisons use the immediately preceding equal-length calendar interval with identical non-date filters. All history and queries without a valid date span omit comparison; `comparison` and `previousRange` are `null`. Date-limited zero baselines still show “New” or “Unchanged”. Invalid dates never enter the previous interval.
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

事件：`ready`、`progress`、`result`、`projects`（共享项目推断）、`canceled`、`error`。进度由实际处理记录/消息及筛选扫描推进；检查点检查取消，约每 8 ms 让出事件循环，而非每个检查点都等待计时器。进度同阶段最多每 50 ms 发布一次，阶段切换及完成立即发布；下钻扫描使用 `phase: 'drilldown'`。时间片是协作式目标，不是单条 JSON 解析或排序的硬性时限。

Events: `ready`, `progress`, `result`, `projects` (shared inferred assignments), `canceled`, `error`. Checkpoints test cancellation and yield after roughly 8 ms of work instead of waiting for a timer at every checkpoint. Same-phase progress is limited to one update per 50 ms; phase transitions and completion publish immediately. Drilldown scans use `phase: 'drilldown'`. The cooperative time slice is not a hard deadline for a single JSON parse or sort.

Data Worker 的 `analyticsConnect` 接收另一端口；`analyticsDisconnect` 释放。Analytics 发送 `streamStart`，Data 返回 `batch`：最多 4 条，UTF-8 目标上限 512 KiB，超大单条独立发送。消费后才发送 `batchAck`，允许读取下一批；`streamCancel` 停止供数。原始记录仅跨两个 Worker，不经过主线程。

Data Worker's `analyticsConnect` receives the peer port; `analyticsDisconnect` closes it. Analytics sends `streamStart`; Data replies with `batch` (at most 4 records, targeting 512 KiB in UTF-8; oversized records alone). After consumption, `batchAck` allows the next batch; `streamCancel` stops delivery. Raw records travel directly between Workers.

索引仅含对话摘要、项目及消息时间/模型/角色/字符数，不含正文。聚合 LRU 最多 12 项，键含来源、条件、项目及停用词版本。离页取消但保留空闲 Worker；重新导入、失败或卸载时终止并关闭端口。创建失败提供重试，不在主线程扫描。

The compact index stores summaries, projects and message time/model/role/character counts, without message bodies. The 12-entry aggregate LRU keys include source, filters, project and stopword versions. Navigation cancels work and keeps the idle Worker. Reimport, failure and unload terminate it and close ports. Creation failure offers retry without a main-thread scan.

打开过探索后，精简索引按全部消息数占用内存，离开统计页仍驻留以便再次打开时复用；聚合缓存上限不会限制索引大小。另仅保留最近一组命中对话摘要（不含消息正文），内存随命中对话数增长，不按 12 组复制。查询扫描同时生成这组摘要；相同条件的翻页和列表 UUID 请求复用摘要，不再扫描或排序。条件或选中桶改变时可重新扫描并替换；键包含来源、有效日期范围、规范化的项目/模型/角色条件、项目/停用词版本及手动修正，排除页码和是否返回 UUID。取消的部分扫描不发布为缓存；重新导入或释放时清空。

After Explore has opened, the compact index uses memory proportional to all messages and remains resident outside Analytics for reuse. The aggregate cache limit does not cap index size. One additional result holds only the latest matching conversation summaries, with memory proportional to matched conversations rather than 12 copies. Queries collect these summaries during aggregation; pagination and UUID requests reuse them without scanning or sorting. Changing conditions or the selected bucket can rescan and replace that result. Its key includes source, effective date range, normalized project/model/role selections, project/stopword revisions and overrides, excluding pagination and UUID inclusion. Partial canceled scans are never cached; reimport and release clear the result.

现有 2 秒普通对话打开目标继续保留。性能回归还对 12 万条合成消息要求：索引已建立后的筛选少于 2 秒，连续两次缓存下钻合计少于 1 秒。它们是 CI 回归上限，并非所有设备的性能承诺。[统计基准与原始样本](benchmarks/analytics-performance.md)说明测量口径。运行 `npm run benchmark:analytics` 输出 JSON；可加 `-- --output=test-results/analytics-benchmark.json` 保存报告，不修改已有基准。

The existing two-second conversation-open target remains. CI also checks 120,000 synthetic messages: a filter after indexing takes under two seconds, and two cached drilldowns take under one second combined. These are regression budgets, not guarantees for all devices. See the [analytics benchmark and raw samples](benchmarks/analytics-performance.md). Run `npm run benchmark:analytics` for JSON output or add `-- --output=test-results/analytics-benchmark.json` to save a report without changing the recorded baseline.

验证：`npm run test:smoke` 包括统计合成样本、背压、取消、缓存、重试及 4× CPU 性能回归；`npm run build:offline` 和 `npm run test:offline` 验证离线运行。

Validation: `npm run test:smoke` covers fixtures, backpressure, cancellation, cache, retry and 4× CPU performance. `npm run build:offline` and `npm run test:offline` verify offline operation.
