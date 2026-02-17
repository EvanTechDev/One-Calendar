# 全站性能优化建议（One Calendar）

本文档聚焦以下目标：减包、提速、静态化、减少请求、适配 Cloudflare Edge Cache/Brotli，并保证业务功能不变。

## 已落地改动

### 1) /app 页面主模块懒加载
- 在 `app/(app)/app/page.tsx` 使用 `next/dynamic` 懒加载 `Calendar`。
- 未加载完成前复用 `AuthWaitingLoading`，避免白屏。

### 2) 日历核心大模块按需拆包
- 在 `components/app/calendar.tsx` 对以下重模块改为动态导入：
  - `DayView`
  - `WeekView`
  - `MonthView`
  - `YearView`
  - `AnalyticsView`
  - `Settings`
- 优点：首次进入 `/app` 不再一次性下载所有视图代码，明显降低主 bundle。

### 3) Edge Cache 友好的缓存头
- 在 `next.config.mjs` 增加 `headers()`：
  - `/_next/static/:path*`：`public, max-age=31536000, immutable`
  - `/app`：`public, s-maxage=120, stale-while-revalidate=600`
- 作用：
  - 静态构建产物可长期缓存。
  - `/app` 可在 CDN 层做短时缓存并后台刷新。

---

## 进一步建议（含示例）

### A. 组件懒加载清单（可继续推进）

1. `EventDialog`、`EventPreview`：仅在打开时加载。
2. 右侧栏 `RightSidebar`：首屏可先占位，交互后再加载。
3. 非关键营销区块（首页）使用 `dynamic` + `ssr: true/false` 视实际 SEO 需求。

示例：

```tsx
const EventDialog = dynamic(() => import("@/components/app/event/event-dialog"), {
  loading: () => null,
})
```

### B. Tree-shaking 与依赖瘦身

1. 避免从聚合入口导入整个工具库。
2. `date-fns` 继续保持函数级导入（已较好）。
3. icon 统一按需导入（当前 `lucide-react` 已按组件导入，继续保持）。
4. 可启用 `experimental.optimizePackageImports`（需回归验证）：

```js
experimental: {
  optimizePackageImports: ["lucide-react"],
}
```

### C. 图片与字体优化

1. 将营销页 `<img>` 替换为 `next/image`（首屏图设置 `priority`）。
2. 非首屏图使用 `loading="lazy"` 或 `next/image` 默认懒加载。
3. 大图建议提供 WebP/AVIF 版本。
4. 字体建议 `next/font` 本地托管，减少第三方阻塞请求。

### D. ISR / Static 优化建议

1. 营销页、隐私条款、文档页尽量改为服务端组件并使用静态生成。
2. 对可接受分钟级更新的页面增加：

```ts
export const revalidate = 300
```

3. 对纯静态内容可：

```ts
export const dynamic = "force-static"
```

### E. 减少不必要 API 请求

1. 对用户设置类接口做本地缓存（含 TTL）+ 失效策略。
2. 列表接口加去重层（防重复触发）。
3. 聚合请求：把强相关小接口合并，减少 RTT。

### F. Cloudflare Edge Cache + Brotli

1. Brotli：Cloudflare 默认可对文本资源压缩，保持 JS/CSS/JSON 可压缩。
2. 缓存键建议纳入语言、登录态相关维度，避免串缓存。
3. API 路由按敏感度区分：
   - 公开数据：`s-maxage + stale-while-revalidate`
   - 用户私有数据：`private, no-store`

---

## 建议的验证指标

- `First Load JS`（Next build 输出）
- LCP / INP / CLS（Web Vitals）
- `/app` 首次加载请求数与总传输体积
- Cloudflare 命中率（Cache HIT ratio）

