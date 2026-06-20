# CHANGELOG

## v0.1.0 (2026-06-20)

墨客工坊首个 Tauri 桌面应用版本，支持 Windows / Linux 双平台。

### 核心功能

**写作管理**
- 项目、章节、大纲的创建与管理
- 角色编辑器（属性和详情）
- 世界观编辑器（分类和条目）
- 星图（关系图谱）可视化
- 时间轴工具（支持多视角和自定义标签）
- 模块显示/隐藏和排序自定义

**AI 辅助**
- AI 写作助手：流式聊天 + 工具调用
- OpenAI 兼容 API 接入（可配置 baseUrl / model）
- MCP 协议支持（远程/本地工具服务器，内置工具集）
- AI 图片生成：百炼 wan2.6-t2i，支持多地区端点
- AI 角色和世界观内容生成

**Tauri 桌面特性**
- 原生 SQLite 数据库，数据持久化本地
- Sidecar 后端进程管理，端口动态分配，health 轮询就绪检测
- 通过 GitHub API 自动检查更新（可配置：启用/预发布/自动下载/静默）
- `--data-dir` 参数支持自定义数据目录持久化
- 合并优先级文档 `MERGE_PRIORITY.md`

### 修复
- 修复 Tauri 生产环境中 AI/MCP 配置加载失败（Sidecar 端口硬编码导致请求发往错误地址）
- 修复前端所有相对路径 API 请求在生产环境中失效的问题
- 修复 esbuild CJS 打包时 `server.ts` 顶层 await 不兼容问题
- 修复 SEA 打包后 `__dirname` 路径解析到构建机的问题
- 移除 traeCN 嵌入广告（vite-plugin-trae-solo-badge / react-dev-locator）
- 修复 sidecar 输出文件名不含目标三元组导致 Tauri 构建失败
- 修复 CI workflow 分支名大小写不匹配问题
- 静态链接 MSVC CRT，消除 Windows 对 VC++ 运行时的依赖

### 已知限制
- `自动下载` 设置项已预留但尚未实现自动下载逻辑，当前仅弹出更新通知对话框
