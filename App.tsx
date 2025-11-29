import React, { useEffect } from 'react';
import { SidebarLeft } from './components/SidebarLeft';
import { SidebarRight } from './components/SidebarRight';
import { GraphCanvas } from './components/GraphCanvas';
import { Timeline } from './components/Timeline';
import { NodeEditorModal } from './components/NodeEditorModal';
import { StatsPanel } from './components/StatsPanel';
import { SemanticSearch } from './components/SemanticSearch';
import { PatchReviewModal } from './components/PatchReviewModal';
import { ResearchDashboard } from './components/ResearchDashboard';
import { useStore } from './store';
import { X, CheckCircle, AlertCircle, Info, PanelLeftOpen } from 'lucide-react';

function App() {
  const { initGraph, toasts, removeToast, toggleSidebar, isSidebarOpen } = useStore();

  useEffect(() => {
    initGraph();
  }, [initGraph]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#09090b] text-zinc-100 font-sans overflow-hidden selection:bg-[#355e3b] selection:text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Spectral:wght@400;600;700&display=swap');
        .font-spectral { font-family: 'Spectral', serif; }
        
        /* Custom Scrollbar for the archival look */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #0c0c0e; }
        ::-webkit-scrollbar-thumb { background: #1e3a25; border-radius: 2px; } /* Dark Green thumb */
        ::-webkit-scrollbar-thumb:hover { background: #355e3b; }

        .btn-zinc {
          display: flex; alignItems: center; gap: 0.5rem; padding: 0.5rem 0.75rem;
          background-color: rgba(53, 94, 59, 0.08); /* OWP Green tint */
          border: 1px solid rgba(53, 94, 59, 0.3); /* OWP Green border */
          border-radius: 0.1rem; 
          font-size: 0.875rem; color: #d4d4d8; transition: all 0.2s;
          font-family: 'Inter', sans-serif;
        }
        .btn-zinc:hover { 
          background-color: rgba(53, 94, 59, 0.25); 
          border-color: #355e3b;
          color: #fff;
          box-shadow: 0 0 10px rgba(53, 94, 59, 0.1);
        }
      `}</style>

      {/* Floating Toggle Button (Visible only when Sidebar is closed) */}
      {!isSidebarOpen && (
        <button 
          onClick={toggleSidebar}
          className="absolute top-4 left-4 z-50 p-2 bg-[#0c0c0e] border border-[#355e3b]/50 text-[#355e3b] rounded shadow-lg hover:bg-[#355e3b] hover:text-white transition-all duration-300"
          title="Open Sidebar"
        >
          <PanelLeftOpen size={20} />
        </button>
      )}

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
      <ResearchDashboard />

      <div className="fixed bottom-20 right-4 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="w-80 bg-[#18181b] border border-[#355e3b]/50 rounded-sm shadow-2xl p-4 pointer-events-auto flex items-start gap-3 animate-slide-up">
            <div className="mt-1">
              {toast.type === 'success' && <CheckCircle size={16} className="text-[#355e3b]" />}
              {toast.type === 'error' && <AlertCircle size={16} className="text-[#be123c]" />}
              {(toast.type === 'info' || !toast.type) && <Info size={16} className="text-[#355e3b]" />}
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-white font-spectral">{toast.title}</h4>
              <p className="text-xs text-zinc-400 mt-1">{toast.description}</p>
            </div>
            <button onClick={() => removeToast(toast.id)} className="text-zinc-500 hover:text-white"><X size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;