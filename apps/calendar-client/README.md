# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

# @Evan Huang 调整Tauri请求标头

在 Tauri 项目中，如果你是用 WebView 套壳外部网页（比如加载一个在线学习平台），想要**给所有请求都带上自定义请求头**（如 `Authorization`、`X-Client` 等），主要有以下几种实现方式：

### 推荐方案对比

| 方案                               | 难度 | 是否推荐     | 说明                       |
| ---------------------------------- | ---- | ------------ | -------------------------- |
| **Rust `on_web_resource_request`** | 中   | **最推荐**   | 原生拦截请求，性能最好     |
| **JavaScript 覆盖 fetch/XHR**      | 低   | 适合快速实现 | 在前端注入脚本修改请求     |
| **自定义协议代理**                 | 高   | 复杂场景     | 适合需要完全控制请求的情况 |

---

### 推荐方案一：Rust 层拦截（最优雅）

在 Tauri v2 中，可以使用 `on_web_resource_request` 来修改请求头。

修改 `src-tauri/src/main.rs`（或 `lib.rs`）中的窗口创建代码：

```rust
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External("https://your-site.com".parse().unwrap()))
                .title("MemPen AI")
                .on_web_resource_request(|request, response| {
                    // 这里可以根据 URL 条件判断是否添加 header
                    let uri = request.uri().to_string();

                    if uri.contains("your-site.com") {
                        // 添加自定义请求头
                        response.set_header("Authorization", "Bearer YOUR_TOKEN");
                        response.set_header("X-Client", "MemPen-AI");
                        response.set_header("X-App-Version", "1.0.0");
                    }
                })
                .build()
                .unwrap();

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

### 方案二：JavaScript 注入方式（快速实现）

如果你不想改 Rust 代码，可以在前端注入脚本，覆盖 `fetch` 和 `XMLHttpRequest`：

在你的 Next.js 项目中创建一个工具函数：

```ts
// lib/injectHeaders.ts
export function injectCustomHeaders(headers: Record<string, string>) {
  // 覆盖 fetch
  const originalFetch = window.fetch
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    const newInit = { ...init }
    newInit.headers = {
      ...newInit.headers,
      ...headers,
    }
    return originalFetch(input, newInit)
  }

  // 覆盖 XMLHttpRequest
  const originalOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (...args: any[]) {
    originalOpen.apply(this, args)
    Object.entries(headers).forEach(([key, value]) => {
      this.setRequestHeader(key, value)
    })
  }
}
```

然后在页面加载后调用：

```ts
useEffect(() => {
  injectCustomHeaders({
    Authorization: 'Bearer YOUR_TOKEN',
    'X-Client': 'MemPen-AI',
  })
}, [])
```

---

### 方案三：仅对特定域名添加（推荐）

如果你只想给某些域名加请求头，Rust 方案可以这样写得更精确：

```rust
.on_web_resource_request(|request, response| {
    let uri = request.uri().to_string();

    // 只对特定域名生效
    if uri.starts_with("https://api.example.com") || uri.starts_with("https://study.example.com") {
        response.set_header("Authorization", "Bearer abc123");
        response.set_header("X-App-Name", "MemPen");
    }
})
```

---

### 建议

- **正式项目推荐用方案一（Rust）**，因为它是原生层拦截，覆盖所有资源请求（包括图片、接口、字体等）。
- 如果你只是想在学习时带上身份信息，**方案二（JS）** 也够用，且改动最小。

---

**你目前的需求是：**

1. 给**所有请求**都加固定请求头？还是只给**特定域名**加？
2. 主要是为了传递 `Authorization` token，还是其他自定义信息？

告诉我具体需求，我可以给你更精确的代码。
