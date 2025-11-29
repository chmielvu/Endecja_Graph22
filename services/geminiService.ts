
import { GoogleGenAI } from "@google/genai";
import { ChatMessage, KnowledgeGraph, NodeData } from "../types";

const API_KEY = process.env.API_KEY || '';
const getAiClient = () => new GoogleGenAI({ apiKey: API_KEY });

// --- Dmowski Persona (1925) ---
const DMOWSKI_SYSTEM_INSTRUCTION = `
Jesteś Romanem Dmowskim w roku 1925. Mówisz wyłącznie po polsku, realistycznie, antyfederacyjnie, piastowsko, z naciskiem na interes narodowy i egoizm narodowy. Odpowiadasz faktami historycznymi, cytujesz własne prace gdy to możliwe. Nie wcielasz się w narratora – jesteś Dmowskim. Nigdy nie łamiesz roli. Nie zmieniaj grafu wiedzy.
`;

export async function chatWithAgent(
  history: ChatMessage[], 
  userMessage: string,
  graphContext: KnowledgeGraph
): Promise<{ text: string, reasoning: string, sources?: any[] }> {
    
    if (!API_KEY) throw new Error("API Key missing");
    const ai = getAiClient();

    // Dmowski Mode: Strictly NO tools, read-only
    try {
      const formattedHistory = history
        .filter(h => h.role !== 'system')
        .map(h => ({ 
           role: h.role === 'assistant' ? 'model' : 'user', 
           parts: [{ text: h.content }] 
        }));

      const chat = ai.chats.create({
         model: 'gemini-3-pro-preview',
         config: {
            systemInstruction: DMOWSKI_SYSTEM_INSTRUCTION,
            temperature: 0.7,
            topP: 0.9,
         },
         history: formattedHistory
      });

      const result = await chat.sendMessage({ message: userMessage });

      // Access text property safely
      const responseText = result.text || "Brak odpowiedzi (blokada bezpieczeństwa lub błąd modelu).";

      return {
        text: responseText,
        reasoning: "Dmowski mode active. Graph mutation disabled.",
        sources: []
      };

    } catch (e: any) {
      console.error("Chat Error:", e);
      return { text: `Wystąpił błąd komunikacji z modelem: ${e.message}`, reasoning: "" };
    }
}

export async function generateGraphExpansion(
  currentGraph: KnowledgeGraph, 
  query: string
): Promise<{ newNodes: any[], newEdges: any[], thoughtProcess: string }> {
  const ai = getAiClient();
  
  // FIX: Remove the arbitrary 30-node limit. 
  // Gemini 3 Pro can easily handle 2000+ node labels in context.
  // We map to a compact string format "Label (Type)" to save space while maximizing context.
  const allContextNodes = currentGraph.nodes.map(n => `${n.data.label} (${n.data.type})`).join(', ');

  const prompt = `
    You are an expert historian specializing in the Endecja movement. Expand the graph based on: "${query}".
    
    EXISTING GRAPH CONTEXT (Do not create duplicates of these):
    ${allContextNodes}
    
    TASK:
    Return JSON with new nodes/edges that connect to the existing graph or expand the requested topic.
    Ensure "dates" are strictly ISO or year ranges. "region" should be specific (e.g., "Wielkopolska", "Lwów").
    
    Schema: { "thoughtProcess": "Short historical reasoning", "nodes": [{ "id": "unique_id", "label": "Name", "type": "person|event...", "dates": "YYYY-YYYY", "region": "String" }], "edges": [{ "source": "id_from", "target": "id_to", "label": "relationship" }] }
  `;
  
  try {
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingBudget: 8192 },
          tools: [{ googleSearch: {} }],
        }
      });

      let text = response.text || '';
      text = text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
      return JSON.parse(text);
  } catch (e) {
    console.error("Expansion Error:", e);
    throw new Error("Failed to generate graph expansion.");
  }
}

export async function generateNodeDeepening(
  node: NodeData,
  currentGraph: KnowledgeGraph
): Promise<{ updatedProperties: Partial<NodeData>, newEdges: any[], thoughtProcess: string }> {
  const ai = getAiClient();
  // Provide context of potentially related nodes to allow linking
  const context = currentGraph.nodes
    .map(n => `${n.data.id} (${n.data.label})`)
    .slice(0, 500) // Moderate limit for deepening context
    .join(', ');

  const prompt = `
    Jesteś Romanem Dmowskim (rok 1925). Przeglądasz teczkę personalną lub dokument: "${node.label}" (${node.type}).
    
    OBECNE DANE:
    ${JSON.stringify(node)}

    KONTEKST INNYCH TECZEK (GRAF):
    ${context}

    ZADANIE:
    1. Przeprowadź kwerendę w swojej pamięci i dokumentach (wiedza historyczna).
    2. Uzupełnij braki: daty (YYYY-YYYY), konkretny region, precyzyjny opis roli w ruchu narodowym.
    3. Zidentyfikuj 1-2 KLUCZOWE relacje, których brakuje (np. z kim współpracował, kogo zwalczał), preferując istniejące węzły z kontekstu.

    Zwróć JSON:
    {
      "thoughtProcess": "Krótki komentarz w stylu Dmowskiego (np. 'Sprawdziłem zapiski ze zjazdu...').",
      "updatedProperties": { 
         "dates": "...", 
         "description": "...", 
         "region": "...",
         "certainty": "confirmed" 
      },
      "newEdges": [ 
        { "source": "${node.id}", "target": "target_id", "label": "relacja" } 
      ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 4096 },
        tools: [{ googleSearch: {} }],
      }
    });

    let text = response.text || '';
    text = text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
    return JSON.parse(text);
  } catch (e) {
    console.error("Deepening Error:", e);
    throw new Error("Failed to deepen node research.");
  }
}
