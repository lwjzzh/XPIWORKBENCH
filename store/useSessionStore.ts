
import { create } from 'zustand';
import { Session } from '../types/schema';
import * as storage from '../services/storage';

interface SessionStoreState {
  sessions: Session[];
  isLoading: boolean;
  
  loadSessions: () => Promise<void>;
  saveSession: (session: Session) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  togglePinSession: (id: string) => Promise<void>;
  
  // Helper to get sessions for a specific app
  getSessionsByApp: (appId: string, type: 'chat' | 'panel') => Session[];
}

// Helper for sorting: Pinned first, then by Date descending
const sortSessions = (sessions: Session[]) => {
    return sessions.sort((a, b) => {
        if (a.isPinned !== b.isPinned) {
            return a.isPinned ? -1 : 1; // Pinned comes first
        }
        return b.updatedAt - a.updatedAt; // Then by date
    });
};

export const useSessionStore = create<SessionStoreState>((set, get) => ({
  sessions: [],
  isLoading: true,

  loadSessions: async () => {
    set({ isLoading: true });
    const sessions = await storage.getSessions();
    set({ sessions: sortSessions(sessions), isLoading: false });
  },

  saveSession: async (session) => {
    const updatedSession = { ...session, updatedAt: Date.now() };
    await storage.saveSession(updatedSession);
    
    set(state => {
       const exists = state.sessions.find(s => s.id === session.id);
       let newSessions;
       if (exists) {
           newSessions = state.sessions.map(s => s.id === session.id ? updatedSession : s);
       } else {
           newSessions = [updatedSession, ...state.sessions];
       }
       return { sessions: sortSessions(newSessions) };
    });
  },

  deleteSession: async (id) => {
    await storage.deleteSession(id);
    set(state => ({ sessions: state.sessions.filter(s => s.id !== id) }));
  },

  togglePinSession: async (id) => {
      const session = get().sessions.find(s => s.id === id);
      if (!session) return;
      
      const updatedSession = { ...session, isPinned: !session.isPinned };
      await storage.saveSession(updatedSession);
      
      set(state => ({
          sessions: sortSessions(state.sessions.map(s => s.id === id ? updatedSession : s))
      }));
  },

  getSessionsByApp: (appId, type) => {
      return get().sessions.filter(s => s.appId === appId && s.type === type);
  }
}));
