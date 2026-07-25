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

### ⏳ 待完成

#### 7g. import-export 重写（`components/app/analytics/import-export.tsx`，1321 行）
- 当前读写 localStorage，需要改为从 API fetch 数据导出 / POST 导入
- 文件已存在，搜索 `readEncryptedLocalStorage` / `writeEncryptedLocalStorage` 定位所有需要改的地方
- 导出格式不变但数据来源改为 API，目标改为让用户下载
- 导入改为 POST 到对应 API

#### 7h. user-profile-button 重写（`components/app/profile/user-profile-button.tsx`，1619 行）
- **移除 backup 功能**（blob API 已返回 410）
- 保留：账户信息展示、邮箱更改、密码更改、2FA、删除账号
- 移除：auto-backup toggle、backup key rotation、sync status
- 这是一个大文件，建议分段重写

#### 8. 移除所有 localStorage 代码
- `packages/utils/src/useLocalStorage.ts` — 确认无引用后可删除
- `packages/utils/src/crypto.ts` — Web Crypto API 部分（客户端加密）是否保留？旧版客户端加密密码可能不再需要
- 确保所有 `readEncryptedLocalStorage` / `writeEncryptedLocalStorage` 调用已移除
- `localStorage.getItem` / `setItem` 调用（主要在 user-profile-button 中）

#### 9. 一次性数据迁移逻辑
- 已登录用户首次打开时，把 localStorage 中现有的 events/categories/countdowns/bookmarks/settings POST 到对应的 API
- 建议放在 `DataProvider` 首次加载时检查 `settings` 表是否有数据，如果为空则尝试从 localStorage 迁移

#### 10. 清理旧表
- `DROP TABLE IF EXISTS calendar_backups CASCADE;`
- `DROP TABLE IF EXISTS shares CASCADE;`（旧的 shares 表）
- 注意：新 shares 表同名但结构不同，migration 应该会自动处理

---

## 八、Git 提交历史（重构相关）

```
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
| `apps/calendar/app/api/share/route.ts` | shares 重建（HKDF + event_id 引用） |
| `apps/calendar/app/api/share/list/route.ts` | shares 列表 |
| `apps/calendar/drizzle/0000_opposite_joystick.sql` | 初始 migration |

### 修改文件
| 文件 | 改动要点 |
|------|---------|
| `.gitignore` | 添加 status.md |
| `apps/calendar/app/layout.tsx` | 添加 DataProvider 包裹层 |
| `apps/calendar/app/api/blob/route.ts` | 标记为 deprecated（410） |
| `apps/calendar/app/api/account/route.ts` | 适配新表名（calendarEvents, settings 等） |
| `apps/calendar/components/providers/calendar-context.tsx` | 从 DataProvider 读取数据替代 localStorage |
| `apps/calendar/components/app/calendar.tsx` | useLocalStorage → useSettings/useEvents |
| `apps/calendar/components/app/event/event-preview.tsx` | share/bookmark 改用 API |
| `apps/calendar/components/app/sidebar/countdown.tsx` | useLocalStorage → useCountdowns |
| `apps/calendar/components/app/sidebar/bookmark-panel.tsx` | localStorage → useBookmarks |

---

## 十、下一个 AI 指南

如果你是新接手的 AI，请按以下步骤：

1. **先读本文件** — 了解上下文
2. **配置 `.env`** — `cp .env.example .env`，填 `POSTGRES_URL` 和 `SALT`
3. **建表** — `pnpm --filter one-calendar exec drizzle-kit push`
4. **检查当前 TODO** — 从「待完成」列表选一个开始
5. **每完成一个 TODO** — `git add ... && git commit -m "..."`，然后更新本文件

### 当前最佳切入点
从「7g. import-export 重写」开始，或者先跑 migration 建表后测试现有 API 是否正常。
