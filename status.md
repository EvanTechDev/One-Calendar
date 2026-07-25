# One-Calendar 重构状态追踪

> 本文件自动跟踪重构进度，每次提交前更新。
> **不在 git 中追踪**（已在 `.gitignore` 中排除）。

---

## 决策记录

### 核心设计原则
- **服务端加密**：敏感字段用 env `SALT` + AES-GCM 加解密（方案 A），客户端无感知
- **无 localStorage**：所有数据存 PostgreSQL，前端通过 API + 内存缓存读写
- **不兼容旧版**：现有 share 链接全部作废，旧表删掉重建
- **无 recurrence**：events 全是单次事件
- **commit 频率**：每完成一个 TODO 提交一次（不 push）

### 加密策略
- 算法：`HKDF(SALT, row_id)` 派生 key → AES-256-GCM 加密
- 敏感字段：`title`, `description`, `location`, `participants`, categories.`name`, countdowns.`name`, countdowns.`description`
- 明文字段：`start_date`, `end_date`, `color`, `category_id`, `sort_order`, `icon`, `target_date`, `user_id`, `event_id` 等
- **搜索方案**：按日期范围 SQL 过滤明文字段 → 客户端拉取 → 服务端解密返回明文 → 前端 JS 搜索

---

## 最终 Schema 设计

### `calendar_events`（新建，替代旧的 calendar_backups）

```sql
CREATE TABLE calendar_events (
  id          TEXT PRIMARY KEY,          -- UUID
  user_id     TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,             -- 加密存储
  description TEXT,                      -- 加密存储
  location    TEXT,                      -- 加密存储
  start_date  TIMESTAMPTZ NOT NULL,      -- 明文
  end_date    TIMESTAMPTZ NOT NULL,      -- 明文
  is_all_day  BOOLEAN NOT NULL DEFAULT false,
  color       TEXT,                      -- 明文（hex color）
  category_id TEXT REFERENCES calendar_categories(id) ON DELETE SET NULL,
  participants JSONB,                    -- 加密存储  [{ name, email, userId? }]
  notification_minutes INTEGER,          -- 明文
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_user_id ON calendar_events(user_id);
CREATE INDEX idx_events_start_date ON calendar_events(user_id, start_date);
```

### `settings`（新建）

```sql
CREATE TABLE settings (
  user_id TEXT NOT NULL PRIMARY KEY REFERENCES "User"(id) ON DELETE CASCADE,
  data    JSONB NOT NULL DEFAULT '{}',   -- 所有设置明文存 jsonb
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

settings.data 结构（对应旧 localStorage keys）:
```json
{
  "language": "zh-CN",
  "firstDayOfWeek": 1,
  "timezone": "Asia/Shanghai",
  "defaultView": "month",
  "timeFormat": "24h",
  "theme": "system",
  "enableShortcuts": true,
  "notificationSound": "default",
  "toastPosition": "bottom-right",
  "autoBackupEnabled": false,
  "skipLanding": false,
  "todayToast": null
}
```

### `calendar_categories`（新建）

```sql
CREATE TABLE calendar_categories (
  id         TEXT PRIMARY KEY,           -- UUID
  user_id    TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,              -- 加密存储
  color      TEXT NOT NULL,              -- 明文（hex color）
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_categories_user_id ON calendar_categories(user_id);
```

### `countdowns`（新建）

```sql
CREATE TABLE countdowns (
  id          TEXT PRIMARY KEY,          -- UUID
  user_id     TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,             -- 加密存储
  target_date TIMESTAMPTZ NOT NULL,      -- 明文
  repeat      TEXT NOT NULL DEFAULT 'none' CHECK (repeat IN ('none','weekly','monthly','yearly')),
  description TEXT,                      -- 加密存储
  color       TEXT,                      -- 明文
  icon        TEXT,                      -- 明文（lucide icon name）
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_countdowns_user_id ON countdowns(user_id);
```

### `bookmarked_events`（新建）

```sql
CREATE TABLE bookmarked_events (
  id         TEXT PRIMARY KEY,           -- UUID
  user_id    TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  event_id   TEXT NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_id)
);
CREATE INDEX idx_bookmarks_user_id ON bookmarked_events(user_id);
CREATE INDEX idx_bookmarks_event_id ON bookmarked_events(event_id);
```

### `shares`（重建）

```sql
CREATE TABLE shares (
  id          TEXT PRIMARY KEY,          -- UUID
  user_id     TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  event_id    TEXT NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  encrypted_payload TEXT NOT NULL,       -- 加密包 JSON { ciphertext, iv, authTag }
  has_password BOOLEAN NOT NULL DEFAULT false,
  burn_after_read BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_shares_user_id ON shares(user_id);
CREATE INDEX idx_shares_event_id ON shares(event_id);
```

### 加密工具函数（新增到 `packages/utils/src/crypto.ts`）

```typescript
// 使用 env SALT 的服务端加解密
// deriveKey(salt: string, rowId: string) => HKDF(salt, rowId) → AES-256-GCM key
// encryptField(salt, rowId, plaintext) => { ciphertext, iv }
// decryptField(salt, rowId, ciphertext, iv) => plaintext
```

---

## 删除的旧表

| 旧表 | 操作 |
|------|------|
| `calendar_backups` | DROP |
| `shares` (旧的) | DROP |

---

## TODO 清单

### ✅ 已完成
- [x] **1. 设计最终 schema 并写入 status.md**
- [x] **2. 写 schema.ts** — 6 个新表定义 + 所有 relations
- [x] **3. 生成 drizzle migration SQL** (`drizzle-kit generate` 成功)
  - ⏳ 需要你配置 `.env` 后手动 `drizzle-kit push`
- [x] **4. 加服务端加密函数** → `lib/field-crypto.ts` (HKDF + AES-GCM)
- [x] **5. 写 CRUD API:**
  - [x] 5a. `/api/events` — calendar_events CRUD
  - [x] 5b. `/api/settings` — settings CRUD
  - [x] 5c. `/api/categories` — categories CRUD
  - [x] 5d. `/api/countdowns` — countdowns CRUD
  - [x] 5e. `/api/bookmarks` — bookmarked_events CRUD
  - [x] 5f. `/api/share` — shares 重建 (HKDF + event_id)
- [x] **6. 写前端 DataProvider + hooks 层**
  - [x] 6a. `lib/api-client.ts` — 类型化 API 封装
  - [x] 6b. `components/providers/data-provider.tsx` — React context + hooks
  - [x] 6c. 更新 CalendarProvider 从 DataProvider 读取数据

### ⏳ 待完成
- [ ] **7. 前端 feature 迁移**
  - [ ] 7a. settings 组件 → useSettings() hook
  - [ ] 7b. categories 组件 → useCategories() hook
  - [ ] 7c. events + bookmarks 组件 → DataProvider API
  - [ ] 7d. countdowns 组件 → useCountdowns() hook
  - [ ] 7e. share 组件 → 新 api-client
- [ ] **8. 移除所有 localStorage 代码**
  - [ ] `packages/utils/src/useLocalStorage.ts` 移除
  - [ ] `packages/utils/src/crypto.ts` 清理（Web Crypto API 保留？）
  - [ ] 所有 `readEncryptedLocalStorage`/`writeEncryptedLocalStorage` 调用移除
- [ ] **9. 一次性数据迁移逻辑（localStorage → server）**
- [ ] **10. 清理旧表（DROP calendar_backups, old shares）**

## 新增文件清单

| 文件 | 说明 |
|------|------|
| `lib/drizzle/schema.ts` | 全部新表定义 |
| `lib/field-crypto.ts` | SALT + HKDF + AES-GCM 服务端加解密 |
| `lib/api-client.ts` | 前端类型化 API 客户端 |
| `components/providers/data-provider.tsx` | DataProvider + useData hooks |
| `app/api/events/route.ts` | events CRUD |
| `app/api/settings/route.ts` | settings CRUD |
| `app/api/categories/route.ts` | categories CRUD |
| `app/api/countdowns/route.ts` | countdowns CRUD |
| `app/api/bookmarks/route.ts` | bookmarks CRUD |
| `app/api/share/route.ts` | shares 重建 |
| `app/api/share/list/route.ts` | shares 列表 |
| `drizzle/0000_opposite_joystick.sql` | 初始 migration |

## 修改文件清单

| 文件 | 改动 |
|------|------|
| `.gitignore` | 添加 status.md |
| `app/layout.tsx` | 添加 DataProvider 包裹层 |
| `app/api/blob/route.ts` | 标记为 deprecated（410） |
| `app/api/account/route.ts` | 适配新表名 |
| `components/providers/calendar-context.tsx` | 使用 DataProvider 替代 localStorage |

---

## 会议记录

### Grilling Session — 2026-07-25

**用户目标：**
- 把 localStorage 全部替换为数据库操作
- 按需加载数据
- 独立表存每个实体（events, categories, countdowns, bookmarks）
- Settings 表统管用户配置
- Share 表重建为 event_id 引用 + 新加密格式
- 服务端加密敏感字段（SALT from env）
- 不做兼容性处理（旧 share 链接作废）

**关键决策：**
1. 新建 `calendar_events` 表代替 `calendar_backups`（后者删除）
2. Recurrence 不做，但 Participants 做（jsonb 列）
3. Settings 一行一个用户（jsonb）存所有配置
4. 服务端 `HKDF(SALT, row_id)` + AES-GCM 加密敏感字段
5. 搜索：日期范围 SQL 过滤 → API 解密返回 → 前端搜索
6. Bookmarks 只存 event_id 引用
7. 数据迁移：用户首次打开时 POST localStorage 数据到 server
8. 离线暂时不支持

**Grilling Q&A:**

- Q1: calendar_backups → events 表设计
- Q2: Settings 一行一个用户 jsonb
- Q3: Share 改用 SALT HKDF，存加密包，加 event_id
- Q4: 新表设计审核（categories, countdowns, bookmarks）
- Q5: 移除 localStorage 策略（DataProvider + hooks + 内存缓存）
- Q6: 分步顺序
- Q7: status.md 位置（根目录，不进 git）
- Q8: 搜索方案（按日期范围拉 + 客户端搜索）
- Q9: Participants 作为 jsonb 列
- Q10: 加密字段清单确认
- Q11: shares 表重建（旧表删除）
