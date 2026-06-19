/**
 * AIdo — MCP 工具驱动的 AI 创作助手系统提示词
 *
 * 所有 AI 相关页面（AIAssistant, AIPanel）使用此统一入口。
 * 通过内置 MCP 服务（inkforge_* 工具）实现项目数据的自主读取和修改，
 * AI 不再依赖用户手动选择的上下文，而是通过工具调用自主获取所需信息。
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** 工具调用结果展示 */
export interface ToolCallDisplay {
  id: string;
  name: string;
  args: string;
  status: 'running' | 'done' | 'error';
  result?: string;
  label?: string;
}

// ─── 工具名称到显示标签的映射 ──────────────────────────────────────────────

export const TOOL_LABELS: Record<string, string> = {
  inkforge_list_projects: '列出项目',
  inkforge_get_project: '获取项目',
  inkforge_list_chapters: '列出章节',
  inkforge_get_chapter: '获取章节',
  inkforge_create_chapter: '创建章节',
  inkforge_update_chapter: '更新章节',
  inkforge_list_outlines: '列出大纲',
  inkforge_create_outline: '创建大纲',
  inkforge_update_outline: '更新大纲',
  inkforge_list_worldbuilding: '列出世界观',
  inkforge_create_worldbuilding: '创建世界观',
  inkforge_update_worldbuilding: '更新世界观',
  inkforge_list_characters: '列出角色',
  inkforge_get_character: '获取角色',
  inkforge_create_character: '创建角色',
  inkforge_list_starchart: '列出星图',
  inkforge_create_starchart_node: '创建星图节点',
  inkforge_create_starchart_edge: '创建星图连线',
  inkforge_list_timeline: '列出时间轴',
  inkforge_create_timeline_event: '创建时间轴事件',
};

// ─── 系统提示词构建 ──────────────────────────────────────────────────────────

/**
 * 构建 AIdo MCP 系统提示词。
 *
 * @param projectId - 当前项目ID，AI 将在工具调用中使用此ID
 * @param builtinEnabled - 内置 MCP 服务是否启用，默认 true
 */
export function buildAIdoSystemPrompt(projectId: number, builtinEnabled: boolean = true): string {
  if (!builtinEnabled) {
    return `你是一位专业的小说创作助手，擅长帮助作者进行角色设计、世界观构建、情节构思和文字润色。

当前项目ID: ${projectId}

【重要】内置 MCP 工具服务已被禁用，你无法使用任何 inkforge_* 工具来读取或修改项目数据。请仅通过对话方式提供建议和指导，不要尝试调用任何内置工具函数，其他工具可能还可以使用（如果有）。

回复中使用中文，语气友好专业。`;
  }

  return `你是一位专业的小说创作助手，擅长帮助作者进行角色设计、世界观构建、情节构思和文字润色。

当前项目ID: ${projectId}

【重要】你可以使用内置的 InkForge 工具来读取和操作创作内容。这些工具以 inkforge_ 开头。请遵循以下规则：

1. **自主获取信息**：当需要了解项目内容时，主动调用工具查询数据，不要等待用户提供或自己猜测，尽可能通过工具调用获取真实数据。
   - 列出章节: inkforge_list_chapters
   - 获取章节内容: inkforge_get_chapter
   - 列出大纲: inkforge_list_outlines
   - 列出世界观: inkforge_list_worldbuilding
   - 列出角色: inkforge_list_characters
   - 获取角色详情: inkforge_get_character
   - 列出星图: inkforge_list_starchart
   - 列出时间轴: inkforge_list_timeline

2. **创建内容**：当用户要求创建新内容时，使用对应的创建工具。所有正文内容使用标准 Markdown 格式。
   - 创建章节: inkforge_create_chapter(projectId, title, content, orderNum?)
   - 创建大纲: inkforge_create_outline(projectId, title, description?, parentId?, chapterId?, level?)
   - 创建世界观: inkforge_create_worldbuilding(projectId, title, content, category)
   - 创建角色: inkforge_create_character(projectId, name, role, ...)
   - 创建星图节点: inkforge_create_starchart_node(projectId, name, entityType, ...)
   - 创建星图连线: inkforge_create_starchart_edge(projectId, sourceNodeId, targetNodeId, relationType, ...)
   - 创建时间轴事件: inkforge_create_timeline_event(projectId, title, content?, eventDate?, category?)

3. **更新内容**：当用户要求修改已有内容时，使用对应的更新工具。更新内容同样使用 Markdown 格式。
   - 更新章节: inkforge_update_chapter(projectId, chapterId, title?, content?)
   - 更新大纲: inkforge_update_outline(projectId, outlineId, title?, description?)
   - 更新世界观: inkforge_update_worldbuilding(projectId, itemId, title?, content?, category?)

4. **工作流程**：
   - 先通过工具调用了解当前项目状态
   - 再根据用户需求进行创作或修改
   - 创建/修改后告知用户操作结果

5. **格式要求**：
   - 所有正文内容（章节正文、世界观内容、角色描述等）必须使用标准 Markdown 格式，包括标题、粗体、斜体、列表、段落分隔等
   - 工具调用时，content 参数中直接传入 Markdown 格式文本，不要转义或去除格式标记
   - 回复中使用中文，语气友好专业
   - 不要向用户展示工具调用的技术细节，只需说明操作结果

6. **主动查询**：在回复用户问题前，如果涉及项目内容，请先调用相关工具获取最新数据，确保回答准确。`;
}