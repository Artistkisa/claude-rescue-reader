# 新版导出导入 / New export imports

新版 Claude 账户导出可能先提供 `manifest-*.json`，而不是单一 ZIP。点击侧栏“下载与导入”进入专门的清单页面，选择“导入下载清单”，再逐项点击“打开下载页”。页面在新标签页打开官方地址，使用浏览器中已登录的 Claude 账号。下载完成后，一次选择或拖入所有 ZIP；也可以选择包含清单与 ZIP 的目录。查看器不会自动访问清单中的链接，不会把“打开下载页”标成下载成功；只有分包导入成功才标为已导入。旧版 ZIP、导出文件夹、`memories.json` 和 Design 仍可从原有入口直接导入，无需清单。

New Claude account exports may provide a `manifest-*.json` instead of one ZIP. Open **Download & import** in the sidebar to reach the dedicated checklist page. Choose **Import download manifest**, then **Open download page** for each file. Official URLs open in a new tab using your browser's Claude login. Select or drop the downloaded ZIPs together, or select their directory. The original ZIP and folder entries still accept legacy exports, including `memories.json` and Design, without a manifest. The viewer never fetches manifest links automatically and marks a package imported only after successful processing. Download links can expire within 24 hours or after use; a local clock cannot determine whether a link remains valid.

## 分包与来源 / Packages and sources

- 对话、项目、记忆、作品与账户资料可以乱序追加。使用“打开新档案”替换当前档案；“追加分包”保留已导入内容。另一份清单建立新档案。
- 每个包先完成解析和账户校验，再提交。损坏包和账户不匹配不删除已导入数据，重新选择修复后的 ZIP 可重试。包指纹按完整内容分块计算，不依赖文件名；相同对话 UUID 的不同内容以来源版本保留。
- ZIP 目录和延迟资源保留在 Import Worker，直到换档案、清除或关闭页面。附件仍受现有图片缓存限制。相同文件名在不同包中不共用缓存；无法唯一匹配时显示缺失提示，不猜测图片。
- `light_metadata` 的账户资料和分页登录记录只在本地只读展示，不纳入对话统计。缺包不阻止查看已导入内容。

Conversation, project, memory, artifact and account packages can be added in any order. **Open new archive** replaces the session; **Add packages** appends. Importing another manifest starts a new archive. Parsing/account validation happens before each package commits; failures preserve earlier packages. Content fingerprints detect duplicate ZIPs. Conflicting conversation IDs preserve both sources. Account details and paged login events remain separate from conversation statistics.

## 两种记忆入口 / Two memory entrances

账户分包中的 `memories/<account>.json` 使用 `memory_files`，独立记忆 ZIP 使用 Markdown 目录；旧 `memories.json` 仍支持。主题保留正文、逻辑路径、来源、frontmatter 和可用的更新时间。UUID 优先关联项目，名称仅在唯一匹配时自动关联，否则使用项目选择框手动关联。

同一归属和主题的相同原文合并展示来源，不同原文保留可切换版本。有有效更新时间的版本按时间倒序，无时间版本按导入顺序倒序；缺失时间不会伪造。frontmatter 仅解释常见标量和列表，不执行 YAML 标签；异常头部保留原文。独立记忆没有账户标识，追加操作代表用户选择将它放入当前档案。

Account packages use `memory_files` in `memories/<account>.json`; standalone exports use Markdown directories. Legacy `memories.json` remains supported. UUIDs take precedence over unique project names, with manual association for ambiguous names. Identical body text shares a version; different text stays selectable. Known update times sort newest first, then undated versions use import order. Unsupported frontmatter stays readable as original text.

## 作品和消息字段 / Artifacts and message fields

`frames` 中的 `artifacts/<id>/artifact.json` 提供作品及版本索引，HTML 打开时才解压，使用现有无同源权限的预览沙箱。默认显示活动版本，缺失时提示并选最新可用版本。对话通过工具结果中的明确 Artifact ID 关联；当前版本不代表历史消息当时的版本，查看器不重建缺失的历史状态。

Thinking 的隐藏、截断、cut-off 和摘要按导出字段展示，不推断未导出的正文；`injected_prompt_block` 默认折叠，并明确显示为注入上下文，不参与正文搜索。Markdown 导出保留该上下文，脱敏递归扫描覆盖其 prompt。未知块可展开查看转义后的结构。缺失模型继续显示“未提供”。

Artifacts are indexed separately and version HTML is extracted on demand into the existing sandbox. Tool results link by explicit artifact ID. The active version is not presented as a historical snapshot. Thinking flags report only exported evidence. Injected prompts are folded context rather than ordinary answers; Markdown export and redaction include them. Missing models remain **Not provided**.

## 维护与验证 / Maintenance and verification

`src/export-format.js` contains shared manifest/frontmatter/path parsing and the bounded SHA-256 fallback for non-secure HTTP origins. `src/export-client.js` owns page-local session/checklist state. Data Worker stages package records before atomic append; a committed revision invalidates search/index work and recreates affected Reader, Task and Analytics workers while keeping Import's ZIP registry. No new persistent store or network dependency is introduced.

Synthetic tests cover manifest navigation, source variants, both memory entrances, account separation, corruption recovery, artifact versions and cache invalidation. The existing 10,000-message ZIP test retains bounded acknowledged batches and 4× CPU responsiveness checks. Real local exports are used only for local acceptance and are not committed as fixtures.
