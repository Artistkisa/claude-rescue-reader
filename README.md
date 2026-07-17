# Claude Export History Viewer

> Hello,
>
> An internal investigation of suspicious signals associated with your account indicates a violation of our Usage Policy. As a result, we have revoked your access to Claude.
>
> To appeal our decision, log in to claude.ai with this account and you'll be taken to the appeals page.
>
> Regards,
> Anthropic's Safeguards Team

好，所以你的账号没了，但对话还在。这个工具就是为了让你能看到它们。

**所有数据均在本地处理，不会上传至任何服务器。**

---

## 为什么需要这个工具

Claude 的导出文件是这样的：

```json
[{"uuid": "3f8a1c2d-e947-4b6f-9d3e-72a5b8c1f0e4", "name": "\u67d0\u9879\u76ee\u7684\u6280\u672f\u8c03\u7814\u8bb0\u5f55", "summary": "**Conversation Overview**\n\nThis conversation focused entirely on technical research...", "chat_messages": [{"uuid":"01a2b3c4-d5e6-7f8a-9b0c-d1e2f3a4b5c6", "text":"...", "content": [{"start_timestamp":"2024-11-08T09:23:14.882341Z","stop_timestamp":"2024-11-08T09:23:17.103Z","flags":null,"type":"thinking","thinking":"Let me analyze the user's request..."}, {"type":"text","text":"...实际回答内容...","citations":[]}], "sender":"assistant", "parent_message_uuid":"00000000-0000-4000-8000-000000000000", ...}]}]
```

150MB，一行，无换行，中文全部 Unicode 转义（`\u67d0\u9879\u76ee` = 某项目），思考过程和正文混在同一个 `content` 数组里，对话树靠 `parent_message_uuid` 链接，项目文档是另一堆 JSON 文件，记忆是 Markdown 塞在 JSON 字符串里。

**直接用文本编辑器打开的结果**：VS Code 会弹出这个提示——

> **SHOW MORE (150MB)**
> Rendering paused for long line for performance reasons.
> This can be configured via `editor.stopRenderingLineAfter`.

然后拒绝渲染剩余内容。一行文字，150MB，把编辑器本身干沉默了。

这个工具把它变成可以正常阅读的对话界面。

## 使用场景

- 🔒 账号被封后，通过官方导出功能抢救历史数据
- 📦 整理和回顾自己的 Claude 对话记录
- 🔍 搜索、导出特定对话内容

## 快速开始

### 第一步：导出 Claude 数据

账号被封后，登录会直接跳转到 [claude.ai/restricted](https://claude.ai/restricted)。页面上有个按钮：

> **Export your data**
> We'll package up your conversations, projects, and settings for download. This might take some time to complete.

点它，等邮件，下载，解压。就这么简单——至少导出这件事他们做得还算人道。

<details>
<summary>顺便，官方 FAQ 的措辞也挺值得一读（点击展开）</summary>

**Q: Why was my account put on hold?**
> We put your account on hold because of unusual activity. We can't share the specifics—that would help bad actors get around the same checks.

翻译：我们不告诉你为什么封你，因为告诉你的话坏人就知道怎么绕过去了。至于你是不是坏人，那是另一回事。

**Q: How long will the review take?**
> Reviews take about 10 days.

十天。祝你在这十天里找到一个能聊天的替代品，虽然你大概找不到。

**Q: Will my billing be affected?**
> We cancelled your subscription and refunded your most recent payment in full.

这个确实做得不错，给退钱了。

**Q: What if I think this is a mistake?**
> Request a review and our team will look over your account. The more specific you are about what you were working on, the better.

所以你需要向 Anthropic 解释你在用 Claude 干什么，才能让他们判断你是不是坏人。希望你的世界观写作、代码调试或者闲聊记录足够自证清白。

</details>

导出文件夹结构如下：

```
claude-export/
├── conversations.json   # 所有对话（含完整消息）
├── users.json           # 账号信息
├── memories.json        # Claude 的记忆（全局 + 项目级）
└── projects/
    └── <uuid>.json      # 各项目文档
```

### 第二步：打开查看器

1. 下载 [`viewer.html`](viewer.html)，直接用浏览器打开（推荐 Chrome / Edge / Firefox）
2. 点击「📂 选择导出文件夹」，选择解压后的整个文件夹
3. 等待加载完成（大文件约需数秒，150MB 约 3–5 秒）

> **注意**：需要网络连接以加载渲染依赖（来自 jsDelivr CDN）。离线使用请参考下方[离线模式](#离线模式)说明。

## 功能介绍

### 对话列表
- 按更新时间 / 创建时间 / 消息数排序
- 搜索对话标题和摘要，勾选「全文搜索」可搜索消息正文
- ↑ / ↓ 或 J / K 键盘导航

### 消息渲染
- Markdown 完整渲染（标题、表格、代码块、引用等）
- 代码块带语言标签 + 一键复制按钮
- 💭 **思考过程**（Thinking 块）可折叠展开
- ⚙ **工具调用** 和结果可折叠展开
- 支持附件、图片占位符、网页链接、搜索引用等内容类型

### 项目
- 查看项目文档（Markdown 渲染，可折叠）
- 三层推断关联对话：文件路径匹配 → 知识搜索词匹配 → 关键词模糊匹配
- **注**：Claude 官方导出不含项目-对话归属关系，关联结果仅供参考

### 记忆
- 全局对话记忆按 4 个分区（工作/个人/重点/历史）展示
- 各项目记忆按 6 个标准分区展示，可折叠

### 其他
- 🌙 / ☀️ 明暗主题切换，偏好自动保存
- ⬇ **导出**：将当前对话导出为 Markdown 文件（Ctrl/Cmd+E）
- 导出文件包含摘要、完整消息流、思考过程（`<details>` 折叠）

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| ↑ / K  | 上一条对话 |
| ↓ / J  | 下一条对话 |
| Ctrl+E | 导出当前对话为 Markdown |

## 离线模式

如需在无网络环境下使用，在 `viewer.html` 同目录下放置以下文件并修改引用路径：

```
marked.min.js          ← https://cdn.jsdelivr.net/npm/marked/marked.min.js
highlight.min.js       ← https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/lib/highlight.min.js
github.min.css         ← https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github.min.css
github-dark.min.css    ← https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github-dark.min.css
```

## 隐私说明

- ✅ 纯本地运行，无后端，无埋点，无任何网络请求（CDN 除外）
- ✅ 数据不会被上传或分享
- ✅ 浏览器关闭后，除主题偏好外不保留任何数据（`localStorage` 仅存 `cv-theme`）
- ⚠️ 导出的 JSON 文件包含您的完整对话历史，请妥善保管

## 已知限制

- 导出文件不含图片二进制内容，仅显示占位符
- 对话树的分支结构取最长路径展示（与 claude.ai 网页端行为一致）
- 项目与对话的归属关系为推断结果，非官方数据，可能存在遗漏或误判
- 超大对话（本工具测试数据：300+ 条对话 / 150MB+ / 单条最长 600+ 条消息）在低内存设备上可能加载缓慢
- 账号无项目或无记忆时，对应 Tab 会自动隐藏，不显示错误

## 数据结构说明

本工具解析的 Claude 导出格式（截至 2026 年）：

| 文件 | 内容 |
|------|------|
| `conversations.json` | 全部对话，含完整消息树、`content` 块（text/thinking/tool_use/tool_result）、附件 |
| `memories.json` | 全局记忆 + 项目记忆，Markdown 格式，按 section 分区 |
| `projects/<uuid>.json` | 项目元数据 + docs 文档内容 |

**注**：Claude 官方导出不包含「对话属于哪个项目」的字段。本工具通过三层推断补全此关联，详见项目页说明。

## 技术栈

- 纯原生 HTML + CSS + JavaScript，无构建步骤，无框架依赖
- [marked.js](https://marked.js.org/) — Markdown 渲染
- [highlight.js](https://highlightjs.org/) — 代码语法高亮

## Changelog

**v1.1** *(2026-07-17)*
- **修复：对话消息数量不对**（如显示 3 条，实际有 7 条）
  根本原因：对话树遍历时固定取"最后一个子节点"，在有分支时会走进空消息的死胡同。改为递归选择**最长路径**，并在等长时优先选有内容的分支。
- **修复：部分消息显示为"(空消息)"**
  Claude 导出的 `files` 数组中，`file_name` 字段有时为空字符串。现在回退到 `file_type` → `file_uuid` 兜底，确保附件气泡有内容显示，而不是空白或占位符。
- **修复：代码块显示 `[object Object]`**
  marked.js v5+ 将 `renderer.code` 的参数从 `(code, lang)` 改为传 token 对象，`String(code)` 因此变成 `[object Object]`。现在兼容新旧两种签名。
- **修复：点击对话无反应**
  事件绑定时 `forEach(el => ...)` 的回调参数 `el` 遮蔽了外层同名变量，导致 `el.dataset.convUuid` 读到容器本身（无此属性）。将回调参数改名为 `item` 解决。
- **修复："最早"排序与"最新"排序结果几乎一致**
  "最早"误用了降序（`b - a`），改为升序（`a - b`），现在最老的对话排最前。
- 新增全文搜索、排序按钮、统计面板、Markdown 导出、键盘导航
- 新增暗色/亮色主题适配（含思考块、工具调用块等所有颜色变量化）
- 新增移动端响应式布局（≤640px 侧边栏转顶部）
- 项目关联对话改为三层推断：文件路径精确匹配 → PKS 查询词匹配 → 关键词模糊匹配

**v1.0** *(2026-07-16)*
- 初始版本：加载 Claude 导出文件夹，渲染对话列表与消息内容

## License

MIT
