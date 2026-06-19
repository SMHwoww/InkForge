import { create } from 'zustand';
import { api } from '@/api/client';

export interface ModuleConfig {
  visible: Record<string, boolean>;
  order: string[];
}

interface ModuleConfigState {
  config: ModuleConfig;
  loading: boolean;
  fetchModuleConfig: () => Promise<void>;
  setModuleVisible: (moduleId: string, visible: boolean) => Promise<void>;
  setModuleOrder: (order: string[]) => Promise<void>;
}

export const useModuleConfigStore = create<ModuleConfigState>((set, get) => ({
  config: { visible: {}, order: [] },
  loading: false,

  fetchModuleConfig: async () => {
    set({ loading: true });
    try {
      const config = await api.getModuleConfig();
      set({ config, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setModuleVisible: async (moduleId, visible) => {
    const { config } = get();
    const newVisible = { ...config.visible, [moduleId]: visible };
    const newConfig = { ...config, visible: newVisible };
    set({ config: newConfig });
    await api.saveModuleConfig({ visible: newVisible });
  },

  setModuleOrder: async (order) => {
    const { config } = get();
    const newConfig = { ...config, order };
    set({ config: newConfig });
    await api.saveModuleConfig({ order });
  },
}));