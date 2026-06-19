import { create } from 'zustand';
import type { ChatMessage, ToolCallRecord } from '@/types';
import { api } from '@/api/client';

interface ChatState {
  projectId: number | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  setProjectId: (id: number | null) => void;
  addMessage: (msg: ChatMessage) => void;
  setStreaming: (val: boolean) => void;
  clearMessages: () => void;
  updateLastAssistant: (content: string) => void;
  setLastAssistantToolCalls: (calls: ToolCallRecord[]) => void;
  removeMessage: (index: number) => void;
  loadMessages: (projectId: number) => Promise<void>;
  _saveMessages: () => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSave(projectId: number, messages: ChatMessage[]) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    api.saveChatMessages(projectId, messages).catch(() => {});
  }, 500);
}

export const useChatStore = create<ChatState>((set, get) => ({
  projectId: null,
  messages: [],
  isStreaming: false,

  setProjectId: (id) => {
    const prev = get().projectId;
    set({ projectId: id, messages: [], isStreaming: false });
    if (id && id !== prev) {
      get().loadMessages(id);
    }
  },

  addMessage: (msg) => {
    const { messages, projectId } = get();
    const newMessages = [...messages, msg];
    set({ messages: newMessages });
    if (projectId) {
      debouncedSave(projectId, newMessages);
    }
  },

  setStreaming: (val) => set({ isStreaming: val }),

  clearMessages: () => {
    const { projectId } = get();
    set({ messages: [], isStreaming: false });
    if (projectId) {
      api.deleteChatMessages(projectId).catch(() => {});
    }
  },

  updateLastAssistant: (content) => {
    const { messages, projectId } = get();
    const msgs = [...messages];
    if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
      msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content };
    }
    set({ messages: msgs });
    if (projectId) {
      debouncedSave(projectId, msgs);
    }
  },

  setLastAssistantToolCalls: (calls) => {
    const { messages, projectId } = get();
    const msgs = [...messages];
    if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
      msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], tool_calls: calls };
    }
    set({ messages: msgs });
    if (projectId) {
      debouncedSave(projectId, msgs);
    }
  },

  removeMessage: (index) => {
    const { messages, projectId } = get();
    const newMessages = messages.filter((_, i) => i !== index);
    set({ messages: newMessages });
    if (projectId) {
      debouncedSave(projectId, newMessages);
    }
  },

  loadMessages: async (projectId) => {
    try {
      const data = await api.getChatMessages(projectId);
      const messages: ChatMessage[] = data.map((m: any) => ({
        role: m.role,
        content: m.content || '',
        tool_calls: m.tool_calls || undefined,
      }));
      set({ messages });
    } catch {
      // Silently fail - messages will be empty
    }
  },

  _saveMessages: () => {
    const { projectId, messages } = get();
    if (projectId) {
      api.saveChatMessages(projectId, messages).catch(() => {});
    }
  },
}));