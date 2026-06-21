### 合并 main 分支的重大后端重构：
- 数据库引擎统一为 better-sqlite3 + Drizzle ORM (WAL 模式)
- 引入全局错误中间件、Zod 请求验证、asyncHandler
- 新增全局搜索功能 (API + UI)
- 保留 Tauri 动态路径解析 (getDataDir/getDbPath)
- 保留所有 Tauri 专属依赖和配置 (base: './', tauri scripts 等)
- 更新 MERGE_PRIORITY.md 反映新架构