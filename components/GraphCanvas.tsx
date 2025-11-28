import React, { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import cola from 'cytoscape-cola';
import { useStore } from '../store';
import { COLORS, COMMUNITY_COLORS } from '../constants';
import { NodeData } from '../types';

// Register the Cola extension
cytoscape.use(cola);

export const GraphCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const { filteredGraph, activeCommunityColoring, selectedNodeIds, toggleNodeSelection, clearSelection, timelineYear } = useStore();

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
            // Tier-4 Visuals
            // Size based on PageRank
            'width': (ele: any) => {
               const pr = ele.data('pagerank') || 0.01;
               return 10 + (pr * 140); 
            },
            'height': (ele: any) => {
               const pr = ele.data('pagerank') || 0.01;
               return 10 + (pr * 140);
            },
            // Border width linked to Clustering Coefficient
            'border-width': (ele: any) => {
               const clustering = ele.data('clustering') || 0;
               return Math.max(0, clustering * 8);
            },
            'border-color': '#fff',
            'border-opacity': 0.8,
            // Smooth transitions
            'transition-property': 'background-color, width, height, border-width',
            'transition-duration': 500
          }
        },
        {
          selector: 'edge',
          style: {
            'width': (ele: any) => {
              const weight = ele.data('weight');
              return weight ? Math.max(1, 1 + (weight * 2)) : 1.5;
            },
            'line-color': (ele) => ele.data('sign') === 'negative' ? '#ef4444' : '#10b981', 
            'target-arrow-color': (ele) => ele.data('sign') === 'negative' ? '#ef4444' : '#10b981',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'opacity': (ele: any) => {
               const weight = ele.data('weight');
               return weight ? Math.min(1, 0.4 + (weight * 0.6)) : 0.6;
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
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        clearSelection();
      }
    });

    cy.on('boxselect', 'node', (evt) => {
      toggleNodeSelection(evt.target.id(), true);
    });

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

      // Diffing or full replacement - for simplicity in this complexity, full replace but keep positions if possible
      // Cytoscape's json() method might be better but let's stick to remove/add for full sync
      cy.elements().remove();
      cy.add([...newNodes, ...newEdges] as any);
      
      // Apply Timeline Filter Opacity
      if (timelineYear !== null) {
        cy.nodes().forEach(node => {
           const y = node.data('year');
           // Simple range logic: if node has year and is within range +/- 10 years or user selected specific year
           const isVisible = !y || (y >= timelineYear - 10 && y <= timelineYear + 10);
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

  // Sync Selection from Store to Graph
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

  // Update Styling (Colors)
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;

    cy.batch(() => {
      cy.nodes().forEach(ele => {
        const data = ele.data() as NodeData;
        
        // Color by Community (Louvain)
        let color = '#9ca3af';
        
        if (activeCommunityColoring) {
          // Prioritize louvainCommunity, fallback to community
          const commId = data.louvainCommunity !== undefined ? data.louvainCommunity : data.community;
          if (commId !== undefined) {
             // Cycle through the discrete Gold->Crimson->Navy palette
             color = COMMUNITY_COLORS[commId % COMMUNITY_COLORS.length];
          }
        } else {
          // Fallback to Type-based coloring
          color = COLORS[data.type] || color;
        }
        
        // Apply color
        ele.style('background-color', color);
      });
    });

  }, [filteredGraph, activeCommunityColoring]);

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
    </div>
  );
};