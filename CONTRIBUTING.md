# Contributing to Claude Rescue Reader / 参与贡献

Thank you for helping improve Claude Rescue Reader. Small fixes, parser compatibility work, synthetic fixtures, documentation, accessibility, performance measurements, and privacy improvements are all welcome.

感谢你帮助改进 Claude Rescue Reader。我们欢迎小型修复、解析兼容、合成测试数据、文档、无障碍、性能测量和隐私增强。

## Before you start / 开始之前

- Search existing issues and pull requests before opening a duplicate.
- Use the issue forms for bugs and feature requests.
- For security-sensitive findings, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
- For larger behavior or UI changes, open an issue first so scope and privacy boundaries can be discussed.

- 提交前请先搜索已有 Issue 和 PR。
- Bug 与功能建议请使用仓库提供的 Issue 表单。
- 安全相关问题不要公开提交，请遵循 [SECURITY.md](SECURITY.md)。
- 较大的行为或界面变更建议先开 Issue，确认范围与隐私边界。

## Privacy rules / 隐私规则

This project processes extremely sensitive exports. Public contributions must never contain:

- real `conversations.json`, `memories.json`, `users.json`, or project exports;
- real conversation titles, summaries, messages, screenshots, account identifiers, or attachment paths;
- personal absolute paths, API keys, bearer tokens, cookies, private keys, or credentials;
- benchmark reports derived from a real user's archive.

本项目处理高度敏感的导出数据。公开贡献绝不能包含：

- 真实的 `conversations.json`、`memories.json`、`users.json` 或项目导出；
- 真实对话标题、摘要、消息、截图、账号标识或附件路径；
- 个人绝对路径、API Key、Bearer Token、Cookie、私钥或凭据；
- 从真实用户档案生成的公开基准报告。

Use clearly fictional names and the fixtures under `tests/fixtures/`. If a bug can only be reproduced from a real export, reduce it locally to the smallest synthetic structure before sharing it.

请使用明确虚构的名称和 `tests/fixtures/` 下的测试数据。如果问题只能由真实导出触发，请先在本地缩减成最小合成结构，再进行公开分享。

## Development setup / 开发环境

Requirements:

- Node.js 22 or later;
- PowerShell 7 for `scripts/build-single-file.ps1`;
- Chromium for browser tests.

```bash
npm ci
npx playwright install chromium
```

The distributable application is `viewer.html`. Maintainable Worker sources live in `src/data-worker.js` and `src/analytics-worker.js`. After changing either Worker, rebuild the embedded single file:

发布应用是 `viewer.html`。Worker 可维护源码位于 `src/data-worker.js` 和 `src/analytics-worker.js`。修改 Worker 后必须重新生成内联单文件：

```powershell
./scripts/build-single-file.ps1
```

## Required checks / 必需检查

Run checks appropriate to the change. Before requesting review, the following baseline should pass:

```bash
npm run validate
npm run docs
npm run privacy
npm run policy
npm run test:smoke -- --reporter=line
```

For offline-distribution changes:

```bash
npm run build:offline
npm run test:offline -- --reporter=line
```

For README demo or benchmark changes:

```bash
npm run build:demo
npm run capture:readme
npm run capture:demo-gif
npm run benchmark:readme
```

FFmpeg is required only for GIF capture. Screenshot scripts may use `CHROME_PATH`; on Windows they also detect the normal system Chrome location.

## Automated review / 自动审核

Pull requests are reviewed by both [G.H.O.S.T Review](https://github.com/Kisara-GHOST-Review/G.H.O.S.T-Review) and Sourcery. These checks complement the repository's validation, browser, privacy, policy, and documentation CI; a bot approval does not replace the required tests.

G.H.O.S.T performs repository-aware code, security, and conflict review. Its `action_required` conclusion blocks merging. Address valid findings in the same PR, push the fix, and resolve the associated review conversation only after the concern has been handled. If a finding appears to be a false positive or its trade-off needs discussion, reply in the original thread so the reasoning remains reviewable instead of silently dismissing it.

Common G.H.O.S.T commands:

| Need | Command |
| --- | --- |
| Run a fresh full review | `@ghost-review review` |
| Explain a finding | `@ghost-review explain` |
| Suggest a minimal fix | `@ghost-review fix` |
| Compare alternative approaches | `@ghost-review alternative` |
| Reconsider the importance or a possible false positive | `@ghost-review why` |
| Continue discussing edge cases | `@ghost-review discuss` |
| Show the available commands | `@ghost-review help` |

External contributors can use the read-only discussion commands. Commands that create Issues, change PR state, resolve threads, or write to a branch are restricted to repository collaborators. Maintainers may additionally request security or conflict analysis, but contributors are not expected to operate those workflows.

Sourcery provides an independent review signal. Treat actionable Sourcery findings the same way: either fix them or leave a concise technical explanation in the relevant thread. Before merge, all required checks must pass, all actionable findings must be addressed, and all review conversations must be resolved.

PR 会同时接受 [G.H.O.S.T Review](https://github.com/Kisara-GHOST-Review/G.H.O.S.T-Review) 与 Sourcery 审核。它们是静态校验、浏览器测试、隐私检查、PR 策略和文档检查的补充，机器人通过不代表可以跳过必需测试。

G.H.O.S.T 会结合仓库上下文检查代码、安全问题与冲突；`action_required` 结论会阻止合并。有效问题应在同一个 PR 中修复并重新推送，确认问题处理完成后再解决对应的审查对话。若判断为误报或需要讨论取舍，请在原审查线程中使用 `@ghost-review why`、`explain` 或 `discuss` 留下可追踪的依据，不要直接忽略。外部贡献者可使用只读讨论命令；创建 Issue、修改 PR 状态、解决线程或写入分支等操作仅限仓库协作者。

Sourcery 提供独立的第二份审核信号。对于可执行的问题，应修复或在对应线程中给出简洁的技术说明。合并前必须满足：全部必需检查通过、有效问题已处理、所有审查对话已解决。

## Pull requests / Pull Request 要求

- Keep each PR focused and explain the user-visible result.
- Use a non-empty title and description.
- Describe validation performed and any privacy/security impact.
- Keep `viewer.html` synchronized with Worker sources.
- Add or update synthetic tests for parser and rendering changes.
- Do not commit temporary files, logs, real exports, or generated failure artifacts.
- Do not force-push shared branches. The repository uses squash merges and linear history.
- Resolve review conversations and obtain passing G.H.O.S.T Review and Sourcery checks before merge.

PR 应保持单一目标，说明用户可见结果、验证方式及隐私/安全影响。解析或渲染改动应补充合成测试；不要提交临时文件、日志、真实导出或失败产物。仓库使用 squash merge 与线性历史；合并前需要通过 G.H.O.S.T Review 与 Sourcery，并解决全部审查对话。

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
