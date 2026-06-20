# 合并优先级指南 — Tauri 分支 → main

本文档记录了 `Tauri` 分支与 `main` 分支发生冲突时，应以 `Tauri` 分支优先的代码区域及原因。

## 核心原则

`Tauri` 分支将应用从纯 Web 架构升级为 **Web + Tauri 桌面双模架构**。合并时，基础设施层的所有 Tauri 变更应优先生效；业务逻辑层（React 页面组件、API 路由处理函数）的 main 分支新增功能应合并进来。

---

## 1. 双模运行时基础设施（Tauri Priority）

### 1.1 `src/lib/tauri-env.ts` — 环境检测与 Sidecar 管理 (NEW FILE)

**Tauri 分支新增，main 分支不存在。** 合并时必须保留，所有 `isTauri()` / `getBaseUrl()` 调用依赖此文件。

- `isTauri()` 检测 `window.__TAURI_INTERNALS__`
- `getBaseUrl()` 开发返回空（相对路径），Tauri 生产返回 `http://127.0.0.1:{port}`
- `launchSidecar()` 管理 Sidecar 生命周期（spawn → health 轮询）

### 1.2 `src/lib/db.ts` — 原生 SQLite 客户端 (NEW FILE)

**Tauri 分支新增。** 提供 Tauri 环境下的原生 SQLite 操作，非 Tauri 环境抛出错误引导调用方回退到 REST API。

### 1.3 `src/api/client.ts` — API 客户端基础地址动态化

| 区域 | main | Tauri | 优先 |
|------|------|-------|------|
| 第 1-8 行 | `const BASE_URL = '/api'` | `let BASE_URL` + `initBaseUrl()` 异步初始化 | **Tauri** |
| `request()` | 直接 fetch | 先 `await initBaseUrl()` | **Tauri** |

Tauri 版本的 `request()` 每次调用前确保 BASE_URL 已根据环境（开发/生产）动态设置。

### 1.4 所有前端 fetch 调用 — 绝对 URL 化

以下文件中的 fetch 调用在 Tauri 分支中改为使用 `getBaseUrl()` 构建绝对 URL。若 main 分支对同一文件有新增 fetch 调用，合并后也必须同样处理：

- `src/pages/Settings.tsx` — `apiUrl()` 辅助函数
- `src/pages/AIAssistant.tsx` — MCP 配置加载
- `src/components/ai/AIPanel.tsx` — MCP 配置加载
- `src/lib/chat.ts` — SSE 流式请求

**规则：任何新增的 `/api/*` fetch 调用必须通过 `getBaseUrl()` 解析，不可直接使用相对路径。**

---

## 2. 后端基础设施（Tauri Priority）

### 2.1 `api/app.ts` — 应用初始化与静态文件服务

| 区域 | main | Tauri | 优先 |
|------|------|------|------|
| 初始化时机 | 模块顶层立即执行 `loadConfig()` / `initDatabase()` | 导出 `initializeApp()` 函数，由 server.ts 调用 | **Tauri** |
| 路径计算 | `fileURLToPath(import.meta.url)` | 兼容 CJS `__dirname` + ESM fallback | **Tauri** |
| 静态文件服务 | 无 `next()` 传递 | API 路由后处理静态文件，添加 `next()` 避免捕获 API 请求 | **Tauri** |
| `__dirname` 使用 | `const __dirname = ...` | `declare var __dirname;` + fallback | **Tauri** |

Tauri 分支将初始化延后到 `server.ts` 调用 `initializeApp()`，确保 `INKFORGE_DATA_DIR` 环境变量已在初始化前设置。

### 2.2 `api/server.ts` — 服务入口彻底重写

| 区域 | main | Tauri | 优先 |
|------|------|------|------|
| 结构 | 顶层同步启动 | 异步 `start()` 函数 | **Tauri** |
| 端口 | 固定 `PORT \|\| 3001` | `--port=` / `PORT` / 自动寻找可用端口 | **Tauri** |
| Sidecar 协议 | 无 | 输出 `INKFORGE_SERVER_PORT={port}` 到 stdout | **Tauri** |
| 数据目录 | 无 | `--data-dir=` / `INKFORGE_DATA_DIR` | **Tauri** |

### 2.3 `api/db/index.ts` — 数据库路径动态化

| 区域 | main | Tauri | 优先 |
|------|------|------|------|
| 路径 | 固定 `../../data/ward.db` | `getDataDir()` 惰性求值 | **Tauri** |
| 路径来源 | 无 | `INKFORGE_DATA_DIR` → `process.execPath` → 项目相对路径 | **Tauri** |
| WASM 加载 | `initSqlJs()` | 生产环境注入 Base64 WASM | **Tauri** |
| `__dirname` | `const __dirname = ...` | `declare var __dirname;` + fallback | **Tauri** |

### 2.4 `api/services/mcpConfig.ts` — 配置文件路径动态化

| 区域 | main | Tauri | 优先 |
|------|------|------|------|
| 配置路径 | 固定 `../../config.json` | `getConfigPath()` 惰性求值 | **Tauri** |
| 路径来源 | 无 | `INKFORGE_DATA_DIR` → `process.execPath` → 项目相对路径 | **Tauri** |
| `__dirname` | `const __dirname = ...` | `declare var __dirname;` + fallback | **Tauri** |

**config.json 的实际位置：**
- 开发环境：`E:\InkForge - Tauri\config.json`
- Tauri 生产环境：通过 `--data-dir` 参数指定的目录（Tauri `appDataDir()`）

---

## 3. 依赖与构建配置（Tauri Priority）

### 3.1 `package.json`

| 类别 | 冲突处理 |
|------|----------|
| Tauri 相关 dependencies | `@tauri-apps/api`, `@tauri-apps/plugin-shell`, `@tauri-apps/plugin-sql` — **必须保留** |
| Tauri CLI devDependency | `@tauri-apps/cli` — **必须保留** |
| Sidecar 构建工具 | `esbuild`, `postject` — **必须保留** |
| 已移除的依赖 | `babel-plugin-react-dev-locator`, `vite-plugin-trae-solo-badge` — **不可重新引入** |
| scripts | `tauri`, `tauri:dev`, `tauri:build`, `sidecar:build` — **必须保留** |

### 3.2 `vite.config.ts`

| 区域 | main | Tauri | 优先 |
|------|------|------|------|
| React 插件 | `react({ babel: { plugins: ['react-dev-locator'] } })` | `react()` | **Tauri** — 不引入 babel locator |
| traeBadgePlugin | 有 | 无 | **Tauri** — 已移除广告注入 |
| server.watch | 无 | `ignored: ['**/src-tauri/target/**']` | **Tauri** |

### 3.3 `.gitignore`

Tauri 分支在 main 的 `.gitignore` 基础上追加了以下内容，**必须保留**：

```
# Tauri
src-tauri/target/
src-tauri/gen/
src-tauri/binaries/inkforge-backend*

# Claude Code
.claude

# Temp
temp
```

---

## 4. Tauri 原生层（Tauri Only — 不存在于 main）

以下文件/目录是 Tauri 分支独有的，不存在冲突，但任意合并方案都必须完整保留：

### `src-tauri/` 目录（整个目录）
- `tauri.conf.json` — Tauri 应用配置（版本号 `0.1.0-1`，窗口设置，sidecar 权限等）
- `Cargo.toml` / `Cargo.lock` — Rust 依赖（tauri 2.11.2, plugin-shell, plugin-sql）
- `src/lib.rs` — Tauri 插件注册（sql, shell）
- `src/main.rs` — Rust 入口
- `src/db.rs` — Rust 侧数据库命令
- `build.rs` — Tauri 构建脚本
- `capabilities/default.json` — 权限声明（shell:allow-spawn, shell:allow-execute, shell:allow-open, sql:*）
- `icons/` — 应用图标（PNG, ICO, ICNS）
- `.cargo/config.toml` — Rust 编译器配置

### `scripts/build-sidecar.mjs` — Sidecar 构建脚本 (NEW FILE)

### `.github/workflows/release.yml` — 双平台构建流水线 (NEW FILE)

---

## 5. 删除的文件（不可恢复）

| 文件 | 原因 |
|------|------|
| `src/pages/RelationGraph.tsx` | 未完成的页面，阻塞 tsc 编译 |

合并时 **不可** 从 main 恢复此文件。

---

## 6. 业务逻辑层合并原则（Merge In）

以下类型的 main 分支变更**应当合入** Tauri 分支的对应文件：

- `api/routes/*.ts` — API 路由的新增/修改（路由处理函数逻辑，不涉及路径/初始化）
- `src/pages/*.tsx` — 页面组件的新增/修改（需确保新 fetch 调用使用 `getBaseUrl()`）
- `src/components/**/*.tsx` — UI 组件的新增/修改（同上）
- `src/stores/*.ts` — 状态管理
- `src/lib/*.ts` — 纯业务逻辑库（非基础设施）

---

## 7. CHANGELOG.md

Tauri 分支新增了 `CHANGELOG.md`。合并时若 main 也有 CHANGELOG，以内容较多者为基础，将另一方的内容追加进去。

---

## 8. config.json 注意事项

- 开发环境使用根目录 `config.json`
- Tauri 生产环境通过 `--data-dir` 使用独立目录下的 `config.json`
- 两者不会冲突，但 main 若修改了 `config.json` 的结构（新增顶层字段），需同步更新 `api/services/mcpConfig.ts` 中的 Zod schema 和 `DEFAULT_CONFIG`
