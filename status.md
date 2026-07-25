# One-Calendar 重构状态追踪

> **本文件不在 git 中追踪**（已在 `.gitignore` 中排除）。
> **用途**：跨 AI session 传递上下文。下一个 AI 会话请先读取本文件，再继续工作。
> **规则**：每完成一个 TODO 就提交 git（不 push），然后更新本文件。

---

## 一、用户原始需求（原文）

> 我想重构（不做兼容性处理）：把 calendar backups 里面也不要赛在一起备份了（以前是把所有的数据挤在一起加密备份的），现在 calendar backups 这个表我想要一条就是一个日程，包括这个日程属于哪个用户（userID），日程的别的信息等（后面的逻辑等你自己补充）。然后由于要大改，所以你可以多加一个 Settings 表里面存用户的所有设置配置例如每周第一天等。然后 share 那个表就改为链接形式，如果是没有加密那么就直接看对应的日程用我们的 salt 解密。如果是有密码加密那就把这个日程的密码加密后直接存 share。还有现在的 countdown、bookmarks、日程分类你都可以多加一个表这样设计，只需要设计的好就可以了。注意更改之后确保一切功能都是正常的，包括但不限于设置的导入导出、分析、搜索、分享、日程分类、倒数日、书签等。有了这个新的数据存储格式之后就可以按需加载数据了，然后完全移除 localstorage 存储数据，全部改成登录之后操作数据库处理。
>
> 但是请注意！你有很强的上下文限制（20万 token），我想请你做一些措施来确保上下文没了之后下一个 request 你还知道自己要做什么,比如在这个项目目录写一个 status.md 文件来记录你说出来的所有提示词和我的提示词以及当前状态和 todo 等，以及我的需求等。然后你每做完一个 todo 就提交一个 git（是提交不是 push！）

### 1.1 用户补充说明（后续对话中确认）

- 不是改 `calendar_backups` 表，是**新建 `calendar_events` 表**，旧的 `calendar_backups` 直接删掉
- Recurrence 不做
- Participants 做（作为 jsonb 列）
- `is_canceled` 不要
- Settings 一行一个用户 jsonb，所有设置上服务器
- SALT 在 env 里面叫做 `SALT`
- Categories/countdowns/bookmarks 有些列需要结合 SALT 加密
- 服务端加解密方案（方案 A），客户端无感知
- 搜索：按日期范围拉取 + 客户端解密搜索
- 不保留旧表（calendar_backups 删掉，shares 重建）
- 现有的 share 链接全部作废
- Participants 作为 calendar_events 的一个 jsonb 列（不单独建表）

---

## 二、Grilling Session 完整问答

### Q1: calendar_backups → events 表设计
- **问**：骨架是否满意？重复事件怎么处理？
- **答**：新建 `calendar_events` 表，不要 recurrence（全是单次），要 participants（jsonb），不要 `is_canceled`。字段基本同意。

### Q2: Settings 表设计
- **问**：一行一个 jsonb 还是 key-value？
- **答**：一行一个用户 jsonb，所有设置都上服务器（包括 toast position, notification sound）。

### Q3: Share 表重构
- **问**：无密码分享的 salt 怎么用？有密码分享存什么？
- **答**：
  - 无密码：`HKDF(SALT, shareId)` 做 key（不用旧的 sha256(shareId)）
  - 有密码：`scrypt(password, shareId)` 做 key
  - 存加密包 JSON `{ ct, iv, tag }`，不再拆三个字段
  - 加 `event_id` 字段引用 events 表
  - 已有的 share 链接全部作废

### Q4: 新表设计
- **问**：categories / countdowns / bookmarks 表设计是否同意？
- **答**：同意。bookmarks 只存 event_id 引用（不冗余 event 数据）。categories 和 countdowns 的 name/description 等字段要加密。

### Q5: 移除 localStorage
- **问**：离线支持？写操作延迟？迁移策略？
- **答**：
  - 不做离线支持
  - 乐观更新（内存缓存先更新，后台 API call）
  - API 失败 toast 提示
  - 迁移：已登录用户首次打开时 POST localStorage 数据到 server

### Q6: 分步顺序
- **问**：建议的顺序是否合理？
- **答**：同意，但微调：1 schema → 2 API → 3 DataProvider → 4 逐个迁移 → 5 清理

### Q7: status.md 机制
- **问**：放根目录还是 docs/？
- **答**：放根目录，不进 git。

### Q8: 搜索方案
- **问**：方案 A（服务端透明加解密）的话搜索怎么处理？
- **答**：按日期范围 SQL 过滤明文字段 → API 解密返回 → 前端 JS 搜索。等数据大了再加 search index。

### Q9: Participants
- **问**：独立表还是 jsonb 列？
- **答**：calendar_events 的 jsonb 列。

### Q10: 加密字段清单
- **问**：哪些字段加密？
- **答**：同意建议。加密：title, description, location, participants, categories.name, countdowns.name, countdowns.description。明文：日期、颜色、sort_order、icon 等。

### Q11: 旧表清理
- **问**：calendary_backups 和旧 shares 怎么处理？
- **答**：删掉重建。

---

## 三、最终 Schema

见 `apps/calendar/lib/drizzle/schema.ts`（170 行），包含：

### 3.1 Better Auth 表（不动）
- `User`, `Session`, `Account`, `Verification`, `twoFactor`

### 3.2 新 App 表（6 个）

| 表名 | 说明 | 加密字段 |
|------|------|----------|
| `calendar_events` | 日程（替代 `calendar_backups`） | title, description, location, participants(jsonb) |
| `settings` | 用户设置（jsonb 一行） | 无（明文 jsonb） |
| `calendar_categories` | 日程分类 | name |
| `countdowns` | 倒数日 | name, description |
| `bookmarked_events` | 书签（只存 event_id） | 无 |
| `shares` | 分享（重建，引用 event_id） | 加密包统一存 encrypted_payload |

### 3.3 删除的旧表
- `calendar_backups` — DROP
- `shares` (旧的) — DROP

---

## 四、加密方案

### 4.1 服务端字段级加密（`lib/field-crypto.ts`）

```
encryptField(rowId, plaintext) → HKDF(SALT, rowId) → AES-256-GCM → JSON { ct, iv, tag }
decryptField(rowId, encrypted) → 反向流程
```

### 4.2 分享加密（`app/api/share/route.ts`）

```
无密码: HKDF(SALT, shareId) → AES-256-GCM
有密码: scrypt(password, shareId, 32) → AES-256-GCM
```

---

## 五、API 清单

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/events` | GET | 按日期范围/分类筛选日程（解密后返回） |
| `/api/events` | POST | 创建/更新日程（加密存储） |
| `/api/events` | DELETE | 删除日程 |
| `/api/settings` | GET | 获取设置 |
| `/api/settings` | PUT | 更新设置（merge） |
| `/api/categories` | GET | 获取分类列表 |
| `/api/categories` | POST | 创建/更新分类 |
| `/api/categories` | DELETE | 删除分类 |
| `/api/countdowns` | GET | 获取倒数日列表 |
| `/api/countdowns` | POST | 创建/更新倒数日 |
| `/api/countdowns` | DELETE | 删除倒数日 |
| `/api/bookmarks` | GET | 获取书签列表（含 event 数据） |
| `/api/bookmarks` | POST | 添加书签 |
| `/api/bookmarks` | DELETE | 删除书签（by id 或 eventId） |
| `/api/share` | POST | 创建分享（需 eventId） |
| `/api/share` | GET | 获取分享数据（?id=xxx&password=） |
| `/api/share` | DELETE | 删除分享 |
| `/api/share/list` | GET | 获取用户分享列表 |
| `/api/blob/*` | * | **已废弃**，返回 410 |

---

## 六、前端架构

```
RootLayout
  └─ DataProvider (fetches all data on mount, provides React context)
      └─ CalendarProvider (Zustand store, hydrates from DataProvider)
          └─ App pages & components
```

### 6.1 Hooks（从 `components/providers/data-provider.tsx` 导出）

| Hook | 返回数据 | 提供方法 |
|------|---------|---------|
| `useData()` | 全部 + loading/error | refresh*, create*, delete*, updateSettings |
| `useEvents()` | events | createEvent, deleteEvent |
| `useCategories()` | categories | createCategory, deleteCategory |
| `useCountdowns()` | countdowns | createCountdown, deleteCountdown |
| `useBookmarks()` | bookmarks | createBookmark, deleteBookmark, deleteBookmarkByEvent |
| `useSettings()` | settings | updateSettings |

### 6.2 API Client（`lib/api-client.ts`）

类型化的封装，所有 CRUD 调用通过 `api.events.list()`, `api.shares.create()` 等。

---

## 七、TODO 清单

### ✅ 已完成

- [x] **1. 设计最终 schema 并写入 status.md**
- [x] **2. 写 schema.ts** — 6 个新表定义 + relations
- [x] **3. drizzle-kit generate** — migration SQL 已生成（在 `apps/calendar/drizzle/`）
  - ⏳ **需要你配置 `.env` 后手动 `drizzle-kit push` 建表**
- [x] **4. 服务端加密** — `lib/field-crypto.ts`
- [x] **5. 全部 CRUD API** — events, settings, categories, countdowns, bookmarks, shares
- [x] **6. DataProvider + hooks** — `data-provider.tsx`, `api-client.ts`
- [x] **7a. settings 迁移** — calendar.tsx 中 `useLocalStorage` → `useSettings()`
- [x] **7b. events/bookmarks 迁移** — handleEventAdd/Update/Delete → API
- [x] **7c. event-preview 迁移** — share creation + bookmark toggle → API
- [x] **7d. countdowns 迁移** — `useLocalStorage` → `useCountdowns()`
- [x] **7e. bookmark-panel 迁移** — `readEncryptedLocalStorage` → `useBookmarks()`
- [x] **7f. categories/sidebar** — 已通过 CalendarProvider 间接从 DataProvider 读取

### ⏳ 待完成 + ⚠️ 已知 Bug（必须先修复）

#### P0 — Share 双重加密 Bug（关键缺陷，分享功能完全不可用）

**Bug 1（share/route.ts POST）**：创建分享时，代码从 DB 读取 `event.title` / `description` / `location`——这些是字段级加密后的密文字符串（`{"ct":"...","iv":"...","tag":"..."}`）。代码直接把这些密文放进 share payload 然后用 share key 再加密一次。接收方解密 share 后拿到的是密文字符串而非可读内容。

**需求**：在放入 share payload 之前，必须用 `decryptField(eventId, event.title)` 解密每个字段。

**Bug 2（share/list/route.ts GET）**：分享列表 JOIN calendarEvents 后直接 select `calendarEvents.title` 作为 `eventTitle` 返回——这是原始加密密文。前端显示分享列表时标题会显示为加密 JSON blob。

**需求**：返回前用 `decryptField(row.id, row.title)` 解密 title。

**修改文件**：`apps/calendar/app/api/share/route.ts` + `apps/calendar/app/api/share/list/route.ts`

---

#### P1 — Migration SQL 未 DROP 旧 shares 表

**问题**：migration SQL 只添加了 `DROP TABLE IF EXISTS "calendar_backups"`。旧 `shares` 表（列：`shareId, encryptedData, iv, authTag, isProtected, isBurn, encVersion`）从未被 DROP。新 `CREATE TABLE "shares"` 同名但结构不同，如果旧表存在会冲突。

**需求**：在 migration SQL 顶部添加 `DROP TABLE IF EXISTS "shares" CASCADE;`（注意：新 shares 表同名，第一次运行时 DROP 会删掉刚建的表——需要确保执行顺序是 DROP → CREATE，或只在建表前执行一次）。

**修改文件**：`apps/calendar/drizzle/0000_opposite_joystick.sql`

---

#### P2 — API 失败无 Toast 提示

**问题**：多处 API 调用使用 `.catch(() => {})` 无声吞掉错误，包括 import-export.tsx、countdown.tsx、data-provider.tsx 中的迁移逻辑。Spec §Q5 明确要求 "API 失败 toast 提示"。

**需求**：将 `catch(() => {})` 替换为 `catch((e) => toast.error(t.operationFailed, { description: e.message }))`。最少需要修复：import-export.tsx 中 categories/countdowns/bookmarks 的 catch blocks；data-provider.tsx 中 migrateFromLocalStorage 的 catch blocks。

**修改文件**：`apps/calendar/components/app/analytics/import-export.tsx`、`apps/calendar/components/providers/data-provider.tsx`

---

#### P3 — Standards 代码味道修复

1. **Duplicated Code**：`getAuthedUser()` 在 5 个 route 文件（bookmarks, categories, countdowns, events, settings）中重复定义。提取到 `apps/calendar/lib/api-helpers.ts`。
2. **Duplicated Code**：`decryptEvent()` 在 bookmarks/route.ts 和 events/route.ts 中主体相同。提取到共享 lib。
3. **Mysterious Name**：`createEvent` 在 calendar.tsx 中实际用于创建和更新（upsert，服务端 upsert）。重命名为 `upsertEvent` 或拆分调用点。

**修改文件**：`apps/calendar/app/api/*/route.ts`、`apps/calendar/components/app/calendar.tsx`

---

#### P4 — 后续可做（非必须）

1. **Primitive Obsession**：替换 `any` 类型转换，使用 `EventData` / `BookmarkData` / `CountdownData` 等已有 domain 类型（import-export.tsx, calendar.tsx, event-preview.tsx 中多处）。
2. **Repeated Switches**：calendar.tsx 中 settings 字段的 if-cascade 改为循环或 map。
3. **删除 dead code 文件**：`usePreferences.ts`, `useEventOperations.ts`, `useViewManagement.ts`, `events-calendar.tsx`, `useBackupSync.ts`, `packages/utils/src/useLocalStorage.ts`, `packages/utils/src/crypto.ts`
4. **i18n.ts 残留 localStorage**：语言偏好仍用 `localStorage.getItem/setItem`，理论上可用 API 通过 settings 表存。但 i18n 是独立包，改起来会导致循环依赖，当前方案可接受。

---

#### 11. 建表 & 测试（用户操作）
- 配置 `.env`（POSTGRES_URL + SALT）后运行 `drizzle-kit push` 建表
- 修复上述 P0-P3 后测试所有功能

---

## 八、Git 提交历史（重构相关）

```
（最新 commit 在 866879a 之后）
xx(未定) fix: decrypt event fields before embedding in share payload
xx(未定) fix: add DROP old shares table to migration SQL
xx(未定) fix: add toast on API failure for import-export and data-provider
xx(未定) refactor: extract shared getAuthedUser() and decryptEvent() to api-helpers
xx(未定) docs: add review findings to status.md with priority levels

866879a refactor: complete localStorage purge across all components

此前提交：
aa95e1f docs: update status.md with current progress
71cab3d refactor: migrate bookmark-panel from localStorage to DataProvider
3558e0d refactor: migrate countdown component from localStorage to DataProvider
1b8d8cb refactor: migrate event-preview share + bookmark logic to API
c3eeb4f refactor: migrate settings + event mutations from localStorage to DataProvider
08b927d feat: add DataProvider + API client frontend layer
5e14933 feat: add field-level encryption and CRUD APIs
bf6260c feat: add new schema tables (events, settings, categories, countdowns, bookmarks, shares)
47f51be chore: add status.md tracking file (gitignored)
```

---

## 九、关键文件清单

### 新增文件
| 文件 | 说明 |
|------|------|
| `apps/calendar/lib/drizzle/schema.ts` | 全部新表定义（170 行） |
| `apps/calendar/lib/field-crypto.ts` | SALT + HKDF + AES-GCM 服务端加解密 |
| `apps/calendar/lib/api-client.ts` | 前端类型化 API 客户端 |
| `apps/calendar/components/providers/data-provider.tsx` | DataProvider + useData/useEvents/useSettings/useCategories/useCountdowns/useBookmarks |
| `apps/calendar/app/api/events/route.ts` | events CRUD（加密存储 title/description/location/participants） |
| `apps/calendar/app/api/settings/route.ts` | settings CRUD（jsonb merge） |
| `apps/calendar/app/api/categories/route.ts` | categories CRUD（加密 name） |
| `apps/calendar/app/api/countdowns/route.ts` | countdowns CRUD（加密 name/description） |
| `apps/calendar/app/api/bookmarks/route.ts` | bookmarks CRUD（含 JOIN events） |
| `apps/calendar/app/api/share/route.ts` | shares 重建（HKDF + event_id 引用）⚠️ 需修复：分享前未解密事件字段 |
| `apps/calendar/app/api/share/list/route.ts` | shares 列表 ⚠️ 需修复：eventTitle 返回加密密文 |
| `apps/calendar/drizzle/0000_opposite_joystick.sql` | 初始 migration |

### 修改文件
| 文件 | 改动要点 |
|------|---------|
| `.gitignore` | 添加 status.md |
| `apps/calendar/app/layout.tsx` | 添加 DataProvider 包裹层 |
| `apps/calendar/app/api/blob/route.ts` | 标记为 deprecated（410） |
| `apps/calendar/app/api/account/route.ts` | 适配新表名（calendarEvents, settings 等） |
| `apps/calendar/components/providers/calendar-context.tsx` | 从 DataProvider 读取数据替代 localStorage |
| `apps/calendar/components/app/calendar.tsx` | useLocalStorage → useSettings/useEvents; 移除 backup 状态/效果；notification 改为 `useNotifications(events, sound)` hook |
| `apps/calendar/components/app/event/event-preview.tsx` | share/bookmark 改用 API |
| `apps/calendar/components/app/sidebar/countdown.tsx` | useLocalStorage → useCountdowns |
| `apps/calendar/components/app/sidebar/bookmark-panel.tsx` | localStorage → useBookmarks |
| `apps/calendar/components/app/profile/user-profile-button.tsx` | 重写（移除 backup，保留账户管理），1619 → ~570 行 |
| `apps/calendar/components/app/analytics/import-export.tsx` | 重写（移除 localStorage/crypto，全部走 API），1321 → ~1127 行 |
| `apps/calendar/components/providers/data-provider.tsx` | 添加 localStorage → API 一次性迁移逻辑 |
| `apps/calendar/lib/notifications.ts` | 改为接受 events 参数而非读 localStorage |
| `apps/calendar/components/app/hooks/useNotifications.ts` | 改为接受 events 参数 |
| `apps/calendar/components/app/hooks/usePreferences.ts` | 移除 backup-restored 事件监听 |
| `packages/i18n/src/i18n.ts` | useLanguage hook 改为 plain localStorage |
| `packages/utils/src/index.ts` | 移除 useLocalStorage / crypto 的 re-export |
| `apps/calendar/drizzle/0000_opposite_joystick.sql` | 顶部添加 DROP calendar_backups |

---

## 十、2026-07-25 Code Review 发现总结

对照基准：`8278ebc4...HEAD`（12 个 commits，31 文件，+3494/-1844 行）。
两个独立轴：Standards（代码味道） + Spec（需求符合度）。

### Standards 发现（6 个）

| # | 味道 | 位置 | 说明 |
|---|------|------|------|
| S1 | Duplicated Code | `*/*/route.ts` ×5 | `getAuthedUser()` 在 5 个 route 重复定义 |
| S2 | Duplicated Code | bookmarks + events route | `decryptEvent()` 主体相同 |
| S3 | Primitive Obsession | import-export, calendar, event-preview | 多处 `any` 转换，应使用 domain 类型 |
| S4 | Repeated Switches | calendar.tsx | settings 初始化 if-cascade |
| S5 | Shotgun Surgery | 15+ files | localStorage→API 迁移横跨过多文件 |
| S6 | Mysterious Name | calendar.tsx | `createEvent` 实际做 upsert |

### Spec 发现（8 个）

| # | 类型 | 严重度 | 说明 |
|---|------|--------|------|
| M1 | 实现错误 | **P0** | Share POST 未解密事件字段就嵌入 payload（双重加密） |
| M2 | 实现错误 | **P0** | Share list 返回加密密文作为 eventTitle |
| M3 | 缺失 | **P1** | Migration SQL 未 DROP 旧 shares 表 |
| M4 | 缺失 | **P2** | API 失败无 toast（`catch(() => {})` 吞错误） |
| M5 | 缺失 | P3 | localStorage→API 迁移只做 settings，不做 events（旧数据可解密时才需要） |
| M6 | 残留 | P3 | i18n.ts 仍用 localStorage（非敏感，可接受） |
| M7 | 范围膨胀 | P4 | account/route.ts 多余的存在性检查 |
| M8 | 范围膨胀 | P4 | SettingsData 多余字段 |

### 下个 AI 的入口
详见 §十一「待完成 + 已知 Bug」。
**先从 P0 开始**（share 双重加密），然后 P1→P2→P3→P4。

---

## 十一、下一个 AI 指南

如果你是新接手的 AI，请按以下步骤：

1. **先读本文件** — 了解上下文
2. **配置 `.env`** — `cp .env.example .env`，填 `POSTGRES_URL` 和 `SALT`
3. **建表** — `pnpm --filter one-calendar exec drizzle-kit push`
4. **从 §十一 P0 开始修复** — 先修 share 双重加密 Bug
5. **每完成一个 TODO** — `git add ... && git commit -m "..."`，然后更新本文件
