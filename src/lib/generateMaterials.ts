// Real AI material generation — supports Gemini, Groq, OpenAI, Grok, Mistral, Anthropic
import { type StructuredBrief, type MaterialKey } from "./store";
import {
  loadAIConfig,
  isOpenAIModel,
  isGroqModel,
  isGrokModel,
  isMistralModel,
  isAnthropicModel,
  geminiApiId,
  getModelProvider,
  getModuleModel,
  type AIModel,
} from "./aiConfig";


// ─── Retry ────────────────────────────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: Error = new Error("Max retries exceeded");
  for (let attempt = 0; attempt <= retries; attempt++) {
    try { return await fn(); } catch (err) {
      lastError = err as Error;
      const msg = lastError.message ?? "";

      // ✅ 429 — falha imediata, sem retry
      if (msg.includes("429")) {
        throw new Error(
          `Rate limit atingido (429). Aguarde alguns segundos e tente novamente, ou troque o modelo em Configurações.`,
        );
      }

      const retryable = msg.includes("503") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("overloaded");
      if (!retryable || attempt === retries) throw lastError;

      const m = msg.match(/retry in (\d+(?:\.\d+)?)s/);
      const suggested = m ? Math.ceil(parseFloat(m[1])) * 1000 : 0;
      const backoff = Math.max(suggested, 4000 * Math.pow(2, attempt));
      console.warn(`[BriefFlow] Retry ${attempt + 1}/${retries} in ${(backoff / 1000).toFixed(0)}s`);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastError;
}


// ─── JSON sanitizer ───────────────────────────────────────────────────────────

function sanitizeJsonResponse(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  return s.trim();
}


// ─── Brief normalizer ─────────────────────────────────────────────────────────

const BRIEF_FIELD_MAP: Record<string, string> = {
  "público-alvo": "publico_alvo", "publico-alvo": "publico_alvo",
  "público alvo": "publico_alvo", "publico alvo": "publico_alvo", "público_alvo": "publico_alvo",
  "proposta comercial": "proposta_comercial", "proposta_comercia": "proposta_comercial",
  "oferta promocional": "oferta_promocional", "oferta_promo": "oferta_promocional",
  "subcategorias citadas": "subcategorias", "sub-categorias": "subcategorias",
  "subcategorias mencionadas": "subcategorias",
  "diferenciais técnicos": "diferenciais_tecnicos", "diferenciais tecnicos": "diferenciais_tecnicos",
  "diferenciais-técnicos": "diferenciais_tecnicos", "diferenciais-tecnicos": "diferenciais_tecnicos",
  "benefícios para revendedor": "beneficios_revendedor", "beneficios para revendedor": "beneficios_revendedor",
  "benefícios revendedor": "beneficios_revendedor", "beneficios revendedor": "beneficios_revendedor",
  "benefícios para o revendedor": "beneficios_revendedor", "beneficios para o revendedor": "beneficios_revendedor",
  "benefícios para cliente final": "beneficios_cliente_final", "beneficios para cliente final": "beneficios_cliente_final",
  "benefícios cliente final": "beneficios_cliente_final", "beneficios cliente final": "beneficios_cliente_final",
  "benefícios para o cliente final": "beneficios_cliente_final", "beneficios para o cliente final": "beneficios_cliente_final",
  "objeções e argumentos": "objecoes_argumentos", "objecoes e argumentos": "objecoes_argumentos",
  "objeções": "objecoes_argumentos", "objecoes": "objecoes_argumentos", "objections": "objecoes_argumentos",
  "tom de comunicação": "tom_comunicacao", "tom de comunicacao": "tom_comunicacao",
  "tom comunicacao": "tom_comunicacao", "tom comunicação": "tom_comunicacao",
  "inferências ia": "inferencias_ia", "inferencias ia": "inferencias_ia",
  "inferências_ia": "inferencias_ia", "inferencias": "inferencias_ia",
  "observações": "observacoes", "observações adicionais": "observacoes",
};

const BRIEF_DEFAULTS: Record<string, unknown> = {
  marca: "", campanha: "", publico_alvo: "", proposta_comercial: "",
  oferta_promocional: "", subcategorias: [], diferenciais_tecnicos: [],
  beneficios_revendedor: [], beneficios_cliente_final: [], objecoes_argumentos: [],
  tom_comunicacao: "", observacoes: "", inferencias_ia: [],
};

function normalizeBriefFields(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const mapped = BRIEF_FIELD_MAP[key.toLowerCase().trim()] ?? key;
    if (mapped === "objecoes_argumentos" && Array.isArray(value)) {
      out[mapped] = (value as Record<string, unknown>[]).map((item) => ({
        objecao: item["objecao"] ?? item["objeção"] ?? item["objecão"] ?? item["objection"] ?? "",
        argumento: item["argumento"] ?? item["argument"] ?? "",
      }));
    } else { out[mapped] = value; }
  }
  for (const [k, def] of Object.entries(BRIEF_DEFAULTS)) {
    if (!(k in out) || out[k] === null || out[k] === undefined) out[k] = def;
  }
  return out;
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
=========================`.trim();
}

const SYSTEM_ROLE =
  "Você é um especialista em marketing B2B e copywriting para o setor laboratorial. " +
  "Escreva em português brasileiro, tom profissional mas acessível. " +
  "Responda SOMENTE com o conteúdo solicitado, sem explicações adicionais.";

const PROMPTS: Record<MaterialKey, (brief: StructuredBrief, customPrompt?: string) => string> = {
  podcast_revendedores: (b, c) => c ||
    `${briefContext(b)}\n\nCrie um ROTEIRO DE PODCAST DE 5 MINUTOS para revendedores de laboratório.\n\nREGRAS OBRIGATÓRIAS:\n- Escreva APENAS o texto que será falado pelo apresentador. Nada mais.\n- NÃO inclua marcadores de tempo, labels como "Apresentador:", "Host:", "Narrador:", blocos de instrução em colchetes, direções de produção, divisores (---), hashtags ou qualquer marcação Markdown.\n- Escreva em parágrafos corridos, como um script de voz.\n- NÃO use asteriscos, colchetes, parênteses de instrução ou qualquer símbolo que não seja pontuação normal.\n\nESTRUTURA DO ROTEIRO:\n1. Abertura impactante mencionando a oferta (${b.oferta_promocional})\n2. Por que a linha ${b.marca} é relevante agora\n3. Subcategorias: ${b.subcategorias.join(", ")}\n4. Benefícios para revendedor e diferenciais técnicos\n5. Chamada à ação com urgência\n\nTom: ${b.tom_comunicacao}.`,

  apresentacao_slides: (b, c) => c ||
    `${briefContext(b)}\n\nCrie uma APRESENTAÇÃO DE 10 SLIDES para capacitação de revendedores.\nCada slide: número, título, 3-5 bullets.\nSlide 1: Capa. Slide 2: Quem é ${b.marca}. Slide 3: Por que qualidade importa.\nSlides 4-8: Subcategorias (${b.subcategorias.join(", ")}).\nSlide 9: Oferta (${b.oferta_promocional}). Slide 10: Próximos passos.`,

  folheto_a4: (b, c) => c ||
    `${briefContext(b)}\n\nCrie texto de FOLHETO A4 PROMOCIONAL para cliente final.\nIncluir: título com oferta (${b.oferta_promocional}), subtítulo, produtos (${b.subcategorias.join(", ")}), destaques técnicos, benefícios, CTA.`,

  ficha_tecnica: (b, c) => c ||
    `${briefContext(b)}\n\nCrie FICHA TÉCNICA INTERNA para vendedores.\nCabeçalho + subcategorias com diferenciais + mecânica (${b.oferta_promocional}) + argumentário + quebra de objeções. Tom direto, uso interno.`,

  emails_revendedores: (b, c) => c ||
    `${briefContext(b)}\n\n2 E-MAILS para revendedores.\nE-MAIL 1: apresentação das subcategorias (${b.subcategorias.join(", ")}) com aplicação e diferencial.\nE-MAIL 2: oferta (${b.oferta_promocional}), margem para revendedor, CTA urgente.\nSepare com === E-MAIL 1 === e === E-MAIL 2 ===`,

  emails_cliente_final: (b, c) => c ||
    `${briefContext(b)}\n\n3 E-MAILS para laboratórios.\nE-MAIL 1 — Topo: ${b.marca}, tipos de pipetadores, ecossistema Forlab.\nE-MAIL 2 — Meio: diferenciais vs. concorrentes.\nE-MAIL 3 — Fundo: ${b.oferta_promocional}, CTA direto.\nSepare com === E-MAIL 1 ===, === E-MAIL 2 ===, === E-MAIL 3 ===`,

  posts_linkedin: (b, c) => c ||
    `${briefContext(b)}\n\n2 POSTS LINKEDIN (B2B).\nPost 1: autoridade técnica, máx 150 palavras + hashtags.\nPost 2: oferta ${b.oferta_promocional}, CTA, máx 150 palavras + hashtags.\nSepare com [POST 1] e [POST 2].`,

  posts_facebook: (b, c) => c ||
    `${briefContext(b)}\n\n2 POSTS FACEBOOK.\nPost 1: apresentação ${b.marca}, amigável, máx 120 palavras.\nPost 2: oferta ${b.oferta_promocional} + urgência + emojis, máx 100 palavras.\nSepare com [POST 1] e [POST 2].`,

  posts_instagram: (b, c) => c ||
    `${briefContext(b)}\n\n2 POSTS INSTAGRAM.\nPost 1 — Carrossel: capa + 4-5 slides + CTA. Legenda + hashtags.\nPost 2 — Reels 15-30s: roteiro cena a cena + música + legenda.\nSepare com [POST 1 — Carrossel] e [POST 2 — Reels].`,

  roteiro_video_curto: (b, c) => c ||
    `${briefContext(b)}\n\nROTEIRO VÍDEO 15-30s para Reels e Shorts.\nCena a cena: [Xs–Ys] Visual | Texto na tela | Locução | Música.\nAbertura impactante em 3s, produto em uso, oferta (${b.oferta_promocional}), CTA final. Tom: ${b.tom_comunicacao}.`,
};


// ─── API callers (texto) ──────────────────────────────────────────────────────

async function callOpenAICompat(prompt: string, model: AIModel, apiKey: string, baseUrl: string): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model, temperature: 0.7, max_tokens: 2000,
      messages: [{ role: "system", content: SYSTEM_ROLE }, { role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`${baseUrl} error ${res.status}: ${(err as { error?: { message?: string } }).error?.message ?? res.statusText}`);
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
    throw new Error(`Gemini error ${res.status}: ${(err as { error?: { message?: string } }).error?.message ?? res.statusText}`);
  }
  const data = await res.json();
  return (data.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
}

async function callAnthropic(prompt: string, model: AIModel, apiKey: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 2048, system: SYSTEM_ROLE, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = err as { error?: { message?: string }; message?: string };
    throw new Error(`Anthropic error ${res.status}: ${e.error?.message ?? e.message ?? res.statusText}`);
  }
  const data = await res.json();
  return (data.content?.[0]?.text ?? "").trim();
}

async function callAI(prompt: string, moduleKey?: string): Promise<string> {
  const config = loadAIConfig();
  const model = moduleKey ? getModuleModel(moduleKey, config) : config.model;

  if (isGroqModel(model)) {
    if (!config.groqKey) throw new Error("Chave Groq não configurada em Configurações.");
    return withRetry(() => callOpenAICompat(prompt, model, config.groqKey, "https://api.groq.com/openai/v1"));
  }
  if (isOpenAIModel(model)) {
    if (!config.openaiKey) throw new Error("Chave OpenAI não configurada em Configurações.");
    return withRetry(() => callOpenAICompat(prompt, model, config.openaiKey, "https://api.openai.com/v1"));
  }
  if (isGrokModel(model)) {
    if (!config.grokKey) throw new Error("Chave Grok (xAI) não configurada em Configurações.");
    return withRetry(() => callOpenAICompat(prompt, model, config.grokKey, "https://api.x.ai/v1"));
  }
  if (isMistralModel(model)) {
    if (!config.mistralKey) throw new Error("Chave Mistral não configurada em Configurações.");
    return withRetry(() => callOpenAICompat(prompt, model, config.mistralKey, "https://api.mistral.ai/v1"));
  }
  if (isAnthropicModel(model)) {
    if (!config.anthropicKey) throw new Error("Chave Anthropic não configurada em Configurações.");
    return withRetry(() => callAnthropic(prompt, model, config.anthropicKey));
  }
  if (!config.geminiKey) throw new Error("Chave Gemini não configurada em Configurações.");
  return withRetry(() => callGemini(prompt, model, config.geminiKey));
}


// ─── TTS helpers ──────────────────────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  return btoa(binary);
}

function pcmBase64ToWavDataUrl(base64: string, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): string {
  const pcmBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const dataSize = pcmBytes.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  new Uint8Array(buffer, 44).set(pcmBytes);
  const wavBytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < wavBytes.length; i++) binary += String.fromCharCode(wavBytes[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function cleanScriptForTTS(script: string): string {
  return script
    .replace(/^\*{1,2}\(.*?\)\*{1,2}\s*$/gm, "")
    .replace(/^\*{1,2}\[.*?\]\*{1,2}[^\n]*$/gm, "")
    .replace(/^\[.*?\][^\n]*$/gm, "")
    .replace(/^\*{1,2}[^*\n]+?\(.*?\)\s*:\*{1,2}\s*/gm, "")
    .replace(/^\*{1,2}[^*\n]+?:\*{1,2}\s*/gm, "")
    .replace(/^[A-ZÀ-Ú][a-zA-ZÀ-Ú\s()]{2,30}:\s+/gm, "")
    .replace(/^-{3,}\s*$/gm, "")
    .replace(/^\*{3,}\s*$/gm, "")
    .replace(/^#+\s.*/gm, "")
    .replace(/\*{1,2}([^*\n]+)\*{1,2}/g, "$1")
    .replace(/\*+/g, "")
    .replace(/\(\d+:\d+(?:[–-]\d+:\d+)?\)/g, "")
    .replace(/\[\d+:\d+(?:[–-]\d+:\d+)?\]/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\([^)]{0,60}\)/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 3000);
}


// ── Gemini TTS ────────────────────────────────────────────────────────────────
async function callGeminiNativeAudioTTS(apiKey: string, inputText: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: inputText }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } } },
      },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gemini TTS error ${res.status}: ${(err as { error?: { message?: string } }).error?.message ?? res.statusText}`);
  }
  const data = await res.json();
  const part = data?.candidates?.[0]?.content?.parts?.[0];
  const b64 = part?.inlineData?.data as string | undefined;
  if (!b64) throw new Error("Gemini TTS: resposta sem dados de áudio.");
  const mimeType: string = part?.inlineData?.mimeType ?? "audio/wav";
  if (mimeType.includes("L16") || mimeType.includes("pcm")) {
    const rateMatch = mimeType.match(/rate=(\d+)/);
    const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
    return pcmBase64ToWavDataUrl(b64, sampleRate);
  }
  return `data:${mimeType};base64,${b64}`;
}

const callGeminiTTS = callGeminiNativeAudioTTS;


// ── Groq TTS ──────────────────────────────────────────────────────────────────
const GROQ_TTS_MODEL = "playai-tts";
const GROQ_TTS_PRIMARY = "Celeste-PlayAI";
const GROQ_TTS_FALLBACK = "Fritz-PlayAI";

async function tryGroqVoice(apiKey: string, inputText: string, voice: string): Promise<ArrayBuffer | null> {
  const res = await fetch("https://api.groq.com/openai/v1/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: GROQ_TTS_MODEL, voice, input: inputText, response_format: "wav" }),
  });
  if (res.ok) return res.arrayBuffer();
  const err = await res.json().catch(() => ({}));
  const msg = (err as { error?: { message?: string } }).error?.message ?? res.statusText;
  if (res.status === 404 || res.status === 400) { console.warn(`[BriefFlow] Groq voz "${voice}" (${res.status}): ${msg}`); return null; }
  throw new Error(`Groq TTS error ${res.status}: ${msg}`);
}

async function callGroqTTS(apiKey: string, inputText: string): Promise<string> {
  let buffer = await tryGroqVoice(apiKey, inputText, GROQ_TTS_PRIMARY);
  if (!buffer) buffer = await tryGroqVoice(apiKey, inputText, GROQ_TTS_FALLBACK);
  if (!buffer) throw new Error("Groq TTS: nenhuma voz disponível no momento.");
  return `data:audio/wav;base64,${arrayBufferToBase64(buffer)}`;
}


// ── OpenAI TTS ────────────────────────────────────────────────────────────────
async function callOpenAITTS(apiKey: string, inputText: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "tts-1", voice: "nova", input: inputText, response_format: "wav" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OpenAI TTS error ${res.status}: ${(err as { error?: { message?: string } }).error?.message ?? res.statusText}`);
  }
  return `data:audio/wav;base64,${arrayBufferToBase64(await res.arrayBuffer())}`;
}


// ─── generatePodcastAudio — roteador por módulo ───────────────────────────────

export async function generatePodcastAudio(script: string): Promise<string> {
  const config = loadAIConfig();
  const audioModel = getModuleModel("audio", config);
  const provider = getModelProvider(audioModel);
  const inputText = cleanScriptForTTS(script);
  if (!inputText) throw new Error("Roteiro vazio. Gere o podcast antes de converter para áudio.");

  if (audioModel === "gemini-2.5-flash-live") {
    if (!config.geminiKey) throw new Error("Chave Gemini não configurada em ⚙️ Configurações.");
    return callGeminiNativeAudioTTS(config.geminiKey, inputText);
  }
  if (provider === "groq") {
    if (!config.groqKey) throw new Error("Chave Groq não configurada em ⚙️ Configurações.");
    return callGroqTTS(config.groqKey, inputText);
  }
  if (provider === "openai") {
    if (!config.openaiKey) throw new Error("Chave OpenAI não configurada em ⚙️ Configurações.");
    return callOpenAITTS(config.openaiKey, inputText);
  }
  if (provider === "gemini") {
    if (!config.geminiKey) throw new Error("Chave Gemini não configurada em ⚙️ Configurações.");
    return callGeminiTTS(config.geminiKey, inputText);
  }

  // Fallback automático
  if (config.groqKey) { console.warn("[BriefFlow] TTS fallback → Groq"); return callGroqTTS(config.groqKey, inputText); }
  if (config.geminiKey) { console.warn("[BriefFlow] TTS fallback → Gemini TTS"); return callGeminiNativeAudioTTS(config.geminiKey, inputText); }

  throw new Error(`O provedor "${provider}" não tem TTS nativo. Configure Groq ou Gemini em ⚙️ Configurações.`);
}


// ─── Brief inference ──────────────────────────────────────────────────────────

function buildBriefPrompt(nome: string, transcricao: string, customPrompt?: string): string {
  const block = `\nNome da campanha: ${nome}\n=== TRANSCRIÇÃO ===\n${transcricao}\n===================`;
  if (!customPrompt) {
    return (
      `Extraia informações da transcrição e retorne EXATAMENTE o seguinte objeto JSON.\n` +
      `NÃO renomeie nenhuma chave. Use EXATAMENTE os nomes de campo abaixo (snake_case):\n\n` +
      `{\n  "marca": "",\n  "campanha": "",\n  "publico_alvo": "",\n  "proposta_comercial": "",\n` +
      `  "oferta_promocional": "",\n  "subcategorias": [],\n  "diferenciais_tecnicos": [],\n` +
      `  "beneficios_revendedor": [],\n  "beneficios_cliente_final": [],\n` +
      `  "objecoes_argumentos": [{"objecao": "", "argumento": ""}],\n` +
      `  "tom_comunicacao": "",\n  "observacoes": "",\n  "inferencias_ia": []\n}\n\n` +
      `REGRAS:\n- Use SOMENTE informações da transcrição.\n` +
      `- Se um campo não estiver claro, retorne [] ou "". NUNCA null.\n` +
      `- NÃO renomeie as chaves. Responda APENAS com JSON válido, SEM markdown.\n` +
      block
    );
  }
  if (customPrompt.includes("{{transcricao}}"))
    return customPrompt.replace("{{nome}}", nome).replace("{{transcricao}}", transcricao);
  return customPrompt + "\n" + block;
}

export async function inferBriefFromTranscriptAI(nome: string, transcricao: string): Promise<string> {
  if (!transcricao?.trim()) throw new Error("Transcrição vazia. Cole o texto antes de gerar o briefing.");
  const config = loadAIConfig();
  const prompt = buildBriefPrompt(nome, transcricao, config.prompts["brief"]);
  const raw = await callAI(prompt, "brief");
  const cleaned = sanitizeJsonResponse(raw);
  try {
    return JSON.stringify(normalizeBriefFields(JSON.parse(cleaned) as Record<string, unknown>));
  } catch { return cleaned; }
}


// ─── Generate all materials ───────────────────────────────────────────────────

export type GenerationProgress = { current: number; total: number; key: MaterialKey; label: string; };

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
  keysToGenerate?: MaterialKey[], // ✅ seleção parcial de materiais
): Promise<Partial<Record<MaterialKey, string>>> {
  const config = loadAIConfig();
  const keys = keysToGenerate ?? (Object.keys(PROMPTS) as MaterialKey[]);
  const results: Partial<Record<MaterialKey, string>> = {};

  // Gemini free tier: 15 RPM → mínimo 5s entre chamadas; Groq: 30 RPM → 2s
  const isGroq = isGroqModel(config.model);
  const delayBetween = isGroq ? 2000 : 5000;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    onProgress?.({ current: i + 1, total: keys.length, key, label: MATERIAL_LABELS[key] });

    const rawCustomPrompt = config.prompts[key];

    // ✅ Substitui placeholders do prompt customizado com dados reais do brief
    const customPrompt = rawCustomPrompt
      ? rawCustomPrompt
          .replace(/\{\{nome\}\}/g, brief.campanha)
          .replace(/\{\{marca\}\}/g, brief.marca)
          .replace(/\{\{oferta\}\}/g, brief.oferta_promocional)
          .replace(/\{\{publico\}\}/g, brief.publico_alvo)
          .replace(/\{\{tom\}\}/g, brief.tom_comunicacao)
      : undefined;

    const prompt = PROMPTS[key](brief, customPrompt);

    try {
      results[key] = await callAI(prompt);
    } catch (err) {
      const msg = (err as Error).message;
      // ✅ 429: registra erro no material mas CONTINUA para o próximo
      results[key] = `[Rate limit — tente regerar este material individualmente]\n${msg}`;
      console.warn(`[BriefFlow] Pulando "${MATERIAL_LABELS[key]}" por erro: ${msg}`);

      // Pausa extra após 429 para dar tempo ao rate limit resetar
      if (msg.includes("429") || msg.includes("Rate limit")) {
        await new Promise((r) => setTimeout(r, 10000));
      }
    }

    if (i < keys.length - 1) {
      await new Promise((r) => setTimeout(r, delayBetween));
    }
  }

  return results;
}