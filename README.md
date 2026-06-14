# 墨客工坊 — AI 写作助手

全栈小说创作工具，内置 AI 辅助写作等多项实用工具

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
InkForge/
├── api/                           # Express 后端
│   ├── db/
│   │   ├── index.ts               # 数据库初始化 & 迁移（sql.js）
│   │   └── schema.ts              # Drizzle ORM Schema
│   ├── routes/
│   │   ├── ai.ts                  # AI 对话 / 生成角色 / 生成世界观
│   │   ├── auth.ts                # 认证
│   │   ├── chapters.ts            # 章节 CRUD
│   │   ├── characters.ts          # 角色 CRUD
│   │   ├── outlines.ts            # 大纲 CRUD
│   │   ├── projects.ts            # 项目 CRUD
│   │   ├── relations.ts           # 关系边
│   │   ├── starchart.ts           # 星图节点
│   │   ├── timeline.ts            # 时间轴事件 / 视角 / 配置
│   │   └── worldbuilding.ts       # 世界观条目
│   ├── services/
│   │   ├── aiService.ts           # OpenAI 流式聊天 & 生成
│   │   ├── chapterService.ts
│   │   ├── characterService.ts
│   │   ├── logger.ts              # 文件日志
│   │   ├── outlineService.ts
│   │   ├── projectService.ts
│   │   ├── relationService.ts
│   │   ├── starchartService.ts
│   │   ├── timelineService.ts     # 含视角/配置 CRUD
│   │   └── worldbuildingService.ts
│   ├── app.ts                     # Express 路由挂载
│   ├── index.ts                   # 入口
│   └── server.ts                  # 服务器启动
├── src/
│   ├── api/
│   │   └── client.ts              # 前端 API 客户端
│   ├── components/
│   │   ├── ai/
│   │   │   └── AIPanel.tsx        # 内嵌 AI 面板（大纲/时间轴复用）
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx      # 应用布局
│   │   │   └── Sidebar.tsx        # 侧边栏导航
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Toast.tsx          # Toast 通知
│   │   └── Empty.tsx              # 空状态占位
│   ├── hooks/
│   │   └── useTheme.ts            # 主题 Hook
│   ├── lib/
│   │   ├── aido.ts                # AIdo 统一指令引擎（解析/剥离/提示词）
│   │   ├── chat.ts                # SSE 流式聊天工具
│   │   └── utils.ts               # 通用工具函数
│   ├── pages/
│   │   ├── AIAssistant.tsx        # AI 写作助手（AIDO 模式）
│   │   ├── ChapterEditor.tsx      # 正文编辑器（TipTap 富文本）
│   │   ├── CharacterDetail.tsx    # 角色详情页
│   │   ├── Characters.tsx         # 角色管理列表
│   │   ├── Dashboard.tsx          # 仪表盘
│   │   ├── Home.tsx               # 首页
│   │   ├── OutlineEditor.tsx      # 大纲编辑器（树形+AI面板）
│   │   ├── ProjectWorkspace.tsx   # 项目工作区
│   │   ├── RelationGraph.tsx      # 关系图谱
│   │   ├── StarChart.tsx          # 星图节点管理
│   │   ├── Timeline.tsx           # 时间轴（网格拖拽+多视角+AI面板）
│   │   └── Worldbuilding.tsx      # 世界观条目管理
│   ├── stores/
│   │   ├── chatStore.ts           # AI 聊天状态（projectId 隔离）
│   │   ├── projectStore.ts        # 全局项目/角色/世界观/章节/大纲/时间轴状态
│   │   └── toastStore.ts          # Toast 通知状态
│   ├── types/
│   │   └── index.ts               # TypeScript 类型定义
│   ├── App.tsx                    # 路由配置
│   ├── index.css                  # 全局样式 & Tailwind
│   └── main.tsx                   # 应用入口
├── data/                          # SQLite 数据库文件（运行时生成）
├── public/                        # 静态资源
├── .env.example                   # 环境变量模板
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## 功能模块

- **仪表盘** — 项目概览、写作进度
- **项目管理** — 创建/管理小说项目
- **AI 助手（AIDO）** — 智能续写、润色、扩写、大纲生成，支持直接操作项目数据（角色/世界观/星图/大纲/正文）
- **角色管理** — 角色信息、外貌、性格、背景
- **世界观** — 地理、历史、势力、魔法体系等分类管理
- **正文编辑** — 分章节写作，富文本编辑
- **大纲编辑器** — 树形大纲，拖拽排序
- **星图** — 可视化角色/概念关系图，力导向自动布局，可编辑节点与连线
- **时间轴** — 网格化拖拽布局，支持多视角（角色线/世界线等），事件池管理，拖拽放置到时间×视角坐标

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENAI_API_KEY` | OpenAI API 密钥 | 必填 |
| `OPENAI_BASE_URL` | API 地址 | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | 模型名称 | `gpt-4o-mini` |

## License

本项目使用MIT许可证
