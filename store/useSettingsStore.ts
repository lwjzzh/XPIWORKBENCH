
import { create } from 'zustand';

interface SettingsState {
  defaultSavePath: string;
  autoSaveResult: boolean;
  envVars: Record<string, string>;
  
  // Actions
  setDefaultSavePath: (path: string) => void;
  setAutoSaveResult: (enabled: boolean) => void;
  setEnvVar: (key: string, value: string) => void;
  deleteEnvVar: (key: string) => void;
  loadSettings: () => void;
}

const STORAGE_KEY = 'omniflow_settings';

export const useSettingsStore = create<SettingsState>((set, get) => ({
  defaultSavePath: '',
  autoSaveResult: false,
  envVars: {},

  loadSettings: () => {
      try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
              const data = JSON.parse(raw);
              // Ensure envVars exists if loading from old config
              set({ 
                  defaultSavePath: data.defaultSavePath || '',
                  autoSaveResult: data.autoSaveResult || false,
                  envVars: data.envVars || {} 
              });
          }
      } catch (e) {
          console.error("Failed to load settings", e);
      }
  },

  setDefaultSavePath: (path) => {
      const newState = { ...get(), defaultSavePath: path };
      set(newState);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  },

  setAutoSaveResult: (enabled) => {
      const newState = { ...get(), autoSaveResult: enabled };
      set(newState);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  },

  setEnvVar: (key, value) => {
      const newEnv = { ...get().envVars, [key]: value };
      const newState = { ...get(), envVars: newEnv };
      set(newState);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  },

  deleteEnvVar: (key) => {
      const newEnv = { ...get().envVars };
      delete newEnv[key];
      const newState = { ...get(), envVars: newEnv };
      set(newState);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  }
}));
