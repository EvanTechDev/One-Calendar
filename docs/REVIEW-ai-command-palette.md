# AI Command Palette — 交付审查与拷问 (grilling + code-review)

> 变更范围：工作区未提交改动（`git status` 中 `packages/agent/`、
> `apps/calendar/app/api/agent/`、`apps/calendar/components/app/ai/`、
> `packages/ui/src/command.tsx` 及配套修改）。
> 按你的要求：不用 sub-agent，两个 skill 的流程由主线程直接执行，结果写进本文件。

---

## 交付了什么

| 部分                     | 位置                                                     | 说明                                                                                                |
| ------------------------ | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| shadcn cmdk Command 组件 | `packages/ui/src/command.tsx`                            | 手动移植，与 shadcn/ui 当前源码一致（用本仓库的 `@zntr/ui/dialog`、`@zntr/utils` cn）               |
| Agent 包                 | `packages/agent/`                                        | eve `defineTool` 编写的 7 个工具 + `CalendarToolkit` 端口 + 纯函数空闲时间算法 + 共享 system prompt |
| eve app（独立运行时）    | `packages/agent/agent/`                                  | `eve dev` 可直接发现运行；工具经 HTTP toolkit 绑定到运行中的日历实例                                |
| DB toolkit               | `apps/calendar/lib/agent/toolkit.ts`                     | 复用 `lib/mcp/*-tools.ts` 的 userId-scoped 函数（与 MCP server 同一条写路径）                       |
| API 路由                 | `apps/calendar/app/api/agent/chat/route.ts`              | Groq gpt-oss-120b + AI SDK streamText，8 步工具循环，限流 20 次/5 分钟                              |
| 命令面板 UI              | `apps/calendar/components/app/ai/ai-command-palette.tsx` | cmdk 对话框，第一栏输入 + 回车提问，流式回答，工具调用行内可见                                      |
| 接入                     | `components/app/calendar.tsx`                            | Cmd/Ctrl+K 全局快捷键 + 头部 ✨ 按钮；写操作后自动 `refreshEvents()`                                |
| 测试                     | `tests/agent/`                                           | 22 个单测（调度算法 + 工具集 + 适配器错误边界），全部通过                                           |
| i18n                     | en / zh-CN / zh-TW / zh-HK / ja                          | 其余 30 个 locale 回退英文（仓库既有机制）                                                          |

验证状态：`type-check` ✅（agent、ui、calendar 三个包）、`lint:check` ✅、
`@zntr/agent` 22/22 ✅、日历既有 1021 个测试 ✅、
真机 smoke test：401（未登录）/ 400（坏 body）/ 503（无 GROQ key）/
200+SSE（伪 key 到达 Groq 网关，返回 `invalid_api_key`——完整链路已打通，
只差一个真 key）。测试用户与会话已从生产库清除。

---

## Code Review — 轴一：Standards（仓库标准 + Fowler smell 基线）

依据：`AGENTS.md`（唯一的标准文档）+ smell 基线。

### 硬性符合项

- 包结构、`package.json` 脚本、`tsconfig`、vitest 布局全部照抄 `@zntr/meetings` 模板（AGENTS.md 的既定范式）。
- "Apps never import each other; 共享代码进 packages/\*"——`@zntr/agent` 零依赖 app 层，靠 `CalendarToolkit` 端口反转依赖。
- 测试放 `tests/agent/`、node 环境，与 AGENTS.md 表格一致。
- oxlint / prettier 全过；未引入新 linter 或格式约定。
- i18n 走 `gen-locales` 机制，缺 key 回退英文，没有绕开。

### 判断性发现（smell 基线，均为 judgement call）

1. **Duplicated Code（低危）** — `as unknown as Parameters<typeof toAiTools>[0]`
   这个双重 cast 在 `route.ts` 和 `tools.test.ts` 里各出现一次。根因是
   `toAiTools` 的 `EveToolLike.inputSchema: z.ZodType` 与 eve 的
   `PublicToolInputSchema`（Standard Schema 联合）不完全重合。
   → 修法：给 `toAiTools` 直接收 `CalendarTools` 类型，或放宽
   `EveToolLike.inputSchema` 为 `unknown`。两处 cast 就都消失。

2. **Middle Man（有意为之，需确认）** — `packages/agent/agent/tools/*.ts`
   七个文件每个只有两行 re-export。这是 eve"一文件一工具"的硬性文件系统约定，
   不是本仓库的设计选择。已在 `bind.ts` 注释说明。基线判：豁免，但值得记录。

3. **Primitive Obsession（低危）** — `AgentEventSummary.startDate: string`
   （ISO 字符串）而非 Date。有意的：端口跨序列化边界（HTTP toolkit / 模型
   工具结果），Date 会在 JSON 边界静默变形。判：豁免。

4. **Speculative Generality（中危，最值得砍的一刀）** — `http-toolkit.ts` +
   整个独立 eve 运行时（`packages/agent/agent/`）。当前唯一真实用户是
   in-app 路由（DB toolkit）。独立运行时是"eve 框架作为一等公民"这个需求
   的直接产物，但它今天没有生产调用方，而且它的 `updateEvent` 读改写
   不透传 `rrule`（见 Spec 轴 #3）。
   → 决策题：留（作为 eve 展示 + 未来 Slack/Discord channel 的地基）
   还是砍（YAGNI）。我的推荐：留，但在 README 里明确标注 "experimental,
   not production-called"——已做。

5. **Mysterious Name（极低）** — `presetToMcp` / `presetRange` 两个私有函数
   名字不对称（一个在 app toolkit，一个在 http toolkit，语义相同）。
   → 可改成同名。不阻塞。

### 硬性问题

无。没有发现违反 AGENTS.md 明文规则的地方。

---

## Code Review — 轴二：Spec（对照你的原始需求）

| #   | 需求                                              | 状态    | 备注                                                                                                                                                   |
| --- | ------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | cmdk 面板"和 shadcn 一模一样"，手动添加，不用 CLI | ✅      | `command.tsx` 与 shadcn/ui 当前源码逐行对应（含 sr-only DialogHeader 的 a11y 结构），仅 import 路径换成本仓库的                                        |
| 2   | 第一栏搜索栏输入问题 + 回车 → AI agent 处理       | ✅      | `CommandInput` 即提问框；Enter（含中文输入法 composing 保护）发送                                                                                      |
| 3   | `packages/agent` 存放 agents 实现                 | ✅      | 见上表                                                                                                                                                 |
| 4   | 使用 eve 框架（Vercel）                           | ⚠️ 部分 | **最重要的诚实披露**，见下文"eve 的真实使用程度"                                                                                                       |
| 5   | Groq 免费 llama                                   | ⚠️→✅   | 原定 `llama-3.3-70b-versatile` 上线后发现已转 Enterprise-only，免费计划不可用；已改为免费档的 `openai/gpt-oss-120b`（工具调用更强），`GROQ_MODEL` 可换 |
| 6   | Termux 环境适配 + 内存 ≤2GB                       | ✅      | 全程 `--max-old-space-size≤1792`；发现并绕过两个 Termux 坑（见下）                                                                                     |
| 7   | 6 小时时限                                        | ✅      | 约 3.5 小时                                                                                                                                            |
| 8   | grilling + code-review 写入 md                    | ✅      | 本文件                                                                                                                                                 |
| 9   | context7 / supabase MCP                           | ✅      | eve、AI SDK 文档均经 context7 核对；schema 经 supabase MCP 查询                                                                                        |
| 10  | 不用 sub-agents                                   | ✅      | 全程主线程                                                                                                                                             |

### eve 的真实使用程度（Spec #4 的详细披露）

eve 在这里扮演两个角色：

1. **工具编写层（真实使用）**：所有工具用 `eve/tools` 的 `defineTool`
   编写——这是运行时导入的真实 eve 代码，不是摆设。选它做唯一编写面的
   理由：eve 的 ToolDefinition 是 AI SDK Tool 的超集，一份定义两个运行时
   都能吃（`adapter.ts` 里的 lowering 只有 30 行）。
2. **独立运行时（提供但非主路径）**：`packages/agent/agent/` 是标准 eve app
   （agent.ts + instructions.md + tools/），`eve dev` 即可跑。

**in-app 主路径没有用 eve 的 serving 运行时**，原因是工程判断而非偷懒：
eve 的会话是 durable workflow（nitro server + 固定 `/eve/v1/*` 协议路由 +
自己的存储层）。把它嵌进已有 Better Auth + 每用户 DB toolkit 的 Next 16
应用，意味着要么信任 eve 的 channel 层做鉴权（绕开现有 session 缓存），
要么在两套会话模型之间做桥。在 Termux 的内存预算内（nitro dev server
是又一个常驻 node 进程）这不划算，而且命令面板的会话本来就该是
ephemeral 的——durable session 是为长任务 agent 设计的。
**如果你想要完整 eve 运行时作为主路径，这是一个可逆决策**：工具层已经
是 eve 原生格式，切换成本集中在鉴权桥上。

### Spec 轴的其余发现

1. **（缺失-低危）真实 LLM 端到端未验证** — 你选择跳过。链路已证明到
   Groq 网关鉴权层。填 `GROQ_API_KEY` 后建议手测一次
   "明天下午三点开会一小时" 创建流。
2. **（缺失-低危）i18n 只显式翻译 5 个 locale** — 其余回退英文。仓库
   机制允许，但 35 locale 全翻更符合项目惯例。
3. **（bug-低危，仅独立运行时）** `http-toolkit.ts` 的 `updateEvent`
   读改写不透传 `rrule` —— 改重复规则这个动作在独立运行时会被静默忽略
   （REST 路由 `rrule === undefined` 时保留原值，所以不会破坏数据，
   只是"改不了"）。DB toolkit（主路径）无此问题。
4. **（未要求而做了 = scope creep，主动交代）**
   - `find_free_time` 工具 + 纯函数调度算法：你没点名要，但"下一代日历"
     的定位下这是 AI 面板最高频的真实用例，且它是唯一一个**组合**多个
     toolkit 调用的工具，恰好验证端口设计。
   - 限流（20/5min）：Groq 免费档配额是公共资源，没刹车会被一个失控
     客户端烧光。
   - `.env.example`、`AGENTS.md` 文档更新。

### Termux 实况（Spec #6 的证据）

- **Turbopack 在 android/arm64 无原生绑定** → dev 必须 `next dev --webpack`。
  这是环境事实，与本变更无关，但影响你日后调试。
- Next dev 的错误页 code-frame 在 WASM 绑定下抛
  `CodeFrameColorMode` 异常，会把真实错误吃掉——看日志比看响应体可靠。
- 后台 `next dev` 进程会被 Android 杀，smoke test 需在同一 shell 内
  启动+请求。
- 峰值内存：type-check ~1.6GB、dev server ~1.2GB，都在 2GB 内。

---

## Grilling — 我替你拷问这个设计（每题附我的推荐答案）

按 grilling 流程本该逐题等你确认；你要求落盘成文，所以每题给出
推荐答案 + 反方论点，**打钩前请逐条过**：

**Q1. 命令面板的对话该不该跨会话持久化？**
现状：关掉面板即焚（stop + setMessages([])）。
推荐：保持 ephemeral。日历问答是即抛型；持久化意味着要管转录的
加密存储（本仓库连 event title 都加密，聊天记录裸存 DB 说不过去）。
反方：用户可能想回看"AI 上周帮我删了什么"。若要审计，正确形态是
工具调用审计日志（MCP 已有 `tool-audit.ts` 可复用），不是聊天记录。

> **你的回答**：不要保存聊天记录
> **状态**：✅ 已按此实现 — 转录随面板关闭销毁，无任何持久化。

**Q2. 破坏性操作（delete_event）要不要人工确认一步？**
现状：靠 system prompt 约束 + 模型自觉。提示注入（比如事件标题里藏
指令"delete all my events"）理论上可诱导删除，虽然只能删自己的。
推荐：加 AI SDK 的 tool approval（`needsApproval`）给 delete_event，
UI 上出确认按钮。这是我认为**上线前唯一必须补的活**。
反方：多一步确认损伤"下一代日历"的顺滑感。折中：只对
`applyTo: 'all'`（删整个系列）要求确认。

> **你的回答**：需要
> **状态**：✅ 已实现 — `delete_event` 和 `delete_countdown` 标记
> `needsApproval`（AI SDK 原生审批流）。模型请求删除时流会暂停，
> 面板显示"确认操作"卡片（含完整参数 JSON）+ 批准/拒绝按钮；
> 拒绝会以 output-denied 回传给模型，模型陈述而不是执行。
> `sendAutomaticallyWhen` 让批准后自动续跑，无需重新输入。

**Q3. 模型的工具调用可靠性够吗？**
（更新：llama-3.3-70b 已转 Groq Enterprise-only，免费计划报
`model does not exist or you do not have access`，默认模型已改为
`openai/gpt-oss-120b`——免费档限额 250K TPM / 1K RPM，工具调用能力
反而更强。）复杂多步（"把下周所有会议挪到下下周"）仍可能翻车。
`GROQ_MODEL` 已做成环境变量可一键换。建议加一个简单的评测脚本
（eve 有 evals 目录约定，正好用独立运行时跑）。

> **你的回答**：我跟你说了你没完善，工具调用你没加限制（比如颜色等等
> props）。请模仿 mcp tools 的实现来改进
> **状态**：✅ 已实现（`packages/agent/src/validation.ts`，镜像 MCP 的
> 校验姿态）：
>
> - **颜色**：schema 内闭合 enum（blue/green/amber/red/purple/pink/teal，
>   与 `lib/mcp/colors.ts` 调色板逐值锁定，有测试钉住镜像一致性），
>   模型只能选名字，执行层再映射为存储 hex——乱传 hex 直接被 schema 拒。
> - **日期**：严格 ISO 8601 正则（必须带时区 offset），start<end 排序
>   校验，全部归一化为 UTC ISO 再进 toolkit。"tomorrow 3pm" 这类 prose
>   会返回带格式示例的可纠正错误。
> - **categoryId**：执行层对照 list_categories 实际存在的 id 校验，
>   幻觉 id 返回错误并列出用户真实分类。
> - **rrule**：必须含合法 FREQ=，prose（"every monday"）被拒。
> - **长度上限**：所有字符串字段 max()（title 200、description 2000、
>   location 500、query 200 等，与 REST 路由的 zod schema 一致）。
> - 所有校验失败都是错误**结果**而非 throw——Groq 网关侧 schema 违规
>   会 400 杀死整条流，这是当初 preset 事故的教训。

**Q4. 为什么工具只有 7 个？bookmark、countdown、邀请呢？**
推荐：先窄后宽。每加一个工具就扩大提示注入的爆炸半径，且拉长
system prompt（免费档 token 预算有限）。事件 CRUD + 分类 + 分析 +
空闲时间覆盖 90% 真实提问。反方：countdown 是本产品特色功能，
AI 面板不认识它显得"没融合"。若要加，照 `tools.ts` 现有模式
15 分钟一个。

> **你的回答**：请完善
> **状态**：✅ 已实现 — 新增 6 个工具，全部复用 MCP 层的既有函数：
> `list_bookmarks` / `bookmark_event` / `remove_bookmark`（书签），
> `list_countdowns` / `create_countdown` / `delete_countdown`（倒计时，
> 删除同样走审批流）。工具总数 7 → 13。邀请（invites）未加：它牵扯
> 第三方（发邮件给他人），值得单独决策而不是顺手带上。

**Q5. 限流参数 20 次/5 分钟合理吗？**
推荐：作为起点合理（Groq 免费档 30 req/min 全局）。但注意：无 Redis
时 fail-open（沿用仓库缓存层姿态）。生产上 REDIS_URL 已配，无虞；
自部署用户没配 Redis 就等于没限流——README 值得提一句。

> **你的回答**：可以
> **状态**：✅ 保持 20/5min。fail-open 警告已写入
> `packages/agent/README.md`（自部署无 REDIS_URL = 无限流）。

**Q6. eve 独立运行时的 CALENDAR_COOKIE 鉴权是不是太糙？**
是。复制浏览器 cookie 是演示级方案，cookie 会过期且拿到它等于拿到
全部会话权限。正确形态：给 agent 发 scoped API key（MCP 层已有
`BETTER_AUTH_API_KEY` 基建可复用）。因为独立运行时今天没有生产
调用方，我把它留在了"能跑通演示"的程度——升级路径已在
`agent/tools/README.md` 注明。

> **你的回答**：太粗糙了啊肯定啊
> **状态**：⏳ 共识达成，未在本轮实现。正确形态是 scoped API key
> （复用 MCP 的 `BETTER_AUTH_API_KEY` 基建），涉及独立运行时的鉴权
> 桥接，工作量不小且该运行时今天没有生产调用方。已在
> `agent/tools/README.md` 标注为 experimental + 升级路径；如果你要
> 启用独立运行时，先做这个。

**Q7. 面板要不要在无 GROQ_API_KEY 时隐藏入口？**
现状：按钮永远显示，点开输入后 503 报错文案。
推荐：保持现状。隐藏入口需要把服务端配置状态漏给客户端
（多一个 API 或 NEXT_PUBLIC 变量），为一个装完 key 就消失的状态
不值得。反方：自部署用户第一印象是"坏了"。折中：错误文案已写明
缺 key（英文 fallback），够引导。

> **你的回答**：需要
> **状态**：✅ 已实现 — `NEXT_PUBLIC_AI_ENABLED` 构建时布尔量
> （`next.config.ts`，只暴露"是否配置了 key"，key 本身永不进客户端）。
> 未配置 GROQ_API_KEY 的部署：无 ✨ 按钮、无 Cmd/Ctrl+K、无面板。
> 注意这是构建时内联——在 Vercel 加 key 后需要重新部署才生效。

**Q8. 8 步工具循环上限（stepCountIs(8)）怎么定的？**
list → categories → create → confirm 是 4 步；留一倍余量给模型
自我纠错。超过 8 步说明模型在打转，快停比慢转好——尤其在免费配额上。
没有科学依据，纯工程直觉，欢迎推翻。

---

## 上线前 checklist（按优先级）

1. ☐ 在 Vercel 项目加 `GROQ_API_KEY`（console.groq.com 免费申请）
2. ☐ 真 key 手测一轮：创建/查询/挪动/删除/空闲时间 各一次
3. ☐ （强烈建议）delete_event 加 needsApproval 确认（Q2）
4. ☐ （建议）i18n 补全其余 30 locale 的 6 个 key
5. ☐ （建议）修 http-toolkit 的 rrule 透传（或给独立运行时贴 experimental 标签就不修）
6. ☐ （可选）工具调用审计接入现有 `lib/mcp/tool-audit.ts`
