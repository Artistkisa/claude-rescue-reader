# 脱敏导出 / Redacted exports

在对话的导出菜单选择“安全导出 Markdown”或“安全导出 PDF”。扫描、替换与文件生成均在按需创建的 Task Worker 中执行；原始档案不被修改。项目普通导出仍是普通导出，不自动套用当前对话的设置。

## 样式与规则

- **标准脱敏**：按类型替换，例如 `[REDACTED:邮箱]`。
- **SCP 档案模式**：使用黑条；PDF 保留现有档案水印。
- **一致化名**：相同原文在一份导出中使用相同的 `[ID_1]` 等代号。映射不持久化，也不跨导出共享；代号不是不可逆的匿名化保证。
- **强力隐私过滤**：额外覆盖姓名、组织、住址、证件、社交链接、IPv4/IPv6、MAC 地址和银行卡号等宽泛模式，可能误伤。未加标签的银行卡数字须通过 Luhn 校验；普通长整数、日期和时间不直接作为银行卡或 IPv6 删除。
- **自定义敏感词**：每行一项，按原文精确匹配、区分大小写，不解释正则。最多 100 项、每项 256 字符、总计 8192 字符。只在当前弹窗及本次任务内使用，不写入浏览器存储。输入变化后防抖重新扫描，扫描完成前不能确认导出。

基础规则覆盖邮箱、中国及带国际前缀的手机号、本地路径、多种 API 密钥、JWT、私钥（包括未闭合的私钥段）、Basic/Bearer 认证、Cookie、Webhook、敏感字段、连接串凭据、签名查询参数及 Claude 导出下载令牌。标准模式保留没有敏感参数的普通文档链接。相互重叠的命中合并后替换，不再次扫描生成的遮罩。

预览只返回分类计数及最多 100 个完全遮罩的样例，不显示原值首尾；动态字段名不会出现在预览路径。被整体移除的工具元数据会单独计数，其中识别到的敏感内容也可计入相应分类。标题、Thinking、摘要、注入上下文、未知内容块及结构化工具结果都参与扫描。安全 Markdown 文件名和 PDF 标题使用脱敏后的标题。

规则无法识别所有上下文隐私，也不执行模型推断、OCR 或任意编码解密。安全 PDF 不重新挂载阅读缓存中的原始附件图片；内嵌二进制数据被移除。正文中的姓名、别名、业务代号等应按需要加入自定义词，并在分享前检查导出结果。

## English

Choose **Safe export** or **Safe PDF** from a conversation's export menu. The lazy Task Worker scans and generates the export without changing the source archive. Ordinary project exports remain ordinary exports and do not inherit conversation redaction settings.

Standard replacements label each type; SCP uses black bars and the existing PDF watermark. **Consistent aliases** reuse an alias for identical text within one export. The mapping is temporary and is not an anonymity guarantee. The optional aggressive filter covers broader personal information and may over-redact.

**Custom sensitive text** accepts exact, case-sensitive literals, one per line (100 entries, 256 characters per entry, 8192 total). It never interprets regexes or persists settings. Changes debounce the preview; confirmation stays disabled until the current scan succeeds.

Coverage includes provider credentials, JWT/private keys, Basic/Bearer authentication, cookies, webhooks, sensitive structured fields, connection credentials, signed URL parameters, Claude download tokens, email, international phone prefixes and local paths. Aggressive rules additionally cover personal context, IPv4/IPv6, MAC addresses and Luhn-valid unlabelled card numbers. Overlapping spans are replaced once against the original text.

Previews return counts and at most 100 fully masked findings. Dynamic keys are omitted from finding paths. Safe filenames and PDF titles use the redacted title. Safe PDFs omit original attachment images; embedded binary data is removed rather than OCR-scanned. Review the output before sharing, and supply custom terms for context-specific identities that format rules cannot infer.
