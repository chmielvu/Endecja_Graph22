import { KnowledgeGraph } from './types';

// Full Data from endecja_knowledge_base.json + PDF Report Ingestion
const DATA = {
  "metadata": {
    "title": "Baza Wiedzy o Endecji (Narodowej Demokracji)",
    "description": "Kompleksowa baza wiedzy uwzględniająca raport 'Endecja GraphLab Pro' i Klaster Poznański.",
    "version": "2.1",
    "updated": "2025-11-25"
  },
  "nodes": [
    // --- The Poznań Cluster (Wielkopolska) - FROM PDF REPORT ---
    {
      "id": "seyda_marian",
      "label": "Marian Seyda",
      "type": "person",
      "dates": "1879-1967",
      "description": "Lider Endecji w zaborze pruskim. Redaktor naczelny 'Kuriera Poznańskiego'. Kluczowy węzeł (Bridge Node) łączący Poznań z Komitetem w Paryżu.",
      "region": "Wielkopolska",
      "importance": 0.9
    },
    {
      "id": "korfanty_wojciech",
      "label": "Wojciech Korfanty",
      "type": "person",
      "dates": "1873-1939",
      "description": "Przywódca narodowy na Śląsku. 'Frenemy' Dmowskiego. Chadecki sojusznik w walce z Sanacją.",
      "region": "Wielkopolska",
      "importance": 0.85
    },
    {
      "id": "zamoyski_wladyslaw",
      "label": "Hrabia Władysław Zamoyski",
      "type": "person",
      "dates": "1853-1924",
      "description": "Patron i filantrop. Przedstawiciel ziemiaństwa wielkopolskiego. Ofiarodawca dóbr kórnickich.",
      "region": "Wielkopolska",
      "importance": 0.8
    },
    {
      "id": "hotel_bazar",
      "label": "Hotel Bazar (Poznań)",
      "type": "organization",
      "dates": "1841-1939",
      "description": "Centralny punkt życia polskiego w Poznaniu. Siedziba organizacji gospodarczych. 'Twierdza polskości'.",
      "region": "Wielkopolska",
      "importance": 0.95
    },
    {
      "id": "bank_zwiazku",
      "label": "Bank Związku Spółek Zarobkowych",
      "type": "organization",
      "dates": "1861-1939",
      "description": "Finansowy silnik ruchu w Wielkopolsce. Finansował kampanie wyborcze i prasę narodową.",
      "region": "Wielkopolska",
      "importance": 0.9
    },
    {
      "id": "kurier_poznanski",
      "label": "Kurier Poznański",
      "type": "publication",
      "dates": "1872-1939",
      "description": "Główny dziennik Endecji w Polsce zachodniej. Potężne narzędzie propagandowe pod redakcją Seydy.",
      "region": "Wielkopolska",
      "importance": 0.85
    },
    {
      "id": "nrl",
      "label": "Naczelna Rada Ludowa",
      "type": "organization",
      "dates": "1918-1919",
      "description": "Naczelna władza polityczna w Wielkopolsce w czasie Powstania Wielkopolskiego.",
      "region": "Wielkopolska",
      "importance": 0.8
    },
    {
      "id": "zwiazek_ludowo_narodowy",
      "label": "Związek Ludowo-Narodowy",
      "type": "organization",
      "dates": "1919-1928",
      "description": "Partia polityczna Endecji w Sejmie Ustawodawczym.",
      "region": "Global",
      "importance": 0.8
    },

    // --- The Warsaw Core (Kongresówka) ---
    {
      "id": "dmowski_roman",
      "label": "Roman Dmowski",
      "type": "person",
      "dates": "1864-1939",
      "birth_date": "1864",
      "death_date": "1939-01-02",
      "description": "Założyciel i główny ideolog Endecji. Twórca Ligi Narodowej. Autor 'Myśli nowoczesnego Polaka'.",
      "region": "Warszawa",
      "importance": 1.0
    },
    {
      "id": "poplawski_jan",
      "label": "Jan Ludwik Popławski",
      "type": "person",
      "dates": "1854-1908",
      "description": "Współzałożyciel Ligi Narodowej. Redaktor 'Przeglądu Wszechpolskiego'.",
      "region": "Warszawa",
      "importance": 0.9
    },
    {
      "id": "balicki_zygmunt",
      "label": "Zygmunt Balicki",
      "type": "person",
      "dates": "1858-1916",
      "description": "Ideolog egoizmu narodowego. Założyciel 'Zet'.",
      "region": "Warszawa",
      "importance": 0.85
    },
    {
      "id": "mosdorf_jan",
      "label": "Jan Mosdorf",
      "type": "person",
      "dates": "1904-1943",
      "description": "Przywódca Młodzieży Wszechpolskiej, radykał. Zginął w Auschwitz.",
      "region": "Warszawa",
      "importance": 0.7
    },
    {
      "id": "rybarski_roman",
      "label": "Roman Rybarski",
      "type": "person",
      "dates": "1887-1942",
      "description": "Ekonomista, prezes Klubu Narodowego. Przedstawiciel 'starych'.",
      "region": "Warszawa",
      "importance": 0.75
    },
    
    // --- Contextual Nodes ---
    { "id": "pilsudski_jozef", "label": "Józef Piłsudski", "type": "person", "region": "Litwa/Warszawa", "dates": "1867-1935", "description": "Rywal Dmowskiego. Sanacja.", "importance": 0.95 },
    { "id": "grabski_wladyslaw", "label": "Władysław Grabski", "type": "person", "region": "Warszawa", "dates": "1874-1938", "description": "Premier, reformator walutowy.", "importance": 0.75 },
    { "id": "onr", "label": "Obóz Narodowo-Radykalny", "type": "organization", "region": "Warszawa", "dates": "1934-1939", "description": "Radykałowie, rozłamowcy.", "importance": 0.7 },
    { "id": "stronnictwo_narodowe", "label": "Stronnictwo Narodowe", "type": "organization", "region": "Global", "dates": "1928-1939", "description": "Główna partia.", "importance": 0.9 },
    { "id": "liga_narodowa", "label": "Liga Narodowa", "type": "organization", "region": "Global", "dates": "1893-1928", "description": "Tajna organizacja trójzaborowa.", "importance": 1.0 },
    { "id": "konferencja_paryska", "label": "Konferencja Pokojowa", "type": "event", "dates": "1919", "importance": 1.0 },
    { "id": "zamach_majowy", "label": "Zamach Majowy", "type": "event", "dates": "1926", "importance": 0.9 },
    { "id": "egoizm_narodowy_concept", "label": "Egoizm Narodowy", "type": "concept", "importance": 0.9 },
    { "id": "koncepcja_piastowska", "label": "Koncepcja Piastowska", "type": "concept", "importance": 0.85 },
    { "id": "giertych_jędrzej", "label": "Jędrzej Giertych", "type": "person", "region": "Warszawa", "dates": "1903-1992", "importance": 0.65 },
    { "id": "doboszynski_adam", "label": "Adam Doboszyński", "type": "person", "region": "Galicja", "dates": "1904-1949", "importance": 0.65 },
    { "id": "mysli_polaka", "label": "Myśli nowoczesnego Polaka", "type": "publication", "dates": "1903", "importance": 1.0 }
  ],
  "edges": [
    // --- Poznań Cluster Interconnectivity (High Density) ---
    { "source": "seyda_marian", "target": "kurier_poznanski", "relationship": "redaktor naczelny", "dates": "1910s-1939" },
    { "source": "seyda_marian", "target": "hotel_bazar", "relationship": "organizował spotkania", "dates": "1918-1939" },
    { "source": "hotel_bazar", "target": "nrl", "relationship": "siedziba", "dates": "1918" },
    { "source": "bank_zwiazku", "target": "hotel_bazar", "relationship": "finansował działalność", "dates": "1918-1939" },
    { "source": "bank_zwiazku", "target": "kurier_poznanski", "relationship": "finansował", "dates": "1920s" },
    { "source": "bank_zwiazku", "target": "stronnictwo_narodowe", "relationship": "wsparcie finansowe", "dates": "1928-1939" },
    { "source": "zamoyski_wladyslaw", "target": "hotel_bazar", "relationship": "bywalec", "dates": "1900s" },
    { "source": "zamoyski_wladyslaw", "target": "bank_zwiazku", "relationship": "depozytariusz", "dates": "1900s" },
    { "source": "korfanty_wojciech", "target": "hotel_bazar", "relationship": "przemawiał (1918)", "dates": "1918" },
    { "source": "korfanty_wojciech", "target": "nrl", "relationship": "członek", "dates": "1918" },

    // --- Bridge Edges (Connecting Regions) ---
    { "source": "seyda_marian", "target": "dmowski_roman", "relationship": "współpracował (KNP)", "dates": "1917-1939" },
    { "source": "seyda_marian", "target": "stronnictwo_narodowe", "relationship": "lider frakcji poznańskiej", "dates": "1928-1939" },
    { "source": "dmowski_roman", "target": "konferencja_paryska", "relationship": "reprezentował Polskę", "dates": "1919" },
    { "source": "nrl", "target": "konferencja_paryska", "relationship": "podporządkowała się KNP", "dates": "1919" },

    // --- Warsaw Core & Ideology ---
    { "source": "dmowski_roman", "target": "liga_narodowa", "relationship": "założył", "dates": "1893" },
    { "source": "poplawski_jan", "target": "liga_narodowa", "relationship": "współzałożył", "dates": "1893" },
    { "source": "dmowski_roman", "target": "koncepcja_piastowska", "relationship": "opracował", "dates": "1903" },
    { "source": "dmowski_roman", "target": "pilsudski_jozef", "relationship": "rywalizował", "dates": "1900-1935" },
    { "source": "giertych_jędrzej", "target": "onr", "relationship": "sympatyzował", "dates": "1934" },
    { "source": "mosdorf_jan", "target": "onr", "relationship": "założył", "dates": "1934" },
    
    // --- Tensions (Structural Balance Test) ---
    { "source": "korfanty_wojciech", "target": "dmowski_roman", "relationship": "konflikt taktyczny", "dates": "1920s" },
    { "source": "onr", "target": "bank_zwiazku", "relationship": "brak finansowania", "dates": "1934" },
    { "source": "mosdorf_jan", "target": "rybarski_roman", "relationship": "konflikt pokoleń", "dates": "1930s" }
  ]
};

// Helper to extract year from date string or number
const getYear = (dateStr: string | number | undefined): number | undefined => {
  if (!dateStr) return undefined;
  if (typeof dateStr === 'number') return dateStr;
  const match = dateStr.toString().match(/\d{4}/);
  return match ? parseInt(match[0]) : undefined;
};

// Map raw JSON to Graph Types
const mappedNodes = DATA.nodes.map(n => ({
  data: {
    id: n.id,
    label: n.label,
    type: n.type as any, // Cast to NodeType
    year: getYear(n.dates),
    dates: n.dates,
    description: n.description,
    importance: n.importance,
    region: n.region || 'Unknown'
  }
}));

const mappedEdges = DATA.edges.map((e: any, i) => ({
  data: {
    id: `edge_${i}_${e.source}_${e.target}`,
    source: e.source,
    target: e.target,
    label: e.relationship || e.label,
    dates: e.dates
  }
}));

export const INITIAL_GRAPH: KnowledgeGraph = {
  nodes: mappedNodes,
  edges: mappedEdges
};

export const COLORS = {
  person: '#3b82f6', // blue-500
  Person: '#3b82f6',
  organization: '#ef4444', // red-500
  Organization: '#ef4444',
  event: '#eab308', // yellow-500
  Event: '#eab308',
  publication: '#10b981', // emerald-500
  Publication: '#10b981',
  concept: '#a855f7', // purple-500
  Concept: '#a855f7',
};

// Tier-4 Palette: Gold -> Crimson -> Navy (Endecja Historical)
export const COMMUNITY_COLORS = [
  '#b45309', // Gold (Amber-700)
  '#be123c', // Crimson (Rose-700)
  '#1e3a8a', // Navy (Blue-900)
  '#c2410c', // Orange-700 (Rust)
  '#0f766e', // Teal-700 (Deep Green)
  '#4338ca', // Indigo-700
  '#7f1d1d', // Red-900 (Blood)
  '#a16207', // Yellow-800
  '#312e81', // Indigo-900
];