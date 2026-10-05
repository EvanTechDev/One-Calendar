# Calendar、Meet 与共享包依赖升级审计

审计日期：2026-10-05。结论基于实时 npm 元数据、官方发布记录及当前仓库代码。

## 结论

**66 个外部直接依赖中，45 个存在较新的稳定版，21 个已是 npm 推荐稳定版。** 最值得做的是有明确代码路径收益的小批升级；不能把全部 45 个包当作一次无风险更新。

1. **优先修补 Next.js：两个应用统一到 16.3.8。** Calendar 当前 16.3.6，Meet 当前 16.3.0；主要理由是官方安全修复，不是泛称性能提升。
2. **性能首批：Streamdown 2.7.0、AI SDK 配套补丁、Zod 4.6.5、MCP server 2.3.0、DayPicker 10.0.2。** 都有位于当前版本之后的具体优化，且对应本仓库实际调用。
3. **Meet 首批：livekit-client 2.22.3、track-processors 0.8.1。** 前者改善重连正确性；后者修复后台视频冻结及回退管线实际帧率偏低。
4. **Better Auth 应尽快规划，但必须带上 schema 兼容工作。** 当前 `account.issuer` 为非空，1.7.3 起不再写该列，直接升级到 1.7.7 会与当前 schema 冲突。
5. **暂缓批量升级测试栈、ioredis 6、Motion 14。** 有真实收益或正确性改善，但存在 Node 版本、协议或跨大版本约束。测试栈的收益只属于研发环境。

本次依赖审计没有安装或升级这些候选包，也没有运行构建、开发服务或测试。版本调查通过 Python HTTP 和文档工具完成；同一任务中的 Turbo 移除及其安装、lint 验证另行执行，不属于依赖升级。

## 1. 范围、口径与证据

仓库 `docs/` 原先只有 `.gitignore`，没有研究笔记命名惯例，因此采用 `docs/research/日期-主题.md`。

| 工作区              | dependencies | devDependencies | 外部 peerDependencies | 其中内部 workspace 引用 |
| ------------------- | -----------: | --------------: | --------------------: | ----------------------: |
| `apps/calendar`     |           42 |               4 |                     0 |                       6 |
| `apps/meet`         |           23 |               4 |                     0 |                       5 |
| `packages/agent`    |            2 |               3 |                     0 |                       0 |
| `packages/auth`     |           17 |               8 |                     2 |                       3 |
| `packages/i18n`     |            1 |               1 |                     0 |                       0 |
| `packages/meetings` |            1 |               2 |                     0 |                       0 |
| `packages/ui`       |           14 |               1 |                     0 |                       1 |
| `packages/utils`    |            1 |               1 |                     0 |                       0 |

总计 **127 条声明 = 112 条外部声明 + 15 条内部引用**；外部包去重为 66 个。两个外部 peer 是 `@zntr/auth` 的 React、React DOM，已计入。root、`apps/web`、`apps/calendar-client` 不属于依赖盘点范围；涉及共享 overrides、CI Node 版本时只说明协调约束。

- manifest：读取上述 8 个 `package.json`，保留原始精确版本、`^` 范围及 `latest`。
- 已安装：读取 `pnpm-lock.yaml` 对应 importer，并逐项读取工作区 `node_modules/<包>/package.json`；112 条外部声明均与锁文件解析版本一致。peer 声明以本工作区实际提供的版本核对。
- 最新稳定版：实时访问官方 `https://registry.npmjs.org/<包名>`，以非 prerelease、未 deprecated 的 `dist-tags.latest` 为推荐候选，并检查数值更高的正式版本是否误发布。
- 查询窗口：**2026-10-05 01:38:46–01:40:29 UTC**；HTTP `Date` 也是 2026-10-05。未发现安装版本在 registry 中缺失，未将更低版本列为升级，也未发现候选发布时间晚于审计日期。
- [完整 JSON 清单](./2026-10-05-dependency-upgrade-inventory.json)保留每条声明、完整锁解析含 peer 后缀、实际安装版本、每包 registry URL、HTTP 日期、dist-tags、安装版与候选版发布时间、engines、peers、deprecated 和发行包信息。
- 发布证据优先采用官方 GitHub Release 和版本标记下的 CHANGELOG；无法公开访问仓库时读取 npm 官方发行 tarball 内的 CHANGELOG。下文逐组引用。
- Context7 用于 Next.js、Vitest 迁移文档核对；其 Next 版本索引落后于实时 npm，因此不用索引推断最新版本。Better Auth 已通过 MCP `/llms.txt` 确认 1.7 文档线；版本化搜索没有返回条目，迁移事实改用官方站点原文确认。

**性能口径：**“有官方增量证据”不等于“本应用已实测提速”。本报告区分运行时 CPU／内存／网络、产物体积、构建／测试、正确性／安全和新增功能；没有进行基准测试，不承诺应用级百分比收益。

## 2. 版本元数据异常与单实例约束

### 2.1 数值最大的版本不一定可升级

| 包                             | npm latest | 更高的正式版本记录        | 官方元数据结论                                                                                                       |
| ------------------------------ | ---------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `@livekit/components-react`    | 2.9.24     | 3.0.0，发布于 2024-03-29  | deprecated：`this version is published by mistake`。保持 2.9.24，不能升级到误发的 3.0.0。                            |
| `fumadocs-core`、`fumadocs-ui` | 16.16.1    | 17.0.0，发布于 2026-02-01 | deprecated：`The package is accidentally published due to a bug in Changesets CLI, do not use it.`。候选为 16.16.1。 |

来源：[LiveKit registry](https://registry.npmjs.org/@livekit%2Fcomponents-react)、[Fumadocs core registry](https://registry.npmjs.org/fumadocs-core)、[Fumadocs UI registry](https://registry.npmjs.org/fumadocs-ui)。这是官方标注的误发布，不能按数字排序覆盖 `latest`。

预发布另行排除：Next `canary=16.4.0-canary.60`；React `canary=19.3.0-canary-278794d7-20261002`；Drizzle `rc=1.0.0-rc.4`；React Icons `beta=6.0.0-beta.0`。Drizzle 的 1.0 RC 不属于本报告的稳定候选。Vitest 的 `V4=4.1.11` 是有效维护分支，适合作为保守更新目标。

### 2.2 overrides 与可选 peer 不能独立更新

`pnpm-workspace.yaml` 当前固定：

- `sonner: 2.0.8`：已是最新稳定版。
- `@types/react: 19.2.18`：虽然 `packages/auth/package.json` 声明 19.2.2，实际锁定和安装都是 19.2.18。

仓库注释记录过真实故障：Sonner 调用方和 `@zntr/ui` 的 Toaster 被解析为不同模块实例，导致 toast 丢失。**相同 sonner 版本也不充分**：不同 optional peer（尤其 `@types/react`）可生成不同 pnpm peer 后缀和模块实例。

升级 React／types 时应统一 `react`、`react-dom`、`@types/react` 的提供版本和全局 override，并协调根目录 `@types/react-dom`。不要只修改 auth 的类型声明，也不要为升级而删除 Sonner override。当前 `packages/ui`、`packages/i18n` 的 React 是直接依赖，也必须纳入同一版本集。

`evlog@2.30.0` 的 React peer 虽然是 optional，范围已为 **`>=19.3.0`**；本仓库确实安装了 React，optional 不等于忽略版本兼容。Fumadocs UI 16.16.1 自带 `motion:^14.0.0`、`lucide-react:^1.50.0`，若本地仍留旧版，会新增版本分叉，不能把升级自动当作去重优化。

## 3. 全量直接依赖清单

缩写：C=`apps/calendar`，M=`apps/meet`，A=`packages/agent`，H=`packages/auth`，I=`packages/i18n`，D=`packages/meetings`，U=`packages/ui`，X=`packages/utils`。无后缀为 dependencies；`(d)` 为 devDependencies；`(p)` 为 peerDependencies。发布日期为 npm latest 的 UTC 日期。每行的精确官方 registry URL 及原始字段见 JSON 的 `registry[包名]`。

| 包                             | 工作区与 manifest 原值                             | 锁定＝实际安装  | npm 稳定 latest | 发布日期   | 结果           |
| ------------------------------ | -------------------------------------------------- | --------------- | --------------- | ---------- | -------------- |
| `@ai-sdk/groq`                 | C,A(d): `4.0.37`                                   | 4.0.37          | 4.0.54          | 2026-09-30 | 更新           |
| `@ai-sdk/react`                | C: `4.0.95`                                        | 4.0.95          | 4.0.130         | 2026-10-01 | 更新           |
| `@better-auth/cimd`            | H: `1.7.2`                                         | 1.7.2           | 1.7.7           | 2026-09-30 | 更新           |
| `@better-auth/core`            | H: `1.7.2`                                         | 1.7.2           | 1.7.7           | 2026-09-30 | 更新           |
| `@better-auth/drizzle-adapter` | H: `1.7.2`                                         | 1.7.2           | 1.7.7           | 2026-09-30 | 更新           |
| `@better-auth/infra`           | H: `0.4.3`                                         | 0.4.3           | 0.4.14          | 2026-10-02 | 更新           |
| `@better-auth/mcp`             | H: `1.7.2`                                         | 1.7.2           | 1.7.7           | 2026-09-30 | 更新           |
| `@better-auth/memory-adapter`  | H(d): `1.7.2`                                      | 1.7.2           | 1.7.7           | 2026-09-30 | 更新           |
| `@better-auth/oauth-provider`  | H: `1.7.2`                                         | 1.7.2           | 1.7.7           | 2026-09-30 | 更新           |
| `@livekit/components-react`    | M: `2.9.24`                                        | 2.9.24          | 2.9.24          | 2026-08-11 | 已检查／无更新 |
| `@livekit/krisp-noise-filter`  | M: `0.4.4`                                         | 0.4.4           | 0.4.5           | 2026-09-17 | 更新           |
| `@livekit/track-processors`    | M: `^0.7.2`                                        | 0.7.2           | 0.8.1           | 2026-09-16 | 更新           |
| `@marsidev/react-turnstile`    | H: `1.5.3`                                         | 1.5.3           | 1.6.1           | 2026-08-26 | 更新           |
| `@mdx-js/loader`               | C: `^3.1.0`                                        | 3.1.0           | 3.1.1           | 2025-08-29 | 更新           |
| `@mdx-js/react`                | C: `^3.1.0`                                        | 3.1.0           | 3.1.1           | 2025-08-29 | 更新           |
| `@modelcontextprotocol/server` | C: `2.0.0`                                         | 2.0.0           | 2.3.0           | 2026-10-02 | 更新           |
| `@shadcn/react`                | U: `0.3.1`                                         | 0.3.1           | 0.3.1           | 2026-08-31 | 已检查／无更新 |
| `@testing-library/jest-dom`    | C(d),M(d),H(d): `^6.9.1`                           | 6.10.0          | 7.0.1           | 2026-08-09 | 更新           |
| `@testing-library/react`       | C(d),M(d),H(d): `^16.3.2`                          | 16.3.2          | 16.3.3          | 2026-08-27 | 更新           |
| `@types/mdx`                   | C: `^2.0.13`                                       | 2.0.14          | 2.0.14          | 2026-06-06 | 已检查／无更新 |
| `@types/node`                  | A(d),D(d): `25.6.0`                                | 25.6.0          | 26.6.4          | 2026-10-01 | 更新           |
| `@types/react`                 | H(d): `19.2.2`                                     | 19.2.18         | 19.3.0          | 2026-09-09 | 更新           |
| `ai`                           | C,A: `7.0.92`                                      | 7.0.92          | 7.0.127         | 2026-10-01 | 更新           |
| `bcryptjs`                     | C,M: `latest`                                      | 3.0.3           | 3.0.3           | 2025-11-02 | 已检查／无更新 |
| `better-auth`                  | H: `1.7.2`                                         | 1.7.2           | 1.7.7           | 2026-09-30 | 更新           |
| `class-variance-authority`     | U: `^0.7.1`                                        | 0.7.1           | 0.7.1           | 2024-11-26 | 已检查／无更新 |
| `cmdk`                         | U: `1.1.1`                                         | 1.1.1           | 1.1.1           | 2025-03-14 | 已检查／无更新 |
| `cn`                           | X: `^0.4.0`                                        | 0.4.0           | 0.4.0           | 2026-09-22 | 已检查／无更新 |
| `cobe`                         | U: `0.6.4`                                         | 0.6.4           | 2.0.1           | 2026-03-19 | 更新           |
| `date-fns`                     | C: `4.4.0`                                         | 4.4.0           | 4.4.0           | 2026-05-29 | 已检查／无更新 |
| `drizzle-orm`                  | C,M,H,D: `^0.45.2`                                 | 0.45.2          | 0.45.3          | 2026-09-21 | 更新           |
| `evlog`                        | C: `2.19.2`                                        | 2.19.2          | 2.30.0          | 2026-10-03 | 更新           |
| `fumadocs-core`                | C: `16.10.5`                                       | 16.10.5         | 16.16.1         | 2026-10-04 | 更新           |
| `fumadocs-mdx`                 | C: `15.0.12`                                       | 15.0.12         | 15.4.6          | 2026-10-02 | 更新           |
| `fumadocs-ui`                  | C: `16.10.5`                                       | 16.10.5         | 16.16.1         | 2026-10-04 | 更新           |
| `geist`                        | C,M: `latest`                                      | 1.7.2           | 1.7.2           | 2026-06-01 | 已检查／无更新 |
| `ioredis`                      | C,M: `^5.11.1`                                     | 5.11.1          | 6.0.0           | 2026-07-31 | 更新           |
| `jsdom`                        | C(d),M(d),H(d): `^29.1.1`                          | 29.1.1          | 30.1.2          | 2026-10-04 | 更新           |
| `livekit-client`               | M: `2.22.0`                                        | 2.22.0          | 2.22.3          | 2026-09-07 | 更新           |
| `livekit-server-sdk`           | M: `2.18.0`                                        | 2.18.0          | 2.19.1          | 2026-09-20 | 更新           |
| `lucide-react`                 | C: `1.48.0`；M,H,U: `1.21.0`                       | 1.48.0 / 1.21.0 | 1.52.0          | 2026-10-04 | 更新           |
| `motion`                       | C,U: `^12.41.0`                                    | 12.43.0         | 14.0.0          | 2026-10-02 | 更新           |
| `next`                         | C: `16.3.6`；M: `16.3.0`                           | 16.3.6 / 16.3.0 | 16.3.8          | 2026-09-30 | 更新           |
| `next-themes`                  | C,M,U: `latest`                                    | 0.4.6           | 0.4.6           | 2025-03-11 | 已检查／无更新 |
| `postcss`                      | C: `8.5.28`                                        | 8.5.28          | 8.5.28          | 2026-09-03 | 已检查／无更新 |
| `postgres`                     | C,M: `^3.4.9`                                      | 3.4.9           | 3.4.9           | 2026-04-05 | 已检查／无更新 |
| `qr-code-styling`              | H: `latest`                                        | 1.9.2           | 1.9.2           | 2025-04-11 | 已检查／无更新 |
| `radix-ui`                     | U: `latest`                                        | 1.6.7           | 1.6.7           | 2026-07-24 | 已检查／无更新 |
| `react`                        | C,M,H(d),I,U: `19.2.7`；H(p): `^19.2.7`            | 19.2.7          | 19.3.0          | 2026-09-09 | 更新           |
| `react-day-picker`             | U: `10.0.1`                                        | 10.0.1          | 10.0.2          | 2026-09-30 | 更新           |
| `react-dom`                    | C,M,H(d),U: `19.2.7`；H(p): `^19.2.7`              | 19.2.7          | 19.3.0          | 2026-09-09 | 更新           |
| `react-email`                  | H: `6.6.4`                                         | 6.6.4           | 6.11.0          | 2026-09-23 | 更新           |
| `react-icons`                  | C: `5.6.0`                                         | 5.6.0           | 5.7.0           | 2026-06-30 | 更新           |
| `react-remove-scroll`          | C: `2.7.2`                                         | 2.7.2           | 2.7.2           | 2025-11-29 | 已检查／无更新 |
| `recharts`                     | U: `3.9.0`                                         | 3.9.0           | 3.10.1          | 2026-07-25 | 更新           |
| `resend`                       | C,H: `6.14.0`                                      | 6.14.0          | 6.32.0          | 2026-10-01 | 更新           |
| `rrule`                        | C: `2.8.1`                                         | 2.8.1           | 2.8.1           | 2023-11-10 | 已检查／无更新 |
| `shadcn`                       | C,M: `4.11.0`                                      | 4.11.0          | 4.21.1          | 2026-10-01 | 更新           |
| `sonner`                       | C,M,H,U: `2.0.8`                                   | 2.0.8           | 2.0.8           | 2026-08-09 | 已检查／无更新 |
| `streamdown`                   | C: `2.6.0`                                         | 2.6.0           | 2.7.0           | 2026-09-30 | 更新           |
| `swr`                          | C: `^2.5.1`                                        | 2.5.1           | 2.5.1           | 2026-08-12 | 已检查／无更新 |
| `tailwindcss`                  | C: `4.3.3`                                         | 4.3.3           | 4.3.3           | 2026-07-16 | 已检查／无更新 |
| `tw-animate-css`               | C,M: `^1.4.0`                                      | 1.4.0           | 1.4.0           | 2025-09-24 | 已检查／无更新 |
| `vitest`                       | C(d),M(d),A(d),H(d),I(d),D(d),U(d),X(d): `^4.1.10` | 4.1.10          | 5.0.3           | 2026-09-30 | 更新           |
| `zod`                          | C,A: `4.4.3`                                       | 4.4.3           | 4.6.5           | 2026-09-13 | 更新           |
| `zustand`                      | C: `5.0.15`                                        | 5.0.15          | 5.0.15          | 2026-08-13 | 已检查／无更新 |

内部引用全部为 `workspace:*`，不查询 npm 最新版：C→agent/auth/i18n/meetings/ui/utils；M→auth/i18n/meetings/ui/utils；H→i18n/ui/utils；U→utils。对应包版本目前均为 0.1.0，锁文件是本地 `link:`。

`motion:^12.41.0` 已安装 12.43.0；`jest-dom:^6.9.1` 已安装 6.10.0；`@types/mdx:^2.0.13` 已安装 2.0.14。后续增量分析均从这些实际版本开始，避免重复计算历史收益。

## 4. 优先级最高的维护与升级前置条件

### 4.1 Next.js 16.3.6／16.3.0 → 16.3.8：优先，安全为主

官方记录：[16.3.8](https://github.com/vercel/next.js/releases/tag/v16.3.8)、[16.3.7](https://github.com/vercel/next.js/releases/tag/v16.3.7)、[16.3.6](https://github.com/vercel/next.js/releases/tag/v16.3.6)、[16.3.3](https://github.com/vercel/next.js/releases/tag/v16.3.3)、[16.3.1](https://github.com/vercel/next.js/releases/tag/v16.3.1)。

- 16.3.8 修复 Image Optimization SSRF、metadata image 路由信息泄漏、部分 SSG/ISR 缓存投毒及 `use cache` 泄漏等；具体适用条件见该 release 所链接的各个官方 advisory。
- **Calendar 从 16.3.6 起算**，增量是 16.3.7 的 Turbopack 取消任务挂起修复及 16.3.8 安全修复。不能再次宣传 16.3.6 的 `next/og` 修复。
- **Meet 从 16.3.0 起算**，还跨过 16.3.3 的 AVIF 图片优化安全修复、16.3.4 恢复 AVIF、16.3.5 图片缓存正确性及 16.3.6 的 `next/og` 修复。两应用 `next.config.ts` 都配置了 AVIF/WebP，因此图片路径值得关注；这不代表本次已证明生产环境可被利用。
- 16.3.1 的重复 prefetch 循环、过多旧缓存保留修复对 Meet 属于真实增量，对 Calendar 已包含。16.3.7 属于构建／开发稳定性，不是页面执行速度基准。
- npm engine 为 Node `>=20.9.0`；React／React DOM peer 接受当前 19.2.7，因此这个补丁批次不要求同时升级 React。
- 两应用都启用了 `ignoreBuildErrors`，将来实施时不能用构建成功替代类型兼容验证。这里未执行构建。

### 4.2 Better Auth 七包 1.7.2 → 1.7.7：尽快做迁移型升级

包含 `better-auth`、`@better-auth/core`、`cimd`、`drizzle-adapter`、`mcp`、`oauth-provider`、`memory-adapter`。官方记录：[1.7.3](https://github.com/better-auth/better-auth/releases/tag/v1.7.3)、[1.7.5](https://github.com/better-auth/better-auth/releases/tag/v1.7.5)、[1.7.6](https://github.com/better-auth/better-auth/releases/tag/v1.7.6)、[1.7.7](https://github.com/better-auth/better-auth/releases/tag/v1.7.7)、[1.7 升级指南的 account identity 段](https://better-auth.com/docs/guides/1-7-upgrade-guide#account-identity-keeps-the-provider-key)。

**确定的仓库级前置条件：**`packages/auth/src/schema.ts:52` 有 `issuer: text('issuer').notNull()`，并定义 `account_issuer_accountId_uidx`；`apps/calendar/drizzle/0016_account_issuer_identity.sql:45` 也设置了 NOT NULL。官方明确说明 **1.7.3 起新账户不再写 issuer**，需要放宽该约束并处理旧身份索引，同时保留 provider/account 身份语义。仅改版本会令与该 schema 一致的数据库拒绝注册／关联账户。这里没有连接数据库，线上实际迁移状态仍待实施时确认。

此外 1.7.3 默认在生产初始化时检查 schema 并拒绝不匹配的认证请求；升级必须同时核对共享 schema、adapter 和已有迁移。仓库规则要求新迁移写入 `apps/calendar/drizzle/`，不应重新运行会卡在旧 snapshots 的 `drizzle-kit generate`。本报告不执行或编写迁移。

| 包／版本                                    | 官方增量及本仓库相关性                                                                                                                                                                                            | 收益归类                     |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `better-auth` 1.7.3–1.7.7                   | 1.7.3 修复残留缓存 cookie 导致 getSession 失败、TOTP 重新注册覆盖；1.7.6 修复 React hydration 和旧请求覆盖新 auth 状态；1.7.7 修复 CAPTCHA／限流错误 Content-Type。当前共享会话、两步验证、React auth UI 均相关。 | 正确性、认证可靠性           |
| `better-auth` 1.7.7                         | 修复 critical Magic Link 账户接管；当前 `packages/auth/src/server.ts` 配置 emailOTP、twoFactor、Sentinel、MCP，没有启用 magicLink，不能据此直接宣称本仓库存在该漏洞。OAuth Proxy 同样未见启用。                   | 上游安全补丁，按配置判断暴露 |
| `@better-auth/core` 1.7.3                   | 优化请求 IP 验证；属于 auth 请求热路径的具体 CPU 优化，但未提供本应用测量。                                                                                                                                       | 有条件的运行时性能           |
| `@better-auth/cimd` 1.7.3、1.7.5            | 修复 Node `ERR_INVALID_IP_ADDRESS`；修复 metadata 无法缓存时连续 OAuth 请求被无谓 pacing。`createMcpOAuthPlugins` 确实启用 CIMD、缓存和 fetch policy。                                                            | 正确性、条件性延迟改善       |
| `@better-auth/drizzle-adapter` 1.7.5、1.7.7 | 修复 lazy 初始化及 PostgreSQL 并发请求突破数据库限流；当前使用 pg adapter，但应用另有自定义限流，不能把数据库限流修复称为普遍吞吐提升。                                                                           | 正确性                       |
| `@better-auth/oauth-provider` 1.7.3、1.7.7  | 支持 native localhost 动态端口、提供 consent query 验证；项目的 MCP native registration 和自定义 consent 路径相关。                                                                                               | 协议兼容、安全接口           |
| `@better-auth/mcp` 1.7.3–1.7.7              | [该包 CHANGELOG](https://github.com/better-auth/better-auth/blob/v1.7.7/packages/mcp/CHANGELOG.md)这段仅同步 oauth-provider 依赖，无独立性能优化证据。                                                            | 配套一致性                   |
| `@better-auth/memory-adapter` 1.7.6         | 修复自定义 model name 与 schema key 相同的模型识别；在本仓库是 devDependency。                                                                                                                                    | 测试正确性，非线上性能       |

组织动态权限检查的优化属于 1.7.3，但本仓库未启用 organization 插件，不计收益。1.7.4 可关闭 instrumentation 是新增配置能力，不是升包即生效的提速。

**组合约束：**1.7.7 插件 peer 要求 core／better-auth `^1.7.7`，部分还固定 `better-call:1.4.0`、`@better-fetch/fetch:1.3.2`，应一起更新。Drizzle adapter 接受当前 `drizzle-orm:^0.45.2`，不需要为此升级 Drizzle 1.0 RC。Calendar 与 Meet 共享数据库和 cookie，需要同批兼容部署；Magic Link 特定的 verification storage 升级指引不能替代本仓库实际需要的 issuer 清理。

### 4.3 `@better-auth/infra` 0.4.3 → 0.4.14：随认证批次，中优先

仓库地址 `better-auth/infrastructure` 的公开 GitHub API 和 raw CHANGELOG 均返回 404；已从[官方 npm 0.4.14 tarball](https://registry.npmjs.org/@better-auth/infra/-/infra-0.4.14.tgz)读取 `package/CHANGELOG.md`，不是凭更新日期推测。

- 0.4.4：Sentinel PoW challenge 不再占用 Better Auth 限流预算；本仓库启用 Sentinel，属于正确性改善。
- 0.4.6：跟进 Better Auth 1.7.3 provider/account 身份回退，适合与认证包同步。
- 0.4.7：客户端 audio fingerprint 改用 OfflineAudioContext，改善受限浏览器兼容性。
- 0.4.13：预计算 API key hash、复用 LocalJWKSet，**明确只优化 Dash JWT middleware**；当前配置启用的是 `sentinel()`，未见 `dash()`，不计作登录提速。
- 0.3.5／0.3.6 的数据库查询和后台 activity write 优化早已包含于当前 0.4.3，不能重复计入。
- peer 接受 Better Auth／core `>=1.4.0`、Zod `>=4.1.12`；新增 Expo／React Native peers 为可选，Web 项目不因此需要安装移动端依赖。

## 5. 真正有新增性能证据的候选

### 5.1 Streamdown 2.6.0 → 2.7.0：高优先，直接命中聊天 UI

来源：[官方 2.7.0 release](https://github.com/vercel/streamdown/releases/tag/streamdown%402.7.0)。

这次更新确有具体工作量削减：流式 Markdown 复用已解析块，仅 lex block tokens；代码／表格自动滚动按帧合并，避免每个 chunk 强制 layout；光标显隐不再引起整篇文档重新计算样式；代码高亮缓存改为有界 LRU；remend 1.4.0 修复大量 delimiter 输入下的二次复杂度修复过程。

`apps/calendar/components/app/ai/chat-transcript.tsx:243–252` 对每个 text part 使用 `<Streamdown isAnimating={busy}>`，属于实际流式路径。**块解析复用、remend 和 DOM 更新优化高度相关**。本仓库未在此传入 code／Mermaid 插件，不能把高亮增量化、Mermaid 调度全部算作现有效果。

React peer 仍支持 18／19；内部 `marked` 升到 18，应核对长中文文本、列表、表格、不完整 Markdown 的结果。可选 `@streamdown/code@2` 的 Shiki 4／Node 20 要求只在使用该插件时相关。没有整个 Calendar 提速百分比证据。

### 5.2 AI SDK 三包：高优先，性能与取消／审批正确性

目标：`ai:7.0.92→7.0.127`，`@ai-sdk/react:4.0.95→4.0.130`，`@ai-sdk/groq:4.0.37→4.0.54`。来源为固定 release tag 下的 [ai CHANGELOG](https://github.com/vercel/ai/blob/ai%407.0.127/packages/ai/CHANGELOG.md)、[React CHANGELOG](https://github.com/vercel/ai/blob/ai%407.0.127/packages/react/CHANGELOG.md)、[Groq CHANGELOG](https://github.com/vercel/ai/blob/ai%407.0.127/packages/groq/CHANGELOG.md)。

- **React 4.0.130**：修复流式 chat 更新饿死导航 transition；**4.0.107**：允许未使用的 realtime runtime tree-shake。Calendar 使用 `useChat` 而非 realtime，故交互调度和不必要代码可裁剪都具有直接相关性。实际产物缩减仍需测量。
- **ai 7.0.119／7.0.127**：客户端断开时取消 response／merged UI streams；7.0.108 取消 pending tool repair；7.0.106 修复提前停止读取后的 rejection 和中止多步流后的回调。这些可以避免取消后继续做无用工作，但本仓库 `app/api/agent/chat/route.ts` 已有请求取消和 deadline，新增覆盖不能等同于“此前完全不取消”。
- **ai 7.0.113／7.0.123／7.0.126**：修复跨消息审批恢复、transform 输入审批校验、被用户消息取代的旧审批及 `addToolOutput` 后清理审批。`packages/agent/src/tools.ts` 的两个 destructive tool 使用 approval，相关性强；重点是行为正确性。
- **Groq 4.0.51**：修复流式 tool call 缺失／空／重复 ID；4.0.47 对没有 choices 的响应返回 typed error。是模型调用可靠性，不是 Groq 推理速度提升。
- 均要求 Node `>=22`，这是当前所用 AI SDK 主版本线已有要求。Zod peer `^3.25.76 || ^4.1.8` 接受当前及候选 Zod。`@ai-sdk/react@4.0.130` 的内部 `ai` 固定 7.0.127，Calendar 和 `packages/agent` 应同步，避免同时保留两套 SDK。

### 5.3 Zod 4.4.3 → 4.6.5：高优先，确有内存增量

来源：[4.5.0](https://github.com/colinhacks/zod/releases/tag/v4.5.0)、[4.6.0](https://github.com/colinhacks/zod/releases/tag/v4.6.0)、[4.6.4](https://github.com/colinhacks/zod/releases/tag/v4.6.4)、[4.6.5](https://github.com/colinhacks/zod/releases/tag/v4.6.5)。

- **4.5.0** 将 schema 方法和内部派生数据移到 prototype，减少每个 schema 的保留堆；其官方 benchmark 明确以 **4.4.3** 为基线，因此是本次真实增量，非 Zod 3→4 的历史宣传。
- 4.5.0 延迟构造 ZodError、避免过早捕获 stack；4.6.0 进一步按需构造 safeParse 错误和 enum/literal regex；4.6.4 用 `URL.canParse()` 避免非法 URL 抛异常的代价。
- `packages/agent/src/tools.ts`、`parse.ts`、`search.ts` 及 `apps/calendar/lib/mcp/server.ts` 都构造 schema；MCP 每请求注册工具，schema 内存／转换开销值得关注。规模较小或长时间等待模型的请求，不应预期总延迟同比下降。
- **`z.compile()`、`.validate()` 是新增 API，需要显式采用才有对应收益**；本仓库未使用，不能给升包贴上官方 compiled benchmark 的倍数。4.6 CommonJS namespace 优化也不能套到全部 ESM 调用。
- 4.6 修复的递归 schema 输入保留是 **4.5 引入的回归**，不是当前 4.4.3 原有问题的修复。建议直接到 4.6.5，避开中间回归版本。
- **具体兼容检查：**4.5 起带 Z／offset 的 datetime 默认要求秒，字符串长度按 Unicode code points 而非 UTF-16 code units 计算。`packages/agent/src/search.ts:66` 使用 `z.iso.datetime({ offset: true })`，`apps/calendar/lib/validation.ts:26–27` 也验证 datetime，因此需要核对模型输出／外部请求是否存在仅到分钟的时间戳；不能将本次 minor 当作校验行为完全不变的替换。来源为上引 4.5.0 release 的 Bug fixes。
- 无外部 peer；AI SDK 和 Fumadocs 的版本范围兼容。校验、transform、JSON schema 输出均属核心契约，应在将来实施时核对 agent 工具输入和 parse 降级行为。

### 5.4 MCP server 2.0.0 → 2.3.0：高优先，每请求初始化优化

来源：[server 2.1.0](https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/%40modelcontextprotocol/server%402.1.0)、[2.2.0](https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/v2.2.0)、[2.3.0](https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/v2.3.0)。2.1.0 的总仓库 `v2.1.0` URL 返回 404，但存在上述 per-package release，已使用它核对。

- **2.3.0 `registerTool` 不再提前转换所有工具 schema**（#2889）。`apps/calendar/lib/mcp/handler.ts:110` 每请求 `createServer()`，`server.ts` 注册大量工具，属于很贴合本项目的 CPU／初始化工作量优化。
- 2.1.0 为 Streamable HTTP 增加默认 **4 MiB** body 限制及 100 条 batch 上限，避免无界读入；对大输入属于资源约束／正确性变化，应确认合法请求不会被新限制拒绝。
- 2.3.0 强制一个 connected server／stateless transport 不得多请求复用；当前在 handler 内创建实例，符合模式。仍需核对协议 headers、request id 0 取消语义和已有自定义 scope 检查。
- release 中“大 SSE 消息一分钟降至一秒内”的例子属于 **MCP client 接收及 eventsource-parser**。本次审计的直接包是 server，当前 transport 还启用 JSON response，**不计入本应用收益**。
- Node `>=20`，没有必须提升到 React／Next 新主版本的 peer 约束。与 Better Auth MCP 是不同职责的包，不能混用二者版本号。

### 5.5 DayPicker 10.0.1 → 10.0.2：高优先，小补丁

来源：[10.0.2](https://github.com/gpbl/react-day-picker/releases/tag/v10.0.2)。改用 date-fns／locale subpath import，避免导入一个 locale 时加载全体 locales；修复受控月份改变后焦点丢失。

`packages/ui/src/calendar.tsx` 使用 DayPicker；Calendar 日期选择器直接受益于焦点修复，包内部 import 收敛也相关。不过 `apps/calendar/lib/date-locale.ts` 自己从 `date-fns/locale` 导入多个语言，库升级不能自动消除应用主动需要的 locale 集合。React／types peer `>=16.8.0`，Node `>=18`，当前版本满足；无已公布的大版本迁移。

### 5.6 Meet 背景处理 0.7.2 → 0.8.1：高优先，实际帧率／可用性

来源：[0.8.0](https://github.com/livekit/track-processors-js/releases/tag/v0.8.0)、[0.8.1](https://github.com/livekit/track-processors-js/releases/tag/v0.8.1)。

- 0.8.0 修复设备旋转／iPhone 竖屏造成的 mask 裁剪和偏移。
- **0.8.1** 在缺少 Insertable Streams 的 Firefox／Safari 回退管线中，用 worker timer 替代会在隐藏页面暂停的 rAF，修复发送方窗口被遮挡／最小化后远端画面冻结。
- 同版用无漂移 deadline 修复 frame gate 量化导致输出达不到 maxFps。官方提到配置 30 fps 时旧代码测得 20.8–23 fps；这是上游特定管线测量，不是本项目实测，也不意味着所有浏览器都加速。
- `apps/meet/lib/join-preferences.ts` 和 `components/room/settings-dialog.tsx` 确实使用 BackgroundBlur／VirtualBackground，相关性高。保持后台输出可能增加后台耗电，不能把此修复同时称为降 CPU。
- **0.x minor 不在当前 `^0.7.2` 范围内**，需显式更新范围；无效 maxFps 现在抛 RangeError。peer 接受 LiveKit 1.12／2.1 以上的对应版本线，兼容本次 2.22.3；新增 GainAudioProcessor 未使用，不计收益。

### 5.7 React Email 6.6.4 → 6.11.0：中高优先，服务端产物可裁剪

来源：[6.8.0](https://github.com/resend/react-email/releases/tag/react-email%406.8.0)、[6.9.1](https://github.com/resend/react-email/releases/tag/react-email%406.9.1)、[6.10.0](https://github.com/resend/react-email/releases/tag/react-email%406.10.0)、[6.11.0](https://github.com/resend/react-email/releases/tag/react-email%406.11.0)。

**6.8.0** 改为 per-module 产物并声明 `sideEffects:false`；只导入普通组件时，不再强行把 Prism、marked、Tailwind 一起带入。`packages/auth/src/email-template.tsx` 从 `react-email` 导入 Body／Button／Html／render 等，使用内联样式，未使用 CodeBlock／Markdown／Tailwind，恰好符合该优化场景。值得观察服务端打包和模块加载成本，但不能直接等同于每封邮件发送更快，Next 外部化策略也可能影响实际收益。

6.6.6 修复 Outlook Button 样式；6.9.1 的 Tailwind 4.3.3 兼容修复对当前非 Tailwind 模板不构成主要收益。6.10+ Node 最低 **20.19**，React／DOM peer 支持 18／19。6.11 的 esbuild plugins 是 CLI 功能，不是线上性能。

### 5.8 COBE 0.6.4 → 2.0.1：有明确历史增量，建议先评估 0.6.5

来源：[0.6.5 release](https://github.com/shuding/cobe/releases/tag/0.6.5)、[性能 PR #99](https://github.com/shuding/cobe/pull/99)、[2.0.1](https://github.com/shuding/cobe/releases/tag/2.0.1)、[v2 PR #105](https://github.com/shuding/cobe/pull/105)、[2.0.1 发行包 README](https://registry.npmjs.org/cobe/-/cobe-2.0.1.tgz)。

0.6.5 预计算每个 marker 的 Fibonacci lattice，去掉双侧重复迭代并复用变量。当前仍为 0.6.4，因此这项旧发布中的优化对本仓库确实是新增收益。`packages/ui/src/globe.tsx` 有 10 个 marker 和持续 onRender，Calendar landing `feature-section.tsx` 使用该组件，作用限定在首页地球。

作者在 PR 中对至少两倍帧率的描述是**预期**，不是本项目基准，不作为承诺。0.6.5 在 npm 存在且未 deprecated，可作为低风险性能补丁单独评估；2.0.1 新增 arcs／DOM anchor 等能力并修复 Firefox GLSL，跨大版本需核对 shader 输出、DPR、销毁和输入交互。发行包 README 仍展示 `onRender`，没有依据断言它被删除。v2 PR 的未完成性能 TODO 也不能算已交付优化。

无 React peer 约束；2.0.1 是否比 0.6.5 再快，**未验证**。因此不建议仅为“最新”跳过较小的可验证变更。

### 5.9 Motion 12.43.0 → 14.0.0：中优先，真实优化但跨两大版本

来源：[官方 CHANGELOG](https://github.com/motiondivision/motion/blob/main/CHANGELOG.md)，此次读取的最新条目为 14.0.0（2026-10-02）。GitHub Releases API 为空，因此使用仓库 CHANGELOG。

- 13.2／13.3 改善 spring、useSpring 重定向和 frame 调度；13.4.5、13.5 缩小 spring／useSpring 代码。`packages/ui/src/globe.tsx:62` 使用 useSpring，Calendar landing 使用 `motion/react-client`，具备实际相关性。
- 13.4.4 的 scroll callback 优化不代表项目现有滚动都获益；13.5 又把 offset 动画改回主线程，不能只摘录前一版本“更多硬件加速”的宣传。
- 13.0 移除隐式 `@emotion/is-prop-valid` 集成，改为显式 MotionConfig；14.0 清理为 13.x 兼容临时恢复的内部 API，并固定内部依赖。当前代码主要使用公开 API，但仍需核对 landing 与 Globe。
- 当前**已安装 12.43.0**，该版 backgroundColor／SVG 硬件加速，以及更早的 Windows Next OOM 修复都已具备，不算新增。
- React／DOM peer 支持 18／19；`AnimateView` 的 React 19.3 集成是新功能，未使用则不计收益。宜与 Fumadocs UI 的 Motion 14 依赖协调，避免并存 12／14。官方子函数 benchmark 不能推算整页帧率。

### 5.10 React／React DOM 19.2.7 → 19.3.0：中优先，整体协调

来源：[19.2.8](https://github.com/react/react/releases/tag/v19.2.8)、[19.3.0](https://github.com/react/react/releases/tag/v19.3.0)、[Next 16 升级文档](https://nextjs.org/docs/app/guides/upgrading/version-16)。

19.3 新增的可定位优化包括：独立渲染不同 transitions，避免一个慢 transition 拖住其他更新；未变化的 innerHTML 不再重设；resize 更新按帧合并；SSR 完成后减少 signal 保留；RSC reply 解码／序列化优化。19.2.8 也有 RSC decoding 性能修复。

但两个应用使用 **Next App Router，其 React/RSC 部分由 Next 打包版本控制**，只提升顶层 React 不保证把 release 中每个 RSC 优化都带到线上；不能把整份 React release 的收益累加。应用没有广泛显式使用 startTransition，新增 ViewTransition／Fragment refs 也不会自动启用。

将 `react`、`react-dom` 同步到相同发行版，并一起协调 UI、i18n、auth devDeps、类型和 overrides；DOM 19.3 peer 要求 `react:^19.3.0`。Next 16.3.8 的公开 peer 接受该版，仍需核对 hydration 与 Meet 的 imperative room 生命周期。当前 Meet 设置 `reactStrictMode:false`，不要以仅在 StrictMode 开发环境发生的修复估算线上性能。此批可解锁 evlog 最新 peer，但不是 Next 安全补丁的前置条件。

### 5.11 Fumadocs 三包：中优先，文档路线独立实施

目标 core／ui `16.10.5→16.16.1`，mdx `15.0.12→15.4.6`。来源：[core 完整 CHANGELOG](https://github.com/fuma-nama/fumadocs/blob/fumadocs%4016.16.1/packages/core/CHANGELOG.md)、[16.12.0](https://github.com/fuma-nama/fumadocs/releases/tag/fumadocs%4016.12.0)、[16.14.0](https://github.com/fuma-nama/fumadocs/releases/tag/fumadocs%4016.14.0)、[16.15.11](https://github.com/fuma-nama/fumadocs/releases/tag/fumadocs%4016.15.11)、[16.15.13](https://github.com/fuma-nama/fumadocs/releases/tag/fumadocs%4016.15.13)、[MDX CHANGELOG](https://github.com/fuma-nama/fumadocs/blob/main/packages/mdx/CHANGELOG.md)。

**可计入的具体增量：**core 16.15.9 与后续全包 `sideEffects` 标注让未使用模块可被裁剪；16.12 不再默认挂载隐藏 tab 内容，减少文档页 DOM，但可能失去隐藏面板本地状态；16.15.13 改用 useSyncExternalStore，官方写明性能优化但没有充分量化细节，置信度低于明确的裁剪工作量。

**不能套用的收益：**MDX 15.4.5 修复 Vite config 每次遍历约一万个 package.json，这是 **Vite 集成**；当前 Calendar 使用 `fumadocs-mdx/next`。15.3 Sätteri 跳过位置跟踪的 parse 优化，需要采用 Sätteri；当前 `source.config.ts` 未配置该编译器。15.4.3 的 experimentalBuildCache 重复打包修复、15.3.1 的 lastModified git log 收敛，都没有在当前配置启用，不能列为必然收益。16.10.2 的 search client 优化也早已包含于 16.10.5。

**约束：**UI 16.16.1 精确 peer core 16.16.1；MDX 15.4.6 要求 core `^16.15.3`，三包不能各自随意升级。16.14 默认搜索从 Orama 改为 ZBSearch，server／client 静态数据格式应同版；自定义 tokenizer／plugin 需检查。16.15.11 删除 `fumadocs-ui/components/ui/scroll-area` 导出（当前 TS/TSX 搜索未发现该导入）。新模板默认 Base UI 不等于现有 Radix 组件被自动迁移。UI 同时引入 Motion 14、Lucide 1.50+；需要控制共享包版本分叉。主要收益在文档路由，不是日历事件网格。

### 5.12 Recharts 3.9.0 → 3.10.1：有性能证据，但当前低优先

来源：[3.9.1](https://github.com/recharts/recharts/releases/tag/v3.9.1)、[3.9.2](https://github.com/recharts/recharts/releases/tag/v3.9.2)、[3.10.0](https://github.com/recharts/recharts/releases/tag/v3.10.0)、[3.10.1](https://github.com/recharts/recharts/releases/tag/v3.10.1)。

3.9.1 将 ScatterChart hover 重渲染工作量由 O(n) 降为 O(1)；3.9.2 避免密集 Sankey 图指数遍历；3.10.0 跳过 tick 未改变时的 axis dispatch，另有 Tooltip／Brush／Label 修复。

本仓库只有 `packages/ui/src/chart.tsx` 通用包装器；本次针对应用代码搜索未发现 ChartContainer、Scatter 或 Sankey 的实际页面调用。因此这些是真实库级性能改进，**本项目当前可见收益未建立**，不列入首批。React／DOM／react-is peer 要一致；Legend 新 position／offset API 和类型需要核对共享包装器。没有理由据此承诺日历渲染加速。

## 6. 其余运行时／工具候选：逐项判断

### 6.1 livekit-client 2.22.0 → 2.22.3：高优先，通话可靠性

来源：[2.22.1](https://github.com/livekit/client-sdk-js/releases/tag/v2.22.1)、[2.22.2](https://github.com/livekit/client-sdk-js/releases/tag/v2.22.2)、[2.22.3](https://github.com/livekit/client-sdk-js/releases/tag/v2.22.3)。2.22.2 修复重连后远端 ICE candidates 永远排队、无法切换网络路径；修复 signal reconnection 缓冲事件未 flush。2.22.1 正确检测 ResizeObserver／IntersectionObserver，2.22.3 支持 VP9／AV1 SVC codecs simulcast。

`apps/meet/components/room/active-room.tsx` 开启 adaptiveStream／dynacast，并有 codec／E2EE 条件分支；这些改动与通话路径相关。重连修复主要是可用性；新增 simulcast 不意味着同画质下 CPU 必然更少，E2EE 下还排除了部分 codec。最新 components-react 2.9.24 peer 要求 client `^2.20.1`，与 2.22.3 兼容。保留 components-react 2.9.24，勿用误发 3.0.0。

### 6.2 livekit-server-sdk 2.18.0 → 2.19.1：中高优先，鉴权／重试正确性

来源：[2.19.0](https://github.com/livekit/node-sdks/releases/tag/livekit-server-sdk%402.19.0)、[2.19.1](https://github.com/livekit/node-sdks/releases/tag/livekit-server-sdk%402.19.1)。2.19.0 为 API 请求提供跨 region failover 保持的 idempotency key；2.19.1 验证 access token 时强制 `exp`。

项目 `lib/room-membership.ts` 使用 TokenVerifier，`lib/livekit-server.ts` 使用 RoomServiceClient，实际相关。应核对旧测试 token／外部 token 均有有效 exp；Node engine `>=19`。PASSTHROUGH egress 跳过转码是新增可选服务端功能，本仓库未见 startEgress 调用，不能记作现有会议性能收益。

### 6.3 Krisp 0.4.4 → 0.4.5：暂缓，增量效果未验证

来源：[npm 元数据](https://registry.npmjs.org/@livekit%2Fkrisp-noise-filter)、[官方 0.4.5 发行包](https://registry.npmjs.org/@livekit/krisp-noise-filter/-/krisp-noise-filter-0.4.5.tgz)。metadata 没有 repository／homepage；发行包有 README，没有 CHANGELOG。本次未取得解释 0.4.4→0.4.5 行为变化的官方 release notes。

能确认 `@livekit/protocol` 依赖由 `^1.45.4` 变为 `^1.50.4`，client peer 仍为 `^2.18.7`，与当前及候选 client 兼容。无法从包体大小或发布日期推出降噪质量／CPU 改善。当前 `join-preferences.ts` 对低功耗设备选 low quality，这本来就是应用行为，不是 0.4.5 新优化。建议等官方 delta 或在实际设备验证后再升。

### 6.4 evlog 2.19.2 → 2.30.0：中优先，需 React 19.3 配套

来源：[2.21.0](https://github.com/evloghq/evlog/releases/tag/evlog%402.21.0)、[2.22.4](https://github.com/evloghq/evlog/releases/tag/evlog%402.22.4)、[2.29.0](https://github.com/evloghq/evlog/releases/tag/evlog%402.29.0)、[2.30.0](https://github.com/evloghq/evlog/releases/tag/evlog%402.30.0)。

2.21.0 修复 createEvlog redact 应用到主请求事件；2.22.4 避免 redirect／notFound 被当作异常；2.29.0 将 Next global drains 延后并用 `after()` 等待送达，具有请求生命周期／日志可靠性价值；2.30.0 改善 Error cause 序列化等。

`apps/calendar/lib/evlog.ts` 使用 createEvlog、自定义 drain、auditOnly 和 hash-chain，redact 在 drain 内自行执行。需要检查新版后台交付与当前 `auditOnly(...,{await:true})` 的顺序保证，不能把日志延后无条件当作更快或同等持久性。release 中标为 Performance 的“更新 benchmark baseline”不是代码优化。大量 Evi／Eve、CLI、其他框架内容与当前运行路径无关。

最新 optional peers 包含 Next `>=16.3.4`、React `>=19.3.0`、ai `>=6.0.168 <8`；Calendar 的 Next 已满足，React 19.2.7 不满足。**暂不纳入保留 React 19.2 的首批**，等待 React 配套后评估。

### 6.5 ioredis 5.11.1 → 6.0.0：暂缓，默认协议是破坏性变化

来源：[6.0.0 官方 release](https://github.com/redis/ioredis/releases/tag/v6.0.0)。新增 RESP3；修复重连残留 timeout、初始化阶段连接关闭、cluster MOVED 等正确性／安全问题。官方明确：Node `>=20`，**默认从 RESP2 改为 RESP3**，可通过 `protocol:2` 保持旧 wire protocol。

Calendar `lib/cache/client.ts` 与 Meet `lib/rate-limit.ts` 都创建 Redis 客户端，当前未指定 protocol；需要核对 Redis 服务支持、响应类型和缓存／限流失败回退。未见此版本对当前 GET／SET／INCR／EXPIRE 路径有直接吞吐优化证据；项目也不是 Cluster 配置。保留 5.11.1，协议迁移单独实施，不为“性能”盲升。

### 6.6 其他维护候选

| 候选                                          | 官方增量与来源                                                                                                                                                                                                            | 仓库相关性、约束、结论                                                                                                                                                                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@marsidev/react-turnstile` 1.5.3→1.6.1       | [1.5.4–1.6.1 releases](https://github.com/marsidev/react-turnstile/releases)：interaction-only 尺寸、execute 后显示、非法 render 参数交给 onError；1.6.1 有明确错误处理说明。                                             | 共享 auth 表单相关；React／DOM peer 支持 17／18／19。**中优先，正确性**，未见新 CPU／网络性能证据。上游 repo 的依赖安全更新不自动等于本应用 runtime 修复。                                                                                             |
| `@mdx-js/loader`、`@mdx-js/react` 3.1.0→3.1.1 | [3.1.1](https://github.com/mdx-js/mdx/releases/tag/3.1.1)：MDX core 补 acorn 依赖、类型修复；esbuild 和 Vite 部分集成修复。                                                                                               | **低优先，构建兼容**。Calendar 的核心 MDX 已在锁文件为 3.1.1；这两个直接包升级不能再次获取核心历史变化。loader peer webpack>=5，react 包 peer React／types>=16；Next 主构建走自身集成。未见二者特有性能 delta。                                        |
| `drizzle-orm` 0.45.2→0.45.3                   | [0.45.3](https://github.com/drizzle-team/drizzle-orm/releases/tag/0.45.3)：新增 Netlify DB driver。                                                                                                                       | 当前用 postgres-js，`postgres:>=3` peer 满足；**低优先／可保持**，无本项目查询提速证据。不要把 1.0 RC 的改进计入此补丁。                                                                                                                               |
| `lucide-react` C 1.48.0、M/H/U 1.21.0→1.52.0  | [1.52.0](https://github.com/lucide-icons/lucide/releases/tag/1.52.0)、[1.21.0…1.52.0](https://github.com/lucide-icons/lucide/compare/1.21.0...1.52.0)：主要图标新增、几何和名称调整。                                     | **中低优先，同步版本有维护价值**；仅同版不保证应用 bundle 变小。1.41 release 提到移除 trash 图标，需核对旧 imports／aliases／图标目录。React peer 接受19，新增 optional types peer 要遵循全局 override。未见当前区间独立渲染性能证据。                 |
| `react-icons` 5.6.0→5.7.0                     | [5.7.0](https://github.com/react-icons/react-icons/releases/tag/v5.7.0)：更新上游图标集合。                                                                                                                               | React peer `*`；**低优先，功能／视觉变更**。图标数量增加不代表性能优化；6.0 beta 不纳入。                                                                                                                                                              |
| `resend` 6.14.0→6.32.0                        | [6.32.0](https://github.com/resend/resend-node/releases/tag/v6.32.0)：request cancellation、所有方法可传 request options、batch HeadersInit 修复；此前多为 contacts／webhooks／broadcast 功能。                           | Calendar reminders 和 `packages/auth/src/email.ts` 发信相关；Node>=20，optional `@react-email/render` peer。**中低优先**。取消必须传 signal 才可减少无用等待，升包不会自动缩短邮件网络延迟。上游示例的 Next 安全升级不算本包 runtime 性能。            |
| `shadcn` 4.11.0→4.21.1                        | [4.13.1](https://github.com/shadcn-ui/ui/releases/tag/shadcn%404.13.1)修复 registry redirect 凭据、路径遍历和依赖 flag 注入；[4.21.1](https://github.com/shadcn-ui/ui/releases/tag/shadcn%404.21.1)抽出 registry engine。 | **下次使用 CLI 前优先更新，属于开发工具安全**。虽然放在 dependencies，它不会自动更新已复制到 `packages/ui/src` 的组件。Node>=20.18.1；4.13 默认 Base UI、4.21 默认 cn，注意现有 radix-nova 项目生成差异。`@zntr/utils` 已使用 cn，不重复计为新增优化。 |

## 7. devDependencies 与类型：有些值得，但不改善线上速度

### 7.1 Vitest 4.1.10 → 5.0.3：真实测试性能，先解决 Node 约束

来源：[4.1.11](https://github.com/vitest-dev/vitest/releases/tag/v4.1.11)、[5.0.0](https://github.com/vitest-dev/vitest/releases/tag/v5.0.0)、[5.0.3](https://github.com/vitest-dev/vitest/releases/tag/v5.0.3)、[官方迁移文档](https://vitest.dev/guide/migration)、[fsModuleCache](https://vitest.dev/config/fsModuleCache)。

5.0 有真实增量：worker 一次往返获取 warm modules、减少无用预热、缓存 key 重复 hash、降低大图 `--changed` 峰值内存；vm pools 不再保留所有完成的测试文件。文件系统缓存可跨进程复用，Node compile cache 是 opt-in，不能默认认为全部启用。5.0.3 修复缓存模块 import 重验证等问题。

本仓库 8 个工作区都有 Vitest devDependency，Calendar／Meet／auth 的组件测试使用 jsdom，这类收益属于**测试启动时间／内存**。没有线上用户性能收益。未使用 vm pool／coverage 的路径不能直接套用那些专属优化。

**实际 blocker：**5.0.3 engine 是 `^22.12.0 || ^24.0.0 || >=26.0.0`，明确不包含 Node 25；而 `.github/workflows/tsc.yml:19` 与 `translate.yml:21` 当前选择 Node 25。即便前者只跑类型检查，其安装步骤仍会遇到 engine 约束。不能只读文档的“Node >=22.12”概括就判兼容。

Vite peer 要求 `^6.4.0 || ^7 || ^8`，当前 Vitest 对应锁解析使用 Vite 8.2.0，满足。5.0 删除旧 entrypoints 和 sequential 测试选项；本项目 `vitest/config`、globals、jsdom 本身仍是支持项，测试调用与插件尚需专项核对。Better Auth 1.7.4 才添加 Vitest 5 支持，现有 1.7.2 也是协调因素。

**建议现在的保守目标为 4.1.11**：官方 V4 tag、实际 npm 发布和 release 均存在；修复全局测试生命周期并发限制及 mock redirect fs allowlist，engine 仍覆盖 Node25。5.0.3 独立安排 Node／认证／测试迁移批次。将来若用户允许验证，继续保持 `NODE_OPTIONS='--max-old-space-size=1024'` 与 `--maxWorkers=1`；本次没有运行任何测试。

### 7.2 jsdom 29.1.1 → 30.1.2：真实测试内存优化，暂缓

来源：[30.0.0](https://github.com/jsdom/jsdom/releases/tag/v30.0.0)、[30.1.0](https://github.com/jsdom/jsdom/releases/tag/v30.1.0)、[30.1.2](https://github.com/jsdom/jsdom/releases/tag/v30.1.2)。

30.1.0 改善 DOM 构造／变更、live collection、computed style、事件分发性能，降低 nodes／listeners／MutationObserver 内存，并修复已关闭 window 保留等泄漏；30.1.2 继续缩小 CSS definitions 内存、修复 observer bookkeeping 泄漏和深层继承 CSS 变量的指数慢读。30.1.2 修复大型 DOM 构建慢的部分是 **30.1.0 新引入回归**，不等于旧 29.1.1 必然比它慢。

Calendar 的事件编辑器及弹层焦点测试、Meet 设置 UI 测试均可能受益，但 jsdom 不在浏览器生产包里。Node engine 为 **`^22.22.2 || ^24.15.0 || >=26.0.0`**，同样排除当前 CI Node25，且比 Vitest5 的最低版本更严格。新增 focus／blur、computed style 行为会改变断言，应该整体迁移而非混入线上小补丁。canvas peer 为可选，非必须安装。

### 7.3 Testing Library 与类型包

| 候选                                     | 官方证据                                                                                                                                                                                            | 约束与建议                                                                                                                                                                                                           |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@testing-library/react` 16.3.2→16.3.3   | [16.3.3](https://github.com/testing-library/react-testing-library/releases/tag/v16.3.3)：避免 dispatch events 时 act() 重入。                                                                       | **中优先的小测试补丁**；React／DOM／types 支持18／19，`@testing-library/dom:^10.0.0`，Node>=18。当前锁中 dom10.4.1满足；没有运行时或明确测试性能增量。                                                               |
| `@testing-library/jest-dom` 6.10.0→7.0.1 | [7.0.0](https://github.com/testing-library/jest-dom/releases/tag/v7.0.0)新增 query matchers；[7.0.1](https://github.com/testing-library/jest-dom/releases/tag/v7.0.1)声明 Vitest optional peer。    | **低优先，和测试栈统一**。Node>=22；`@testing-library/dom` 变为必需 peer，范围 `>=10 <11`。目前未在这几个 manifest 直接声明 dom，锁有10.4.1不代表未来严格 peer 安装可随意忽略。无性能 delta。                        |
| `@types/node` 25.6.0→26.6.4              | [npm registry](https://registry.npmjs.org/@types%2Fnode)、[官方维护源](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/node)；发行包 README 确认源目录及 2026-10-01 更新时间。 | **暂缓盲追 latest**：类型应匹配部署／CI Node，当前 CI25，升级类型不升级运行时。未取得精确 25.6.0→26.6.4 的官方逐版 release notes，细粒度 delta **未验证**。类型包不产生线上执行速度收益，也没有本项目 tsc 提速证据。 |
| `@types/react` 实际19.2.18→19.3.0        | [npm registry](https://registry.npmjs.org/@types%2Freact)、[官方维护源](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/react)；发行包 README 更新时间 2026-09-09。            | **只随 React19.3 统一升级**。精确类型 diff 的发布说明未取得，细粒度 delta **未验证**。必须改全局 override 并协调 DOM types，不能让 auth 的19.2.2声明误导版本判断；无运行时性能收益。                                 |

## 8. 推荐批次与收益排序

这是后续实施顺序，不是已经执行的升级。

| 顺序       | 建议批次                                                                                                                   | 主要理由／前置条件                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1          | 两应用 Next→16.3.8                                                                                                         | 直接安全补丁；Calendar、Meet 起点不同，统一维护。React可保持当前版本。                              |
| 2          | `streamdown→2.7.0`；`ai→7.0.127`、`@ai-sdk/react→4.0.130`、`groq→4.0.54`；`zod→4.6.5`；MCP server→2.3.0；DayPicker→10.0.2  | 最贴近本项目的 CPU／内存／交互工作量改善；分别提交，便于识别聊天、schema、协议或日期行为变化。      |
| 3          | Meet client→2.22.3、track-processors→0.8.1；server-sdk→2.19.1                                                              | 网络恢复、后台视频和帧率可靠性；server token exp 行为单独核对。                                     |
| 4          | Better Auth 七包→1.7.7、infra→0.4.14、Turnstile→1.6.1                                                                      | **先完成 issuer schema 兼容方案，再共同部署**；安全／认证正确性高价值，但不能当作普通 patch merge。 |
| 5          | React Email→6.11.0；COBE先评估0.6.5；测试补丁 Vitest→4.1.11、RTL→16.3.3；CLI shadcn→4.21.1                                 | 小而明确的产物裁剪、首页 GPU 工作量、测试／工具维护。CLI升级不改已复制UI源码。                      |
| 6          | React／DOM／types19.3、evlog；Fumadocs三包、Motion14、Lucide统一                                                           | 配套 peer／大版本／布局及文档搜索变化，需要独立批次。                                               |
| 7          | Vitest5、jsdom30、jest-dom7及匹配Node工具链                                                                                | 有真实研发性能价值，但目前Node25不在前两者支持范围；不与线上功能升级混成一批。                      |
| 保持／等待 | Krisp（说明不足）、ioredis6（协议变化）、Drizzle0.45.3（新driver不相关）、Recharts（未见页面调用）、react-icons／MDX小更新 | 收益低、条件不成立或未验证。可以按维护需要安排，但不是性能优先项。                                  |

**纯性能性价比顺序：**Streamdown／AI React 流式路径 → Zod schema 内存与 MCP 注册工作量 → Meet 背景处理特定浏览器路径 → DayPicker／React Email 的可裁剪产物。COBE 只影响实际展示地球的 landing；Motion、React、Fumadocs 有库级增量，但依赖组合和实际启用路径使收益更不确定。测试栈另算。

## 9. 证据边界与交接重点

- 66 个外部包都做了实时 registry 查询，45 个候选都在上文有单独或配套组评估；21 个无更新包已逐行标记。无候选被降级或用 prerelease 冒充稳定版。
- “未取得官方 delta”主要涉及 Krisp 和两个 DefinitelyTyped 包；infra 虽公开仓库404，但发行包内有完整 CHANGELOG，已据此评估。
- GitHub monorepo release 列表存在分页；AI SDK 改用固定 tag 的包级完整 CHANGELOG，Fumadocs补读分页及完整 CHANGELOG。报告只对所引用的具体增量作判断，不声称逐个审计所有提交或传递依赖漏洞。
- JSON 中 `latestStableBySemver` 是**机械选取无预发布后缀的最大版本号**，可能包含误发布／deprecated；实际推荐以本报告的 latest 与 deprecated 判断为准。保留该原始字段正是为了暴露 LiveKit／Fumadocs 异常。
- 没有真实 bundle、浏览器帧率、堆快照、p95 API 延迟或测试耗时对照，因此没有应用级性能数字。包的解包字节数也不能替代 gzip bundle 或运行时内存。
- 只做了本地代码相关性核对，没有查询生产 Node／数据库／Redis 配置。Better Auth blocker 是当前 schema 与新写入契约的确定冲突，线上是否已应用0016仍需核实。
- 后续实施遵守资源限制：每个 Node 进程设置 `NODE_OPTIONS='--max-old-space-size=1024'`，允许的专项测试最多一个 worker；当前研究没有运行 build／dev／全量测试或安装。
- 依赖审计只新增研究 Markdown 和 JSON；Turbo 移除由同一任务的主流程完成。既有 `.gitattributes` 删除属于用户原有改动，未改动。
