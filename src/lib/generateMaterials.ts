// Real AI material generation using OpenAI or Gemini
import { type StructuredBrief, type MaterialKey } from "./store";
import { loadAIConfig, isOpenAIModel, type AIModel } from "./aiConfig";

// ─── Gemini model ID mapping ──────────────────────────────────────────────────
// Maps our internal model keys to the actual Gemini API model IDs.
const GEMINI_API_IDS: Record<string, string> = {
  "gemini-2.5-flash":      "gemini-2.5-flash-preview-04-17",
  "gemini-2.5-flash-lite": "gemini-2.5-flash-lite-preview-06-17",
  "gemini-2.5-pro":        "gemini-2.5-pro-preview-05-06",
  "gemini-3-flash":        "gemini-2.0-flash",
  "gemini-3.1-flash":      "gemini-2.5-flash-preview-04-17",
  "gemini-3.1-pro":        "gemini-2.5-pro-preview-05-06",
};

function geminiModelId(model: AIModel): string {
  return GEMINI_API_IDS[model] ?? "gemini-2.5-flash-preview-04-17";
}

// ─── Retry helper ─────────────────────────────────────────────────────────────
// Retries on 429 (rate limit) and 503 (overload) with exponential backoff.
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelayMs = 8000,
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = (err as Error).message ?? "";
      const isRetryable = msg.includes("429") || msg.includes("503") || msg.includes("RESOURCE_EXHAUSTED");
      if (!isRetryable || attempt === retries) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt); // 8s, 16s, 32s
      console.warn(`[BriefFlow] Retry ${attempt + 1}/${retries} in ${delay}ms — ${msg}`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("Max retries exceeded");
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function briefContext(brief: StructuredBrief): string {
  return `
=== BRIEF ESTRUTURADO ===
Marca: ${brief.marca}
Campanha: ${brief.campanha}
Público-alvo: ${brief.publico_alvo}
Proposta comercial: ${brief.proposta_comercial}
Oferta promocional: ${brief.oferta_promocional}
Subcategorias: ${brief.subcategorias.join(", ")}
Diferenciais técnicos: ${brief.diferenciais_tecnicos.join("; ")}
Benefícios para revendedor: ${brief.beneficios_revendedor.join("; ")}
Benefícios para cliente final: ${brief.beneficios_cliente_final.join("; ")}
Objeções/argumentos: ${brief.objecoes_argumentos.map((o) => `[${o.objecao}] → ${o.argumento}`).join(" | ")}
Tom de comunicação: ${brief.tom_comunicacao}
Observações: ${brief.observacoes}
=========================
`.trim();
}

const SYSTEM_ROLE =
  "Você é um especialista em marketing B2B e copywriting para o setor laboratorial. " +
  "Escreva em português brasileiro, tom profissional mas acessível. " +
  "Responda SOMENTE com o conteúdo solicitado, sem explicações adicionais.";

const PROMPTS: Record<MaterialKey, (brief: StructuredBrief, customPrompt?: string) => string> = {
  podcast_revendedores: (b, custom) =>
    custom ||
    `${briefContext(b)}

Crie um ROTEIRO DE PODCAST DE 5 MINUTOS para revendedores de laboratório.
Estrutura obrigatória:
[INTRO 0:00–0:20] Abertura impactante mencionando a oferta
[BLOCO 1 — Contexto 0:20–1:30] Por que a linha ${b.marca} é relevante agora
[BLOCO 2 — Subcategorias 1:30–3:00] Destaque rápido de cada subcategoria: ${b.subcategorias.join(", ")}
[BLOCO 3 — Argumentos comerciais 3:00–4:20] Benefícios para o revendedor, diferenciais técnicos
[CTA 4:20–5:00] Chamada à ação clara com urgência, mencionando: ${b.oferta_promocional}
Tom: ${b.tom_comunicacao}. Pegada comercial. Use linguagem de especialista B2B.`,

  apresentacao_slides: (b, custom) =>
    custom ||
    `${briefContext(b)}

Crie uma APRESENTAÇÃO DE 10 SLIDES para capacitação técnica de revendedores.
Para cada slide, forneça: número, título e 3-5 bullets objetivos.
Estrutura sugerida:
1. Capa (campanha + marca)
2. Quem é a ${b.marca} (posicionamento global)
3. Por que pipetadores de qualidade importam
4-8. Linha completa: ${b.subcategorias.join(", ")} — distribua conforme relevância
9. Oferta: ${b.oferta_promocional}
10. Próximos passos e contato
Foco: Capacitação Técnica. Tom: ${b.tom_comunicacao}.`,

  folheto_a4: (b, custom) =>
    custom ||
    `${briefContext(b)}

Crie o TEXTO COMPLETO DE UM FOLHETO PROMOCIONAL A4 para cliente final de laboratório.
Incluir obrigatoriamente:
- Título chamativo com a oferta: ${b.oferta_promocional}
- Subtítulo de posicionamento
- Apresentação da linha com os produtos: ${b.subcategorias.join(", ")}
- Box de destaques técnicos: ${b.diferenciais_tecnicos.join("; ")}
- Bloco de benefícios para o usuário final
- Rodapé com CTA e informações da distribuidora
Foco: Promocional. Linguagem acessível para técnicos e compradores de laboratório.`,

  ficha_tecnica: (b, custom) =>
    custom ||
    `${briefContext(b)}

Crie uma FICHA TÉCNICA INTERNA para vendedores da Forlab.
Formato estruturado com:
- Cabeçalho: marca, linha, distribuidora, vigência da campanha
- Lista por subcategoria com 2-3 diferenciais chave de cada: ${b.subcategorias.join(", ")}
- Mecânica comercial: ${b.oferta_promocional}
- Argumentário rápido: ${b.beneficios_revendedor.join("; ")}
- Quebra de objeções: ${b.objecoes_argumentos.map((o) => `"${o.objecao}" → ${o.argumento}`).join(" | ")}
- Alerta de vigência e urgência
Tom: direto, técnico, uso interno.`,

  emails_revendedores: (b, custom) =>
    custom ||
    `${briefContext(b)}

Crie uma SEQUÊNCIA DE 2 EMAILS DE MARKETING para revendedores.

E-MAIL 1 — Apresentação das Subcategorias:
Assunto: impactante, mencionando a linha ${b.marca}
Corpo: apresentar cada subcategoria (${b.subcategorias.join(", ")}) com 1-2 linhas sobre aplicação e diferencial. Finalizar com gancho para próximo email.

E-MAIL 2 — Oferta:
Assunto: urgência + oferta
Corpo: reforçar diferenciais técnicos, apresentar mecânica (${b.oferta_promocional}), benefícios de margem para o revendedor, CTA claro.

Separe os emails com === E-MAIL 1 === e === E-MAIL 2 ===`,

  emails_cliente_final: (b, custom) =>
    custom ||
    `${briefContext(b)}

Crie uma SEQUÊNCIA DE 3 EMAILS DE MARKETING para cliente final (laboratórios).

E-MAIL 1 — TOPO DE FUNIL: posicionamento ${b.marca}, tipos de pipetadores (${b.subcategorias.join(", ")}), ecossistema Forlab.
E-MAIL 2 — MEIO DE FUNIL: diferenciais técnicos vs. concorrentes, importância do ecossistema completo.
E-MAIL 3 — FUNDO DE FUNIL: ${b.oferta_promocional}, CTA direto.

Separe com === E-MAIL 1 ===, === E-MAIL 2 ===, === E-MAIL 3 ===`,

  posts_linkedin: (b, custom) =>
    custom ||
    `${briefContext(b)}

Crie 2 POSTS PARA LINKEDIN (público B2B — gestores, compradores técnicos, revendedores).
Post 1: autoridade técnica, diferenciais de qualidade. Tom profissional. Máx 150 palavras + 3-5 hashtags.
Post 2: oferta ${b.oferta_promocional}, benefícios para o laboratório, CTA. Máx 150 palavras + hashtags.
Separe com [POST 1] e [POST 2].`,

  posts_facebook: (b, custom) =>
    custom ||
    `${briefContext(b)}

Crie 2 POSTS PARA FACEBOOK para público misto (técnicos e compradores).
Post 1: apresentação da linha ${b.marca} de forma acessível. Tom amigável. Máx 120 palavras.
Post 2: oferta ${b.oferta_promocional} com urgência. Inclua emojis relevantes, CTA claro. Máx 100 palavras.
Separe com [POST 1] e [POST 2].`,

  posts_instagram: (b, custom) =>
    custom ||
    `${briefContext(b)}

Crie 2 CONCEITOS DE POSTS PARA INSTAGRAM.
Post 1 — Carrossel educativo: capa, 4-5 slides com conteúdo e visual sugerido, slide de CTA. Legenda + hashtags.
Post 2 — Reels/Stories 15-30s: roteiro cena a cena com visual, texto overlay e música sugerida. Legenda curta + hashtags.
Separe com [POST 1 — Carrossel] e [POST 2 — Reels].`,

  roteiro_video_curto: (b, custom) =>
    custom ||
    `${briefContext(b)}

Crie um ROTEIRO DE VÍDEO CURTO DE 15-30 SEGUNDOS para Reels e YouTube Shorts.
Formato cena a cena: [0–Xs] Visual | Texto na tela | Locução | Música sugerida
Requisitos: abertura impactante nos primeiros 3s, produto em uso real, oferta ${b.oferta_promocional} visualmente, CTA final.
Tom: ${b.tom_comunicacao}. Adequado para 9:16 e 16:9.`,
};

// ─── API callers ──────────────────────────────────────────────────────────────

async function callOpenAI(prompt: string, model: AIModel, apiKey: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_ROLE },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OpenAI error ${res.status}: ${(err as { error?: { message?: string } }).error?.message ?? res.statusText}`);
  }
  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

async function callGemini(prompt: string, model: AIModel, apiKey: string): Promise<string> {
  const apiModel = geminiModelId(model);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_ROLE }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2000 },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { error?: { message?: string } }).error?.message ?? res.statusText;
    throw new Error(`Gemini error ${res.status}: ${msg}`);
  }
  const data = await res.json();
  return (data.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
}

async function callAI(prompt: string): Promise<string> {
  const config = loadAIConfig();
  const { model } = config;
  if (isOpenAIModel(model)) {
    if (!config.openaiKey) throw new Error("Chave OpenAI não configurada em Configurações.");
    return withRetry(() => callOpenAI(prompt, model, config.openaiKey));
  } else {
    if (!config.geminiKey) throw new Error("Chave Gemini não configurada em Configurações.");
    return withRetry(() => callGemini(prompt, model, config.geminiKey));
  }
}

// ─── Brief inference ──────────────────────────────────────────────────────────

export async function inferBriefFromTranscriptAI(nome: string, transcricao: string): Promise<string> {
  const config = loadAIConfig();
  const customPrompt = config.prompts["brief"];

  const prompt =
    customPrompt ||
    `A partir da transcrição/briefing abaixo, extraia um JSON estruturado com os campos:
marca, campanha, publico_alvo, proposta_comercial, oferta_promocional,
subcategorias (array), diferenciais_tecnicos (array), beneficios_revendedor (array),
beneficio_cliente_final (array), objecoes_argumentos (array de {objecao, argumento}),
tom_comunicacao, observacoes, inferencias_ia (array — campos onde você inferiu sem dado explícito).

Não invente categorias fixas. Use SOMENTE o que está na transcrição. Responda APENAS com JSON válido, sem markdown.

Nome da campanha: ${nome}

=== TRANSCRIÇÃO ===
${transcricao}
===================`;

  return callAI(prompt);
}

// ─── Generate all materials ───────────────────────────────────────────────────

export type GenerationProgress = {
  current: number;
  total: number;
  key: MaterialKey;
  label: string;
};

const MATERIAL_LABELS: Record<MaterialKey, string> = {
  podcast_revendedores: "Podcast 5 min",
  apresentacao_slides: "Apresentação 10 slides",
  folheto_a4: "Folheto A4",
  ficha_tecnica: "Ficha técnica",
  emails_revendedores: "E-mails revendedores",
  emails_cliente_final: "E-mails cliente final",
  posts_linkedin: "Posts LinkedIn",
  posts_facebook: "Posts Facebook",
  posts_instagram: "Posts Instagram",
  roteiro_video_curto: "Roteiro de vídeo",
};

export async function generateAllMaterials(
  brief: StructuredBrief,
  onProgress?: (p: GenerationProgress) => void,
): Promise<Partial<Record<MaterialKey, string>>> {
  const config = loadAIConfig();
  const keys = Object.keys(PROMPTS) as MaterialKey[];
  const results: Partial<Record<MaterialKey, string>> = {};

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    onProgress?.({ current: i + 1, total: keys.length, key, label: MATERIAL_LABELS[key] });

    const customPrompt = config.prompts[key];
    const prompt = PROMPTS[key](brief, customPrompt);

    try {
      results[key] = await callAI(prompt);
    } catch (err) {
      results[key] = `[ERRO ao gerar este material]\n${(err as Error).message}`;
    }

    // Pausa entre materiais para respeitar o rate limit do free tier (ex: 10 req/min)
    if (i < keys.length - 1) {
      await new Promise((r) => setTimeout(r, 6500));
    }
  }

  return results;
}
