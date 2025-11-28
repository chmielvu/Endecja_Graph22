import { GoogleGenAI } from "@google/genai";
import { ChatMessage, KnowledgeGraph } from "../types";

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
  const prompt = `
    You are an expert historian. Expand the graph based on: "${query}".
    Current Nodes: ${currentGraph.nodes.slice(0, 30).map(n => n.data.label).join(', ')}...
    Return JSON with new nodes/edges.
    Schema: { "thoughtProcess": "", "nodes": [{ "id": "", "label": "", "type": "", "dates": "", "region": "" }], "edges": [] }
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