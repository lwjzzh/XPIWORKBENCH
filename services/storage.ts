
import { App, Session } from '../types/schema';

// Helper to access Wails backend
const getBackend = () => (window as any).go?.main?.App;
const getRuntime = () => (window as any).runtime; // Wails Runtime for Events

// --- APPS ---
export const getApps = async (): Promise<App[]> => {
  try {
    const backend = getBackend();
    if (backend) {
      const jsonList: string[] = await backend.GetApps();
      return jsonList.map(json => JSON.parse(json));
    }
    const raw = localStorage.getItem('omniflow_apps_v2');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to load apps:", e);
    return [];
  }
};

export const saveApp = async (app: App): Promise<void> => {
  try {
    const backend = getBackend();
    if (backend) {
      await backend.SaveApp(JSON.stringify(app));
      return;
    }
    const apps = await getApps();
    const idx = apps.findIndex(a => a.id === app.id);
    if (idx >= 0) apps[idx] = app;
    else apps.push(app);
    localStorage.setItem('omniflow_apps_v2', JSON.stringify(apps));
  } catch (e) {
    console.error("Failed to save app:", e);
  }
};

export const deleteApp = async (id: string): Promise<void> => {
  try {
    const backend = getBackend();
    if (backend) {
      await backend.DeleteApp(id);
      return;
    }
    const apps = await getApps();
    const newApps = apps.filter(a => a.id !== id);
    localStorage.setItem('omniflow_apps_v2', JSON.stringify(newApps));
  } catch (e) {
    console.error("Failed to delete app:", e);
  }
};

export const getAppById = async (id: string): Promise<App | undefined> => {
  const apps = await getApps();
  return apps.find(a => a.id === id);
};

// --- SESSIONS (Persistence) ---
export const getSessions = async (): Promise<Session[]> => {
    try {
        const backend = getBackend();
        if (backend) {
            const jsonList: string[] = await backend.GetSessions();
            return jsonList.map(json => JSON.parse(json));
        }
        const raw = localStorage.getItem('omniflow_sessions');
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.error("Failed to load sessions:", e);
        return [];
    }
};

export const saveSession = async (session: Session): Promise<void> => {
    try {
        const backend = getBackend();
        if (backend) {
            await backend.SaveSession(JSON.stringify(session));
            return;
        }
        const sessions = await getSessions();
        const idx = sessions.findIndex(s => s.id === session.id);
        if (idx >= 0) sessions[idx] = session;
        else sessions.push(session);
        localStorage.setItem('omniflow_sessions', JSON.stringify(sessions));
    } catch (e) {
        console.error("Failed to save session:", e);
    }
};

export const deleteSession = async (id: string): Promise<void> => {
    try {
        const backend = getBackend();
        if (backend) {
            await backend.DeleteSession(id);
            return;
        }
        const sessions = await getSessions();
        const newSessions = sessions.filter(s => s.id !== id);
        localStorage.setItem('omniflow_sessions', JSON.stringify(newSessions));
    } catch (e) {
        console.error("Failed to delete session:", e);
    }
};


// --- Backend Proxy Helper ---
export const proxyRequest = async (method: string, url: string, headers: Record<string, string>, body: string) => {
    const backend = getBackend();
    if (backend) {
        return await backend.ProxyRequest(method, url, headers, body);
    }
    throw new Error("Wails backend not connected.");
};

// --- Streaming Proxy Helper ---
export const proxyStreamRequest = async (
    method: string, 
    url: string, 
    headers: Record<string, string>, 
    body: string, 
    onData: (chunk: string) => void
): Promise<string> => {
    const backend = getBackend();
    const runtime = getRuntime();

    if (!backend || !runtime) {
        throw new Error("Wails backend not connected.");
    }

    const requestId = crypto.randomUUID();
    let accumulatedBody = "";
    
    return new Promise((resolve, reject) => {
        // Subscribe to Events
        const dataEvent = `stream:data:${requestId}`;
        const errorEvent = `stream:error:${requestId}`;
        const endEvent = `stream:end:${requestId}`;

        // Cleanup function
        const cleanup = () => {
            runtime.EventsOff(dataEvent);
            runtime.EventsOff(errorEvent);
            runtime.EventsOff(endEvent);
        };

        runtime.EventsOn(dataEvent, (chunkB64: string) => {
            try {
                // Decode Base64 chunk to string (UTF-8 safe usually happens after full reassembly, 
                // but for streaming text we trust standard JS atob/TextDecoder)
                const binaryString = atob(chunkB64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const chunk = new TextDecoder().decode(bytes, { stream: true });
                
                accumulatedBody += chunk;
                onData(chunk);
            } catch (e) {
                console.error("Chunk decode error", e);
            }
        });

        runtime.EventsOn(errorEvent, (err: string) => {
            cleanup();
            reject(new Error(err));
        });

        runtime.EventsOn(endEvent, () => {
            cleanup();
            resolve(accumulatedBody);
        });

        // Trigger Request
        backend.ProxyStreamRequest(requestId, method, url, headers, body);
    });
};
