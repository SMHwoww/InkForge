# InkForge 代码架构优化报告

> 项目：墨客工坊 — AI 写作助手
> 审查日期：2026-06-21
> 技术栈：React 18 + Vite + Express + sql.js + Drizzle ORM + OpenAI + MCP

---

## 一、代码总结

InkForge 是一款面向小说创作者的全栈 AI 辅助写作工具，核心功能涵盖项目管理、角色设计、世界观构建、章节编辑、大纲梳理、星图关系、时间轴管理以及基于 MCP（Model Context Protocol）的 AI 助手。项目采用前后端分离架构：

- **前端**：React 18 + TypeScript + Vite + Tailwind CSS + Zustand（状态管理）+ TipTap（富文本编辑器）+ React Router v7
- **后端**：Express.js + sql.js（SQLite 内存版）+ Drizzle ORM（仅用于 Schema 定义）+ OpenAI SDK + MCP SDK
- **AI 层**：支持 OpenAI 兼容 API 的流式 SSE 对话、Function Calling / Tool Calls、内置 20+ 个 `inkforge_*` 工具及外部 MCP 服务接入

**当前实现方式的特点**：
- 数据库使用 `sql.js`（纯内存 SQLite），通过手动执行 `db.exec()` 进行所有 CRUD 操作，每次写入后调用 `saveDb()` 将整个数据库二进制导出到文件系统。
- Drizzle ORM 虽然出现在依赖中且定义了完整的 Schema，但**服务层完全没有使用它**，所有查询都是裸 SQL 字符串拼接 + 手动数组索引映射字段（`row[0]`, `row[1]`...）。
- 后端路由采用极简的 Express Router 模式，每个路由文件内重复书写 `try/catch` + 500 返回，没有统一的错误处理、输入校验和日志追踪。
- 前端使用 Zustand 管理状态，但将所有模块（项目、角色、世界观、章节、大纲、时间轴等）全部塞进一个 `projectStore`，形成典型的 **God Store** 反模式。
- API 客户端（`client.ts`）虽然用 TypeScript 编写，但大量滥用 `any` 类型，完全放弃了类型安全。

---

## 二、核心问题分析

### 🔴 问题 1：Drizzle ORM 被「摆设化」，数据库层处于「裸奔」状态

**现状**：`api/db/schema.ts` 精心定义了所有 Drizzle ORM 的 Table Schema，包括字段类型、外键约束、`onDelete: 'cascade'` 等。然而进入 `api/services/` 下的任何服务文件，你会发现所有查询都长这样：

```typescript
const rows = db.exec(`SELECT * FROM chapters WHERE project_id = ? ORDER BY order_num, id`, [projectId]);
return rows[0].values.map((row: any[]) => ({
  id: Number(row[0]),
  projectId: Number(row[1]),
  title: String(row[2]),
  // ... 手写字段映射
}));
```

**危害**：
- 字段顺序一旦因表结构变更（增删字段）改变，整个映射逻辑全部错乱，且编译期无法发现。
- 完全丧失类型安全。Drizzle ORM 的核心价值——"Schema 即类型"——被彻底浪费。
- 裸 SQL 拼接虽然灵活，但项目中已经暴露出不一致的命名风格（`coverUrl` vs `cover_url`），转换逻辑散落在数十个服务函数中。

**根源**：开发者可能先引入了 Drizzle ORM，但发现 sql.js 的兼容性或使用方式有障碍，于是退回了原始 SQL，却忘记移除或真正利用 ORM。

---

### 🔴 问题 2：sql.js 内存数据库 + 全量二进制导出 = 数据定时炸弹

**现状**：数据库初始化使用 `sql.js`（将 SQLite 编译为 WebAssembly/JS，运行在内存中）。每次写操作（`create`/`update`/`delete`）后都要调用 `saveDb()`：

```typescript
export function saveDb() {
  if (db) {
    const data = db.export();        // 导出整个内存数据库为 Uint8Array
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer); // 同步覆盖写入整个文件
  }
}
```

**危害**：
- **数据丢失风险极高**：进程崩溃、断电、未捕获异常导致 Node 退出时，最后一次 `saveDb()` 之后的数据全部丢失。
- **性能灾难**：随着项目数据增长（小说正文可能达到数 MB），每次修改一个字段都要导出并写入整个数据库文件，IO 开销呈 O(n) 增长。
- **并发安全**：`sql.js` 是单例内存数据库，没有事务隔离的持久化保障，`writeFileSync` 也不具备原子性，存在写坏文件的风险。
- **无法扩展**：内存数据库天然无法支持多进程部署，也无法使用 WAL 模式、备份、增量同步等企业级数据库能力。

---

### 🔴 问题 3：错误处理处于「石器时代」

**现状**：后端的每个路由都重复以下模式：

```typescript
router.get('/', async (req, res) => {
  try {
    const projects = await projectService.getProjectList();
    res.json({ code: 0, data: projects, message: 'ok' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '获取项目列表失败' });
  }
});
```

**危害**：
- 错误对象 `e` 被完全吞掉，仅返回一个固定中文文案。生产环境出问题后，日志里没有堆栈、没有上下文、没有请求参数，调试全靠猜。
- 没有统一错误处理中间件，导致 404、400、权限错误、数据库约束冲突等全部返回千篇一律的 500。
- `async` 路由中的异常如果没有被 `try/catch`，Express 默认行为可能挂起请求或直接崩溃（取决于 Express 版本和配置）。

---

### 🔴 问题 4：前端状态管理是典型的 God Store 反模式

**现状**：`projectStore.ts` 包含了：
- 8 个状态切片（projects, characters, worldbuilding, chapters, outlines, timelineEvents, timelinePerspectives, xLabels）
- 接近 30 个 action 方法
- 所有模块的加载状态只有一个 `loading: boolean`

**危害**：
- 任何一处数据更新都可能触发大量无关组件的重渲染。
- 单个 store 文件超过 300 行（估计），维护成本指数级上升。
- 唯一的 `loading` 标志意味着无法独立追踪「章节保存中」但「角色列表已加载完成」的复合状态。
- 没有提供 selector 优化，Zustand 的默认订阅模式会让所有消费组件在任意状态变更时重渲染。

---

### 🔴 问题 5：API 契约与类型系统全面崩塌

**现状**：
- `client.ts` 中几乎全部是 `request<any>(...)`、`request<any[]>(...)`，甚至直接 `data: any`。
- 后端服务层返回的是手动拼接的 Plain Object，与 `schema.ts` 中 Drizzle 推断的类型完全脱节。
- 前端 `types/index.ts` 定义了看似完善的 Interface，但没有任何机制保证后端返回的数据结构与之匹配。

**危害**：
- 前后端类型不同源。后端改了一个字段名，前端可能在运行时才暴露 `undefined` 错误。
- 重构成本极高。没有类型驱动的安全感，开发者不敢轻易改动数据结构。

---

### 🟡 问题 6：认证模块「尸位素餐」

项目中存在 `api/routes/auth.ts`，但 `app.ts` 中没有挂载 `/api/auth` 路由，也没有任何 JWT/Session/密码校验的中间件。这是一个单机桌面/本地应用（从 `tauri` 脚本推断），但即使如此，缺乏基础的本地用户隔离或配置加密也是隐患。

---

### 🟡 问题 7：AI 流式接口缺少熔断与背压控制

`aiService.ts` 的 `streamChat` 实现了多轮 Tool Call 循环（`MAX_TOOL_ROUNDS = 5`），但：
- 如果 MCP 工具陷入死循环或 LLM 持续返回 tool_calls，用户只能干等或关闭页面。
- SSE 连接没有超时控制、没有客户端断开检测（`req.on('close')` 未处理）。
- `res.write` 直接写原始流，没有考虑 Node 流背压（虽然 Express Response 做了一定封装，但长期高并发下有风险）。

---

## 三、性能优化建议

| 等级 | 建议 | 具体措施 | 预期收益 |
|------|------|----------|----------|
| **必须优化** | 替换 sql.js 为真正的文件型 SQLite | 使用 `better-sqlite3` 或 `libsql`/`turso`，配合 Drizzle ORM 的 `drizzle-orm/better-sqlite3` 驱动。开启 WAL 模式，利用真实的事务和增量持久化。 | 解决数据丢失风险；写操作性能提升 10-100 倍；支持原子事务。 |
| **必须优化** | 真正启用 Drizzle ORM 进行所有查询 | 删除所有裸 `db.exec()` 和手动字段映射，改用 `db.select().from(chapters).where(...)` 和 Relational Queries。利用 Drizzle 的 `migrate` 替代手写的 `CREATE TABLE IF NOT EXISTS`。 | 恢复编译期类型安全；消除字段映射错误；查询逻辑清晰可维护。 |
| **强烈建议** | 引入 API 响应缓存与数据库查询缓存 | 对 `getProjectList`、`getCharacters` 等读多写少的接口，在服务端引入 LRU 缓存或 HTTP ETag；前端对项目基础数据做 SWR/Stale-While-Revalidate 缓存。 | 减少重复数据库查询；提升页面切换流畅度。 |
| **强烈建议** | AI SSE 流增加超时与客户端断开监听 | 在 `streamChat` 中设置 `req.on('close', ...)` 来终止 OpenAI 流；增加单轮 Tool Call 的超时限制（如 30s）。 | 防止僵尸连接占用资源；提升系统稳定性。 |
| **强烈建议** | 前端实现组件级懒加载与路由分割 | 对 `StarChart`、`Timeline`、`MediaAssets` 等重型页面使用 `React.lazy()` + `Suspense`；TipTap 编辑器及其插件按需加载。 | 首屏包体积降低 30%-50%；提升首屏渲染速度。 |
| **可选优化** | 数据库索引优化 | 检查高频查询（如 `SELECT * FROM chapters WHERE project_id = ?`），确保外键和常用过滤字段有索引。目前部分表有索引，但不够完整。 | 大数据量下查询性能提升数倍。 |
| **可选优化** | AI 内容生成增加流式 Token 限流 | 对 OpenAI 的 `max_tokens` 根据模型动态调整；长文生成拆分为多次摘要式调用。 | 降低 API 费用；减少单次响应延迟。 |

---

## 四、架构重构建议

### 🏗️ 1. 后端分层架构重构（必须优化）

**目标**：建立清晰的 Controller → Service → Repository → DB 分层。

```
api/
├── db/
│   ├── schema.ts          # Drizzle Schema（已有，保留）
│   ├── connection.ts      # 数据库连接单例（better-sqlite3）
│   └── migrations/        # Drizzle 迁移文件
├── repositories/          # NEW：数据访问层，封装所有 Drizzle 查询
│   ├── projectRepository.ts
│   ├── chapterRepository.ts
│   └── ...
├── services/              # 业务逻辑层，无裸 SQL
│   ├── projectService.ts
│   └── ...
├── controllers/           # NEW：HTTP 请求处理与响应格式化
│   ├── projectController.ts
│   └── ...
├── routes/                # 只负责路由注册和中间件串联
│   └── projects.ts
├── middlewares/           # NEW：统一错误处理、请求校验、日志
│   ├── errorHandler.ts
│   ├── validateRequest.ts
│   └── requestLogger.ts
└── types/                 # NEW：共享的 DTO / API 类型定义
```

**关键动作**：
- 每个 Repository 函数返回的类型直接由 Drizzle 的 `inferSelectModel` 推断，确保前后端类型同源。
- 使用 `zod` 在中间件层统一校验 `req.body`、`req.params`、`req.query`，校验失败自动返回 400 及详细字段错误。

---

### 🏗️ 2. 引入统一错误处理与标准化响应（必须优化）

**实现**：

```typescript
// middlewares/errorHandler.ts
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  logger.error({ err, reqId: req.id, path: req.path, body: req.body }, 'Unhandled error');

  if (err instanceof ValidationError) {
    return res.status(400).json({ code: 400, message: err.message, details: err.details });
  }
  if (err instanceof NotFoundError) {
    return res.status(404).json({ code: 404, message: err.message });
  }
  // ... 其他业务异常

  res.status(500).json({ code: 500, message: '服务器内部错误', requestId: req.id });
}
```

**收益**：路由层不再需要 `try/catch`，代码量减少 50%；错误日志包含完整上下文；客户端获得结构化的错误信息。

---

### 🏗️ 3. 前端状态管理拆分（强烈建议）

**目标**：将 God Store 拆分为领域驱动的多个 Store，并引入切片选择器。

```
src/stores/
├── projectStore.ts        # 仅保留项目列表和当前项目元数据
├── characterStore.ts
├── chapterStore.ts
├── outlineStore.ts
├── worldbuildingStore.ts
├── timelineStore.ts
└── uiStore.ts             # 全局 UI 状态（loading、toast、modal）
```

**使用示例**：

```typescript
// 只订阅需要的切片，避免无关重渲染
const chapters = useChapterStore(state => state.chapters);
const isLoading = useChapterStore(state => state.isLoading);
```

**进阶**：对服务端状态（Server State）考虑引入 **TanStack Query (React Query)**，替代手动的 `fetch → setState → error handling → caching` 逻辑。

---

### 🏗️ 4. 前后端类型共享（强烈建议）

**方案 A（推荐）**：建立 `shared/` 目录，存放所有 DTO 的 Zod Schema。前后端共享这些 Schema，前端用 `z.infer<>` 推导类型。

```typescript
// shared/schemas/project.ts
export const ProjectSchema = z.object({ id: z.number(), title: z.string(), ... });
export type Project = z.infer<typeof ProjectSchema>;
```

**方案 B**：使用 `tRPC` 或 `Rspc` 替代 REST，直接实现端到端类型安全（需要更大胆的重构）。

---

### 🏗️ 5. MCP 与 AI 层解耦（可选优化）

当前 `aiService.ts` 既负责 OpenAI 流式调用，又负责 Tool Round 循环调度，还依赖 `mcpClient.ts` 获取工具定义。**建议**：

- 将 `ToolRoundExecutor` 独立为 `services/toolExecutor.ts`，负责管理 Tool Call 生命周期、重试、超时。
- `aiService.ts` 只关注与 OpenAI 的交互（生成请求、解析响应、流式输出）。
- 引入策略模式，支持未来切换 Claude、Gemini 等其他 LLM Provider。

---

## 五、代码美观改进

| 等级 | 问题 | 优化方向 |
|------|------|----------|
| **必须优化** | 服务层手写字段映射灾难 | 全部替换为 Drizzle ORM 查询，消除所有 `row[0]`、`row[1]`。 |
| **强烈建议** | 路由文件大量重复 `try/catch` 模板 | 使用 `express-async-handler` 或统一错误中间件，让路由回归声明式。 |
| **强烈建议** | `client.ts` 中 API 方法堆积，无分组 | 按领域拆分为 `projectApi.ts`、`chapterApi.ts` 等，或使用 OpenAPI 生成客户端。 |
| **强烈建议** | 缺少一致的命名规范 | 统一 snake_case（DB）与 camelCase（TS）的转换边界，全部在 Repository 层处理，上层只认 camelCase。 |
| **可选优化** | 缺少 ESLint/Prettier 的严格规则 | 增加 `@typescript-eslint/strict-type-checked`、`no-explicit-any` 等规则，逐步消除 `any`。 |
| **可选优化** | 注释质量参差不齐 | 对核心业务逻辑（如 MCP Tool Round、自动保存防抖）增加 JSDoc；删除无意义的文件头注释（如 "API Server"）。 |

---

## 六、安全加固建议

| 等级 | 风险点 | 加固措施 |
|------|--------|----------|
| **必须优化** | 没有输入校验，存在 SQL 注入风险 | 虽然当前用了参数化查询（`?`），但部分 `UPDATE ... SET ${sets.join(', ')}` 存在拼接风险（`projectService.ts`）。立即全面审计所有 SQL 拼接点，全部改为 Drizzle ORM。 |
| **必须优化** | 没有认证与授权 | 即使是本地应用，也应增加基本的 Token 或 Session 机制，防止其他进程/网页随意调用 `localhost:3001/api`。对敏感配置（OpenAI API Key）加密存储，不要明文写在 `config.json`。 |
| **强烈建议** | CORS 完全开放 | `app.use(cors())` 允许所有来源，在本地开发可以接受，但生产环境（或 Tauri 打包后）应限制为特定 origin。 |
| **强烈建议** | `express.json({ limit: '10mb' })` 无文件类型过滤 | 大 JSON 可能导致内存问题；配合 Multer 上传时应限制文件类型和大小。 |
| **强烈建议** | `config.json` 明文存储 API Key | 使用 `keytar` 或操作系统密钥环存储密钥；`config.json` 只保留非敏感配置。 |
| **可选优化** | 缺少请求速率限制 | 对 `/api/ai/chat` 等昂贵接口增加 `express-rate-limit`，防止前端异常或恶意脚本导致 API 费用飙升。 |

---

## 七、优化优先级路线图

### 第一阶段：生存线（1-2 周，必须完成）
1. **替换数据库**：将 `sql.js` 迁移到 `better-sqlite3`，真正启用 Drizzle ORM 完成所有 CRUD。
2. **统一错误处理**：建立全局错误中间件，所有路由移除冗余 `try/catch`。
3. **输入校验**：使用 Zod 为所有路由添加 `req.body` / `req.params` 校验。
4. **修复 SQL 拼接**：审计所有字符串拼接 SQL，彻底消除注入风险。

### 第二阶段：架构升级（2-3 周，强烈建议）
5. **后端分层**：建立 Repository 层，实现 Controller → Service → Repository 的清晰分层。
6. **前端状态拆分**：将 God Store 拆分为领域 Store，或引入 TanStack Query 管理服务端状态。
7. **前后端类型共享**：建立 `shared/schemas`，让 API 契约有类型保障。
8. **安全加固**：CORS 限制、API Key 加密、基础认证中间件。

### 第三阶段：体验与扩展（3-4 周，可选）
9. **前端性能优化**：路由懒加载、组件虚拟化、SWR 缓存。
10. **AI 层解耦**：ToolRoundExecutor 独立、支持多 LLM Provider。
11. **测试体系**：为 Repository 和业务逻辑补充单元测试；为核心用户流程补充 E2E 测试。
12. **文档与监控**：OpenAPI/Swagger 文档、基础性能监控与日志聚合。

---

## 八、总结

InkForge 作为一款功能丰富、创意十足的 AI 写作工具，其代码在**业务功能实现上已经非常完整**，但在**工程化、类型安全、数据持久化和架构分层上存在严重的「半成品」痕迹**。最核心的问题是：

> **Drizzle ORM 被当作摆设，数据库层退回到了 10 年前的裸 SQL + 手动映射模式；而 sql.js 的内存数据库 + 全量导出机制，更是在生产环境中埋下一颗数据丢失的定时炸弹。**

如果以上建议只能做一件事：**请立刻将数据库层重构为真正的持久化 SQLite + Drizzle ORM**。这是从「Demo 级项目」迈向「可信赖产品」的分水岭。

---

*本报告基于对 InkForge 当前代码库的全面静态分析生成，所有文件引用均来自实际代码路径。*
