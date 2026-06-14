import { create } from 'zustand';
import type { ChatMessage } from '@/types';

interface ChatState {
  projectId: number | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  setProjectId: (id: number | null) => void;
  addMessage: (msg: ChatMessage) => void;
  setStreaming: (val: boolean) => void;
  clearMessages: () => void;
  updateLastAssistant: (content: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  projectId: null,
  messages: [],
  isStreaming: false,

  setProjectId: (id) => set({ projectId: id }),

  addMessage: (msg) => set({ messages: [...get().messages, msg] }),

  setStreaming: (val) => set({ isStreaming: val }),

  clearMessages: () => set({ messages: [], isStreaming: false }),

  updateLastAssistant: (content) => {
    const msgs = [...get().messages];
    if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
      msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content };
    }
    set({ messages: msgs });
  },
}));