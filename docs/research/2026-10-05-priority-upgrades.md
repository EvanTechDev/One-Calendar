# 高优先级依赖升级实施

本次执行 [依赖审计](./2026-10-05-dependency-upgrade-audit.md) 中的高优先项，以及配套的认证、邮件和 Meet 服务端更新。审计清单保留升级前的版本快照。

| 包                                             | 升级版本                   | 范围                       |
| ---------------------------------------------- | -------------------------- | -------------------------- |
| Next.js                                        | 16.3.8                     | Calendar、Meet、根开发依赖 |
| Streamdown                                     | 2.7.0                      | Calendar                   |
| AI SDK / React / Groq                          | 7.0.127 / 4.0.130 / 4.0.54 | Calendar、agent            |
| Zod                                            | 4.6.5                      | Calendar、agent            |
| MCP server                                     | 2.3.0                      | Calendar                   |
| DayPicker                                      | 10.0.2                     | ui                         |
| LiveKit client / track-processors / server-sdk | 2.22.3 / 0.8.1 / 2.19.1    | Meet                       |
| Better Auth 及同版本配套包                     | 1.7.7                      | auth                       |
| Better Auth infra / Turnstile                  | 0.4.14 / 1.6.1             | auth                       |
| React Email                                    | 6.11.0                     | auth                       |
| shadcn CLI                                     | 4.21.1                     | Calendar、Meet             |

## Better Auth 部署顺序

**先在 Calendar 和 Meet 共用的数据库执行 `apps/calendar/drizzle/0022_relax_legacy_account_issuer.sql`，再部署两应用。**

Better Auth 1.7.3 起以 `(providerId, accountId)` 识别账号，注册和关联账号不再写入 `issuer`。本项目的迁移 0016 曾将该列设为 `NOT NULL`，所以只更新 npm 包会导致新账号写入失败。

迁移 0022 与共享 Drizzle schema 同步：

- 允许 `issuer` 为 NULL，保留已有值、账号 ID 和密码哈希。
- 删除旧的 `account_issuer_accountId_uidx`。
- 保留 `Account_providerId_accountId_key`，继续禁止重复的 provider/account 组合。

迁移已加入 Drizzle journal。旧的 0014–0021 SQL 不全部在现有 journal 中；本次没有重排历史记录。部署数据库须已经具备这些历史迁移要求的表结构，不能把当前 journal 当作完整的新库初始化脚本。

此代码变更不代表生产数据库已执行迁移。

来源：[Better Auth 1.7 升级指南](https://better-auth.com/docs/guides/1-7-upgrade-guide#account-identity-keeps-the-provider-key)。

另将 `jose` 6.x 统一到 6.2.12（不改 5.x）：它是 `@better-auth/core` 的 peer，不同版本会让 pnpm 安装两份 core。新版 adapter 在模块内 WeakMap 注册 schema 检查，若 Better Auth 读取另一份 core 的注册表，就会静默跳过检查。新增真实 adapter/core 集成测试先复现 `checkSchema` 为 undefined，再验证统一依赖后检查正常执行。

## Zod 日期兼容

Zod 4.5 起带时区的 datetime 默认要求秒。日程写入和已签发搜索分页 token 仍需接受旧的分钟精度格式，所以显式接受分钟与秒／小数秒两种精度，同时继续要求时区并验证真实日期。

来源：[Zod 4.5](https://github.com/colinhacks/zod/releases/tag/v4.5.0)。

## 验证结果

- 18 个定向测试文件、198 项测试通过，覆盖 AI 工具／搜索／流式内容、真实 MCP SDK 调用、OAuth 注册／PKCE／刷新令牌、邮件渲染和 Meet 令牌／偏好设置。
- 全 workspace `lint:check`、新增／修改测试文件 lint、离线 frozen-lockfile 安装检查通过。
- 迁移测试在隔离的 `auth_test` schema 中用真实 PostgreSQL 执行两次 0022，验证幂等性、旧密码哈希保留、新账号无需 issuer、provider/account 唯一性。生产表未执行迁移。
- Meet 和全部六个 packages 类型检查通过。Calendar 仍有升级前已有的 `app/api/events/route.ts:948` 的 `seriesStartDate` 类型错误，本次未引入新的类型错误。
- `pnpm peers check` 的两项旧告警仍存在：CLI 间接依赖的 Zod 3.24.1 不满足 zod-to-json-schema 的 peer；根／其他 app 的 React DOM 19.2.8 与 React 19.2.7 不匹配。已与升级前 lockfile 对照，Calendar／Meet 的 React 和 React DOM 均为 19.2.7。
- 未运行 build、dev 或全量测试。Node 命令使用 1024 MiB 堆限制，测试单 worker 串行执行。

定向测试不等于生产性能基准；本次未测量实际帧率、首屏耗时或 bundle 体积变化。

## Standards

未发现违反仓库规范的问题。

## Spec

最初发现 Better Auth 双 core 实例导致 schema 检查丢失，已统一 JOSE peer，并经运行时回归测试和二次审查确认修复。全部高优先项已覆盖，无遗留问题。
