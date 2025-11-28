import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { chatWithAgent } from '../services/geminiService';
import { Send, Cpu, Link as LinkIcon, ChevronDown, ChevronRight, MessageSquare } from 'lucide-react';

export const SidebarRight: React.FC = () => {
  const { messages, addMessage, isThinking, setThinking, graph } = useStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages, isThinking]);

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;

    const userMsg = { id: Date.now().toString(), role: 'user' as const, content: input, timestamp: Date.now() };
    addMessage(userMsg);
    setInput('');
    setThinking(true);

    try {
      const response = await chatWithAgent(messages, input, graph);
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text,
        reasoning: response.reasoning,
        sources: response.sources,
        timestamp: Date.now()
      });
    } catch (e) {
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: 'Error communicating with Dmowski.',
        timestamp: Date.now()
      });
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="w-[420px] h-full bg-zinc-900 border-l border-zinc-800 flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900">
        <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
          <MessageSquare size={16} /> Rozmowa z Romanem Dmowskim (1925)
        </h2>
        <span className="text-xs bg-zinc-800 px-2 py-1 rounded text-zinc-400">Persona Mode</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <ChatMessageItem key={msg.id} msg={msg} />
        ))}
        {isThinking && (
          <div className="flex gap-2 items-start animate-pulse opacity-70">
            <div className="w-8 h-8 rounded-full bg-indigo-900/50 flex items-center justify-center">
               <Cpu size={14} className="text-indigo-400" />
            </div>
            <div className="bg-zinc-800 rounded-lg p-3 text-xs text-zinc-400">
              Dmowski myśli nad odpowiedzią...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-zinc-800 bg-zinc-900">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Zadaj pytanie Panu Romanowi..."
            className="flex-1 bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
          <button 
            onClick={handleSend}
            disabled={isThinking}
            className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-md disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

const ChatMessageItem: React.FC<{ msg: any }> = ({ msg }) => {
  const [showReasoning, setShowReasoning] = useState(false);
  const isUser = msg.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${isUser ? 'bg-zinc-700' : 'bg-indigo-900/50'}`}>
        {isUser ? <span className="text-xs">Ty</span> : <span className="font-serif font-bold text-xs text-indigo-200">RD</span>}
      </div>
      
      <div className={`max-w-[85%] space-y-2`}>
        <div className={`p-3 rounded-lg text-sm break-words whitespace-pre-wrap ${isUser ? 'bg-zinc-800 text-zinc-100' : 'bg-zinc-800/50 text-zinc-200 border border-zinc-700'}`}>
          {msg.content}
        </div>

        {/* ReAct Reasoning Dropdown */}
        {!isUser && msg.reasoning && (
           <div className="border border-zinc-800 rounded bg-zinc-900/50 overflow-hidden">
             <button 
               onClick={() => setShowReasoning(!showReasoning)}
               className="w-full flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 transition-colors text-xs text-zinc-500"
             >
               {showReasoning ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
               Logi systemowe
             </button>
             {showReasoning && (
               <div className="p-3 text-xs text-zinc-400 font-mono bg-zinc-950/30 whitespace-pre-wrap border-t border-zinc-800 break-words">
                 {msg.reasoning}
               </div>
             )}
           </div>
        )}
      </div>
    </div>
  );
};