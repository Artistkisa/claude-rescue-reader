# Worker pipelines / Worker 性能管线

The viewer creates at most five workers, only when their feature is used. Opening the file creates none. Folder import creates Data; reading creates Reader; ZIP import creates Import; scans/exports create Task; statistics creates Analytics. All code runs locally. Worker libraries are pinned, bundled as Base64, and decoded only when the corresponding worker is created.

最多五个 Worker，均按需创建。打开页面不创建 Worker；文件夹导入使用 Data，阅读使用 Reader，ZIP 使用 Import，扫描与导出使用 Task，统计使用 Analytics。固定版本依赖以 Base64 内嵌，创建对应 Worker 时才解码，不增加运行时网络依赖。

| Source | Responsibility / 职责 |
| --- | --- |
| `src/data-worker.js` | Raw records, IndexedDB cache, archive search, independent record channels / 原始记录、缓存、档案检索、独立供数通道 |
| `src/import-worker.js` | ZIP directory, streamed JSON decompression, Design/project/memory parsing, lazy images / ZIP 目录、流式解压、附属 JSON 解析、图片延迟提取 |
| `src/task-worker.js` | Redaction, export Blobs, quality, behavior, PDF view pages, background highlighting / 脱敏、文件生成、质量与行为扫描、PDF 预处理、后台高亮 |
| `src/reader-worker.js` | Current conversation, iterative tree index, branch selection, Markdown, paged search / 当前对话、迭代树索引、分支选择、Markdown、分页搜索 |
| `src/analytics-worker.js` | Existing exploration and archive overview / 统计探索及全档案总览 |
| `src/worker-core.js` | Shared pure tree, redaction, quality, text extraction, rendering and export algorithms / 共享纯函数算法 |
| `src/worker-runtime.js` | Request generations, cancellation, progress, acknowledged streams / 数据代次、取消、进度、背压 |
| `src/feature-client.js` | Worker lifecycle and DOM integration / Worker 生命周期及 DOM 挂载 |

Record consumers have independent MessagePorts. Each receives at most four conversations, targeting 512 KiB of UTF-8 data; an oversized record travels alone. An acknowledgement releases the next batch. Import sends transferred buffers of at most 4 MiB directly to Data. Main receives metadata and active view models, never a ZIP's decompressed conversation archive.

供数通道彼此独立，每批最多四条对话、目标 512 KiB（UTF-8），超大单条独立传输，消费确认后再发下一批。Import 直接向 Data 传输最多 4 MiB 的缓冲区，主线程只接收元数据和当前视图模型。

Reader retains one conversation and its tree index. Search covers the selected branch (or full tree), body text without Markdown markers, Thinking and source code. Results use source array indices rather than UUIDs, with 100 hits per page. A mounted window has at most 100 messages and also follows the rendering weight budget. Text fields over 64 KiB use 32 KiB sections; these sections show escaped plain text, with large code highlighting scheduled in Task. Copy and export use complete worker-owned source, independent of the mounted section. PDF receives complete content in batches of 50 messages; printing and layout remain on main.

Reader 只保留当前对话及树索引。搜索当前分支或整树，覆盖去除 Markdown 标记的正文、Thinking 和代码，以源数组序号定位，避免依赖缺失或重复 UUID。命中每页 100 条，挂载窗口最多 100 条消息并继续遵守权重预算。超过 64 KiB 的文本按 32 KiB 分段显示为转义纯文本，大代码段在 Task 后台高亮；复制、导出使用完整原文。PDF 每批接收 50 条完整消息，排版与打印仍在主线程。

Task runs one computation at a time. Explicit requests cancel an older task; background highlighting waits for explicit work, and behavior cannot interrupt an active export. Scans yield about every 8 ms / 128 messages. Preview scans all fields but returns counts and at most 100 masked findings, caching at most four summaries. Project export processes one conversation at a time and accumulates output only inside Task. No extra Quality worker exists.

Task 同时执行一项计算。显式操作取消旧任务，后台高亮等待前台任务完成，行为分析不会抢占导出。扫描约每 8 ms 或 128 条消息让出事件循环。预览扫描全部字段，只返回计数和最多 100 条遮罩结果，缓存最多四组摘要。项目导出逐条处理，仅在 Task 内积累输出。质量扫描不再创建独立 Worker。

ZIP images are extracted on first visible use. The LRU targets 32 entries / 64 MiB; currently mounted images are pinned and can temporarily exceed the target. An individual image over 64 MiB is displayed through a temporary URL without entering the cache. Unmounted temporary URLs are revoked. Reimport and unload terminate feature workers, disconnect consumers, clear attachments and reject pending requests. ZIP parse-cache keys use size, mtime and sampled first/last 64 KiB (SHA-256 where available), inheriting the existing sampled-fingerprint cache tradeoff; this is not a whole-file integrity check. The existing cache disclosure and clear action remain applicable.

ZIP 图片首次进入可视区域才解压。LRU 目标为 32 项、64 MiB；当前挂载图片不会被驱逐，可能暂时超出目标。单个超过 64 MiB 的图片不进缓存，使用临时 URL，卸载后释放。重新导入和页面卸载会终止功能 Worker、断开端口、清理附件并拒绝待处理请求。ZIP 解析缓存沿用采样指纹的取舍：文件大小、修改时间及首尾各 64 KiB，支持时使用 SHA-256；这不是全文件完整性校验。原有缓存告知及清除入口继续生效。

Build with `npm ci` then `powershell -File scripts/build-single-file.ps1`. `npm run validate` checks maintained code, embedded library versions/hashes and CSP hashes. Dependency license texts are embedded in the single file and included in offline notices. Run `npm run test:smoke`, `npm run build:offline`, and `npm run test:offline`. See `tests/worker-core.test.mjs` and `tests/worker-pipelines.spec.mjs` for focused regression coverage.

使用上述命令重新生成单文件并校验；生成结果包含源码、依赖版本与哈希、CSP 哈希和第三方许可证。专项测试覆盖深链、异常树、代码和 Thinking 搜索、跨窗口定位、全文导出、脱敏上限、取消、背压、附件及 Worker 重建。

`npm run benchmark:workers -- --runs=3` compares the base commit with the current single file under 4× CPU throttling. It uses synthetic data (15,900 messages), including a 10,000-message conversation with a legacy root for baseline compatibility. Results in [worker-pipelines.json](benchmarks/worker-pipelines.json) include file size, main-thread long tasks and main-thread heap. Heap figures exclude worker heaps; measurements are local observations, not device-independent guarantees. A separate 12,000-message canonical-root test verifies iterative traversal without the baseline's recursive stack limit.

基准使用三次测量的中位数，数据完全合成，一万条长对话采用旧根格式以便旧版可执行。报告记录单文件体积、主线程长任务和主线程堆内存；堆数据不包含 Worker，结果只代表本机观测。另有 12,000 条标准根深链测试，验证新实现不受旧递归栈限制。


The parent document keeps `script-src blob:` because opaque Artifact frames inherit its CSP in addition to their own policy. The local Artifact script runner executes Blob scripts inside that frame; a child policy cannot relax an inherited restriction. Both file and HTTP regression tests verify script execution, opaque origin and blocked networking. Removing the parent permission breaks both paths. This permission is separate from `worker-src` and `frame-src`.

主文档保留 `script-src blob:`：Artifact 的不透明来源帧同时受父文档继承策略及帧内策略约束，帧内策略无法放宽继承限制。本地脚本在帧内通过 Blob 执行；移除父策略许可会导致 file 和 HTTP 两种模式的交互失效。现有回归同时验证执行、不透明来源和网络隔离；此许可与 Worker、帧加载许可分别生效。
