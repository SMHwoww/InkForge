# 墨客工坊 — AI 写作助手

全栈小说创作工具，内置 AI 辅助写作（AIDO 模式）、角色管理、世界观构建、大纲编辑器、正文编辑和星图可视化关系系统。

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 18 + TypeScript + Vite |
| 样式 | Tailwind CSS |
| 状态管理 | Zustand |
| 路由 | React Router v7 |
| 编辑器 | TipTap |
| AI | OpenAI API（流式 SSE） |
| 后端 | Express.js |
| 数据库 | SQLite（sql.js / Drizzle ORM） |
| Markdown | marked |

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入你的 OpenAI API Key

# 启动开发服务器（前端 + 后端）
npm run dev

# 仅前端
npm run client:dev

# 仅后端
npm run server:dev
```

## 项目结构

```
ward/
├── api/                  # Express 后端
│   ├── db/               # 数据库 schema 与迁移
│   ├── routes/           # API 路由
│   └── services/         # AI 服务等
├── src/
│   ├── pages/            # 页面组件
│   │   ├── Dashboard.tsx       # 仪表盘
│   │   ├── AIAssistant.tsx     # AI 写作助手（AIDO）
│   │   ├── ChapterEditor.tsx   # 正文编辑器
│   │   ├── OutlineEditor.tsx   # 大纲编辑器
│   │   ├── Characters.tsx      # 角色管理
│   │   ├── Worldbuilding.tsx   # 世界观
│   │   ├── StarChart.tsx       # 星图关系图
│   │   └── ProjectWorkspace.tsx # 项目工作区
│   ├── components/       # 通用组件
│   ├── stores/           # Zustand 状态
│   ├── api/              # 前端 API 客户端
│   └── types/            # TypeScript 类型
├── data/                 # SQLite 数据库文件（运行时生成）
├── public/               # 静态资源
└── .env.example          # 环境变量模板
```

## 构建部署

```bash
# 构建前端
npm run build

# 生产启动（先构建，再启动后端服务静态文件）
NODE_ENV=production node api/server.ts
```

构建产物在 `dist/` 目录，后端 Express 服务在 `api/` 目录。

## 功能模块

- **仪表盘** — 项目概览、写作进度
- **项目管理** — 创建/管理小说项目
- **AI 助手（AIDO）** — 智能续写、润色、扩写、大纲生成，支持直接操作项目数据（角色/世界观/星图/大纲/正文）
- **角色管理** — 角色信息、外貌、性格、背景
- **世界观** — 地理、历史、势力、魔法体系等分类管理
- **正文编辑** — 分章节写作，富文本编辑
- **大纲编辑器** — 树形大纲，拖拽排序
- **星图** — 可视化角色/概念关系图，力导向自动布局，可编辑节点与连线

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENAI_API_KEY` | OpenAI API 密钥 | 必填 |
| `OPENAI_BASE_URL` | API 地址 | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | 模型名称 | `gpt-4o-mini` |

## License

MIT
