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

> **2026-06-21 更新**：main 分支已从 sql.js 迁移到 better-sqlite3 + Drizzle ORM，与 Tauri 分支的数据库引擎一致。冲突域缩小为**路径解析方式**。

| 区域 | main | Tauri | 优先 |
|------|------|------|------|
| 数据库引擎 | better-sqlite3 + Drizzle ORM | better-sqlite3 + Drizzle ORM | 一致 |
| 路径计算 | 固定 `dataDir`/`dbPath` 变量（模块顶层计算） | `getDataDir()`/`getDbPath()` 惰性函数求值 | **Tauri** |
| 路径来源 | 仅 `__dirname` fallback | `INKFORGE_DATA_DIR` → `process.execPath` → 项目相对路径 | **Tauri** |
| `__dirname` | `const __dirname = ...` | `declare var __dirname;` + fallback | **Tauri** |
| 构建标识 | 无 | `INKFORGE_BUNDLED` define（esbuild 注入） | **Tauri** |

**冲突解决策略**：采用 main 的 better-sqlite3 + Drizzle ORM 代码，但保留 Tauri 的 `getDataDir()`/`getDbPath()` 惰性函数求值及 `INKFORGE_DATA_DIR`/`INKFORGE_BUNDLED` 支持。

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

## 2.5 后端中间件与验证层（Shared Infrastructure — 2026-06 重构引入）

> main 分支在本次重构中引入了以下新文件，Tauri 分支已完整合入。这些是共享基础设施，未来合并时双方平等对待。

| 文件 | 功能 | 合并策略 |
|------|------|----------|
| `api/common/errors.ts` | 自定义错误类（`AppError`, `NotFoundError`, `ValidationError` 等） | 双方平等合并 |
| `api/common/asyncHandler.ts` | 异步路由处理器包装，消除 try/catch 模板 | 双方平等合并 |
| `api/middlewares/errorHandler.ts` | 全局错误中间件，统一错误响应格式 | 双方平等合并 |
| `api/middlewares/validateRequest.ts` | Zod 请求验证中间件（body/params/query） | 双方平等合并 |
| `api/schemas/index.ts` | 30+ Zod Schema 定义，统一 API 契约 | 双方平等合并 |
| `api/routes/search.ts` | 全局搜索 API（跨 7 种实体类型） | 双方平等合并 |
| `src/components/GlobalSearch.tsx` | 全局搜索 UI 组件（Ctrl+K 快捷键） | 双方平等合并 |

**注意**：`api/routes/*.ts` 路由文件已全部重构为使用 `validateRequest` + `asyncHandler` 模式。合并时若 main 修改了路由处理函数逻辑，应直接采用；若 Tauri 修改了路由处理函数逻辑，需要在新模式下重新实现。

---

## 3. 依赖与构建配置（Tauri Priority）

### 3.1 `package.json`

| 类别 | 冲突处理 |
|------|----------|
| Tauri 相关 dependencies | `@tauri-apps/api`, `@tauri-apps/plugin-shell`, `@tauri-apps/plugin-sql` — **必须保留** |
| Tauri CLI devDependency | `@tauri-apps/cli` — **必须保留** |
| Better-SQLite3 类型 | `@types/better-sqlite3` — **必须保留**（main 新增） |
| Sidecar 构建工具 | `esbuild`, `postject` — **必须保留** |
| 已移除的依赖 | `babel-plugin-react-dev-locator`, `vite-plugin-trae-solo-badge` — **不可重新引入** |
| scripts | `tauri`, `tauri:dev`, `tauri:build`, `sidecar:build` — **必须保留** |

### 3.2 `vite.config.ts`

| 区域 | main | Tauri | 优先 |
|------|------|------|------|
| `base` | 无（默认 `/`） | `base: './'`（相对路径，Tauri 生产必需） | **Tauri** |
| React 插件 | `react()` | `react()` | 一致 |
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
- `tauri.conf.json` — Tauri 应用配置（版本号 `0.2.0`，窗口设置，sidecar 权限等）
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

---

## 9. 更新/下载基础设施（Tauri Priority）

### 9.1 `api/routes/config.ts` — 更新下载 API 端点

Tauri 分支在 `api/routes/config.ts` 中新增了以下端点，main 合并时必须保留：

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/config/update/download` | POST | 启动后台下载更新包（调用 `downloaderService`） |
| `/api/config/update/download/:id` | GET | 轮询下载进度（进度百分比、已下载/总大小、状态） |

### 9.2 `api/services/downloaderService.ts` — 文件下载服务 (NEW FILE)

**Tauri 分支新增，main 分支不存在。** 提供带重试、超时、取消、进度回调的 HTTP 文件下载能力。更新下载 API 依赖此服务。

### 9.3 `src/lib/updateChecker.ts` — 更新检查与下载

| 区域 | main | Tauri | 优先 |
|------|------|-------|------|
| `UpdateInfo` 接口 | 仅有 `version/name/url/body` | 新增 `downloadUrl` / `downloadName`（从 GitHub Release assets 提取） | **Tauri** |
| 导出函数 | `checkForUpdates()` / `getCurrentVersion()` | 新增 `startDownload()` / `pollDownloadStatus()` / `DownloadStatus` 接口 | **Tauri** |

### 9.4 `src/components/UpdateDialog.tsx` — 更新对话框

| 区域 | main | Tauri | 优先 |
|------|------|-------|------|
| 按钮文案 | "查看更新"（打开浏览器） | "下载更新"（通过后端 API 下载） | **Tauri** |
| 下载状态 | 无 | 下载进度条、完成/错误状态、打开文件按钮 | **Tauri** |

### 9.5 `src/App.tsx` — 启动时自动下载

Tauri 分支在 `App.tsx` 的更新检查逻辑中新增了 `autoDownload` 支持：当用户启用自动下载且发现新版本时，自动调用 `startDownload()` 后台下载，不阻塞用户操作。main 合并时必须保留此逻辑。

### 9.6 `src/pages/Settings.tsx` — 更新设置与关于页面

Tauri 分支在 Settings 页面中新增：

- **手动检查更新**：`UpdateConfigPanel` 中新增"立即检查更新"按钮，显示检查结果（新版本详情或已是最新）
- **关于页面**：`AboutPanel` 组件，显示版本号 `v0.2.0`、构建平台（Tauri 2.x）、MIT License 全文（可展开/复制）、版权声明
- **导航**：侧边栏新增"关于"标签页