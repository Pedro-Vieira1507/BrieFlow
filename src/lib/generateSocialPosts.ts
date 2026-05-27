import { callLLM } from "./generateMaterials";
import { type StructuredBrief } from "./store";

// ─── Tipos ───────────────────────────────────────────────────────────────────

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
  visual: string;   // descrição do visual/imagem
  texto: string;    // texto sobreposto
  cor: string;      // cor de fundo hex
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

// ─── LinkedIn ──────────────────────────────────────────────────────────────────

export async function generateLinkedInPosts(
  texto: string,
  brief: StructuredBrief,
  nomeCampanha: string,
): Promise<LinkedInPost[]> {
  const prompt = `Você é especialista em LinkedIn marketing B2B para o setor científico-laboratorial.

Com base no TEXTO e BRIEF, crie 2 posts profissionais para LinkedIn.

TEXTO: ${texto}
Marca: ${brief.marca} | Oferta: ${brief.oferta_promocional} | Tom: ${brief.tom_comunicacao}

Retorne SOMENTE JSON válido:
{
  "posts": [
    {
      "titulo": "Gancho inicial impactante (1-2 linhas que param o scroll)",
      "corpo": "Corpo do post em paragrafos curtos. Use linhas em branco para aerar. Max 150 palavras.",
      "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"],
      "tipo": "autoridade",
      "cta": "Chamada para ação final do post"
    },
    {
      "titulo": "...",
      "corpo": "...",
      "hashtags": ["..."],
      "tipo": "oferta",
      "cta": "..."
    }
  ]
}

Post 1 (autoridade): Insight técnico + posicionamento da marca como referência
Post 2 (oferta): Apresentação da oferta com dados/resultados + urgência`;

  const raw = await callLLM(prompt);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("IA não retornou JSON para LinkedIn.");
  return (JSON.parse(match[0]) as { posts: LinkedInPost[] }).posts;
}

// ─── Facebook ─────────────────────────────────────────────────────────────────

export async function generateFacebookPosts(
  texto: string,
  brief: StructuredBrief,
  nomeCampanha: string,
): Promise<FacebookPost[]> {
  const prompt = `Você é especialista em Facebook marketing para laboratórios e distribuidores.

Com base no TEXTO e BRIEF, crie 2 posts para Facebook.

TEXTO: ${texto}
Marca: ${brief.marca} | Oferta: ${brief.oferta_promocional} | Tom: ${brief.tom_comunicacao}

Retorne SOMENTE JSON válido:
{
  "posts": [
    {
      "texto": "Texto completo do post com emojis (max 120 palavras, parágrafos curtos)",
      "cta": "Chamada para ação",
      "emojis": "3-5 emojis temáticos usados no post",
      "tipo": "apresentacao"
    },
    {
      "texto": "...",
      "cta": "...",
      "emojis": "...",
      "tipo": "oferta"
    }
  ]
}

Post 1: Apresentação amigável da marca/produto com benefícios
Post 2: Oferta direta com urgência, emojis e CTA claro`;

  const raw = await callLLM(prompt);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("IA não retornou JSON para Facebook.");
  return (JSON.parse(match[0]) as { posts: FacebookPost[] }).posts;
}

// ─── Instagram ────────────────────────────────────────────────────────────────

export async function generateInstagramData(
  texto: string,
  brief: StructuredBrief,
  nomeCampanha: string,
): Promise<InstagramData> {
  const prompt = `Você é especialista em Instagram marketing para o setor laboratorial.

Com base no TEXTO e BRIEF, crie 1 carrossel e 1 roteiro de Reels para Instagram.

TEXTO: ${texto}
Marca: ${brief.marca} | Oferta: ${brief.oferta_promocional} | Tom: ${brief.tom_comunicacao}

Retorne SOMENTE JSON válido:
{
  "carrossel": {
    "slides": [
      { "numero": 1, "visual": "descrição do visual/imagem", "texto": "Texto do slide (curto)", "cor": "#6C63FF" },
      { "numero": 2, "visual": "...", "texto": "...", "cor": "#7C3AED" }
    ],
    "legenda": "Legenda completa do post com emoji e CTA",
    "hashtags": ["hashtag1", "hashtag2"]
  },
  "reels": {
    "duracao": "20s",
    "cenas": [
      { "tempo": "0-3s", "visual": "visual da cena", "texto": "Texto na tela", "locucao": "Fala do narrador" }
    ],
    "legenda": "Legenda do reels",
    "musica": "Sugestão de estilo musical",
    "hashtags": ["hashtag1"]
  }
}

Carrossel: 5-7 slides. Slide 1 = capa impactante. Slides 2-5 = conteúdo. Último = CTA.
Reels: 15-25s, 4-6 cenas dinâmicas. Cada cena 3-5s.
Use cores da paleta: #6C63FF, #7C3AED, #A78BFA, #F59E0B, #10B981`;

  const raw = await callLLM(prompt);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("IA não retornou JSON para Instagram.");
  return JSON.parse(match[0]) as InstagramData;
}

// ─── Roteiro de Vídeo ─────────────────────────────────────────────────────────────

export async function generateVideoRoteiro(
  texto: string,
  brief: StructuredBrief,
  nomeCampanha: string,
): Promise<VideoRoteiro> {
  const prompt = `Você é diretor criativo especialista em vídeos curtos para redes sociais (Reels, Shorts, TikTok).

Com base no TEXTO e BRIEF, crie um roteiro de vídeo 15-30s profissional e dinâmico.

TEXTO: ${texto}
Marca: ${brief.marca} | Oferta: ${brief.oferta_promocional} | Tom: ${brief.tom_comunicacao}

Retorne SOMENTE JSON válido:
{
  "titulo": "Título criativo do vídeo",
  "duracao": "25s",
  "formato": "Vertical 9:16 (Reels/Shorts)",
  "cenas": [
    {
      "numero": 1,
      "tempo": "0-3s",
      "visual": "Descrição detalhada do visual/imagem da cena",
      "textTela": "Texto que aparece na tela (curto, impactante)",
      "locucao": "Texto exato da narração/locucao",
      "musica": "Descrição do som/música nesta cena"
    }
  ],
  "cta": "Call-to-action final do vídeo",
  "legenda": "Legenda para postar nas redes (com emojis e hashtags)"
}

REGRAS:
- 5-7 cenas de 3-5s cada
- Cena 1: Hook impactante em 3s (pergunta ou dado surpreendente)
- Cenas 2-4: Produto em ação, diferenciais rápidos
- Cena 5-6: Oferta ${brief.oferta_promocional}
- Cena final: CTA direto com urgencia
- Locação coerente com ambiente de laboratório
- Ritmo acelerado, cortes rápidos`;

  const raw = await callLLM(prompt);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("IA não retornou JSON para o roteiro de vídeo.");
  return JSON.parse(match[0]) as VideoRoteiro;
}
