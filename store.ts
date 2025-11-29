
import { create } from 'zustand';
import { AppState, KnowledgeGraph, NodeData, ChatMessage, Toast, RegionalAnalysisResult, DuplicateCandidate, GraphPatch, ResearchTask, GraphNode, GraphEdge } from './types';
import { INITIAL_GRAPH } from './constants';
import { enrichGraphWithMetrics, calculateRegionalMetrics } from './services/graphService';
import { storage } from './services/storage';

interface HistoryState {
  past: KnowledgeGraph[];
  future: KnowledgeGraph[];
}

interface Store extends AppState {
  initGraph: () => void;
  loadFromStorage: () => Promise<KnowledgeGraph | null>;
  
  // Graph Mutation
  addNodesAndEdges: (nodes: any[], edges: any[]) => void;
  applyPatch: (nodes: Partial<NodeData>[], edges: any[]) => void; // New robust patch applicator
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
  setCertaintyMode: (active: boolean) => void;
  runRegionalAnalysis: () => void;
  setShowStatsPanel: (show: boolean) => void;
  setSemanticSearchOpen: (open: boolean) => void;
  setPendingPatch: (patch: GraphPatch | null) => void;
  addResearchTask: (task: ResearchTask) => void;
  updateResearchTask: (id: string, updates: Partial<ResearchTask>) => void;
  
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
  
  // Tier-4 Deepening
  deepeningNodeId: string | null;
  setDeepeningNode: (id: string | null) => void;
}

export const useStore = create<Store>((set, get) => ({
  graph: { nodes: [], edges: [] },
  filteredGraph: { nodes: [], edges: [] },
  selectedNodeIds: [],
  editingNodeId: null,
  deepeningNodeId: null,
  pendingPatch: null,
  activeResearchTasks: [],
  metricsCalculated: false,
  activeCommunityColoring: true,
  showCertainty: false,
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

  initGraph: async () => {
    try {
      const currentVersion = INITIAL_GRAPH.meta?.version || "1.0";
      const stored = await get().loadFromStorage();
      
      // Auto-hydrate if empty OR if version mismatch (forced upgrade)
      if (!stored || (stored.meta?.version !== currentVersion)) {
        console.log(`Hydrating Initial Graph. Stored: ${stored?.meta?.version}, Current: ${currentVersion}`);
        // If enrichment fails, this might throw
        const enriched = enrichGraphWithMetrics(INITIAL_GRAPH);
        set({ graph: enriched, filteredGraph: enriched, metricsCalculated: true });
        get().addToast({ title: 'Database Updated', description: `Loaded Knowledge Base v${currentVersion}`, type: 'success' });
        storage.save(enriched, currentVersion);
      } else {
         // Load from storage if version matches
         set({ graph: stored, filteredGraph: stored, metricsCalculated: true });
      }
      
      // Auto-save loop
      setInterval(() => {
        const { graph } = get();
        if (graph.nodes.length > 0) storage.save(graph);
      }, 10000);

    } catch (e: any) {
      console.error("Initialization Error (using raw fallback):", e);
      get().addToast({ title: 'System Notice', description: `Loaded basic graph due to metric error.`, type: 'warning' });
      // Fallback to raw initial graph without metrics if enrichment fails
      set({ graph: INITIAL_GRAPH, filteredGraph: INITIAL_GRAPH, metricsCalculated: false });
    }
  },

  loadFromStorage: async () => {
    try {
      const data = await storage.load();
      if (data) {
        // Just return the graph, initGraph decides whether to use it
        return { ...data.graph, meta: { ...data.graph.meta, version: data.version } };
      }
      return null;
    } catch (e) {
      console.error("Failed to load from storage", e);
      return null;
    }
  },

  recalculateGraph: () => {
    const { graph } = get();
    const enriched = enrichGraphWithMetrics(graph);
    set({ graph: enriched, filteredGraph: enriched, metricsCalculated: true });
    storage.save(enriched);
  },

  // Simplified Add - mostly for legacy or direct adds
  addNodesAndEdges: (newNodesRaw, newEdgesRaw) => {
     get().applyPatch(newNodesRaw, newEdgesRaw);
  },

  // Robust Patch Application (Upsert Logic)
  applyPatch: (patchNodes, patchEdges) => {
    get().pushHistory();
    const { graph } = get();

    // 1. Process Nodes (Upsert)
    const existingNodeMap = new Map<string, GraphNode>(graph.nodes.map(n => [n.data.id, n]));
    
    patchNodes.forEach(pn => {
      if (!pn.id) return;
      
      let year = pn.year;
      if (!year && typeof pn.dates === 'string') {
        const match = pn.dates.match(/\d{4}/);
        if (match && match.length > 0) year = parseInt(match[0]);
      }
      
      if (existingNodeMap.has(pn.id)) {
        // Update Existing
        const existing = existingNodeMap.get(pn.id)!;
        existingNodeMap.set(pn.id, {
          ...existing,
          data: { 
            ...existing.data, 
            ...pn,
            id: pn.id, // Ensure ID is preserved
            year: year || existing.data.year 
          } as NodeData
        });
      } else {
        // Create New
        existingNodeMap.set(pn.id, {
          data: {
            id: pn.id,
            label: pn.label || pn.id,
            type: pn.type || 'concept',
            year: year,
            dates: pn.dates,
            description: pn.description,
            importance: 0.5,
            region: pn.region || 'Unknown',
            certainty: pn.certainty || 'confirmed'
          } as NodeData
        });
      }
    });

    // 2. Process Edges
    const newEdges: GraphEdge[] = patchEdges.map(e => ({
      data: {
        id: e.id || `edge_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,
        source: e.source,
        target: e.target,
        label: e.relationship || e.label || 'related',
        dates: e.dates,
        certainty: e.certainty || 'confirmed',
        sign: e.sign || 'positive'
      }
    }));

    // Filter edges to ensure both source/target exist
    const validNewEdges = newEdges.filter(e => 
      existingNodeMap.has(e.data.source) && existingNodeMap.has(e.data.target)
    );

    // Merge edges, avoiding exact duplicates (same source, target, and label)
    const existingEdges = graph.edges;
    const finalEdges = [...existingEdges];
    
    validNewEdges.forEach(newEdge => {
      const isDuplicate = existingEdges.some(ex => 
        ex.data.source === newEdge.data.source && 
        ex.data.target === newEdge.data.target && 
        ex.data.label === newEdge.data.label
      );
      if (!isDuplicate) {
        finalEdges.push(newEdge);
      }
    });

    const updatedGraph: KnowledgeGraph = {
      nodes: Array.from(existingNodeMap.values()),
      edges: finalEdges
    };

    const enriched = enrichGraphWithMetrics(updatedGraph);
    set({ graph: enriched, filteredGraph: enriched, pendingPatch: null });
    storage.save(enriched);
  },

  updateNode: (id, data) => {
    get().pushHistory();
    const { graph } = get();
    const newNodes = graph.nodes.map(n => 
      n.data.id === id ? { ...n, data: { ...n.data, ...data } } : n
    );
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

  // Smart Merge: Preserves data from the dropped node if missing in kept node
  mergeNodes: (keepId, dropId) => {
    get().pushHistory();
    const { graph } = get();
    
    const keepNode = graph.nodes.find(n => n.data.id === keepId);
    const dropNode = graph.nodes.find(n => n.data.id === dropId);
    
    if (!keepNode || !dropNode) return;

    // Merge Logic: Prefer "Unknown" to be overwritten by specific data
    const newData = { ...keepNode.data };
    
    if ((!newData.region || newData.region === 'Unknown') && dropNode.data.region && dropNode.data.region !== 'Unknown') {
       newData.region = dropNode.data.region;
    }
    
    if (!newData.description && dropNode.data.description) {
       newData.description = dropNode.data.description;
    } else if (dropNode.data.description && newData.description && dropNode.data.description.length > newData.description.length) {
       // Simple heuristic: keep longer description
       newData.description = dropNode.data.description;
    }
    
    if (!newData.dates && dropNode.data.dates) {
       newData.dates = dropNode.data.dates;
       newData.year = dropNode.data.year;
    }

    const updatedEdges = graph.edges.map(e => {
      let edgeData = { ...e.data };
      if (edgeData.source === dropId) edgeData.source = keepId;
      if (edgeData.target === dropId) edgeData.target = keepId;
      return { data: edgeData };
    });
    
    // Update the kept node
    const updatedNodes = graph.nodes
      .filter(n => n.data.id !== dropId)
      .map(n => n.data.id === keepId ? { ...n, data: newData } : n);
      
    const finalEdges = updatedEdges.filter(e => e.data.source !== e.data.target);
    const enriched = enrichGraphWithMetrics({ nodes: updatedNodes, edges: finalEdges });
    set({ graph: enriched, filteredGraph: enriched });
    get().addToast({ title: 'Merged Nodes', description: `Merged ${dropNode.data.label} into ${keepNode.data.label}`, type: 'success' });
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
  setCertaintyMode: (val) => set({ showCertainty: val }),
  setFilterYear: (y) => set({ timelineYear: y }),
  setShowStatsPanel: (show) => set({ showStatsPanel: show }),
  setSemanticSearchOpen: (open) => set({ isSemanticSearchOpen: open }),
  setPendingPatch: (patch) => set({ pendingPatch: patch }),
  
  setDeepeningNode: (id) => set({ deepeningNodeId: id }),
  addResearchTask: (task) => set(state => ({ activeResearchTasks: [task, ...state.activeResearchTasks] })),
  updateResearchTask: (id, updates) => set(state => ({ 
    activeResearchTasks: state.activeResearchTasks.map(t => t.id === id ? { ...t, ...updates } : t) 
  })),
}));
