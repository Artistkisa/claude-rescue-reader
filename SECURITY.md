# Security Policy / 安全策略

Claude Rescue Reader is a local-first viewer for sensitive Claude.ai exports. Security reports are especially important when they involve data leaving the browser, unsafe rendering, incomplete redaction, or exposure of local information.

Claude Rescue Reader 是处理敏感 Claude.ai 导出的本地优先查看器。任何可能导致数据离开浏览器、不安全渲染、脱敏绕过或本地信息泄露的问题，都属于重要安全问题。

## Supported versions / 支持版本

| Version | Supported |
|---|:---:|
| Latest GitHub Release | ✅ |
| Current `main` | ✅ |
| Older releases | ❌ Please reproduce against the latest release first |

| 版本 | 支持状态 |
|---|:---:|
| 最新 GitHub Release | ✅ |
| 当前 `main` | ✅ |
| 更早版本 | ❌ 请先在最新版复现 |

## Reporting a vulnerability / 报告漏洞

Please do **not** open a public issue for an unpatched vulnerability. Use GitHub's **Report a vulnerability** flow in the repository Security tab to create a private vulnerability report.

未修复漏洞请**不要提交公开 Issue**。请在仓库 Security 页面使用 **Report a vulnerability** 创建私密报告。

Include, when possible:

- affected version or commit;
- browser and operating system;
- a concise impact statement;
- minimal reproduction steps using synthetic data;
- expected and actual behavior;
- a proposed mitigation, if known.

请尽量提供：受影响版本或提交、浏览器和操作系统、影响说明、使用合成数据的最小复现步骤、预期与实际行为，以及已知的缓解建议。

Never attach a real Claude export, real conversation screenshot, credential, token, private key, or personal absolute path. If the original finding came from private data, reproduce the structure with fictional values before submitting it.

不要附加真实 Claude 导出、真实对话截图、凭据、Token、私钥或个人绝对路径。如果问题来源于私有数据，请先用虚构值重建结构。

## Security scope / 安全范围

Examples that should be reported privately:

- script execution or sandbox escape through Markdown, Artifact, Design, SVG, Mermaid, or attachment rendering;
- unexpected network transmission of imported content;
- access to files the user did not select;
- ZIP path traversal or unsafe archive handling;
- safe-export or privacy-scanner bypasses that expose sensitive values;
- leakage of local paths, tool parameters, internal metadata, or credentials;
- dependency vulnerabilities that are reachable in the shipped viewer or offline bundle.

以下问题应私密报告：通过 Markdown、Artifact、Design、SVG、Mermaid 或附件渲染执行脚本或逃逸沙箱；导入内容被意外联网发送；读取用户未选择的文件；ZIP 路径穿越；安全导出或隐私扫描绕过；泄露本地路径、工具参数、内部元数据或凭据；可在发行版中实际触发的依赖漏洞。

Ordinary parsing errors, display bugs, unsupported export shapes, and false-positive redaction matches can use the public bug form if the reproduction is fully synthetic and contains no security-sensitive detail.

普通解析错误、显示问题、尚未支持的导出结构和脱敏误报，可以在完全合成且不含安全细节时使用公开 Bug 表单。

## Response expectations / 响应预期

The maintainer aims to acknowledge a complete report within 7 days and provide an initial assessment within 14 days. Complex fixes may take longer. Please allow a reasonable remediation period before public disclosure.

维护者目标是在 7 天内确认完整报告，并在 14 天内给出初步评估。复杂修复可能需要更长时间；公开披露前请预留合理修复窗口。

