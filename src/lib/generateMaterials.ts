// Real AI material generation using OpenAI or Gemini
import { type StructuredBrief, type MaterialKey } from "./store";
import { loadAIConfig, isOpenAIModel, geminiApiId, type AIModel } from "./aiConfig";

// ─── Retry helper (respeita Retry-After do Gemini) ────────────────────────────
async function withRetry<T>(
  fn: () => Promise<T & { _retryAfterMs?: number }>,
  retries = 3,
): Promise<T> {
  let lastError: Error = new Error("Max retries exceeded");
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn() as T;
    } catch (err) {
      lastError = err as Error;
      const msg = lastError.message ?? "";
      const isRetryable = msg.includes("429") || msg.includes("503") || msg.includes("RESOURCE_EXHAUSTED");
      if (!isRetryable || attempt === retries) throw lastError;

      // Extrai o tempo sugerido pelo Gemini ("Please retry in 47.9s")
      const retryMatch = msg.match(/retry in (\d+(?:\.\d+)?)s/);
      const suggestedMs = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) * 1000 : 0;
      const backoffMs = Math.max(suggestedMs, 12000 * Math.pow(2, attempt)); // mínimo 12s, 24s, 48s

      console.warn(`[BriefFlow] Retry ${attempt + 1}/${retries} in ${(backoffMs / 1000).toFixed(0)}s`);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  throw lastError;
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
[INTRO 0:00–0:20] Abertura impactante mencionando a oferta
[BLOCO 1 0:20–1:30] Por que a linha ${b.marca} é relevante agora
[BLOCO 2 1:30–3:00] Subcategorias: ${b.subcategorias.join(", ")}
[BLOCO 3 3:00–4:20] Benefícios para revendedor, diferenciais técnicos
[CTA 4:20–5:00] Chamada à ação com urgência: ${b.oferta_promocional}
Tom: ${b.tom_comunicacao}.`,

  apresentacao_slides: (b, custom) =>
    custom ||
    `${briefContext(b)}

Crie uma APRESENTAÇÃO DE 10 SLIDES para capacitação de revendedores.
Cada slide: número, título, 3-5 bullets.
Slide 1: Capa. Slide 2: Quem é ${b.marca}. Slide 3: Por que qualidade importa.
Slides 4-8: Subcategorias (${b.subcategorias.join(", ")}).
Slide 9: Oferta (${b.oferta_promocional}). Slide 10: Próximos passos.`,

  folheto_a4: (b, custom) =>
    custom ||
    `${briefContext(b)}

Crie texto de FOLHETO A4 PROMOCIONAL para cliente final.
Incluir: título com oferta (${b.oferta_promocional}), subtítulo, produtos (${b.subcategorias.join(", ")}), destaques técnicos, benefícios, CTA.`,

  ficha_tecnica: (b, custom) =>
    custom ||
    `${briefContext(b)}

Crie FICHA TÉCNICA INTERNA para vendedores.
Cabeçalho + subcategorias com diferenciais + mecânica (${b.oferta_promocional}) + argumentário + quebra de objeções. Tom direto, uso interno.`,

  emails_revendedores: (b, custom) =>
    custom ||
    `${briefContext(b)}

2 E-MAILS para revendedores.
E-MAIL 1: apresentação das subcategorias (${b.subcategorias.join(", ")}) com aplicação e diferencial.
E-MAIL 2: oferta (${b.oferta_promocional}), margem para revendedor, CTA urgente.
Separe com === E-MAIL 1 === e === E-MAIL 2 ===`,

  emails_cliente_final: (b, custom) =>
    custom ||
    `${briefContext(b)}

3 E-MAILS para laboratórios.
E-MAIL 1 — Topo: ${b.marca}, tipos de pipetadores, ecossistema Forlab.
E-MAIL 2 — Meio: diferenciais vs. concorrentes.
E-MAIL 3 — Fundo: ${b.oferta_promocional}, CTA direto.
Separe com === E-MAIL 1 ===, === E-MAIL 2 ===, === E-MAIL 3 ===`,

  posts_linkedin: (b, custom) =>
    custom ||
    `${briefContext(b)}

2 POSTS LINKEDIN (B2B).
Post 1: autoridade técnica, máx 150 palavras + hashtags.
Post 2: oferta ${b.oferta_promocional}, CTA, máx 150 palavras + hashtags.
Separe com [POST 1] e [POST 2].`,

  posts_facebook: (b, custom) =>
    custom ||
    `${briefContext(b)}

2 POSTS FACEBOOK.
Post 1: apresentação ${b.marca}, amigável, máx 120 palavras.
Post 2: oferta ${b.oferta_promocional} + urgência + emojis, máx 100 palavras.
Separe com [POST 1] e [POST 2].`,

  posts_instagram: (b, custom) =>
    custom ||
    `${briefContext(b)}

2 POSTS INSTAGRAM.
Post 1 — Carrossel: capa + 4-5 slides + CTA. Legenda + hashtags.
Post 2 — Reels 15-30s: roteiro cena a cena + música + legenda.
Separe com [POST 1 — Carrossel] e [POST 2 — Reels].`,

  roteiro_video_curto: (b, custom) =>
    custom ||
    `${briefContext(b)}

ROTEIRO VÍDEO 15-30s para Reels e Shorts.
Cena a cena: [Xs–Ys] Visual | Texto na tela | Locução | Música.
Abertura impactante em 3s, produto em uso, oferta (${b.oferta_promocional}), CTA final. Tom: ${b.tom_comunicacao}.`,
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
  const apiModel = geminiApiId(model);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_ROLE }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
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
    `Extraia um JSON estruturado da transcrição abaixo com os campos:
marca, campanha, publico_alvo, proposta_comercial, oferta_promocional,
subcategorias (array), diferenciais_tecnicos (array), beneficios_revendedor (array),
beneficio_cliente_final (array), objecoes_argumentos (array de {objecao, argumento}),
tom_comunicacao, observacoes, inferencias_ia (array).
Use SOMENTE o que está na transcrição. Responda APENAS com JSON válido, sem markdown.

Nome: ${nome}
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

    // Pausa entre materiais: 4s para free tier 15 RPM, garante < 15 req/min
    if (i < keys.length - 1) {
      await new Promise((r) => setTimeout(r, 4500));
    }
  }

  return results;
}
