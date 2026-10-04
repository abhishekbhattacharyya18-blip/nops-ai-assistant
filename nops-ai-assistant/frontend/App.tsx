import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Waves, RotateCcw, Activity, Radar, MessageSquare } from 'lucide-react';
import { Message, ChatState } from './types';
import { sendMessageToGemini, resetChat } from './services/geminiService';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { SonarDashboard } from './components/SonarDashboard';

const generateId = () => Math.random().toString(36).substring(2, 15);

export default function App() {
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    error: null,
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatState.messages, chatState.isLoading]);

  // Initialize the conversation with the user's prompt
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const startConversation = async () => {
      const initialPrompt = "how is this software utilising the .TIF file that i am providing";
      
      const userMessage: Message = {
        id: generateId(),
        role: 'user',
        text: initialPrompt,
        timestamp: Date.now(),
      };

      setChatState(prev => ({
        ...prev,
        messages: [userMessage],
        isLoading: true,
        error: null
      }));

      try {
        const responseText = await sendMessageToGemini(initialPrompt);
        
        const modelMessage: Message = {
          id: generateId(),
          role: 'model',
          text: responseText,
          timestamp: Date.now(),
        };

        setChatState(prev => ({
          ...prev,
          messages: [...prev.messages, modelMessage],
          isLoading: false
        }));
      } catch (error) {
        setChatState(prev => ({
          ...prev,
          isLoading: false,
          error: "Failed to connect to the AI. Please check your API key and connection."
        }));
      }
    };

    startConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSendMessage = useCallback(async (text: string) => {
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      text,
      timestamp: Date.now(),
    };

    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
      error: null
    }));

    try {
      const responseText = await sendMessageToGemini(text);
      
      const modelMessage: Message = {
        id: generateId(),
        role: 'model',
        text: responseText,
        timestamp: Date.now(),
      };

      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, modelMessage],
        isLoading: false
      }));
    } catch (error) {
      setChatState(prev => ({
        ...prev,
        isLoading: false,
        error: "An error occurred while generating the response."
      }));
    }
  }, []);

  const handleReset = () => {
    resetChat();
    setChatState({
      messages: [],
      isLoading: false,
      error: null
    });
    hasInitialized.current = false;
    window.location.reload();
  };

  return (
    <div className="flex flex-col h-screen bg-navy-950 text-slate-100 font-sans selection:bg-cyan-500/30 overflow-hidden">
      {/* Header */}
      <header className="flex-none flex items-center justify-between px-6 py-4 bg-navy-900/90 backdrop-blur-md border-b border-navy-800 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-cyan-900/30 rounded-xl border border-cyan-500/30 relative overflow-hidden">
            <div className="absolute inset-0 bg-cyan-400/10 animate-pulse-fast"></div>
            <Waves className="text-cyan-400 relative z-10" size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wide flex items-center gap-2 text-slate-100">
              NOPS Command Center
            </h1>
            <p className="text-xs text-cyan-500/80 font-medium tracking-wider uppercase">Acoustic Prediction & ASW Intelligence</p>
          </div>
        </div>
        <button
          onClick={handleReset}
          className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-navy-800 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium border border-transparent hover:border-navy-700"
          title="Reset Session"
        >
          <RotateCcw size={18} />
          <span className="hidden sm:inline">Reset Session</span>
        </button>
      </header>

      {/* Main Content Area - Split Screen */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Left Pane: Sonar Dashboard */}
        <section className="w-full lg:w-3/5 h-1/2 lg:h-full overflow-y-auto border-b lg:border-b-0 lg:border-r border-navy-800 p-4 sm:p-6 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-navy-900/40 via-navy-950 to-navy-950 custom-scrollbar">
          <SonarDashboard onAnalyze={handleSendMessage} />
        </section>

        {/* Right Pane: AI Assistant Chat */}
        <section className="w-full lg:w-2/5 h-1/2 lg:h-full flex flex-col bg-navy-950 relative">
          <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-navy-950 to-transparent z-10 pointer-events-none"></div>
          
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
            {chatState.messages.length === 0 && !chatState.isLoading && (
              <div className="flex flex-col items-center justify-center h-full text-slate-600">
                <Radar size={48} className="mb-4 opacity-20 animate-pulse" />
                <p className="text-sm font-medium tracking-wide">Initializing NOPS AI Assistant...</p>
              </div>
            )}

            {chatState.messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}

            {chatState.isLoading && (
              <div className="flex w-full justify-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-navy-800 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-900/20">
                    <Activity size={16} className="text-cyan-400 animate-pulse" />
                  </div>
                  <div className="px-5 py-4 rounded-2xl bg-navy-800 border border-navy-700 rounded-tl-sm flex gap-1.5 items-center">
                    <div className="w-2 h-2 bg-cyan-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-cyan-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-cyan-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}

            {chatState.error && (
              <div className="p-4 mb-6 bg-red-900/20 border border-red-900/50 rounded-xl text-red-400 text-sm text-center flex items-center justify-center gap-2">
                <Activity size={16} />
                {chatState.error}
              </div>
            )}
            
            <div ref={messagesEndRef} className="h-4" />
          </div>

          {/* Chat Input Area */}
          <footer className="flex-none p-4 bg-navy-950 border-t border-navy-900 z-20">
            <ChatInput onSendMessage={handleSendMessage} isLoading={chatState.isLoading} />
            <div className="flex justify-between items-center mt-2 px-1">
              <p className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                AI LINK ACTIVE
              </p>
              <p className="text-[10px] text-slate-500 flex items-center gap-1">
                <MessageSquare size={10} /> Tactical Advisory Mode
              </p>
            </div>
          </footer>
        </section>

      </main>
    </div>
  );
}
