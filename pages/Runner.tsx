
import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { App, AppRunMode } from '../types/schema';
import { PanelRunner } from '../components/runner/PanelRunner';
import { ChatRunner } from '../components/runner/ChatRunner';

const RunnerPage: React.FC = () => {
  const { id: appId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { apps, loadApps } = useAppStore();
  
  const [app, setApp] = useState<App | undefined>(undefined);
  const [isReady, setIsReady] = useState(false);
  const [activeMode, setActiveMode] = useState<AppRunMode>('panel');

  // Ensure apps are loaded
  useEffect(() => {
     if (apps.length === 0) {
         loadApps();
     }
  }, [loadApps, apps.length]);

  // Initialize App Data & Mode
  useEffect(() => {
    if (appId && apps.length > 0) {
        const data = apps.find(a => a.id === appId);
        if (data) {
            setApp(data);
            
            // Priority: URL Query Param > App Default Config
            const modeParam = searchParams.get('mode');
            if (modeParam === 'chat' || modeParam === 'panel') {
                setActiveMode(modeParam);
            } else {
                setActiveMode(data.runMode);
            }
            
            setIsReady(true);
        }
    }
  }, [appId, apps, searchParams]);

  if (!isReady || !app) {
      return (
          <div className="h-screen flex items-center justify-center text-zinc-500 bg-background gap-2">
              <RefreshCw className="w-5 h-5 animate-spin"/> 
              正在初始化...
          </div>
      );
  }

  return (
    <div className="h-screen w-full bg-background flex flex-col animate-in fade-in duration-300">
        {activeMode === 'chat' ? (
            <ChatRunner app={app} />
        ) : (
            <PanelRunner app={app} />
        )}
    </div>
  );
};

export default RunnerPage;
