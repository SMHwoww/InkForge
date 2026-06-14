/**
 * AIdo — Unified AIdo instruction parser, stripper, and system prompt builder.
 *
 * All AI-related pages (AIAssistant, AIPanel) use this single source of truth.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type AIdoType = 'EDIT' | 'OUTLINE' | 'WORLDBUILD' | 'STARCHART' | 'TIMELINE' | 'PLACEHOLDER';

export interface AIdoAction {
  type: AIdoType;
  action: string;
  title: string;
  content: string;
  options?: string;
}

// Maps AIdoType -> display metadata
export const AIDO_TYPE_META: Record<AIdoType, { label: string; color: string }> = {
  EDIT: { label: '正文', color: 'bg-[#c9a96e]/5' },
  OUTLINE: { label: '大纲', color: 'bg-[#7dc9a9]/5' },
  WORLDBUILD: { label: '世界观', color: 'bg-[#7da8c9]/5' },
  STARCHART: { label: '星图', color: 'bg-[#e8a8c9]/5' },
  TIMELINE: { label: '时间轴', color: 'bg-[#d4a87d]/5' },
  PLACEHOLDER: { label: '长任务', color: 'bg-orange-900/15' },
};

// ─── Bracket parser ───────────────────────────────────────────────────────────

/** Find the matching closing bracket ] that balances nested brackets. */
function findClosingBracket(text: string, startIndex: number): number {
  let depth = 1;
  for (let i = startIndex; i < text.length; i++) {
    if (text[i] === '[') depth++;
    else if (text[i] === ']') depth--;
    if (depth === 0) return i;
  }
  return -1;
}

// ─── Strip AIdo instructions from display text ────────────────────────────────

/** Remove all AIdo instructions so the user sees clean text. */
export function stripAIdoInstructions(text: string): string {
  const tagPattern = /\[(EDIT|OUTLINE|WORLDBUILD|STARCHART|TIMELINE|PLACEHOLDER)\|\|\|/g;
  let result = '';
  let lastEnd = 0;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(text)) !== null) {
    result += text.slice(lastEnd, match.index);
    const closeIdx = findClosingBracket(text, match.index + match[0].length);
    lastEnd = closeIdx >= 0 ? closeIdx + 1 : match.index + match[0].length;
  }
  result += text.slice(lastEnd);
  return result.trim();
}

// ─── Parse AIdo instructions ──────────────────────────────────────────────────

/** Parse all AIdo instructions from AI response text. */
export function parseAIdoInstructions(text: string): AIdoAction[] {
  const actions: AIdoAction[] = [];
  const tagPattern = /\[(EDIT|OUTLINE|WORLDBUILD|STARCHART|TIMELINE|PLACEHOLDER)\|\|\|/g;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(text)) !== null) {
    const tag = match[1] as AIdoType;
    const payloadStart = match.index + match[0].length;
    const closeIdx = findClosingBracket(text, payloadStart);
    if (closeIdx < 0) continue;
    const payload = text.slice(payloadStart, closeIdx);
    const parts = payload.split('|||');

    switch (tag) {
      case 'EDIT':
        actions.push({ type: 'EDIT', action: 'edit', title: parts[0] || '', content: parts.slice(1).join('|||') || '' });
        break;
      case 'OUTLINE':
        actions.push({ type: 'OUTLINE', action: parts[0] || 'create', title: parts[1] || '', content: parts.slice(2).join('|||') || '' });
        break;
      case 'WORLDBUILD':
        actions.push({ type: 'WORLDBUILD', action: 'add', title: parts[0] || '', content: parts.slice(1).join('|||') || '' });
        break;
      case 'STARCHART':
        actions.push({ type: 'STARCHART', action: parts[0] || 'add', title: parts[1] || '', content: parts.slice(2).join('|||') || '' });
        break;
      case 'TIMELINE':
        actions.push({ type: 'TIMELINE', action: 'create', title: parts[0] || '', content: parts.slice(1).join('|||') || '' });
        break;
      case 'PLACEHOLDER':
        actions.push({ type: 'PLACEHOLDER', action: 'defer', title: parts[0] || '', content: parts.slice(1).join('|||') || '', options: parts[1] || undefined });
        break;
    }
  }
  return actions;
}

// ─── System prompt builder ────────────────────────────────────────────────────

/** Build the unified AIdo system prompt. Accepts optional extra context. */
export function buildAIdoSystemPrompt(extraContext?: string): string {
  const base = `[AIdo模式] 你可以使用以下特殊指令来直接操作创作内容。

【重要】以下指令是内部系统标记，绝对不能向用户展示或提及。指令必须放在回复的绝对最后，不要在指令前后添加任何说明文字。不要用任何markdown格式（代码块、引用块、加粗等）包裹指令——指令应当以纯文本形式紧跟在回复末尾。

指令格式（使用 ||| 作为字段分隔符）：
[EDIT|||章节标题|||正文内容] - 创建或编辑正文（正文使用标准markdown格式）
[OUTLINE|||大纲标题|||简要描述] - 添加大纲条目
[WORLDBUILD|||标题|||世界观内容] - 添加世界观设定
[STARCHART|||add|||节点名称|||节点描述] - 添加星图节点
[STARCHART|||connect|||节点A->节点B|||关系类型|关系标签] - 创建星图节点连线（关系类型：family/friend/love/enemy/master_student/colleague/association/other）
[TIMELINE|||事件标题|||事件描述] - 创建时间轴事件，注意时间顺序不一定是故事发展顺序
[PLACEHOLDER|||任务标题|||任务描述] - 表示任务较长或有多个方向可选，不给完整输出以减少tokens消耗`;

  return extraContext ? `${base}\n\n${extraContext}` : base;
}