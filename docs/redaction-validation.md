# 语境脱敏验证 / Context redaction validation

2026-10-21；合成样例在 `tests/redaction-context.test.mjs`，通过 `npm run test:worker-core` 重现。所有正反例都使用虚构值，没有收录用户档案、下载令牌或本地测试文件。

| 类别 / Category | 应命中 / Positive | 漏检 / Misses | 应保留 / Negative | 误伤 / False positives |
| --- | ---: | ---: | ---: | ---: |
| 姓名 / Names | 3 | 0 | 3 | 0 |
| 地址 / Addresses | 3 | 0 | 3 | 0 |
| 单位 / Organizations | 3 | 0 | 3 | 0 |
| 社交 / Social | 3 | 0 | 3 | 0 |
| 口令 / Passphrases | 3 | 0 | 3 | 0 |
| 联系方式 / Contact | 3 | 0 | 3 | 0 |
| 混淆格式 / Obfuscated formats | 3 | 0 | 3 | 0 |

这是固定小样本的回归结果，不代表现实文本的准确率。另有泛化描述、导师姓名、护照字段、Cohere 字段、全角/零宽字符/拆分号码、短词、Dice/编辑距离双门槛、重复原文、emoji、窗口边界、重叠、超限及取消用例。弱候选默认保留；不凭格式猜测模型、语义或身份关系。

浏览器用例验证四种新增选项组合的预览、Markdown 和 PDF 一致，缓存隔离，超限禁止导出、关闭开关后恢复及 Worker 重建。file/HTTP 两种入口与断网离线包均覆盖新开关。原有 4× CPU 阅读与并发任务性能检查继续运行。

## 本地性能观察 / Local performance observation

Windows 本地 Node，270,000 个 UTF-16 字符的重复中英文及 emoji 正文，连续 7 次同步核心扫描取中位数。旧版取主分支 `92a9c9f`，新版为本 PR；不是浏览器主线程耗时或通用硬件承诺。

| 模式 / Mode | 中位耗时 / Median |
| --- | ---: |
| 旧版默认 / Previous default | 0.84 ms |
| 新版默认 / New default | 1.41 ms |
| 新版＋100 个自定义词近似匹配 / New + 100 custom terms with similarity | 33.72 ms |

单文件从 768,558 增至 787,240 字节（增加 18,682 字节，约 18.2 KiB）。第三方库版本和运行时网络依赖没有变化。Task Worker 按需创建，新扫描分段检查取消，不在主线程执行。候选较密集时可能达到每窗口 4096 次验证上限，此时必须提示未完成并阻止安全导出。

These are small, fixed synthetic regression sets, not a claim of real-world accuracy. Reproduce functional coverage with `npm run test:worker-core`, `npm run test:smoke`, `npm run build:offline` and `npm run test:offline`. The local timing comparison uses seven synchronous scans of 270,000 UTF-16 characters and reports medians; it does not measure browser main-thread blocking. Weak candidates and similarity are opt-in, and incomplete scans fail closed.
