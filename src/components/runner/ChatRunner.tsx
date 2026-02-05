import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Loader2, Sparkles, X, File as FileIcon, Plus, MessageSquare, Trash2, Menu, Edit2, Check, ArrowLeft, Pin, ArrowUp, Film, Image as ImageIcon, ChevronRight, ChevronDown, CheckCircle2, Circle, RefreshCw } from 'lucide-react';
import { App, Session } from '../../types/schema';
import { executeApp } from '../../services/workflowEngine';
import { ResultRenderer } from './ResultRenderer';
import { useSessionStore } from '../../store/useSessionStore';
import { useToast } from '../ui/Toast';
import { Button } from '../ui/Common';

interface ChatRunnerProps {
  app: App;
}

// Extended Message type to support "Process" visualization
interface ExecutionStep {
    id: string;
    name: string;
    status: 'pending' | 'running' | 'success' | 'error';
    error?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: any;
  attachment?: { name: string; data: string; type: 'image' | 'file' | 'video' };
  isError?: boolean;
  // New field to track intermediate steps
  executionSteps?: ExecutionStep[];
}

export const ChatRunner: React.FC<ChatRunnerProps> = ({ app }) => {
  const navigate = useNavigate();
  const { sessions, loadSessions, saveSession, deleteSession, togglePinSession } = useSessionStore();
  const { addToast } = useToast();
  
  // State
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [attachment, setAttachment] = useState<{ name: string; data: string; type: 'image' | 'file' | 'video' } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  
  // Expand Process State (by message ID)
  const [expandedProcesses, setExpandedProcesses] = useState<Record<string, boolean>>({});

  // Rename State
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  
  // Safety Ref
  const isMounted = useRef(true);
  
  // Smart Scroll Tracking
  const shouldAutoScrollRef = useRef(true);

  // Load Sessions on mount
  useEffect(() => {
      isMounted.current = true;
      loadSessions();
      return () => { isMounted.current = false; };
  }, []);

  // Compute sessions locally to ensure reactivity to store changes
  const allSessions = useMemo(() => {
    return sessions
        .filter(s => s.appId === app.id && s.type === 'chat')
        .sort((a, b) => {
            if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
            return b.updatedAt - a.updatedAt;
        });
  }, [sessions, app.id]);

  const pinnedSessions = useMemo(() => allSessions.filter(s => s.isPinned), [allSessions]);
  const otherSessions = useMemo(() => allSessions.filter(s => !s.isPinned), [allSessions]);

  // Switch Session
  useEffect(() => {
      if (activeSessionId) {
          const sess = allSessions.find(s => s.id === activeSessionId);
          if (sess) {
              setMessages(sess.data.messages || []);
              shouldAutoScrollRef.current = true; // Always scroll to bottom on switch
          }
      } else if (allSessions.length === 0 && !activeSessionId) {
          setMessages([{ id: 'init', role: 'assistant', content: `你好！我是 ${app.name}。有什么我可以帮你的吗？` }]);
      }
  }, [activeSessionId, app.id]);

  // Handle Scroll Logic
  const handleScroll = () => {
      if (!scrollRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      shouldAutoScrollRef.current = isNearBottom;
  };

  useEffect(() => {
    if (shouldAutoScrollRef.current && scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing, expandedProcesses]);

  useEffect(() => {
    if (textInputRef.current) {
        textInputRef.current.style.height = 'auto'; 
        const newHeight = Math.min(textInputRef.current.scrollHeight, 200);
        textInputRef.current.style.height = `${newHeight}px`;
    }
  }, [inputValue]);

  const handleNewChat = () => {
      setActiveSessionId(null);
      setMessages([{ id: 'init', role: 'assistant', content: `你好！我是 ${app.name}。有什么我可以帮你的吗？` }]);
      setInputValue('');
      setAttachment(null);
      shouldAutoScrollRef.current = true;
      if (window.innerWidth < 768) setShowSidebar(false);
      setTimeout(() => textInputRef.current?.focus(), 100);
  };

  const handleSelectSession = (id: string) => {
      if (editingSessionId) return; 
      setActiveSessionId(id);
      const sess = allSessions.find(s => s.id === id);
      if (sess) setMessages(sess.data.messages || []);
      if (window.innerWidth < 768) setShowSidebar(false);
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
      e.preventDefault(); e.stopPropagation(); 
      if(window.confirm("确认删除此对话？")) {
          await deleteSession(id);
          addToast('对话已删除', 'success');
          if (activeSessionId === id) handleNewChat();
      }
  };

  const handleTogglePin = async (e: React.MouseEvent, id: string) => {
      e.preventDefault(); e.stopPropagation();
      await togglePinSession(id);
  };

  const startRenaming = (e: React.MouseEvent, session: Session) => {
      e.preventDefault(); e.stopPropagation();
      setEditingSessionId(session.id);
      setEditNameValue(session.name);
  };

  const saveRename = async (e?: React.MouseEvent) => {
      e?.preventDefault(); e?.stopPropagation();
      if (editingSessionId) {
          const session = allSessions.find(s => s.id === editingSessionId);
          if (session && editNameValue.trim()) {
              await saveSession({ ...session, name: editNameValue.trim() });
          }
          setEditingSessionId(null);
      }
  };

  const persistCurrentSession = async (currentMsgs: Message[], knownSessionId: string | null): Promise<string> => {
      let sessId = knownSessionId;
      if (!sessId) {
          sessId = crypto.randomUUID();
          setActiveSessionId(sessId); 
      }
      let sessName = "新对话";
      const existing = allSessions.find(s => s.id === sessId);
      if (existing) {
          sessName = existing.name;
      } else {
          const firstUserMsg = currentMsgs.find(m => m.role === 'user');
          if (firstUserMsg && typeof firstUserMsg.content === 'string') {
              sessName = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '');
          }
      }
      const session: Session = {
          id: sessId, appId: app.id, name: sessName, type: 'chat',
          data: { messages: currentMsgs }, updatedAt: Date.now(), isPinned: existing?.isPinned || false
      };
      await saveSession(session);
      return sessId;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = () => {
              const dataStr = reader.result as string;
              const isImage = file.type.startsWith('image/');
              const isVideo = file.type.startsWith('video/');
              setAttachment({ name: file.name, data: dataStr, type: isImage ? 'image' : isVideo ? 'video' : 'file' });
          };
          reader.readAsDataURL(file);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleProcessExpand = (msgId: string) => {
      setExpandedProcesses(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const handleSend = async () => {
      if ((!inputValue.trim() && !attachment) || isProcessing) return;
      const userText = inputValue;
      const currentAttachment = attachment;
      setInputValue(''); setAttachment(null);
      shouldAutoScrollRef.current = true;
      
      const newUserMsg: Message = { id: crypto.randomUUID(), role: 'user', content: userText, attachment: currentAttachment || undefined };
      const messagesWithUser = [...messages, newUserMsg];
      setMessages(messagesWithUser);
      
      const currentStableId = await persistCurrentSession(messagesWithUser, activeSessionId);
      setIsProcessing(true);

      const botMsgId = crypto.randomUUID();
      
      const initialSteps: ExecutionStep[] = app.components.map(c => ({
          id: c.id,
          name: c.name,
          status: 'pending'
      }));

      const botPlaceholder: Message = { 
          id: botMsgId, 
          role: 'assistant', 
          content: '',
          executionSteps: initialSteps
      };
      
      setMessages(prev => [...prev, botPlaceholder]);
      setExpandedProcesses(prev => ({ ...prev, [botMsgId]: true })); 

      try {
          const structuredInputs: Record<string, Record<string, any>> = {};
          app.components.forEach((comp, idx) => {
              structuredInputs[comp.id] = {};
              if (idx === 0) {
                  let textAssigned = false; let fileAssigned = false;
                  comp.parameters.forEach(p => {
                      if (!p.isVisible) return;
                      if ((p.uiType === 'input' || p.uiType === 'textarea') && !textAssigned && userText) {
                          structuredInputs[comp.id][p.key] = userText; textAssigned = true;
                      }
                      if (p.uiType === 'file' && !fileAssigned && currentAttachment) {
                          structuredInputs[comp.id][p.key] = currentAttachment.data; fileAssigned = true;
                      }
                  });
              }
          });

          const historyArray = messages.filter(m => !m.isError && m.id !== 'init').map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }));
          const currentMsgObj = { role: 'user', content: userText };
          const context: Record<string, any> = { '$session_id': currentStableId, '$user_role': 'user', '$timestamp': Date.now().toString(), '$history': historyArray, '$messages': [...historyArray, currentMsgObj] };
          
          let finalContent = "";

          await executeApp(app.id, structuredInputs, (compId, status, result, error) => {
              if (!isMounted.current) return;

              setMessages(prev => prev.map(m => {
                  if (m.id !== botMsgId) return m;
                  
                  const newSteps = m.executionSteps?.map(step => {
                      if (step.id === compId) {
                          return { ...step, status, error };
                      }
                      return step;
                  });

                  const isLastStep = app.components[app.components.length - 1].id === compId;
                  let newContent = m.content;

                  if (isLastStep) {
                       if (status === 'running' && typeof result === 'string') {
                           newContent = result;
                       }
                       if (status === 'success') {
                           newContent = result;
                           finalContent = result;
                       }
                  }

                  return { ...m, content: newContent, executionSteps: newSteps };
              }));

              if (status === 'error' && !app.components.find(c=>c.id === compId)?.flowControl?.continueOnError) {
                   throw new Error(error || "Step failed");
              }

          }, context);

          if (!isMounted.current) return;

          setMessages(prev => prev.map(m => {
              if (m.id === botMsgId) {
                  return { ...m, executionSteps: m.executionSteps?.map(s => s.status === 'running' ? { ...s, status: 'success' } : s) };
              }
              return m;
          }));
          
          setTimeout(() => {
             if (isMounted.current) setExpandedProcesses(prev => ({ ...prev, [botMsgId]: false }));
          }, 1000);

          await persistCurrentSession([...messagesWithUser, { id: botMsgId, role: 'assistant', content: finalContent, executionSteps: undefined }], currentStableId);

      } catch (e: any) {
          if (!isMounted.current) return;
          setMessages(prev => prev.map(m => {
              if (m.id === botMsgId) {
                  return { ...m, isError: true, content: e.message || "工作流执行失败" };
              }
              return m;
          }));
      } finally {
          if (isMounted.current) setIsProcessing(false);
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const renderSessionItem = (sess: Session) => (
    <div 
        key={sess.id}
        onClick={() => handleSelectSession(sess.id)}
        className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-all duration-200 border border-transparent mb-1 relative ${activeSessionId === sess.id ? 'bg-zinc-800/80 text-white shadow-sm' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
    >
        {editingSessionId === sess.id ? (
            <div className="flex items-center gap-1 w-full" onClick={e => e.stopPropagation()}>
                <input 
                    autoFocus
                    className="flex-1 bg-black/40 border border-primary/50 rounded px-2 py-1 text-xs text-white focus:outline-none"
                    value={editNameValue}
                    onChange={e => setEditNameValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveRename()}
                    onBlur={() => saveRename()}
                />
                <button onClick={(e) => saveRename(e)} className="p-1 text-green-400 hover:bg-green-500/20 rounded"><Check className="w-3 h-3"/></button>
            </div>
        ) : (
            <>
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                    {sess.isPinned && <Pin className="w-3 h-3 text-blue-400 shrink-0" />}
                    <span className="truncate">{sess.name || '未命名对话'}</span>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900 rounded-l-md pl-1 absolute right-2 top-1/2 -translate-y-1/2 z-20 shadow-[-10px_0_10px_rgba(24,24,27,1)]">
                    <button onClick={(e) => handleTogglePin(e, sess.id)} className="p-1.5 text-zinc-400 hover:text-blue-400 rounded"><Pin className="w-3 h-3" /></button>
                    <button onClick={(e) => startRenaming(e, sess)} className="p-1.5 text-zinc-400 hover:text-white rounded"><Edit2 className="w-3 h-3" /></button>
                    <button onClick={(e) => handleDeleteSession(e, sess.id)} className="p-1.5 text-zinc-400 hover:text-red-400 rounded"><Trash2 className="w-3 h-3" /></button>
                </div>
            </>
        )}
    </div>
  );

  return (
    <div className="flex h-full bg-background overflow-hidden relative">
      <button className="md:hidden absolute top-4 left-4 z-50 p-2 bg-black/50 backdrop-blur rounded-full text-white border border-white/10" onClick={() => setShowSidebar(!showSidebar)}><Menu className="w-4 h-4" /></button>

      {/* Sidebar */}
      <div className={`w-[260px] bg-zinc-950 flex flex-col transition-all duration-300 absolute md:relative z-40 h-full border-r border-white/5 ${showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <div className="p-3 flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                 <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-zinc-500 hover:text-white px-0 hover:bg-transparent"><ArrowLeft className="w-4 h-4 mr-2" /> 返回</Button>
              </div>
              <Button onClick={handleNewChat} className="w-full justify-between bg-white/5 hover:bg-white/10 text-white border border-white/5 rounded-lg h-10 shadow-sm group">
                 <span className="flex items-center font-medium text-sm"><Plus className="w-4 h-4 mr-2" /> 新对话</span>
                 <Edit2 className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50 transition-opacity" />
              </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 space-y-4 custom-scrollbar pb-4 pt-2">
              {pinnedSessions.length > 0 && <div><div className="px-3 py-1.5 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">置顶</div>{pinnedSessions.map(sess => renderSessionItem(sess))}</div>}
              {otherSessions.length > 0 && <div><div className="px-3 py-1.5 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{pinnedSessions.length > 0 ? '最近' : '历史'}</div>{otherSessions.map(sess => renderSessionItem(sess))}</div>}
          </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative min-w-0 bg-background">
          {/* Header */}
          <div className="h-14 flex items-center justify-between px-6 shrink-0 z-10 border-b border-white/5 bg-background/50 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                  <span className="font-bold text-zinc-200 text-sm">{app.name}</span>
                  <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 rounded border border-white/5 font-mono">BOT</span>
              </div>
              <div className="flex items-center gap-3">
                  <button className="text-zinc-500 hover:text-white transition-colors"><RefreshCw className="w-4 h-4" onClick={handleNewChat}/></button>
              </div>
          </div>

          {/* Messages */}
          <div 
            className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth" 
            ref={scrollRef}
            onScroll={handleScroll}
          >
              <div className="max-w-3xl mx-auto space-y-8 pb-4">
                  {messages.map((msg) => (
                      <div key={msg.id} className="group flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                          {/* Avatar */}
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm ${msg.role === 'user' ? 'bg-zinc-700 text-zinc-300' : msg.isError ? 'bg-red-900/50 text-red-200' : 'bg-primary/20 text-primary border border-primary/20'}`}>
                              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                              <div className="font-bold text-sm text-zinc-400 select-none">
                                  {msg.role === 'user' ? 'You' : app.name}
                              </div>

                              {/* Workflow Steps (Chain of Thought) */}
                              {msg.executionSteps && msg.executionSteps.length > 0 && (
                                  <div className="mb-2">
                                      <div 
                                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 transition-colors cursor-pointer border border-white/5 select-none"
                                          onClick={() => toggleProcessExpand(msg.id)}
                                      >
                                          {isProcessing && msg.id === messages[messages.length-1].id ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> : <CheckCircle2 className="w-3.5 h-3.5 text-zinc-500" />}
                                          <span className="text-xs font-medium text-zinc-400">
                                              {isProcessing && msg.id === messages[messages.length-1].id ? 'Executing Workflow...' : 'Workflow Trace'}
                                          </span>
                                          {expandedProcesses[msg.id] ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500"/> : <ChevronRight className="w-3.5 h-3.5 text-zinc-500"/>}
                                      </div>
                                      
                                      {expandedProcesses[msg.id] && (
                                          <div className="mt-2 pl-2 space-y-1 border-l-2 border-zinc-800">
                                              {msg.executionSteps.map((step) => (
                                                  <div key={step.id} className="flex items-center gap-3 px-3 py-1 text-xs">
                                                      <div className="w-3.5 flex justify-center shrink-0">
                                                          {step.status === 'pending' && <Circle className="w-2.5 h-2.5 text-zinc-700" />}
                                                          {step.status === 'running' && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                                                          {step.status === 'success' && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                                                          {step.status === 'error' && <X className="w-3 h-3 text-red-500" />}
                                                      </div>
                                                      <span className={`${step.status === 'running' ? 'text-primary' : step.status === 'pending' ? 'text-zinc-600' : 'text-zinc-300'}`}>
                                                          {step.name}
                                                      </span>
                                                      {step.error && <span className="text-red-400 ml-2">{step.error}</span>}
                                                  </div>
                                              ))}
                                          </div>
                                      )}
                                  </div>
                              )}

                              {/* Message Body */}
                              <div className={`text-sm leading-7 ${msg.role === 'user' ? 'text-zinc-200' : 'text-zinc-300'}`}>
                                  {msg.role === 'user' ? (
                                      <div className="flex flex-col gap-2">
                                          {msg.attachment && (
                                              <div className="rounded-lg overflow-hidden border border-white/10 bg-black/40 max-w-[240px]">
                                                  {msg.attachment.type === 'image' ? <img src={msg.attachment.data} alt="attachment" className="w-full h-auto object-cover max-h-[200px]" /> : msg.attachment.type === 'video' ? <div className="relative"><video src={msg.attachment.data} controls className="w-full h-auto max-h-[200px]" /><div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white flex items-center gap-1 pointer-events-none"><Film className="w-3 h-3" /> Video</div></div> : <div className="p-3 flex items-center gap-2 text-xs text-zinc-300"><FileIcon className="w-4 h-4 shrink-0" /><span className="truncate">{msg.attachment.name}</span></div>}
                                              </div>
                                          )}
                                          {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
                                      </div>
                                  ) : (
                                      <div className="w-full overflow-x-auto">
                                          <ResultRenderer result={msg.content} status={msg.isError ? 'error' : 'success'} />
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>
                  ))}
                  {isProcessing && messages[messages.length-1].role === 'user' && (
                      <div className="flex gap-4 animate-pulse">
                          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                              <Sparkles className="w-4 h-4 text-zinc-500" />
                          </div>
                          <div className="flex items-center">
                              <div className="h-4 w-2 rounded-full bg-zinc-600 animate-bounce delay-75"></div>
                              <div className="h-4 w-2 rounded-full bg-zinc-600 animate-bounce mx-1 delay-150"></div>
                              <div className="h-4 w-2 rounded-full bg-zinc-600 animate-bounce delay-300"></div>
                          </div>
                      </div>
                  )}
              </div>
          </div>

          {/* Input Area */}
          <div className="shrink-0 p-6 z-20">
              <div className="max-w-3xl mx-auto">
                <div className="relative flex items-end gap-2 bg-zinc-900 border border-white/10 rounded-[26px] p-2 pl-4 shadow-lg focus-within:ring-1 focus-within:ring-white/20 transition-all">
                    <div className="shrink-0 mb-1.5">
                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
                        <button onClick={() => fileInputRef.current?.click()} className="w-8 h-8 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors" title="上传附件"><Plus className="w-5 h-5" /></button>
                    </div>

                    <div className="flex-1 flex flex-col min-w-0 py-2.5">
                        {attachment && (
                            <div className="flex items-center gap-3 p-2 mb-2 bg-white/5 rounded-xl border border-white/10 w-fit animate-in zoom-in-95">
                                <div className="p-1.5 bg-black/40 rounded-lg text-zinc-300">
                                    {attachment.type === 'image' ? <ImageIcon className="w-3.5 h-3.5"/> : attachment.type === 'video' ? <Film className="w-3.5 h-3.5"/> : <FileIcon className="w-3.5 h-3.5"/>}
                                </div>
                                <span className="text-xs text-zinc-200 max-w-[150px] truncate font-medium">{attachment.name}</span>
                                <button onClick={() => setAttachment(null)} className="ml-1 p-1 hover:bg-white/10 rounded-full text-zinc-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>
                            </div>
                        )}
                        <textarea 
                            ref={textInputRef} 
                            value={inputValue} 
                            onChange={(e) => setInputValue(e.target.value)} 
                            onKeyDown={handleKeyDown} 
                            placeholder="发送消息给 OmniFlow..." 
                            rows={1} 
                            className="w-full min-h-[24px] max-h-[200px] resize-none bg-transparent border-0 focus:ring-0 p-0 text-[15px] leading-relaxed placeholder:text-zinc-600 text-zinc-200 custom-scrollbar focus:outline-none" 
                        />
                    </div>

                    <div className="shrink-0 mb-1.5 mr-1">
                        {isProcessing ? (
                             <button className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-200 flex items-center justify-center cursor-not-allowed">
                                 <Loader2 className="w-4 h-4 animate-spin"/>
                             </button>
                        ) : (
                             <button 
                                disabled={!inputValue.trim() && !attachment} 
                                onClick={handleSend} 
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${ (inputValue.trim() || attachment) ? 'bg-white text-black hover:bg-zinc-200' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed' }`}
                             >
                                 <ArrowUp className="w-5 h-5" strokeWidth={2.5} />
                             </button>
                        )}
                    </div>
                </div>
                <div className="text-center mt-2">
                    <p className="text-[10px] text-zinc-600">OmniFlow can make mistakes. Consider checking important information.</p>
                </div>
              </div>
          </div>
      </div>
    </div>
  );
};