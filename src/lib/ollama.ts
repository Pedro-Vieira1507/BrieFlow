// lib/ollama.ts — Núcleo da IA BrieFlow (Corrigido)
import type { BuilderState, BrandContext, DiscoveryPlan, CampaignAsset } from "@/types/builder";
import { formatSiteContextForAgent } from "@/lib/scrape-site";

// ─── PROMPTS PROFISSIONAIS DE MARKETING PREMIUM ───────────────────────────────

const DISCOVERY_AGENT_PROMPT = (
  currentPlan: DiscoveryPlan | undefined,
  brandContext: BrandContext,
) => `Você é o **BrieFlow Creative Director** — um diretor de criação sênior especializado em marketing digital premium. 
Sua missão é conduzir um briefing conversacional para produzir peças de altíssima qualidade: banners, posts de redes sociais e e-mails marketing.

=== REGRAS DE CONVERSA (OBRIGATÓRIAS) ===
1. Tom: profissional, criativo, acolhedor e direto. Sem jargão vazio. Sem clichês. Máximo 1 emoji se fizer sentido.
2. UMA pergunta por vez. NUNCA faça listas de perguntas.
3. Valide a resposta anterior em 1 frase curta antes da próxima pergunta.
4. Se o usuário trouxer muita informação de uma vez, extraia o essencial e avance o plano.
5. Se houver DADOS DO SITE abaixo, use-os: confirme a marca/produto e NUNCA peça informação que já tem.

=== DADOS DO SITE (quando disponíveis) ===
${
  brandContext.site
    ? formatSiteContextForAgent(brandContext.site)
    : "Nenhum site analisado ainda. Se o usuário enviar uma URL, peça para colar o link completo."
}

=== CONTEXTO DE MARCA ===
Persona: ${brandContext.persona}
Tom desejado: ${brandContext.tone}
Framework: ${brandContext.framework}
${brandContext.brandName ? `Marca: ${brandContext.brandName}` : ""}
${brandContext.product ? `Produto: ${brandContext.product}` : ""}

=== MEMÓRIA DO PLANO ATUAL ===
${currentPlan ? JSON.stringify(currentPlan, null, 2) : "Sem dados. Comece pelo Passo 1."}

=== ROTEIRO DE QUALIFICAÇÃO PREMIUM (ordem flexível, adapte à conversa) ===
Passo 1 — Site ou marca/produto (peça a URL se ainda não houver)
Passo 2 — Objetivo da peça (lançamento, lead gen, remarketing, awareness, promoção, fidelização...)
Passo 3 — Público-alvo (perfil demográfico + psicográfico: quem deve se sentir representado?)
Passo 4 — Oferta principal / Diferencial / CTA desejado e canais (banner, e-mail, post — ou todos)
Passo 5 — FECHAMENTO: Resuma o briefing em 3-5 linhas claras e pergunte se pode gerar as peças agora.

Quando chegar no Passo 5:
- missingInfo = "Nenhuma"
- proposedStrategy deve listar exatamente as peças a gerar com o ângulo criativo de cada uma
- Exemplo: "Banner (hero com produto + CTA forte) + E-mail (storytelling de lançamento) + Post Instagram (lifestyle + UGC)"

=== RETORNO OBRIGATÓRIO (JSON ESTRITO) ===
Responda ESTRITAMENTE em JSON. Nenhum texto fora do JSON.
{
  "chat": "Sua resposta conversacional (validação + próxima pergunta OU fechamento).",
  "builder": {
    "type": "discovery_plan",
    "discoveryPlan": {
      "detectedContext": "Resumo atualizado e estruturado do que já sabe sobre a marca/produto/objetivo.",
      "missingInfo": "O que ainda falta coletar. Se completo: 'Nenhuma'",
      "proposedStrategy": "Peças e ângulo criativo de cada uma. Se ainda coletando: 'Aguardando dados...'",
      "brandName": "nome da marca se souber, null se não souber",
      "product": "produto/serviço se souber, null se não souber",
      "audience": "público-alvo se souber, null se não souber",
      "offer": "oferta/CTA se souber, null se não souber",
      "channels": ["banner", "email", "social"],
      "websiteUrl": "url se houver, null se não houver"
    }
  }
}`;

const EXECUTION_AGENT_PROMPT = (
  ctx: BrandContext,
  plan: DiscoveryPlan | undefined,
  targetAsset: string,
) => `Você é o **BrieFlow Execution Agent** — Diretor de Criação de Marketing Premium com 15+ anos de experiência em agências top.
Gere APENAS a peça solicitada com qualidade de agência de primeira linha (copy persuasiva + direção de arte impecável).

=== BRIEFING APROVADO ===
${plan ? JSON.stringify(plan, null, 2) : "Use o histórico da conversa."}

=== DADOS DO SITE / MARCA ===
${ctx.site ? formatSiteContextForAgent(ctx.site) : "Sem site. Use o briefing."}
Tom: ${ctx.tone}
Persona: ${ctx.persona}
${ctx.brandName ? `Marca: ${ctx.brandName}` : ""}

=== TAREFA ATUAL ===
GERAR APENAS: ${targetAsset.toUpperCase()}

=== FRAMEWORKS DE COPYWRITING (APLICAR OBRIGATORIAMENTE) ===
1. **AIDA**: Atenção (headline magnética) → Interesse (benefício concreto) → Desejo (prova/social proof) → Ação (CTA claro)
2. **Princípios de Cialdini**: Reciprocidade, Prova Social, Autoridade, Escassez, Compromisso
3. **Storytelling**: Começar com situação → Conflito → Resolução (produto como herói)
4. **Regra de 3**: Três benefícios principais, não mais
5. **CTA de alta conversão**: Verbo de ação + benefício + urgência sutil

=== PADRÃO PREMIUM OBRIGATÓRIO ===
1. Copy em português do Brasil, elegante, persuasiva e SEM clichês:
   ❌ Proibido: "revolucionário", "melhor do mercado", "não perca", "última chance", "imperdível"
   ✅ Prefira: benefício concreto, número específico, prova social, pergunta que desperta curiosidade
2. Frases curtas e impactantes. Benefício > feature SEMPRE.
3. imagePrompt e emailHeroImagePrompt SEMPRE em INGLÊS, fotográficos/cinemáticos, SEM texto na imagem.
4. Respeite a identidade da marca quando houver site (setor, produto, tom, cores inferidas).
5. Cada palavra deve ter propósito. Zero enchimento.

${
  targetAsset === "banner"
    ? `=== BANNER PREMIUM ===
- title: MÁXIMO 5 palavras, punchy e magnético. Deve parar o scroll.
- subtitle: 1 linha de benefício concreto (máx 18 palavras). NÃO repita o title.
- cta: 2-4 palavras, verbo de ação + benefício (ex: "Começar Teste Grátis")
- imagePrompt fórmula: "[hero subject related to brand/product] on the far right third, cinematic commercial lighting, [relevant premium environment], massive empty dark negative space on the left two-thirds for typography, ultra premium advertising photography, shot on Hasselblad, 8k, no text, no watermark"`
    : ""
}
${
  targetAsset === "email"
    ? `=== E-MAIL MARKETING PREMIUM ===
- preheader: 40-80 chars, instigante, complementa o assunto (não repete)
- title: assunto de e-mail que ABRE (curiosidade + benefício, máx 50 chars)
- subtitle: linha de apoio opcional (máx 12 palavras)
- body: 2-3 parágrafos curtos separados por \\n\\n:
  Parágrafo 1: Hook (pergunta ou situação que conecta com a dor do público)
  Parágrafo 2: Solução (apresenta o produto/benefício com prova social)
  Parágrafo 3: CTA expandido (1 frase que reforça a urgência/benefício)
- cta: botão claro, verbo de ação (ex: "Quero Aproveitar")
- footerText: linha legal simples e profissional
- emailHeroImagePrompt: fotografia comercial premium em INGLÊS, wide cinematic hero 2:1, sem texto, estética de campanha de alto padrão`
    : ""
}
${
  targetAsset === "social"
    ? `=== POST SOCIAL PREMIUM (Instagram) ===
- caption: 2-4 linhas engajadoras que param o scroll:
  Linha 1: Hook magnético (pergunta ou afirmação ousada)
  Linha 2-3: Benefício ou storytelling curto
  Linha 4: CTA sutil (não agressivo — combinar com vibe da marca)
- hashtags: array com 5-8 hashtags relevantes (com #), mix de branded + descoberta + nicho
- imagePrompt: vertical 4:5 commercial photo em INGLÊS, sem texto, estética premium de feed do Instagram, lighting editorial`
    : ""
}

=== RETORNO OBRIGATÓRIO (JSON ESTRITO) ===
{
  "chat": "Confirmação breve de que a peça foi gerada. Máx 2 frases.",
  "builder": {
    "type": "campaign",
    "campaignAssets": [
       ${
         targetAsset === "banner"
           ? `{ "id": "banner-1", "type": "banner", "status": "draft", "content": { "type": "banner", "brandName": "...", "title": "...", "subtitle": "...", "cta": "...", "imagePrompt": "..." } }`
           : ""
       }
       ${
         targetAsset === "email"
           ? `{ "id": "email-1", "type": "email", "status": "draft", "content": { "type": "email", "brandName": "...", "preheader": "...", "emailHeroImagePrompt": "...", "title": "...", "subtitle": "...", "body": "...", "cta": "...", "footerText": "..." } }`
           : ""
       }
       ${
         targetAsset === "social"
           ? `{ "id": "social-1", "type": "social", "status": "draft", "content": { "type": "social", "brandName": "...", "caption": "...", "hashtags": ["#a", "#b", "#c"], "imagePrompt": "..." } }`
           : ""
       }
    ]
  },
  "scores": { "persuasion": 0-100, "clarity": 0-100, "seo": 0-100 }
}`;

// ─── TIPOS ───────────────────────────────────────────────────────────────────

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OllamaResponse {
  chat: string;
  builder: BuilderState;
  scores?: { persuasion: number; clarity: number; seo: number };
}

// ─── PARSER DE JSON ROBUSTO ──────────────────────────────────────────────────

function tryParseJson(text: string): OllamaResponse | null {
  let cleanText = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  cleanText = cleanText.replace(/```json/gi, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(cleanText) as OllamaResponse;
  } catch {
    // Continua
  }

  const jsonMatch = extractBalancedJson(cleanText);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch) as OllamaResponse;
    } catch {
      // Continua
    }
  }

  const simpleMatch = cleanText.match(/\{[\s\S]*\}/);
  if (simpleMatch) {
    try {
      return JSON.parse(simpleMatch[0]) as OllamaResponse;
    } catch {
      // Falha total
    }
  }

  return null;
}

function extractBalancedJson(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === "\\") {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

// ─── CONFIGURAÇÃO DE MODELOS ─────────────────────────────────────────────────

function resolveOllamaApiUrl(): string {
  let apiUrl = "http://localhost:11434/api/chat";

  if (typeof window !== "undefined") {
    const envUrl = import.meta.env.VITE_OLLAMA_API_URL as string | undefined;
    if (envUrl) {
      apiUrl = `${envUrl
        .replace("/v1/chat/completions", "")
        .replace("/api/chat", "")}/api/chat`;
    } else {
      apiUrl = `http://${window.location.hostname}:11434/api/chat`;
    }
  } else {
    const envUrl = import.meta.env.VITE_OLLAMA_API_URL as string | undefined;
    if (envUrl) {
      apiUrl = `${envUrl
        .replace("/v1/chat/completions", "")
        .replace("/api/chat", "")}/api/chat`;
    }
  }

  return apiUrl;
}

function pickModels(wantsExecution: boolean): string {
  const discoveryModel =
    (import.meta.env.VITE_OLLAMA_DISCOVERY_MODEL as string | undefined) ||
    "qwen2.5:7b";
  const executionModel =
    (import.meta.env.VITE_OLLAMA_EXECUTION_MODEL as string | undefined) ||
    "qwen2.5:32b";

  return wantsExecution ? executionModel : discoveryModel;
}

// ─── VALIDAÇÃO DE CONTEÚDO GERADO ────────────────────────────────────────────

function validateAsset(asset: CampaignAsset, targetAsset: string): boolean {
  if (!asset.content) return false;
  const c = asset.content;

  switch (targetAsset) {
    case "banner":
      return Boolean(c.title && c.imagePrompt);
    case "email":
      return Boolean(c.title && c.body && c.cta);
    case "social":
      return Boolean(c.caption && c.imagePrompt);
    default:
      return false;
  }
}

// ─── FUNÇÃO PRINCIPAL ────────────────────────────────────────────────────────

export async function sendToOllama(
  history: ChatTurn[],
  brandContext: BrandContext,
  currentPlan?: DiscoveryPlan,
  onStream?: (partialChat: string) => void,
  targetAsset?: string,
): Promise<OllamaResponse> {
  const apiUrl = resolveOllamaApiUrl();
  const wantsExecution = !!targetAsset;
  const systemPrompt = wantsExecution
    ? EXECUTION_AGENT_PROMPT(brandContext, currentPlan, targetAsset!)
    : DISCOVERY_AGENT_PROMPT(currentPlan, brandContext);

  const recentHistory = history.slice(-10);
  const messages: ChatTurn[] = [
    { role: "system", content: systemPrompt },
    ...recentHistory,
  ];

  const modelToUse = pickModels(wantsExecution);
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    wantsExecution ? 300_000 : 120_000,
  );

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelToUse,
        messages,
        stream: true,
        format: "json",
        options: {
          temperature: wantsExecution ? 0.7 : 0.55,
          top_p: 0.9,
          num_predict: wantsExecution ? 4096 : 1200,
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `Ollama HTTP ${res.status}${errText ? `: ${errText.slice(0, 200)}` : ""}`,
      );
    }

    if (!res.body) throw new Error("Streaming não suportado pelo servidor.");

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let rawJson = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter(Boolean);

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.message?.content) {
            rawJson += parsed.message.content;

            if (onStream && !wantsExecution) {
              const partial = extractChatField(rawJson);
              if (partial) onStream(partial);
            }
          }
        } catch {
          // Linha NDJSON parcial
        }
      }
    }

    clearTimeout(timeoutId);

    const parsed = tryParseJson(rawJson);
    if (!parsed) {
      return {
        chat: "Tive uma oscilação ao processar a resposta. Pode reenviar ou reformular?",
        builder: currentPlan
          ? { type: "discovery_plan", discoveryPlan: currentPlan }
          : { type: "none" },
      };
    }

    if (!parsed.builder) {
      const rawParsed = parsed as Record<string, unknown>;
      if (rawParsed.campaignAssets || rawParsed.type === "campaign") {
        parsed.builder = {
          type: "campaign",
          campaignAssets: (rawParsed.campaignAssets as CampaignAsset[]) || [],
        };
      } else if (
        rawParsed.type === "email" ||
        rawParsed.type === "banner" ||
        rawParsed.type === "social"
      ) {
        parsed.builder = {
          type: "campaign",
          campaignAssets: [
            {
              id: `asset-${Math.random().toString(36).substring(7)}`,
              type: rawParsed.type as "email" | "banner" | "social",
              status: "draft",
              content: rawParsed as unknown as BuilderState,
            },
          ],
        };
      } else {
        parsed.builder = currentPlan
          ? { type: "discovery_plan", discoveryPlan: currentPlan }
          : { type: "none" };
      }
    }

    if (parsed.builder.type === "campaign" && parsed.builder.campaignAssets) {
      parsed.builder.campaignAssets = parsed.builder.campaignAssets.filter(
        (asset) => validateAsset(asset, targetAsset || asset.type),
      );
    }

    if (!parsed.chat) {
      parsed.chat = wantsExecution
        ? "Peça gerada com qualidade premium. Confira no painel ao lado."
        : "Pode me contar um pouco mais sobre a campanha?";
    }

    return parsed;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const error = err as { name?: string; message?: string };
    if (error.name === "AbortError") {
      throw new Error(
        wantsExecution
          ? "A IA demorou demais para criar esta peça (limite de 5 minutos). Tente novamente ou simplifique o briefing."
          : "O servidor de IA não respondeu a tempo (limite de 2 minutos).",
      );
    }
    throw new Error(`Falha de rede com a IA: ${error.message ?? String(err)}`);
  }
}

// ─── EXTRAÇÃO INCREMENTAL DO CAMPO CHAT ──────────────────────────────────────

function extractChatField(rawJson: string): string | null {
  const chatKeyMatch = rawJson.match(/"chat"\s*:\s*"/);
  if (!chatKeyMatch) return null;

  const startIdx = chatKeyMatch.index! + chatKeyMatch[0].length;
  let result = "";
  let i = startIdx;

  while (i < rawJson.length) {
    const char = rawJson[i];

    if (char === "\\" && i + 1 < rawJson.length) {
      const next = rawJson[i + 1];
      switch (next) {
        case "n": result += "\n"; break;
        case '"': result += '"'; break;
        case "\\": result += "\\"; break;
        case "t": result += "\t"; break;
        case "r": result += "\r"; break;
        default: result += next;
      }
      i += 2;
      continue;
    }

    if (char === '"') {
      return result;
    }

    result += char;
    i++;
  }

  return result;
}