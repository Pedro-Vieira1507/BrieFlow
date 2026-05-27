import { callLLM } from "./generateMaterials";
import { type StructuredBrief } from "./store";

// System role compartilhado — mesma identidade do SYSTEM_ROLE de generateMaterials
const SOCIAL_SYSTEM_ROLE =
  "Você é um especialista em marketing B2B e copywriting para o setor laboratorial. " +
  "Escreva em português brasileiro, tom profissional mas acessível. " +
  "Responda SOMENTE com JSON válido, sem markdown, sem explicações adicionais.";

// Helper: injeta system role no início do prompt para que callLLM o use
function withRole(prompt: string): string {
  return `${SOCIAL_SYSTEM_ROLE}\n\n${prompt}`;
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

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

// Helper de parse JSON seguro
function parseJSON<T>(raw: string, label: string): T {
  // Remove markdown code fences se existirem
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`IA não retornou JSON válido para ${label}.`);
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    throw new Error(`Erro ao interpretar JSON de ${label}: resposta malformada.`);
  }
}

// ─── LinkedIn ─────────────────────────────────────────────────────────────────

export async function generateLinkedInPosts(
  texto: string,
  brief: StructuredBrief,
  nomeCampanha: string,
): Promise<LinkedInPost[]> {
  const prompt = withRole(`Você é especialista em LinkedIn marketing B2B para o setor científico-laboratorial.

Com base no TEXTO e BRIEF, crie 2 posts profissionais para LinkedIn.

TEXTO: ${texto}
Marca: ${brief.marca} | Campanha: ${nomeCampanha} | Oferta: ${brief.oferta_promocional} | Tom: ${brief.tom_comunicacao}
Diferenciais: ${brief.diferenciais_tecnicos.join("; ")}
Benefícios revendedor: ${brief.beneficios_revendedor.join("; ")}

Retorne SOMENTE JSON válido:
{
  "posts": [
    {
      "titulo": "Gancho inicial impactante (1-2 linhas que param o scroll)",
      "corpo": "Corpo do post em parágrafos curtos com linhas em branco. Max 150 palavras.",
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

Post 1 (autoridade): Insight técnico + posicionamento de ${brief.marca} como referência no setor.
Post 2 (oferta): Apresentação de ${brief.oferta_promocional} com dados/resultados e urgência.`);

  const raw = await callLLM(prompt);
  return parseJSON<{ posts: LinkedInPost[] }>(raw, "LinkedIn").posts;
}

// ─── Facebook ─────────────────────────────────────────────────────────────────

export async function generateFacebookPosts(
  texto: string,
  brief: StructuredBrief,
  nomeCampanha: string,
): Promise<FacebookPost[]> {
  const prompt = withRole(`Você é especialista em Facebook marketing para laboratórios e distribuidores.

Com base no TEXTO e BRIEF, crie 2 posts para Facebook.

TEXTO: ${texto}
Marca: ${brief.marca} | Campanha: ${nomeCampanha} | Oferta: ${brief.oferta_promocional} | Tom: ${brief.tom_comunicacao}
Benefícios cliente final: ${brief.beneficios_cliente_final.join("; ")}

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

Post 1: Apresentação amigável da marca/produto com benefícios para o laboratório.
Post 2: Oferta ${brief.oferta_promocional} com urgência, emojis e CTA claro.`);

  const raw = await callLLM(prompt);
  return parseJSON<{ posts: FacebookPost[] }>(raw, "Facebook").posts;
}

// ─── Instagram ────────────────────────────────────────────────────────────────

export async function generateInstagramData(
  texto: string,
  brief: StructuredBrief,
  nomeCampanha: string,
): Promise<InstagramData> {
  const prompt = withRole(`Você é especialista em Instagram marketing para o setor laboratorial.

Com base no TEXTO e BRIEF, crie 1 carrossel e 1 roteiro de Reels para Instagram.

TEXTO: ${texto}
Marca: ${brief.marca} | Campanha: ${nomeCampanha} | Oferta: ${brief.oferta_promocional} | Tom: ${brief.tom_comunicacao}
Subcategorias: ${brief.subcategorias.join(", ")}

Retorne SOMENTE JSON válido:
{
  "carrossel": {
    "slides": [
      { "numero": 1, "visual": "descrição do visual/imagem", "texto": "Texto do slide (curto, impactante)", "cor": "#6C63FF" },
      { "numero": 2, "visual": "...", "texto": "...", "cor": "#7C3AED" }
    ],
    "legenda": "Legenda completa do post com emoji e CTA",
    "hashtags": ["hashtag1", "hashtag2", "hashtag3"]
  },
  "reels": {
    "duracao": "20s",
    "cenas": [
      { "tempo": "0-3s", "visual": "visual da cena", "texto": "Texto na tela", "locucao": "Fala do narrador" }
    ],
    "legenda": "Legenda do reels com CTA",
    "musica": "Sugestão de estilo musical",
    "hashtags": ["hashtag1", "hashtag2"]
  }
}

Carrossel: 5-7 slides. Slide 1 = capa impactante com ${brief.marca}. Slides 2-5 = benefícios/produtos. Último = CTA.
Reels: 15-25s, 4-6 cenas de 3-5s cada. Use cores da paleta: #6C63FF, #7C3AED, #A78BFA, #F59E0B, #10B981`);

  const raw = await callLLM(prompt);
  return parseJSON<InstagramData>(raw, "Instagram");
}

// ─── Roteiro de Vídeo ─────────────────────────────────────────────────────────

export async function generateVideoRoteiro(
  texto: string,
  brief: StructuredBrief,
  nomeCampanha: string,
): Promise<VideoRoteiro> {
  const prompt = withRole(`Você é diretor criativo especialista em vídeos curtos para redes sociais (Reels, Shorts, TikTok).

Com base no TEXTO e BRIEF, crie um roteiro de vídeo 15-30s profissional e dinâmico.

TEXTO: ${texto}
Marca: ${brief.marca} | Campanha: ${nomeCampanha} | Oferta: ${brief.oferta_promocional} | Tom: ${brief.tom_comunicacao}
Diferenciais: ${brief.diferenciais_tecnicos.join("; ")}

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
      "locucao": "Texto exato da narração/locução",
      "musica": "Descrição do som/música nesta cena"
    }
  ],
  "cta": "Call-to-action final do vídeo",
  "legenda": "Legenda para postar nas redes (com emojis e hashtags)"
}

REGRAS:
- 5-7 cenas de 3-5s cada
- Cena 1: Hook impactante em 3s (pergunta ou dado surpreendente sobre ${brief.subcategorias[0] ?? brief.marca})
- Cenas 2-4: Produto em ação, diferenciais rápidos (${brief.diferenciais_tecnicos.slice(0, 2).join(", ")})
- Cena 5-6: Oferta ${brief.oferta_promocional} com visual da promoção
- Cena final: CTA direto com urgência
- Locação coerente com ambiente de laboratório`);

  const raw = await callLLM(prompt);
  return parseJSON<VideoRoteiro>(raw, "Roteiro de vídeo");
}
