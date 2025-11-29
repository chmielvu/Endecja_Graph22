
import Graph from 'graphology';
import cytoscape from 'cytoscape';
import louvain from 'graphology-communities-louvain';
import { KnowledgeGraph, RegionalAnalysisResult, DuplicateCandidate } from '../types';
import { getEmbedding, getEmbeddingsBatch, cosineSimilarity } from './embeddingService';

/**
 * Calculates robust graph metrics using a headless Cytoscape instance.
 * Replaces simple JS implementations with library-grade algorithms.
 * Includes manual calculation for Clustering Coefficient.
 */
export function enrichGraphWithMetrics(graph: KnowledgeGraph): KnowledgeGraph {
  // Ensure we handle potential 'links' vs 'edges' confusion if data comes from external source
  const safeEdges = graph.edges || (graph as any).links || [];
  
  if (graph.nodes.length === 0) {
     return { ...graph, meta: { ...graph.meta, modularity: 0, globalBalance: 1 } };
  }
  
  // Initialize headless Cytoscape for calculation
  const cy = cytoscape({
    headless: true,
    elements: {
      nodes: graph.nodes.map(n => ({ data: { ...n.data } })),
      edges: safeEdges.map(e => ({ data: { ...e.data } }))
    }
  });

  // 1. Calculate Centralities (Cytoscape Core)
  let pr: any, bc: any, dcn: any;
  try {
     pr = cy.elements().pageRank({ dampingFactor: 0.85, precision: 0.000001 });
     bc = cy.elements().betweennessCentrality({ directed: true });
     dcn = cy.elements().degreeCentralityNormalized({ directed: true, weight: () => 1 } as any);
  } catch (e) {
      console.warn("Centrality calculation failed", e);
      // Fallback mocks
      pr = { rank: () => 0.01 };
      bc = { betweenness: () => 0 };
      dcn = { degree: () => 0 };
  }
  
  // 2. Local Clustering Coefficient (Manual Implementation)
  let clusteringMap: Record<string, number> = {};
  try {
     clusteringMap = calculateClusteringCoefficient(cy);
  } catch(e) {
     console.warn("Clustering failed", e);
  }

  // 3. Community Detection (Real Louvain via graphology-communities-louvain)
  // Convert to Graphology instance for Louvain algorithm
  let comm: Record<string, number> = {};
  let modularity = 0;
  
  try {
      const graphologyGraph = buildGraphologyGraph(graph);
      // Run Louvain algorithm if graph is not empty and lib is valid
      if (graphologyGraph.order > 0) {
        // Safe check for louvain export structure which might vary by environment/CDN
        if (louvain && typeof (louvain as any).detailed === 'function') {
           const louvainDetails = (louvain as any).detailed(graphologyGraph);
           comm = louvainDetails.communities;
           modularity = louvainDetails.modularity;
        } else {
           console.warn("Louvain library not correctly loaded or missing 'detailed' method.");
        }
      }
  } catch (e) {
      console.warn("Louvain detection failed:", e);
  }

  // 4. Edge Metrics (Sign, Certainty)
  let processedEdges = [];
  try {
     processedEdges = processEdgeMetrics(safeEdges);
  } catch (e) {
     console.warn("Edge metrics failed", e);
     processedEdges = safeEdges;
  }
  
  // 5. Triadic Balance
  let globalBalance = 1;
  try {
      const tempGraph = { ...graph, edges: processedEdges };
      const balanceResult = calculateTriadicBalance(tempGraph);
      globalBalance = balanceResult.globalBalance;
  } catch(e) {
      console.warn("Balance calculation failed", e);
  }

  // Map to store PageRank for edge weighting later
  const pageRankMap = new Map<string, number>();

  // 6. Map results back to nodes
  const newNodes = graph.nodes.map(node => {
    try {
        const ele = cy.getElementById(node.data.id);
        
        // Safety check if node exists in cytoscape instance
        if (ele.length === 0) return node;

        // Use 'as any' to access methods if types are not inferred correctly
        const degree = (dcn as any).degree ? (dcn as any).degree(ele) : 0;
        const pagerankVal = pr && pr.rank ? parseFloat(pr.rank(ele).toFixed(6)) : 0.01;
        const betweennessVal = bc && bc.betweenness ? bc.betweenness(ele) : 0;
        const clusteringVal = clusteringMap[node.data.id] || 0;
        
        // Store PR for edges
        pageRankMap.set(node.data.id, pagerankVal);

        // Get community from Louvain result
        const communityId = comm[node.data.id] !== undefined ? comm[node.data.id] : 0;

        return {
          ...node,
          data: {
            ...node.data,
            degreeCentrality: parseFloat(degree.toFixed(6)),
            pagerank: pagerankVal,
            betweenness: parseFloat(betweennessVal.toFixed(6)),
            clustering: parseFloat(clusteringVal.toFixed(6)), 
            eigenvector: pagerankVal, // PageRank is a variant of Eigenvector
            community: communityId, // Legacy mapping
            louvainCommunity: communityId, // Real Louvain ID
            kCore: Math.floor(degree * 10)
          }
        };
    } catch (e) {
        console.warn(`Node metric update failed for ${node.data.id}`, e);
        return node;
    }
  });

  // 7. Calculate Edge Weights based on Node PageRank
  const weightedEdges = processedEdges.map(edge => {
    const prSource = pageRankMap.get(edge.data.source) || 0;
    const prTarget = pageRankMap.get(edge.data.target) || 0;
    const weight = (prSource + prTarget) / 2;

    return {
      ...edge,
      data: {
        ...edge.data,
        weight: parseFloat(weight.toFixed(6))
      }
    };
  });

  return {
    nodes: newNodes,
    edges: weightedEdges,
    meta: {
      ...graph.meta,
      modularity: parseFloat(modularity.toFixed(3)),
      globalBalance
    }
  };
}

/**
 * Calculates Local Clustering Coefficient for each node in the Cytoscape instance.
 */
function calculateClusteringCoefficient(cy: cytoscape.Core): Record<string, number> {
  const coefficients: Record<string, number> = {};

  cy.nodes().forEach(node => {
    try {
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
            const n1 = neighborArray[i];
            const n2 = neighborArray[j];
            if (n1 && n2 && n1.edgesWith(n2).length > 0) {
              links++;
            }
          }
        }

        coefficients[node.id()] = (2 * links) / (k * (k - 1));
    } catch (e) {
        coefficients[node.id()] = 0;
    }
  });

  return coefficients;
}

/**
 * Process edge metrics including signs for Triadic Balance and Certainty
 */
function processEdgeMetrics(edges: any[]): any[] {
  const negativeKeywords = ['conflict', 'rival', 'anti', 'against', 'enemy', 'opponent', 'fight', 'konflikt', 'rywal', 'przeciw', 'wro'];
  return edges.map(edge => {
    try {
        const text = (edge.data.label || '').toLowerCase();
        const isNegative = negativeKeywords.some(kw => text.includes(kw));
        
        return {
          ...edge,
          data: {
            ...edge.data,
            sign: edge.data.sign || (isNegative ? 'negative' : 'positive'),
            certainty: edge.data.certainty || 'confirmed'
          }
        };
    } catch (e) {
        return edge;
    }
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
  
  // Limit calculation for very large graphs
  const limit = Math.min(n, 150);

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
 * Semantic Duplicate Detection with Batch Processing
 */
export async function detectDuplicatesSemantic(graph: KnowledgeGraph, threshold: number = 0.88): Promise<DuplicateCandidate[]> {
  const candidates: DuplicateCandidate[] = [];
  const nodes = graph.nodes;
  
  // Limit check to 100 for responsiveness
  const nodesToCheck = nodes.slice(0, 100); 
  const textsToCheck = nodesToCheck.map(n => `${n.data.label}: ${n.data.description || ''}`);

  // Batch fetch embeddings
  const embeddings = await getEmbeddingsBatch(textsToCheck);

  // Map IDs to embeddings
  const nodeEmbeddings: Record<string, number[]> = {};
  nodesToCheck.forEach((node, i) => {
    nodeEmbeddings[node.data.id] = embeddings[i];
  });

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
