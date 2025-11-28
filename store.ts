import { create } from 'zustand';
import { AppState, KnowledgeGraph, NodeData, ChatMessage, Toast, RegionalAnalysisResult, DuplicateCandidate } from './types';
import { INITIAL_GRAPH } from './constants';
import { enrichGraphWithMetrics, calculateRegionalMetrics } from './services/graphService';
import { storage } from './services/storage';

interface HistoryState {
  past: KnowledgeGraph[];
  future: KnowledgeGraph[];
}

interface Store extends AppState {
  initGraph: () => void;
  loadFromStorage: () => Promise<void>;
  
  // Graph Mutation
  addNodesAndEdges: (nodes: any[], edges: any[]) => void;
  removeNode: (nodeId: string) => void;
  updateNode: (id: string, data: Partial<NodeData>) => void;
  mergeNodes: (keepId: string, dropId: string) => void;
  recalculateGraph: () => void;
  
  // Bulk Actions
  toggleNodeSelection: (id: string, multi?: boolean) => void;
  clearSelection: () => void;
  bulkDeleteSelection: () => void;
  
  // Analysis & View
  setFilterYear: (year: number | null) => void;
  toggleSidebar: () => void;
  setCommunityColoring: (active: boolean) => void;
  runRegionalAnalysis: () => void;
  setShowStatsPanel: (show: boolean) => void;
  setSemanticSearchOpen: (open: boolean) => void;
  
  // UI
  setEditingNode: (id: string | null) => void;
  addMessage: (msg: ChatMessage) => void;
  setThinking: (isThinking: boolean) => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;

  // History Actions
  undo: () => void;
  redo: () => void;
  _history: HistoryState;
  pushHistory: () => void;
}

export const useStore = create<Store>((set, get) => ({
  graph: { nodes: [], edges: [] },
  filteredGraph: { nodes: [], edges: [] },
  selectedNodeIds: [],
  editingNodeId: null,
  metricsCalculated: false,
  activeCommunityColoring: true,
  minDegreeFilter: 0,
  isSidebarOpen: true,
  timelineYear: null,
  regionalAnalysis: null,
  showStatsPanel: false,
  isSemanticSearchOpen: false,
  messages: [
    { 
      id: 'welcome', 
      role: 'assistant', 
      content: 'Witaj w Endecja KG Builder Tier-4. Platforma badawcza gotowa. Czekam na polecenia.', 
      timestamp: Date.now() 
    }
  ],
  isThinking: false,
  toasts: [],
  
  // History State
  _history: { past: [], future: [] },

  canUndo: () => get()._history.past.length > 0,
  canRedo: () => get()._history.future.length > 0,

  pushHistory: () => {
    const { graph, _history } = get();
    // Limit history to 50 steps
    const newPast = [JSON.parse(JSON.stringify(graph)), ..._history.past].slice(0, 50);
    set({ _history: { past: newPast, future: [] } });
  },

  undo: () => {
    const { _history } = get();
    if (_history.past.length === 0) return;

    const previous = _history.past[0];
    const newPast = _history.past.slice(1);
    const current = get().graph;

    set({ 
      graph: previous, 
      filteredGraph: previous,
      _history: { 
        past: newPast, 
        future: [current, ..._history.future] 
      } 
    });
    storage.save(previous);
  },

  redo: () => {
    const { _history } = get();
    if (_history.future.length === 0) return;

    const next = _history.future[0];
    const newFuture = _history.future.slice(1);
    const current = get().graph;

    set({ 
      graph: next, 
      filteredGraph: next,
      _history: { 
        past: [current, ..._history.past], 
        future: newFuture 
      } 
    });
    storage.save(next);
  },

  initGraph: () => {
    get().loadFromStorage().then(() => {
      const { graph } = get();
      if (graph.nodes.length === 0) {
        console.log("Loading Initial Data...");
        const enriched = enrichGraphWithMetrics(INITIAL_GRAPH);
        set({ graph: enriched, filteredGraph: enriched, metricsCalculated: true });
        storage.save(enriched);
      }
    });
    
    // Auto-save
    setInterval(() => {
      const { graph } = get();
      if (graph.nodes.length > 0) storage.save(graph);
    }, 10000);
  },

  loadFromStorage: async () => {
    try {
      const data = await storage.load();
      if (data) {
        set({ graph: data.graph, filteredGraph: data.graph, metricsCalculated: true });
        get().addToast({ title: 'Loaded from Disk', description: `Restored ${data.graph.nodes.length} nodes from ${new Date(data.savedAt).toLocaleTimeString()}`, type: 'success' });
      }
    } catch (e) {
      console.error("Failed to load from storage", e);
    }
  },

  recalculateGraph: () => {
    const { graph } = get();
    const enriched = enrichGraphWithMetrics(graph);
    set({ graph: enriched, filteredGraph: enriched, metricsCalculated: true });
    storage.save(enriched);
  },

  addNodesAndEdges: (newNodesRaw, newEdgesRaw) => {
    get().pushHistory(); // Save state
    const { graph } = get();
    
    const newNodesData = newNodesRaw.map(n => ({
      id: n.id,
      label: n.label,
      type: n.type,
      year: typeof n.dates === 'string' ? parseInt(n.dates.substr(0,4)) || 1900 : (n.year || 1900),
      dates: n.dates,
      description: n.description,
      importance: 0.5,
      region: n.region || 'Unknown'
    }));

    const newEdgesData = newEdgesRaw.map(e => ({
      id: `edge_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,
      source: e.source,
      target: e.target,
      label: e.relationship || e.label,
      dates: e.dates
    }));

    const existingIds = new Set(graph.nodes.map(n => n.data.id));
    const uniqueNodes = newNodesData.filter(n => !existingIds.has(n.id)).map(n => ({ data: n }));
    const uniqueEdges = newEdgesData.map(e => ({ data: e }));

    const updatedGraph = {
      nodes: [...graph.nodes, ...uniqueNodes],
      edges: [...graph.edges, ...uniqueEdges]
    };

    const enriched = enrichGraphWithMetrics(updatedGraph);
    set({ graph: enriched, filteredGraph: enriched });
    storage.save(enriched); 
  },

  updateNode: (id, data) => {
    get().pushHistory();
    const { graph } = get();
    const newNodes = graph.nodes.map(n => 
      n.data.id === id ? { ...n, data: { ...n.data, ...data } } : n
    );
    // Don't re-run full metrics on single edit for performance, unless necessary
    // But for consistency we should, or at least keep existing metrics
    const newGraph = { ...graph, nodes: newNodes };
    set({ graph: newGraph, filteredGraph: newGraph });
    storage.save(newGraph);
  },

  removeNode: (nodeId) => {
    get().pushHistory();
    const { graph } = get();
    const newNodes = graph.nodes.filter(n => n.data.id !== nodeId);
    const newEdges = graph.edges.filter(e => e.data.source !== nodeId && e.data.target !== nodeId);
    const enriched = enrichGraphWithMetrics({ nodes: newNodes, edges: newEdges });
    set({ graph: enriched, filteredGraph: enriched, selectedNodeIds: [] });
    storage.save(enriched);
  },

  bulkDeleteSelection: () => {
    get().pushHistory();
    const { graph, selectedNodeIds } = get();
    if (selectedNodeIds.length === 0) return;
    
    const newNodes = graph.nodes.filter(n => !selectedNodeIds.includes(n.data.id));
    const newEdges = graph.edges.filter(e => !selectedNodeIds.includes(e.data.source) && !selectedNodeIds.includes(e.data.target));
    
    const enriched = enrichGraphWithMetrics({ nodes: newNodes, edges: newEdges });
    set({ graph: enriched, filteredGraph: enriched, selectedNodeIds: [] });
    get().addToast({ title: 'Bulk Delete', description: `Removed ${selectedNodeIds.length} nodes.`, type: 'info' });
    storage.save(enriched);
  },

  mergeNodes: (keepId, dropId) => {
    get().pushHistory();
    const { graph } = get();
    const updatedEdges = graph.edges.map(e => {
      let newData = { ...e.data };
      if (newData.source === dropId) newData.source = keepId;
      if (newData.target === dropId) newData.target = keepId;
      return { data: newData };
    });
    const updatedNodes = graph.nodes.filter(n => n.data.id !== dropId);
    const finalEdges = updatedEdges.filter(e => e.data.source !== e.data.target);
    const enriched = enrichGraphWithMetrics({ nodes: updatedNodes, edges: finalEdges });
    set({ graph: enriched, filteredGraph: enriched });
    storage.save(enriched);
  },

  toggleNodeSelection: (id, multi) => {
    const { selectedNodeIds } = get();
    if (multi) {
      if (selectedNodeIds.includes(id)) {
        set({ selectedNodeIds: selectedNodeIds.filter(nid => nid !== id) });
      } else {
        set({ selectedNodeIds: [...selectedNodeIds, id] });
      }
    } else {
      set({ selectedNodeIds: [id] });
    }
  },

  clearSelection: () => set({ selectedNodeIds: [] }),
  setEditingNode: (id) => set({ editingNodeId: id }),
  runRegionalAnalysis: () => {
    const { graph } = get();
    const result = calculateRegionalMetrics(graph);
    set({ regionalAnalysis: result });
    get().addToast({ title: 'Regional Analysis', description: `Isolation Index: ${(result.isolationIndex * 100).toFixed(1)}%`, type: 'info' });
  },

  addToast: (t) => {
    const id = Math.random().toString(36).substr(2, 9);
    set(state => ({ toasts: [...state.toasts, { ...t, id }] }));
    setTimeout(() => get().removeToast(id), 4000);
  },
  removeToast: (id) => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),
  
  toggleSidebar: () => set(state => ({ isSidebarOpen: !state.isSidebarOpen })),
  setThinking: (val) => set({ isThinking: val }),
  addMessage: (msg) => set(state => ({ messages: [...state.messages, msg] })),
  setCommunityColoring: (val) => set({ activeCommunityColoring: val }),
  setFilterYear: (y) => set({ timelineYear: y }),
  setShowStatsPanel: (show) => set({ showStatsPanel: show }),
  setSemanticSearchOpen: (open) => set({ isSemanticSearchOpen: open }),
}));