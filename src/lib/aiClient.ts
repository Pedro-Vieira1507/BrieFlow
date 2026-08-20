// src/lib/aiClient.ts
import type { ZodType } from "zod";
import { supabase } from "@/lib/supabase";

export type AiProviderName = "omniroute" | "ollama" | "groq" | "gemini";

export interface AiCompletionMeta {
  requestId: string;
  provider: string;
  model: string;
  usedFallback: boolean;
  latencyMs: number;
  generatedAt: string;
}

export interface AiCompletionResult<T> {
  raw: string;
  data: T;
  meta: AiCompletionMeta;
}

export interface GenerateCompletionOptions<T> {
  system: string;
  user: string;
  history?: { role: "user" | "assistant"; content: string }[];
  schema?: ZodType<T>;
  onToken?: (partial: string) => void;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  requestId?: string;
  signal?: AbortSignal;
  provider?: AiProviderName;
}

export class AiClientError extends Error {
  constructor(
    message: string,
    readonly code: "NO_PROVIDER" | "PROVIDER_FAILED" | "TIMEOUT" | "INVALID_OUTPUT" | "UNAUTHORIZED" | "INSUFFICIENT_CREDITS",
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "AiClientError";
  }
}

export async function generateCompletion<T = string>(
  opts: GenerateCompletionOptions<T>,
): Promise<AiCompletionResult<T>> {
  const {
    system,
    user,
    history,
    schema,
    temperature,
    maxTokens,
    timeoutMs = 500_000,
    requestId = (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : `req_${Date.now()}`,
    signal,
    provider = "omniroute"
  } = opts;

  // 1. VERIFICA E DEDUZ CRÉDITOS DIRETAMENTE NO BANCO DE DADOS
  if (supabase) {
    const { data: session } = await supabase.auth.getSession();
    if (session?.session) {
      const { data: success, error } = await supabase.rpc("deduct_user_credit", { cost: 1 });
      if (error || !success) {
        throw new AiClientError("Créditos insuficientes para esta geração.", "INSUFFICIENT_CREDITS");
      }
    }
  }

  const messages = [
    { role: "system", content: schema ? `${system}\n\nResponda EXCLUSIVAMENTE em JSON válido.` : system },
    ...(history ?? []),
    { role: "user", content: user },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const combinedSignal = signal ?? controller.signal;
  const startMs = Date.now();

  let response: Response | undefined;
  let usedProviderName = provider as string;
  let usedModel = "unknown";
  let lastError: any;

  // 2. ROTEAMENTO PARA OLLAMA LOCAL
  if (provider === "ollama") {
    const ollamaUrl = import.meta.env.VITE_OLLAMA_URL || "http://localhost:11434/api/chat";
    usedModel = import.meta.env.VITE_OLLAMA_EXECUTION_MODEL || import.meta.env.VITE_OLLAMA_MODEL || "qwen2.5:7b";
    
    try {
      response = await fetch(ollamaUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: usedModel,
          messages,
          stream: false,
          format: schema ? "json" : undefined,
          options: {
            temperature: temperature ?? 0.7,
            num_predict: maxTokens ?? 4096
          }
        }),
        signal: combinedSignal,
      });
    } catch (err) {
      clearTimeout(timeout);
      throw new AiClientError("Erro de conexão com o Ollama local.", "PROVIDER_FAILED", err);
    }
  } 
  
  // 3. ROTEAMENTO NUVEM (FALLBACK EM CASCATA)
  else {
    const fallbackProviders = [
      {
        name: "groq",
        url: "https://api.groq.com/openai/v1/chat/completions",
        key: import.meta.env.VITE_GROQ_API_KEY,
        // Atualizado para o modelo ativo recomendado pela Groq!
        model: "openai/gpt-oss-20b" 
      },
      {
        name: "gemini",
        url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        key: import.meta.env.VITE_GEMINI_API_KEY,
        model: "gemini-1.5-flash"
      }
    ];

    let hasConfiguredProvider = false;

    for (const p of fallbackProviders) {
      if (!p.key) continue; 
      hasConfiguredProvider = true;

      try {
        const payload: any = {
          model: p.model,
          messages,
          temperature: temperature ?? 0.7,
          // Reduzimos o limite de resposta para 2000 para a Groq não dar erro 400
          max_tokens: p.name === "groq" ? 2000 : (maxTokens ?? 4096),
          stream: false,
        };

        // Deixamos a exigência estrita de JSON apenas para o Gemini
        // A Groq se comporta melhor apenas com as instruções do prompt
        if (p.name === "gemini" && schema) {
          payload.response_format = { type: "json_object" };
        }

        response = await fetch(p.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${p.key}`,
          },
          body: JSON.stringify(payload),
          signal: combinedSignal,
        });

        if (response.ok) {
          usedProviderName = p.name;
          usedModel = p.model;
          break; // Sucesso! Sai do loop.
        }

        if (response.status === 429) {
          console.warn(`[Fallback] Limite atingido no provedor ${p.name} (429). Tentando o próximo...`);
          continue;
        }

        const errText = await response.text();
        console.warn(`[Fallback] Erro ${response.status} no provedor ${p.name}:`, errText);
        continue;
      } catch (err) {
        lastError = err;
        console.warn(`[Fallback] Erro de rede ao acessar ${p.name}. Tentando o próximo...`);
      }
    }

    if (!hasConfiguredProvider) {
      clearTimeout(timeout);
      throw new AiClientError("Nenhuma API Key configurada no .env (Groq ou Gemini).", "NO_PROVIDER");
    }

    if (!response || !response.ok) {
      clearTimeout(timeout);
      throw new AiClientError(`Todos os provedores de nuvem falharam.`, "PROVIDER_FAILED", lastError);
    }
  }

  clearTimeout(timeout);

  const json = await response.json();
  
  // Como Groq e Gemini usam o formato OpenAI, acessamos choices[0].message.content
  const raw = usedProviderName === "ollama" ? json.message?.content : json.choices?.[0]?.message?.content;

  if (!raw) throw new AiClientError("Resposta vazia.", "INVALID_OUTPUT");

  const metaData: AiCompletionMeta = { 
    requestId, 
    provider: usedProviderName, 
    model: usedModel, 
    usedFallback: usedProviderName !== provider, 
    latencyMs: Date.now() - startMs, 
    generatedAt: new Date().toISOString() 
  };

  if (!schema) {
    return {
      raw,
      data: raw as unknown as T,
      meta: metaData,
    };
  }

  // Tratamento de segurança para extrair JSON caso o modelo escreva marcações de markdown (ex: ```json ... ```)
  const jsonStr = raw.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]?.trim() || raw.trim();
  
  let parsed: unknown;
  try {
     parsed = JSON.parse(jsonStr);
  } catch {
     throw new AiClientError("O modelo não retornou um JSON válido.", "INVALID_OUTPUT");
  }

  const result = schema.safeParse(parsed);
  if (!result.success) throw new AiClientError("Validação de estrutura do JSON (Zod) falhou.", "INVALID_OUTPUT", result.error.issues);

  return {
    raw,
    data: result.data,
    meta: metaData,
  };
}