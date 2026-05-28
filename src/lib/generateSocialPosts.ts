import { callLLM } from "./generateMaterials";
import { type StructuredBrief } from "./store";
// FIX: EmailSequencia é importada de generateEmail para evitar duplicação de interface.
import { type EmailSequencia } from "./generateEmail";

export type { EmailSequencia };

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface LinkedInPost {
  titulo: string;
  corpo: string;
  hashtags: string[];
  tipo: "autoridade" | "oferta";
  cta: string;
}

export interface FacebookPost {
  texto: string;
  cta: string;
  emojis: string;
  tipo: "apresentacao" | "oferta";
}

export interface InstagramSlide {
  numero: number;
  visual: string;
  texto: string;
  cor: string;
}

export interface InstagramCarrossel {
  slides: InstagramSlide[];
  legenda: string;
  hashtags: string[];
}

export interface InstagramReels {
  duracao: string;
  cenas: { tempo: string; visual: string; texto: string; locucao: string }[];
  legenda: string;
  musica: string;
  hashtags: string[];
}

export interface InstagramData {
  carrossel: InstagramCarrossel;
  reels: InstagramReels;
}

export interface VideoRoteiro {
  titulo: string;
  duracao: string;
  formato: string;
  cenas: {
    numero: number;
    tempo: string;
    visual: string;
    textTela: string;
    locucao: string;
    musica: string;
  }[];
  cta: string;
  legenda: string;
}

// ─── Helper: extrai JSON de string que pode ter markdown fence ───────────────

function parseJson<T>(raw: string, label: string): T {
  // 1. Remove markdown fences (```json ... ```)
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  // 2. Tenta extrair o primeiro bloco JSON completo (objeto ou array)
  const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (!match) {
    throw new Error(`IA não retornou JSON válido para ${label}. Tente novamente.`);
  }

  // 3. Tenta parse direto
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    // 4. Fallback: sanitiza newlines literais e caracteres de controle dentro de strings
    try {
      const sanitized = match[0].replace(
        /"(?:[^"\\]|\\.)*"/g,
        (str) =>
          str.replace(/[\x00-\x1F\x7F]/g, (c) => {
            if (c === "\n") return "\\n";
            if (c === "\t") return "\\t";
            if (c === "\r") return "\\r";
            return "";
          }),
      );
      return JSON.parse(sanitized) as T;
    } catch {
      throw new Error(`Erro ao interpretar JSON de ${label}. Tente novamente.`);
    }
  }
}

// ─── Contexto comum ───────────────────────────────────────────────────────

function ctx(brief: StructuredBrief, nomeCampanha: string): string {
  return `Marca: ${brief.marca} | Campanha: ${nomeCampanha} | Oferta: ${brief.oferta_promocional} | Público: ${brief.publico_alvo} | Tom: ${brief.tom_comunicacao} | Diferenciais: ${brief.diferenciais_tecnicos?.join("; ") ?? ""} | Subcategorias: ${brief.subcategorias?.join(", ") ?? ""}`;
}

// ─── LinkedIn ──────────────────────────────────────────────────────────────────

export async function generateLinkedInPosts(
  texto: string,
  brief: StructuredBrief,
  nomeCampanha: string,
): Promise<LinkedInPost[]> {
  const prompt = `Você é especialista em LinkedIn marketing B2B para o setor científico-laboratorial.\nEscreva em português brasileiro. Tom: ${brief.tom_comunicacao}.\n\n${ctx(brief, nomeCampanha)}\n\nTEXTO DE REFERÊNCIA:\n${texto}\n\nCrie 2 posts profissionais para LinkedIn.\nPost 1 (autoridade): Insight técnico + posicionamento de ${brief.marca} como referência. Gancho forte nas primeiras 2 linhas.\nPost 2 (oferta): "${brief.oferta_promocional}" com dados/resultados + urgência + CTA.\n\nRetorne SOMENTE JSON válido sem markdown:\n{\n  "posts": [\n    {\n      "titulo": "Gancho inicial (1-2 linhas que param o scroll)",\n      "corpo": "Corpo em parágrafos curtos com linha em branco entre eles. Max 150 palavras.",\n      "hashtags": ["hashtag1","hashtag2","hashtag3","hashtag4","hashtag5"],\n      "tipo": "autoridade",\n      "cta": "Chamada para ação final"\n    },\n    {\n      "titulo": "...",\n      "corpo": "...",\n      "hashtags": ["..."],\n      "tipo": "oferta",\n      "cta": "..."\n    }\n  ]\n}`;

  const data = parseJson<{ posts?: LinkedInPost[] }>(await callLLM(prompt), "LinkedIn");
  if (!Array.isArray(data.posts) || data.posts.length === 0)
    throw new Error("Nenhum post LinkedIn foi gerado. Tente novamente.");
  return data.posts;
}

// ─── Facebook ─────────────────────────────────────────────────────────────────

export async function generateFacebookPosts(
  texto: string,
  brief: StructuredBrief,
  nomeCampanha: string,
): Promise<FacebookPost[]> {
  const prompt = `Você é especialista em Facebook marketing para distribuidores e laboratórios.\nEscreva em português brasileiro. Tom amigável mas profissional.\n\n${ctx(brief, nomeCampanha)}\n\nTEXTO DE REFERÊNCIA:\n${texto}\n\nCrie 2 posts para Facebook.\nPost 1 (apresentação): Apresentação amigável de ${brief.marca} com benefícios e emojis. Max 120 palavras.\nPost 2 (oferta): "${brief.oferta_promocional}" com urgência, emojis e CTA claro. Max 100 palavras.\n\nRetorne SOMENTE JSON válido sem markdown:\n{\n  "posts": [\n    {\n      "texto": "Texto completo com emojis e parágrafos curtos",\n      "cta": "Chamada para ação",\n      "emojis": "3-5 emojis temáticos usados no post",\n      "tipo": "apresentacao"\n    },\n    {\n      "texto": "...",\n      "cta": "...",\n      "emojis": "...",\n      "tipo": "oferta"\n    }\n  ]\n}`;

  const data = parseJson<{ posts?: FacebookPost[] }>(await callLLM(prompt), "Facebook");
  if (!Array.isArray(data.posts) || data.posts.length === 0)
    throw new Error("Nenhum post Facebook foi gerado. Tente novamente.");
  return data.posts;
}

// ─── Instagram ────────────────────────────────────────────────────────────────

export async function generateInstagramData(
  texto: string,
  brief: StructuredBrief,
  nomeCampanha: string,
): Promise<InstagramData> {
  const prompt = `Você é especialista em Instagram marketing para o setor laboratorial.\nEscreva em português brasileiro.\n\n${ctx(brief, nomeCampanha)}\n\nTEXTO DE REFERÊNCIA:\n${texto}\n\nCrie 1 carrossel (5-7 slides) e 1 roteiro de Reels (15-25s) para Instagram.\n\nCarrossel: Slide 1 = capa impactante. Slides 2-5 = conteúdo. Último slide = CTA.\nReels: 4-6 cenas dinâmicas de 3-5s cada. Ritmo acelerado.\nUse cores: #6C63FF, #7C3AED, #A78BFA, #F59E0B, #10B981.\n\nRetorne SOMENTE JSON válido sem markdown:\n{\n  "carrossel": {\n    "slides": [\n      { "numero": 1, "visual": "descrição do visual", "texto": "Texto curto do slide", "cor": "#6C63FF" }\n    ],\n    "legenda": "Legenda completa com emoji e CTA",\n    "hashtags": ["hashtag1","hashtag2"]\n  },\n  "reels": {\n    "duracao": "20s",\n    "cenas": [\n      { "tempo": "0-3s", "visual": "visual da cena", "texto": "Texto na tela", "locucao": "Fala do narrador" }\n    ],\n    "legenda": "Legenda do reels",\n    "musica": "Estilo musical sugerido",\n    "hashtags": ["hashtag1"]\n  }\n}`;

  const data = parseJson<InstagramData>(await callLLM(prompt), "Instagram");
  if (!data.carrossel?.slides || !data.reels?.cenas)
    throw new Error("Dados de Instagram incompletos. Tente novamente.");
  return data;
}

// ─── Roteiro de Vídeo ─────────────────────────────────────────────────────────────

export async function generateVideoRoteiro(
  texto: string,
  brief: StructuredBrief,
  nomeCampanha: string,
): Promise<VideoRoteiro> {
  const prompt = `Você é diretor criativo especialista em vídeos curtos para Reels, Shorts e TikTok do setor laboratorial.\nEscreva em português brasileiro.\n\n${ctx(brief, nomeCampanha)}\n\nTEXTO DE REFERÊNCIA:\n${texto}\n\nCrie um roteiro de vídeo 15-30s profissional e dinâmico.\nRegras:\n- 5-7 cenas de 3-5s cada\n- Cena 1: Hook em 3s (pergunta ou dado surpreendente)\n- Cenas 2-4: Produto em ação, diferenciais rápidos\n- Cena 5-6: Destaque da oferta "${brief.oferta_promocional}"\n- Cena final: CTA com urgência\n- Ambiente de laboratório realista\n\nRetorne SOMENTE JSON válido sem markdown:\n{\n  "titulo": "Título criativo do vídeo",\n  "duracao": "25s",\n  "formato": "Vertical 9:16 (Reels/Shorts)",\n  "cenas": [\n    {\n      "numero": 1,\n      "tempo": "0-3s",\n      "visual": "Descrição detalhada da cena",\n      "textTela": "Texto na tela (curto, impactante)",\n      "locucao": "Texto exato da narração",\n      "musica": "Descrição do som"\n    }\n  ],\n  "cta": "Call-to-action final",\n  "legenda": "Legenda para redes (com emojis e hashtags)"\n}`;

  const data = parseJson<VideoRoteiro>(await callLLM(prompt), "Roteiro de Vídeo");
  if (!Array.isArray(data.cenas) || data.cenas.length === 0)
    throw new Error("Cenas do roteiro não foram geradas. Tente novamente.");
  return data;
}
