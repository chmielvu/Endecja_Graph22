
export type NodeType = 'person' | 'organization' | 'event' | 'concept' | 'publication' | 'Person' | 'Organization' | 'Event' | 'Concept' | 'Publication';

export interface NodeData {
  id: string;
  label: string;
  type: NodeType;
  year?: number; // Approximate year of relevance
  description?: string;
  dates?: string;
  importance?: number;
  region?: string; // 'Warszawa', 'Wielkopolska', 'Galicja', 'Emigracja'
  
  // Metrics
  degreeCentrality?: number;
  pagerank?: number;
  community?: number; // Legacy/Fallback
  louvainCommunity?: number; // Real Louvain Community ID
  kCore?: number;
  
  // Tier-3 Advanced Metrics
  betweenness?: number;
  closeness?: number;
  eigenvector?: number;
  clustering?: number; // Local Clustering Coefficient

  // Embedding for semantic search
  embedding?: number[]; 
  sources?: string[];
  certainty?: 'confirmed' | 'disputed' | 'alleged';
}

export interface EdgeData {
  id: string;
  source: string;
  target: string;
  label: string; // relationship
  dates?: string;
  weight?: number;
  // Triadic Balance
  sign?: 'positive' | 'negative';
  isBalanced?: boolean;
  certainty?: 'confirmed' | 'disputed' | 'alleged';
}

export interface GraphNode {
  data: NodeData;
  position?: { x: number; y: number };
  selected?: boolean;
}

export interface GraphEdge {
  data: EdgeData;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta?: {
    modularity?: number;
    globalBalance?: number; // 0 to 1
    lastSaved?: number;
    version?: string; // Data version for migration
  };
}

export interface GraphPatch {
  type: 'expansion' | 'deepening';
  reasoning: string;
  nodes: Partial<NodeData>[];
  edges: Partial<EdgeData>[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'model';
  content: string;
  reasoning?: string; // For ReAct display
  timestamp: number;
  sources?: Array<{ title: string; uri: string }>;
  toolCalls?: any[];
  toolResponses?: any[];
}

export interface Toast {
  id: string;
  title: string;
  description: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface DuplicateCandidate {
  nodeA: NodeData;
  nodeB: NodeData;
  similarity: number;
  reason?: string;
}

export interface RegionalAnalysisResult {
  isolationIndex: number; // Assortativity
  bridges: Array<{ id: string; label: string; score: number }>;
  dominantRegion: string;
}

export interface ResearchTask {
  id: string;
  type: 'expansion' | 'deepening' | 'analysis';
  target: string;
  status: 'running' | 'complete' | 'failed';
  reasoning?: string;
}

export interface AppState {
  // Graph State
  graph: KnowledgeGraph;
  filteredGraph: KnowledgeGraph;
  selectedNodeIds: string[]; // Multi-select
  editingNodeId: string | null; // For modal
  
  // Analysis State
  metricsCalculated: boolean;
  activeCommunityColoring: boolean;
  showCertainty: boolean; // Toggle for Evidence Quality Mode
  minDegreeFilter: number;
  regionalAnalysis: RegionalAnalysisResult | null;
  
  // UI State
  isSidebarOpen: boolean;
  timelineYear: number | null; // Continuous slider value
  showStatsPanel: boolean;
  isSemanticSearchOpen: boolean;
  
  // AI Patch Review State
  pendingPatch: GraphPatch | null;
  activeResearchTasks: ResearchTask[];
  
  // Chat State
  messages: ChatMessage[];
  isThinking: boolean;

  // Notifications
  toasts: Toast[];

  // History
  canUndo: () => boolean;
  canRedo: () => boolean;
}
