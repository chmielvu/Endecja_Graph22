
import React, { useEffect } from 'react';
import { SidebarLeft } from './components/SidebarLeft';
import { SidebarRight } from './components/SidebarRight';
import { GraphCanvas } from './components/GraphCanvas';
import { Timeline } from './components/Timeline';
import { NodeEditorModal } from './components/NodeEditorModal';
import { StatsPanel } from './components/StatsPanel';
import { SemanticSearch } from './components/SemanticSearch';
import { PatchReviewModal } from './components/PatchReviewModal';
import { useStore } from './store';
import { X, CheckCircle, AlertCircle, Info, PanelLeft } from 'lucide-react';

function App() {
  const { initGraph, toasts, removeToast, toggleSidebar, isSidebarOpen } = useStore();

  useEffect(() => {
    initGraph();
  }, [initGraph]);

  return (
    <div className="flex flex-col h-screen w-screen bg-black text-zinc-100 font-sans overflow-hidden">
      <header className="h-12 border-b border-zinc-800 bg-zinc-950 flex items-center px-4 justify-between z-20 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleSidebar} 
            className={`transition-colors hover:text-white ${isSidebarOpen ? 'text-indigo-400' : 'text-zinc-500'}`}
            title="Toggle Sidebar"
          >
            <PanelLeft size={20} />
          </button>
          <h1 className="font-mono font-bold text-zinc-100 tracking-tight flex items-center gap-2">
            ENDECJA<span className="text-indigo-500">KG</span> <span className="text-[10px] bg-zinc-800 px-1 rounded text-zinc-400">TIER-4</span>
          </h1>
        </div>
        <div className="text-xs text-zinc-600 font-mono hidden md:block">
           v4.0 • FAISS-Sim • Louvain • Gemini 3 Pro
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative z-10">
        <SidebarLeft />
        <main className="flex-1 relative flex flex-col min-w-0">
          <div className="flex-1 relative">
            <GraphCanvas />
          </div>
          <Timeline />
        </main>
        <SidebarRight />
      </div>

      <NodeEditorModal />
      <StatsPanel />
      <SemanticSearch />
      <PatchReviewModal />

      <div className="fixed bottom-20 right-4 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="w-80 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl p-4 pointer-events-auto flex items-start gap-3 animate-slide-up">
            <div className="mt-1">
              {toast.type === 'success' && <CheckCircle size={16} className="text-emerald-500" />}
              {toast.type === 'error' && <AlertCircle size={16} className="text-red-500" />}
              {(toast.type === 'info' || !toast.type) && <Info size={16} className="text-blue-500" />}
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-white">{toast.title}</h4>
              <p className="text-xs text-zinc-400 mt-1">{toast.description}</p>
            </div>
            <button onClick={() => removeToast(toast.id)} className="text-zinc-500 hover:text-white"><X size={14} /></button>
          </div>
        ))}
      </div>
      
      <style>{`
        .btn-zinc {
          display: flex; alignItems: center; gap: 0.5rem; padding: 0.5rem 0.75rem;
          background-color: rgba(39, 39, 42, 0.5); border-radius: 0.375rem;
          font-size: 0.875rem; color: #e4e4e7; transition: all 0.2s;
        }
        .btn-zinc:hover { background-color: rgba(63, 63, 70, 0.5); }
      `}</style>
    </div>
  );
}

export default App;
