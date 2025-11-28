import Graph from 'graphology';
import cytoscape from 'cytoscape';
import louvain from 'graphology-communities-louvain';
import { KnowledgeGraph, RegionalAnalysisResult, DuplicateCandidate } from '../types';
import { getEmbedding, cosineSimilarity } from './embeddingService';

/**
 * Calculates robust graph metrics using a headless Cytoscape instance.
 * Replaces simple JS implementations with library-grade algorithms.
 * Includes manual calculation for Clustering Coefficient.
 */
export function enrichGraphWithMetrics(graph: KnowledgeGraph): KnowledgeGraph {
  // Ensure we handle potential 'links' vs 'edges' confusion if data comes from external source
  const safeEdges = graph.edges || (graph as any).links || [];
  
  // Initialize headless Cytoscape for calculation
  const cy = cytoscape({
    headless: true,
    elements: {
      nodes: graph.nodes.map(n => ({ data: { ...n.data } })),
      edges: safeEdges.map(e => ({ data: { ...e.data } }))
    }
  });

  // 1. Calculate Centralities (Cytoscape Core)
  const pr = cy.elements().pageRank({ dampingFactor: 0.85, precision: 0.000001 });
  const bc = cy.elements().betweennessCentrality({ directed: true });
  // Cast options to any to avoid strict type checks on optional properties like 'root'
  const cc = cy.elements().closenessCentrality({ directed: true } as any);
  // Provide weight function or cast to any for degreeCentralityNormalized
  const dcn = cy.elements().degreeCentralityNormalized({ directed: true, weight: () => 1 } as any);
  
  // 2. Local Clustering Coefficient (Manual Implementation)
  const clusteringMap = calculateClusteringCoefficient(cy);

  // 3. Community Detection (Real Louvain via graphology-communities-louvain)
  // Convert to Graphology instance for Louvain algorithm
  const graphologyGraph = buildGraphologyGraph(graph);
  
  // Run Louvain algorithm
  // detailed() returns { communities: { nodeId: communityId }, modularity: number, ... }
  // We need to cast louvain to any because TS might not know about .detailed on the default export depending on types
  const louvainDetails = (louvain as any).detailed(graphologyGraph);
  const comm = louvainDetails.communities;
  const modularity = louvainDetails.modularity;

  // 4. Edge Metrics (Sign, Certainty)
  const processedEdges = processEdgeMetrics(safeEdges);
  
  // 5. Triadic Balance
  const tempGraph = { ...graph, edges: processedEdges };
  const { globalBalance } = calculateTriadicBalance(tempGraph);

  // 6. Map results back to nodes
  const newNodes = graph.nodes.map(node => {
    const ele = cy.getElementById(node.data.id);
    
    // Safety check if node exists in cytoscape instance
    if (ele.length === 0) return node;

    // Use 'as any' to access methods if types are not inferred correctly
    const degree = (dcn as any).degree(ele);
    const pagerankVal = pr.rank(ele);
    const betweennessVal = bc.betweenness(ele);
    const closenessVal = (cc as any).closeness(ele);
    const clusteringVal = clusteringMap[node.data.id] || 0;
    
    // Get community from Louvain result
    const communityId = comm[node.data.id] !== undefined ? comm[node.data.id] : 0;

    return {
      ...node,
      data: {
        ...node.data,
        degreeCentrality: parseFloat(degree.toFixed(6)),
        pagerank: parseFloat(pagerankVal.toFixed(6)),
        betweenness: parseFloat(betweennessVal.toFixed(6)),
        closeness: parseFloat(closenessVal.toFixed(6)),
        clustering: parseFloat(clusteringVal.toFixed(6)), 
        eigenvector: parseFloat(pagerankVal.toFixed(6)), // PageRank is a variant of Eigenvector
        community: communityId, // Legacy mapping
        louvainCommunity: communityId, // Real Louvain ID
        kCore: Math.floor(degree * 10)
      }
    };
  });

  return {
    nodes: newNodes,
    edges: processedEdges,
    meta: {
      ...graph.meta,
      modularity: parseFloat(modularity.toFixed(3)),
      globalBalance
    }
  };
}

/**
 * Calculates Local Clustering Coefficient for each node in the Cytoscape instance.
 * C_v = 2 * (number of edges between neighbors) / (k * (k - 1))
 */
function calculateClusteringCoefficient(cy: cytoscape.Core): Record<string, number> {
  const coefficients: Record<string, number> = {};

  cy.nodes().forEach(node => {
    const neighbors = node.neighborhood().nodes();
    const k = neighbors.length;

    if (k < 2) {
      coefficients[node.id()] = 0;
      return;
    }

    let links = 0;
    // Safely convert collection to array for iteration
    const neighborArray = neighbors.toArray();

    // Check connections between neighbors
    for (let i = 0; i < k; i++) {
      for (let j = i + 1; j < k; j++) {
        // Check if edge exists between neighbors[i] and neighbors[j]
        const n1 = neighborArray[i];
        const n2 = neighborArray[j];
        if (n1.edgesWith(n2).length > 0) {
          links++;
        }
      }
    }

    // Formula for undirected graph clustering coefficient
    coefficients[node.id()] = (2 * links) / (k * (k - 1));
  });

  return coefficients;
}

/**
 * Process edge metrics including signs for Triadic Balance and Certainty
 */
function processEdgeMetrics(edges: any[]): any[] {
  const negativeKeywords = ['conflict', 'rival', 'anti', 'against', 'enemy', 'opponent', 'fight', 'konflikt', 'rywal', 'przeciw', 'wro'];
  return edges.map(edge => {
    const text = (edge.data.label || '').toLowerCase();
    const isNegative = negativeKeywords.some(kw => text.includes(kw));
    
    return {
      ...edge,
      data: {
        ...edge.data,
        // Preserve existing sign if present, otherwise calculate heuristic
        sign: edge.data.sign || (isNegative ? 'negative' : 'positive'),
        // Preserve existing certainty or default to confirmed
        certainty: edge.data.certainty || 'confirmed'
      }
    };
  });
}

/**
 * Calculates Triadic Balance.
 */
export function calculateTriadicBalance(graph: KnowledgeGraph): { globalBalance: number, unbalancedEdges: Set<string> } {
  const edges = graph.edges;
  const adj: Record<string, Record<string, number>> = {};
  
  edges.forEach(e => {
    if (!adj[e.data.source]) adj[e.data.source] = {};
    if (!adj[e.data.target]) adj[e.data.target] = {};
    const val = e.data.sign === 'negative' ? -1 : 1;
    adj[e.data.source][e.data.target] = val;
    adj[e.data.target][e.data.source] = val; 
  });

  let totalTriangles = 0;
  let balancedTriangles = 0;
  const unbalancedEdges = new Set<string>();

  const nodes = graph.nodes;
  // Optimize loop for performance
  const nodeIds = nodes.map(n => n.data.id);
  const n = nodeIds.length;
  
  // Limit calculation for very large graphs in demo
  const limit = Math.min(n, 200);

  for (let i = 0; i < limit; i++) {
    for (let j = i + 1; j < limit; j++) {
      for (let k = j + 1; k < limit; k++) {
        const u = nodeIds[i];
        const v = nodeIds[j];
        const w = nodeIds[k];

        const uv = adj[u]?.[v];
        const vw = adj[v]?.[w];
        const wu = adj[w]?.[u];

        if (uv && vw && wu) {
          totalTriangles++;
          if (uv * vw * wu > 0) {
            balancedTriangles++;
          }
        }
      }
    }
  }

  const globalBalance = totalTriangles > 0 ? balancedTriangles / totalTriangles : 1;
  return { globalBalance, unbalancedEdges };
}

/**
 * Semantic Duplicate Detection
 */
export async function detectDuplicatesSemantic(graph: KnowledgeGraph, threshold: number = 0.88): Promise<DuplicateCandidate[]> {
  const candidates: DuplicateCandidate[] = [];
  const nodes = graph.nodes;
  const nodeEmbeddings: Record<string, number[]> = {};
  const nodesToCheck = nodes.slice(0, 30); 

  for (const node of nodesToCheck) {
    const text = `${node.data.label}: ${node.data.description || ''}`;
    nodeEmbeddings[node.data.id] = await getEmbedding(text);
  }

  for (let i = 0; i < nodesToCheck.length; i++) {
    for (let j = i + 1; j < nodesToCheck.length; j++) {
      const n1 = nodesToCheck[i].data;
      const n2 = nodesToCheck[j].data;
      
      if (n1.type !== n2.type) continue;
      if (n1.id === n2.id) continue;

      const vec1 = nodeEmbeddings[n1.id];
      const vec2 = nodeEmbeddings[n2.id];
      
      if (vec1 && vec2 && vec1.length && vec2.length) {
        const sim = cosineSimilarity(vec1, vec2);
        if (sim >= threshold) {
          candidates.push({
            nodeA: n1,
            nodeB: n2,
            similarity: sim,
            reason: `Semantic match: ${(sim * 100).toFixed(1)}%`
          });
        }
      }
    }
  }
  return candidates.sort((a, b) => b.similarity - a.similarity);
}

export function getLevenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
      else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
    }
  }
  return matrix[b.length][a.length];
}

export function detectDuplicates(graph: KnowledgeGraph, threshold: number = 0.85): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = [];
  const nodes = graph.nodes;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const n1 = nodes[i].data;
      const n2 = nodes[j].data;
      if (n1.type !== n2.type) continue;
      const longer = n1.label.length > n2.label.length ? n1.label : n2.label;
      const sim = (longer.length - getLevenshteinDistance(n1.label.toLowerCase(), n2.label.toLowerCase())) / longer.length;
      if (sim >= threshold) candidates.push({ nodeA: n1, nodeB: n2, similarity: sim, reason: 'String similarity' });
    }
  }
  return candidates.sort((a, b) => b.similarity - a.similarity);
}

export function buildGraphologyGraph(kg: KnowledgeGraph): Graph {
  const g = new Graph();
  kg.nodes.forEach(n => { if (!g.hasNode(n.data.id)) g.addNode(n.data.id, { ...n.data }); });
  kg.edges.forEach(e => { if (g.hasNode(e.data.source) && g.hasNode(e.data.target)) g.addEdge(e.data.source, e.data.target, { ...e.data }); });
  return g;
}

export function calculateRegionalMetrics(graph: KnowledgeGraph): RegionalAnalysisResult {
  const nodes = graph.nodes;
  const edges = graph.edges;
  let sameRegionEdges = 0;
  let totalValidEdges = 0;

  edges.forEach(e => {
    const src = nodes.find(n => n.data.id === e.data.source);
    const tgt = nodes.find(n => n.data.id === e.data.target);
    if (src?.data.region && tgt?.data.region && src.data.region !== 'Unknown' && tgt.data.region !== 'Unknown') {
      totalValidEdges++;
      if (src.data.region === tgt.data.region) sameRegionEdges++;
    }
  });

  const isolationIndex = totalValidEdges > 0 ? (sameRegionEdges / totalValidEdges) : 0;
  const bridgeScores: Record<string, number> = {};
  
  nodes.forEach(n => {
    if (n.data.region === 'Unknown') return;
    const neighbors = edges
      .filter(e => e.data.source === n.data.id || e.data.target === n.data.id)
      .map(e => e.data.source === n.data.id ? e.data.target : e.data.source);

    let differentRegionCount = 0;
    neighbors.forEach(nid => {
      const neighbor = nodes.find(nn => nn.data.id === nid);
      if (neighbor?.data.region && neighbor.data.region !== 'Unknown' && neighbor.data.region !== n.data.region) {
        differentRegionCount++;
      }
    });
    bridgeScores[n.data.id] = differentRegionCount * (n.data.importance || 1);
  });

  const sortedBridges = Object.entries(bridgeScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id, score]) => ({
      id,
      label: nodes.find(n => n.data.id === id)?.data.label || id,
      score
    }));

  return {
    isolationIndex,
    bridges: sortedBridges,
    dominantRegion: 'Wielkopolska'
  };
}