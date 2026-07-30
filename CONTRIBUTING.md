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

## Pull requests / Pull Request 要求

- Keep each PR focused and explain the user-visible result.
- Use a non-empty title and description.
- Describe validation performed and any privacy/security impact.
- Keep `viewer.html` synchronized with Worker sources.
- Add or update synthetic tests for parser and rendering changes.
- Do not commit temporary files, logs, real exports, or generated failure artifacts.
- Do not force-push shared branches. The repository uses squash merges and linear history.
- Resolve review conversations before merge.

PR 应保持单一目标，说明用户可见结果、验证方式及隐私/安全影响。解析或渲染改动应补充合成测试；不要提交临时文件、日志、真实导出或失败产物。仓库使用 squash merge 与线性历史，合并前需要解决审查对话。

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

