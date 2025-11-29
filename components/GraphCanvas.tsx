import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import cola from 'cytoscape-cola';
import { useStore } from '../store';
import { COLORS, COMMUNITY_COLORS } from '../constants';
import { NodeData } from '../types';
import { generateNodeDeepening } from '../services/geminiService';
import { BookOpenCheck, X } from 'lucide-react';

// Register the Cola extension
cytoscape.use(cola);

export const GraphCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const { 
    graph, 
    filteredGraph, 
    activeCommunityColoring, 
    selectedNodeIds, 
    toggleNodeSelection, 
    clearSelection, 
    timelineYear, 
    deepeningNodeId,
    setDeepeningNode,
    setThinking,
    addToast,
    setPendingPatch
  } = useStore();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);

  // Deepen Logic (Context Menu Version)
  const handleDeepenContext = async (nodeId: string) => {
    setContextMenu(null);
    const node = graph.nodes.find(n => n.data.id === nodeId)?.data;
    if (!node) return;

    setDeepeningNode(nodeId);
    setThinking(true);
    addToast({ title: 'Kwerenda Archiwalna', description: `Przeszukuję teczki dla: ${node.label}...`, type: 'info' });

    try {
      const result = await generateNodeDeepening(node, graph);
      
      setPendingPatch({
        type: 'deepening',
        reasoning: result.thoughtProcess,
        nodes: [{ id: node.id, ...result.updatedProperties }], 
        edges: result.newEdges
      });
      addToast({ title: 'Kwerenda Zakończona', description: 'Zweryfikuj sugerowane zmiany.', type: 'success' });
    } catch (e) {
      addToast({ title: 'Błąd Archiwum', description: 'Nie udało się pogłębić wiedzy o węźle.', type: 'error' });
    } finally {
      setDeepeningNode(null);
      setThinking(false);
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    cyRef.current = cytoscape({
      container: containerRef.current,
      selectionType: 'additive',
      boxSelectionEnabled: true,
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'color': '#ffffff',
            'font-size': '12px',
            'text-valign': 'bottom',
            'text-margin-y': 5,
            'text-background-opacity': 0.7,
            'text-background-color': '#000',
            'text-background-padding': '2px',
            'text-background-shape': 'roundrectangle',
            'width': (ele: any) => {
               const pr = ele.data('pagerank') || 0.01;
               return 10 + (pr * 140); 
            },
            'height': (ele: any) => {
               const pr = ele.data('pagerank') || 0.01;
               return 10 + (pr * 140);
            },
            'border-width': (ele: any) => {
               const clustering = ele.data('clustering') || 0;
               return clustering * 8;
            },
            'border-color': '#fff',
            'border-opacity': 0.8,
            'transition-property': 'background-color, width, height, border-width, opacity, border-color',
            'transition-duration': 500
          }
        },
        {
          selector: 'edge',
          style: {
            'width': (ele: any) => {
              const weight = ele.data('weight');
              return weight ? Math.max(1, 1 + (weight * 50)) : 1.5;
            },
            'line-color': (ele) => ele.data('sign') === 'negative' ? '#ef4444' : '#10b981', 
            'target-arrow-color': (ele) => ele.data('sign') === 'negative' ? '#ef4444' : '#10b981',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'opacity': (ele: any) => {
               const weight = ele.data('weight') || 0;
               return Math.min(1, 0.3 + (weight * 3));
            }
          }
        },
        {
          selector: ':selected',
          style: {
            'border-width': 4,
            'border-color': '#facc15', // yellow-400
            'background-color': '#facc15'
          }
        }
      ],
      wheelSensitivity: 0.2,
    });

    const cy = cyRef.current;

    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const isMulti = evt.originalEvent.shiftKey || evt.originalEvent.ctrlKey;
      toggleNodeSelection(node.id(), isMulti);
      setContextMenu(null);
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        clearSelection();
        setContextMenu(null);
      }
    });

    cy.on('boxselect', 'node', (evt) => {
      toggleNodeSelection(evt.target.id(), true);
    });

    // Context Menu Handler
    cy.on('cxttap', 'node', (evt) => {
      evt.preventDefault();
      setContextMenu({
        x: evt.originalEvent.clientX,
        y: evt.originalEvent.clientY,
        nodeId: evt.target.id()
      });
    });

    // Close menu on zoom/pan
    cy.on('zoom pan', () => setContextMenu(null));

    return () => {
      if (cyRef.current) cyRef.current.destroy();
    };
  }, []);

  // Sync Graph Data & Timeline Filtering
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;

    cy.batch(() => {
      const newNodes = filteredGraph.nodes.map(n => ({
        group: 'nodes',
        data: n.data,
        position: n.position
      }));
      const newEdges = filteredGraph.edges.map(e => ({
        group: 'edges',
        data: e.data
      }));

      cy.elements().remove();
      cy.add([...newNodes, ...newEdges] as any);
      
      if (timelineYear !== null) {
        cy.nodes().forEach(node => {
           const y = node.data('year');
           let isVisible = false;
           if (!y) {
               isVisible = false; 
           } else {
               isVisible = (y >= timelineYear - 20 && y <= timelineYear + 20);
           }
           
           node.style('opacity', isVisible ? 1 : 0.15);
           node.connectedEdges().style('opacity', isVisible ? 1 : 0.05);
        });
      } else {
        cy.elements().style('opacity', 1);
      }
    });

    cy.layout({
      name: 'cola',
      animate: true,
      refresh: 2,
      maxSimulationTime: 3000,
      ungrabifyWhileSimulating: false,
      fit: true,
      padding: 30,
      randomize: false,
      nodeSpacing: (node: any) => {
        const pr = node.data('pagerank') || 0.01;
        return 40 + (pr * 100);
      },
      edgeLength: (edge: any) => 100,
      nodeDimensionsIncludeLabels: true,
      gravity: 0.5,
      friction: 0.5,
    } as any).run();

  }, [filteredGraph, timelineYear]);

  // Sync Selection
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    cy.batch(() => {
      cy.nodes().unselect();
      selectedNodeIds.forEach(id => {
        cy.$id(id).select();
      });
    });
  }, [selectedNodeIds]);

  // Update Styling (Colors & Deepening Visuals)
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;

    cy.batch(() => {
      cy.nodes().forEach(ele => {
        const data = ele.data() as NodeData;
        
        // Deepening Visual Effect (Active Research)
        if (deepeningNodeId && data.id === deepeningNodeId) {
            // Base style for deepening
            ele.style('border-color', '#be123c'); // Crimson
            ele.style('border-width', 8);
            ele.style('border-style', 'double');
            return;
        }

        let color = '#9ca3af';
        if (activeCommunityColoring) {
          const commId = data.louvainCommunity !== undefined ? data.louvainCommunity : data.community;
          if (commId !== undefined) {
             color = COMMUNITY_COLORS[commId % COMMUNITY_COLORS.length];
          }
        } else {
          color = COLORS[data.type] || color;
        }
        
        ele.style('background-color', color);
        if (!ele.selected()) {
           ele.style('border-color', '#fff');
           ele.style('border-width', (data.clustering || 0) * 8);
           ele.style('border-style', 'solid');
        }
      });
    });

  }, [filteredGraph, activeCommunityColoring, deepeningNodeId]);

  // Animation Pulse Effect for Deepening Node
  useEffect(() => {
    if (!deepeningNodeId || !cyRef.current) return;
    const cy = cyRef.current;
    const el = cy.$id(deepeningNodeId);
    
    // Simple pulsing effect using animation
    const animate = () => {
       if (el.removed() || !el.inside()) return; // check if element is valid
       
       el.animation({
         style: { 'border-width': 12, 'border-opacity': 0.5 },
         duration: 800
       } as any).play().promise().then(() => {
         el.animation({
           style: { 'border-width': 4, 'border-opacity': 1 },
           duration: 800
         } as any).play().promise().then(() => {
            // Check if still deepening same node
            if (useStore.getState().deepeningNodeId === deepeningNodeId) {
                animate();
            }
         });
       });
    };
    
    animate();

    return () => {
        el.stop(true);
    };
  }, [deepeningNodeId]);

  return (
    <div className="w-full h-full bg-zinc-950 relative overflow-hidden">
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <div className="text-zinc-500 text-xs font-mono bg-black/50 p-1 rounded backdrop-blur-sm border border-zinc-800">
          <div>Nodes: {filteredGraph.nodes.length} | Edges: {filteredGraph.edges.length}</div>
          <div>Balance: {((filteredGraph.meta?.globalBalance || 1) * 100).toFixed(1)}%</div>
          <div>Modularity: {filteredGraph.meta?.modularity?.toFixed(3) || 'N/A'}</div>
          <div>Coloring: {activeCommunityColoring ? 'Louvain Communities' : 'Entity Type'}</div>
        </div>
      </div>
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="fixed z-50 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div className="px-3 py-2 border-b border-zinc-800 mb-1">
             <span className="text-xs font-bold text-zinc-400 block uppercase">
               {graph.nodes.find(n => n.data.id === contextMenu.nodeId)?.data.label}
             </span>
          </div>
          <button 
            onClick={() => handleDeepenContext(contextMenu.nodeId)}
            className="w-full text-left px-3 py-2 text-sm text-crimson-300 hover:bg-zinc-800 hover:text-white transition-colors flex items-center gap-2"
          >
            <BookOpenCheck size={14} className="text-indigo-400" /> Deepen Research
          </button>
          <button 
            onClick={() => setContextMenu(null)}
            className="w-full text-left px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors flex items-center gap-2"
          >
            <X size={14} /> Cancel
          </button>
        </div>
      )}
    </div>
  );
};