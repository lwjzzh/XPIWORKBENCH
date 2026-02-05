import { create } from 'zustand';
import { App, Component } from '../types/schema';
import * as storage from '../services/storage';

interface AppStoreState {
  apps: App[];
  isLoading: boolean;
  
  // Actions
  loadApps: () => Promise<void>;
  addApp: (app: App) => Promise<void>;
  updateApp: (id: string, updates: Partial<App>) => Promise<void>;
  deleteApp: (id: string) => Promise<void>;
  togglePinApp: (id: string) => Promise<void>;
  
  // Component Actions
  addComponent: (appId: string, component: Component) => Promise<void>;
  updateComponent: (appId: string, componentId: string, updates: Partial<Component>) => Promise<void>;
  deleteComponent: (appId: string, componentId: string) => Promise<void>;
  
  // Synch Helper
  getAppById: (id: string) => App | undefined;
}

export const useAppStore = create<AppStoreState>((set, get) => ({
  apps: [],
  isLoading: true,

  loadApps: async () => {
    set({ isLoading: true });
    const apps = await storage.getApps();
    set({ apps, isLoading: false });
  },

  getAppById: (id) => get().apps.find(a => a.id === id),

  addApp: async (app) => {
    await storage.saveApp(app);
    set(state => ({ apps: [...state.apps, app] }));
  },

  updateApp: async (id, updates) => {
    const app = get().apps.find(a => a.id === id);
    if (!app) return;
    
    const updatedApp = { ...app, ...updates, updatedAt: Date.now() };
    await storage.saveApp(updatedApp);
    
    set(state => ({
      apps: state.apps.map(a => a.id === id ? updatedApp : a)
    }));
  },

  togglePinApp: async (id) => {
    const app = get().apps.find(a => a.id === id);
    if (!app) return;

    // Do NOT update timestamp when pinning, purely a UI preference change
    const updatedApp = { ...app, isPinned: !app.isPinned };
    await storage.saveApp(updatedApp);

    set(state => ({
        apps: state.apps.map(a => a.id === id ? updatedApp : a)
    }));
  },

  deleteApp: async (id) => {
    await storage.deleteApp(id);
    set(state => ({ apps: state.apps.filter(a => a.id !== id) }));
  },

  addComponent: async (appId, component) => {
    const app = get().apps.find(a => a.id === appId);
    if (!app) return;

    const updatedApp = { 
        ...app, 
        components: [...app.components, component],
        updatedAt: Date.now() 
    };
    await storage.saveApp(updatedApp);

    set(state => ({
        apps: state.apps.map(a => a.id === appId ? updatedApp : a)
    }));
  },

  updateComponent: async (appId, componentId, updates) => {
    const app = get().apps.find(a => a.id === appId);
    if (!app) return;

    const updatedApp = {
        ...app,
        components: app.components.map(c => c.id === componentId ? { ...c, ...updates } : c),
        updatedAt: Date.now()
    };
    await storage.saveApp(updatedApp);

    set(state => ({
        apps: state.apps.map(a => a.id === appId ? updatedApp : a)
    }));
  },

  deleteComponent: async (appId, componentId) => {
    const app = get().apps.find(a => a.id === appId);
    if (!app) return;

    const updatedApp = {
        ...app,
        components: app.components.filter(c => c.id !== componentId),
        updatedAt: Date.now()
    };
    await storage.saveApp(updatedApp);

    set(state => ({
        apps: state.apps.map(a => a.id === appId ? updatedApp : a)
    }));
  }
}));