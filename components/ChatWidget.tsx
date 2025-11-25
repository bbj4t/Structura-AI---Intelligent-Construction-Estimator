import React, { useState, useRef, useEffect } from 'react';
import { sendChatMessage, generateComplexEstimate, ensureApiKey } from '../services/geminiService';
import { ChatMessage } from '../types';
import { Send, Bot, User, BrainCircuit, Loader2 } from 'lucide-react';

export const ChatWidget: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Hello! I am Structura, your AI construction consultant. I can help with building codes, complex estimates, and project planning. How can I assist you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [useThinkingMode, setUseThinkingMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    try {
      let responseText = '';
      if (useThinkingMode) {
          await ensureApiKey();
          responseText = await generateComplexEstimate(input);
      } else {
          const history = messages.map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
          }));
          responseText = await sendChatMessage(history, input);
      }

      setMessages(prev => [...prev, { role: 'model', text: responseText }]);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'model', text: "I encountered an error processing that request. Please try again.", isError: true }]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
       {/* Chat Header */}
       <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-sm">
          <div className="flex items-center space-x-3">
             <div className="bg-primary/20 p-2 rounded-lg border border-primary/30">
               <Bot className="text-primary" size={24} />
             </div>
             <div>
               <h3 className="font-bold text-white">Gemini Consultant</h3>
               <p className="text-xs text-slate-400">Powered by Gemini 3 Pro</p>
             </div>
          </div>
          <div className="flex items-center space-x-3 bg-slate-950 p-2 rounded-xl border border-slate-800">
            <span className={`text-xs font-bold ${useThinkingMode ? 'text-indigo-400' : 'text-slate-500'}`}>Thinking Mode</span>
            <button 
              onClick={() => setUseThinkingMode(!useThinkingMode)}
              className={`w-12 h-6 rounded-full flex items-center transition-colors p-1 ${useThinkingMode ? 'bg-indigo-600 justify-end' : 'bg-slate-700 justify-start'}`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </button>
          </div>
       </div>

       {/* Messages */}
       <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900" ref={scrollRef}>
          {messages.map((msg, idx) => (
             <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                   <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mx-3 ${msg.role === 'user' ? 'bg-slate-700' : 'bg-primary/20 border border-primary/30'}`}>
                      {msg.role === 'user' ? <User size={20} className="text-slate-300" /> : <Bot size={20} className="text-primary" />}
                   </div>
                   <div className={`p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-md ${
                     msg.role === 'user' 
                       ? 'bg-slate-700 text-white rounded-tr-none' 
                       : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                   } ${msg.isError ? 'bg-red-900/20 text-red-200 border-red-800' : ''}`}>
                      {msg.text}
                   </div>
                </div>
             </div>
          ))}
          {isThinking && (
            <div className="flex justify-start">
               <div className="flex items-center space-x-3 ml-16 bg-slate-800/50 px-5 py-3 rounded-full border border-slate-700">
                  {useThinkingMode ? <BrainCircuit size={18} className="text-indigo-400 animate-pulse" /> : <Loader2 size={18} className="animate-spin text-slate-400" />}
                  <span className="text-xs font-medium text-slate-400">{useThinkingMode ? 'Reasoning deeply (32k token budget)...' : 'Gemini is thinking...'}</span>
               </div>
            </div>
          )}
       </div>

       {/* Input */}
       <div className="p-5 border-t border-slate-800 bg-slate-900">
          <div className="relative">
             <textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if(e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={useThinkingMode ? "Ask a complex estimation question..." : "Type your message..."}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-5 pr-14 py-4 text-white focus:ring-2 focus:ring-primary focus:outline-none resize-none h-16 shadow-inner placeholder-slate-600"
             />
             <button 
                onClick={handleSend}
                disabled={!input.trim() || isThinking}
                className="absolute right-3 top-3 bottom-3 bg-primary text-slate-900 p-2.5 rounded-xl hover:bg-sky-400 disabled:opacity-50 transition-colors shadow-lg shadow-primary/20"
             >
                <Send size={20} />
             </button>
          </div>
          {useThinkingMode && <p className="text-xs text-indigo-400 mt-3 flex items-center justify-center font-medium"><BrainCircuit size={14} className="mr-1.5"/> Thinking Mode enabled for complex tasks</p>}
       </div>
    </div>
  );
};