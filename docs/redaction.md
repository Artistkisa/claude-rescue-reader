# 脱敏导出 / Redacted exports

在对话的导出菜单选择“安全导出 Markdown”或“安全导出 PDF”。扫描、替换与文件生成均在按需创建的 Task Worker 中执行；原始档案不被修改。项目普通导出仍是普通导出，不自动套用当前对话的设置。

## 样式与规则

- **标准脱敏**：按类型替换，例如 `[REDACTED:邮箱]`。
- **SCP 档案模式**：使用黑条；PDF 保留现有档案水印。
- **一致化名**：相同原文在一份导出中使用相同的 `[ID_1]` 等代号。映射不持久化，也不跨导出共享；代号不是不可逆的匿名化保证。
- **强力隐私过滤**：额外覆盖姓名、组织、住址、证件、社交链接、IPv4/IPv6、MAC 地址和银行卡号等宽泛模式，可能误伤。未加标签的银行卡数字须通过 Luhn 校验；普通长整数、日期和时间不直接作为银行卡或 IPv6 删除。
- **自定义敏感词**：每行一项，按原文精确匹配、区分大小写，不解释正则。最多 100 项、每项 256 字符、总计 8192 字符。只在当前弹窗及本次任务内使用，不写入浏览器存储。输入变化后防抖重新扫描，扫描完成前不能确认导出。

基础规则覆盖邮箱、中国及带国际前缀的手机号、本地路径、多种 API 密钥、JWT、私钥（包括未闭合的私钥段）、Basic/Bearer 认证、Cookie、Webhook、敏感字段、连接串凭据、签名查询参数及 Claude 导出下载令牌。标准模式保留没有敏感参数的普通文档链接。相互重叠的命中合并后替换，不再次扫描生成的遮罩。

## 语境与近似写法

同一句内的有限上下文（触发词前后最多各 160 字符）结合类别结构识别中英文姓名、联系方式、地址、学校/单位、社交账号和口令表达。明确的归属与有效结构自动遮罩；较弱的字段表达单独统计。**同时遮罩语境候选**默认关闭，独立于强力过滤；预览区分将替换数量与未纳入的候选数量，并显示类别、证据等级、匹配方式和规则理由。教学说明、疑问及泛化描述可排除，但不会豁免已有的凭据格式规则。

**查找近似写法**默认关闭，仅参照用户输入的自定义词。开启后兼容全角、ASCII 大小写、零宽字符及常见分隔符，并通过原文偏移替换原始区间。归一化后不足 4 字符只做原文精确匹配；4–7 字符只增加归一化等值匹配；8–128 字符要求二元组 Dice ≥ 0.85 且编辑距离 ≤ 1（至少 16 字符时 ≤ 2）；更长词只做精确及归一化等值匹配。不推断拼音、谐音、机构简称或语义同义关系，不跨换行，匹配原文跨度最多 512 字符。近似但不同的原文分别分配化名。

新增扫描使用最多 32 KiB 的重叠窗口，按 Worker 的约 8 ms 预算让出执行。每窗口最多验证 4096 个去重近似候选；超限会显示“近似扫描未完成”并禁止确认和生成安全导出。关闭近似开关后可重新扫描。原有跨段私钥规则仍完整扫描。两项选项和全部自定义词均参与四组摘要缓存的区分，不增加持久化存储。

预览只返回分类计数及最多 100 个完全遮罩的样例，不显示原值首尾；动态字段名不会出现在预览路径。被整体移除的工具元数据会单独计数，其中识别到的敏感内容也可计入相应分类。标题、Thinking、摘要、注入上下文、未知内容块及结构化工具结果都参与扫描。安全 Markdown 文件名和 PDF 标题使用脱敏后的标题。

规则无法识别所有上下文隐私，也不执行模型推断、OCR 或任意编码解密。安全 PDF 不重新挂载阅读缓存中的原始附件图片；内嵌二进制数据被移除。正文中的姓名、别名、业务代号等应按需要加入自定义词，并在分享前检查导出结果。

## English

Choose **Safe export** or **Safe PDF** from a conversation's export menu. The lazy Task Worker scans and generates the export without changing the source archive. Ordinary project exports remain ordinary exports and do not inherit conversation redaction settings.

Standard replacements label each type; SCP uses black bars and the existing PDF watermark. **Consistent aliases** reuse an alias for identical text within one export. The mapping is temporary and is not an anonymity guarantee. The optional aggressive filter covers broader personal information and may over-redact.

**Custom sensitive text** accepts exact, case-sensitive literals, one per line (100 entries, 256 characters per entry, 8192 total). It never interprets regexes or persists settings. Changes debounce the preview; confirmation stays disabled until the current scan succeeds.

Coverage includes provider credentials, JWT/private keys, Basic/Bearer authentication, cookies, webhooks, sensitive structured fields, connection credentials, signed URL parameters, Claude download tokens, email, international phone prefixes and local paths. Aggressive rules additionally cover personal context, IPv4/IPv6, MAC addresses and Luhn-valid unlabelled card numbers. Overlapping spans are replaced once against the original text.

**Also redact context candidates** is off by default and independent of the aggressive filter. Bounded sentence context and category structure identify names, contact information, addresses, organizations, social handles and passphrases. Definite matches are masked automatically; weaker candidates are counted separately. Questions and instructional/generic descriptions can be excluded without exempting existing credential rules. Previews show evidence, matching method and reason without exposing source context.

**Find similar spellings**, also off by default, only uses your custom terms. It supports width/case, zero-width and separator variations with original-source offset mapping. Normalized terms shorter than 4 characters stay exact; 4–7 allow normalized equality; 8–128 require bigram Dice ≥ .85 and edit distance ≤ 1 (≤ 2 from length 16); longer terms allow exact/normalized equality only. Matches cannot cross lines or exceed 512 source characters. No phonetic, abbreviation or semantic inference is performed, and different original values retain distinct aliases.

New scans use overlapping windows up to 32 KiB and yield under the Worker's approximately 8 ms budget. More than 4096 distinct candidate verifications in a window marks the scan incomplete and blocks safe export; turn similarity off and rescan to continue. Multiline private-key matching remains intact. Both options are included in the four-entry summary cache and never persisted.

Previews return counts and at most 100 fully masked findings. Dynamic keys are omitted from finding paths. Safe filenames and PDF titles use the redacted title. Safe PDFs omit original attachment images; embedded binary data is removed rather than OCR-scanned. Review the output before sharing, and supply custom terms for context-specific identities that format rules cannot infer.
