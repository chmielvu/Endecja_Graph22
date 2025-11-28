import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { Play, Download, Search, Scissors, X, GitMerge, Map, Activity, Edit2, Trash2, BrainCircuit, Undo2, Redo2, FileJson } from 'lucide-react';
import { generateGraphExpansion } from '../services/geminiService';
import { detectDuplicatesSemantic, detectDuplicates } from '../services/graphService';
import { DuplicateCandidate } from '../types';

export const SidebarLeft: React.FC = () => {
  const { 
    graph, 
    initGraph, 
    recalculateGraph,
    selectedNodeIds, 
    clearSelection,
    activeCommunityColoring, 
    setCommunityColoring, 
    addNodesAndEdges,
    setThinking,
    mergeNodes,
    removeNode,
    addToast,
    runRegionalAnalysis,
    regionalAnalysis,
    setEditingNode,
    bulkDeleteSelection,
    setShowStatsPanel,
    isSidebarOpen,
    setSemanticSearchOpen,
    undo, redo, canUndo, canRedo
  } = useStore();

  const [dupeCandidates, setDupeCandidates] = useState<DuplicateCandidate[]>([]);
  const [showDupeModal, setShowDupeModal] = useState(false);
  
  // Resizable Sidebar State
  const [sidebarWidth, setSidebarWidth] = useState(420);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = e.clientX;
      if (newWidth > 240 && newWidth < 800) {
        setSidebarWidth(newWidth);
      }
    }
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  useEffect(() => {
    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  }, [isResizing]);

  const selectedNode = selectedNodeIds.length === 1 
    ? graph.nodes.find(n => n.data.id === selectedNodeIds[0])?.data 
    : null;

  const handleRunMetrics = () => {
    try {
      recalculateGraph();
      // Get updated graph to display the correct modularity
      const { graph: updatedGraph } = useStore.getState();
      addToast({ 
        title: 'Analiza Zakończona', 
        description: `Modularity: ${(updatedGraph.meta?.modularity || 0).toFixed(3)} (Louvain)`, 
        type: 'success' 
      });
    } catch (e: any) {
      addToast({ 
        title: 'Błąd Analizy', 
        description: `Nie udało się przeliczyć metryk: ${e.message}`, 
        type: 'error' 
      });
    }
  };

  const handleExpand = async () => {
    const topic = prompt("Enter a topic or entity to expand upon:");
    if (!topic) return;
    setThinking(true);
    addToast({ title: 'Expanding Graph', description: 'Consulting Gemini 3 Pro...', type: 'info' });
    try {
      const result = await generateGraphExpansion(graph, topic);
      addNodesAndEdges(result.newNodes, result.newEdges);
      addToast({ title: 'Expanded', description: `Added ${result.newNodes.length} nodes.`, type: 'success' });
    } catch (e) {
      addToast({ title: 'Error', description: 'Expansion failed.', type: 'error' });
    } finally {
      setThinking(false);
    }
  };

  const handleGroomDupes = async (semantic = false) => {
    setThinking(true);
    try {
      const candidates = semantic 
        ? await detectDuplicatesSemantic(graph, 0.88)
        : detectDuplicates(graph, 0.7);
      
      if (candidates.length === 0) {
        addToast({ title: 'Clean Graph', description: 'No duplicates detected.', type: 'success' });
      } else {
        setDupeCandidates(candidates);
        setShowDupeModal(true);
      }
    } finally {
      setThinking(false);
    }
  };

  const handleMerge = (candidate: DuplicateCandidate) => {
    const keepA = (candidate.nodeA.description?.length || 0) >= (candidate.nodeB.description?.length || 0);
    const keepId = keepA ? candidate.nodeA.id : candidate.nodeB.id;
    const dropId = keepA ? candidate.nodeB.id : candidate.nodeA.id;
    mergeNodes(keepId, dropId);
    setDupeCandidates(prev => prev.filter(c => c !== candidate));
  };

  const handleExportObsidian = () => {
    const obsidianData = {
      nodes: graph.nodes.map(n => ({
        id: n.data.id,
        label: n.data.label,
        x: n.position?.x || 0,
        y: n.position?.y || 0,
        community: n.data.louvainCommunity
      })),
      edges: graph.edges.map(e => ({
        source: e.data.source,
        target: e.data.target,
        label: e.data.label
      })),
      groups: Array.from(new Set(graph.nodes.map(n => n.data.louvainCommunity))).map(c => ({
        id: `community-${c}`,
        label: `Wspólnota ${c}`
      }))
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(obsidianData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "endecja-obsidian-graph.json");
    document.body.appendChild(downloadAnchorNode); 
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <>
      <div 
        ref={sidebarRef}
        className={`${isSidebarOpen ? 'border-r' : 'border-r-0'} bg-zinc-900 border-zinc-800 overflow-hidden flex-shrink-0 relative`}
        style={{ 
          width: isSidebarOpen ? sidebarWidth : 0, 
          transition: isResizing ? 'none' : 'width 0.3s ease-in-out' 
        }}
      >
        <div style={{ width: sidebarWidth }} className="h-full flex flex-col p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              Endecja KG <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1 rounded">Tier-4</span>
            </h2>
            <div className="flex items-center gap-1">
               <button onClick={undo} disabled={!canUndo()} className="p-1 text-zinc-400 hover:text-white disabled:opacity-30"><Undo2 size={16}/></button>
               <button onClick={redo} disabled={!canRedo()} className="p-1 text-zinc-400 hover:text-white disabled:opacity-30"><Redo2 size={16}/></button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Analysis</label>
              <button onClick={handleRunMetrics} className="w-full btn-zinc"><Play size={16} /> Analiza i Rozwój Grafu</button>
              <button onClick={() => setSemanticSearchOpen(true)} className="w-full btn-zinc text-indigo-400 border-indigo-900/50"><Search size={16} /> Wyszukiwanie Semantyczne</button>
              <button onClick={() => setShowStatsPanel(true)} className="w-full btn-zinc text-emerald-400"><Activity size={16} /> Graph Dashboard</button>
              <button onClick={runRegionalAnalysis} className="w-full btn-zinc border-purple-800 text-purple-300"><Map size={16} /> Regional Analysis</button>
              {regionalAnalysis && (
                <div className="p-3 bg-purple-950/20 border border-purple-900/50 rounded-lg text-xs space-y-2">
                  <div className="flex justify-between"><span className="text-purple-300">Isolation Index:</span> <span className="font-mono text-white">{(regionalAnalysis.isolationIndex * 100).toFixed(1)}%</span></div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Refinement</label>
              <button onClick={handleExpand} className="w-full btn-zinc border-blue-800 text-blue-300"><BrainCircuit size={16} /> AI Expand</button>
              <button onClick={() => handleGroomDupes(true)} className="w-full btn-zinc border-amber-800 text-amber-300"><Scissors size={16} /> Semantic Grooming</button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Visualization</label>
              <div className="flex items-center justify-between p-2 bg-zinc-800/50 rounded-md">
                <span className="text-sm text-zinc-300">Community Colors</span>
                <button onClick={() => setCommunityColoring(!activeCommunityColoring)} className={`w-8 h-4 rounded-full relative transition-colors ${activeCommunityColoring ? 'bg-emerald-600' : 'bg-zinc-600'}`}>
                  <div className={`w-2 h-2 bg-white rounded-full absolute top-1 transition-all ${activeCommunityColoring ? 'left-5' : 'left-1'}`}></div>
                </button>
              </div>
            </div>

            {/* Contextual Selection Panel */}
            {selectedNodeIds.length > 0 && (
              <div className="p-4 bg-zinc-950/80 border border-zinc-700 rounded-lg space-y-3 animate-in slide-in-from-left-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-white">{selectedNodeIds.length} Selected</h3>
                    <button onClick={clearSelection} className="text-zinc-500 hover:text-white"><X size={14}/></button>
                  </div>
                  
                  {selectedNodeIds.length === 1 && selectedNode && (
                    <div className="space-y-2 text-xs text-zinc-400">
                      <p className="font-bold text-white text-sm">{selectedNode.label}</p>
                      <p>{selectedNode.description}</p>
                      
                      {/* Metric Display in Tooltip Area */}
                      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-zinc-800">
                        <div>DC: <span className="text-white">{(selectedNode.degreeCentrality || 0).toFixed(3)}</span></div>
                        <div>PR: <span className="text-white">{(selectedNode.pagerank || 0).toFixed(3)}</span></div>
                        <div className="col-span-2 text-emerald-400">
                          Clust. Coeff: <span className="font-mono font-bold">{(selectedNode.clustering || 0).toFixed(3)}</span>
                        </div>
                         <div className="col-span-2 text-amber-400">
                          Comm ID: <span className="font-mono font-bold">{selectedNode.louvainCommunity}</span>
                        </div>
                      </div>

                      <button onClick={() => setEditingNode(selectedNode.id)} className="w-full btn-zinc text-xs mt-2"><Edit2 size={12}/> Edit Node</button>
                    </div>
                  )}

                  {selectedNodeIds.length > 1 && (
                    <div className="space-y-2">
                      <button onClick={bulkDeleteSelection} className="w-full btn-zinc bg-red-900/20 text-red-400 border-red-900/50 hover:bg-red-900/40"><Trash2 size={14}/> Delete All</button>
                    </div>
                  )}
              </div>
            )}
          </div>
          
          <div className="mt-auto pt-4 border-t border-zinc-800 space-y-2">
            <button onClick={handleExportObsidian} className="w-full btn-zinc text-xs"><FileJson size={14}/> Eksportuj do Obsidian</button>
          </div>
        </div>

        {/* Drag Handle */}
        <div 
          onMouseDown={startResizing}
          className={`absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-indigo-500/50 z-50 transition-colors ${isResizing ? 'bg-indigo-600' : 'bg-transparent'}`}
        />
      </div>

      {showDupeModal && (
        <DupeModal candidates={dupeCandidates} onClose={() => setShowDupeModal(false)} onMerge={handleMerge} />
      )}
    </>
  );
};

const DupeModal = ({ candidates, onClose, onMerge }: any) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
      <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
        <h3 className="text-lg font-bold text-white">Semantic Review ({candidates.length})</h3>
        <button onClick={onClose} className="text-zinc-400 hover:text-white"><X size={20}/></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {candidates.map((cand: any, i: number) => (
          <div key={i} className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 flex gap-4 items-center">
            <div className="flex-1 space-y-1">
              <div className="flex justify-between"><span className="text-sm font-bold text-indigo-400">{cand.nodeA.label}</span></div>
              <div className="flex justify-between"><span className="text-sm font-bold text-amber-400">{cand.nodeB.label}</span></div>
              <div className="text-xs text-zinc-500">{cand.reason}</div>
            </div>
            <button onClick={() => onMerge(cand)} className="btn-zinc text-emerald-400"><GitMerge size={14} /> Merge</button>
          </div>
        ))}
      </div>
    </div>
  </div>
);