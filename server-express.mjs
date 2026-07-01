import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { readdirSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? "gemma3:4b";

const HTML_INTENTS = new Set(["email", "banner", "instagram"]);

const SYSTEM_PROMPTS = {
  email: `Você é um especialista em e-mail marketing. Gere um e-mail HTML completo, responsivo, com CSS inline em todos os elementos (sem <style> ou <link> externos), pronto para envio. Comece DIRETAMENTE com <!DOCTYPE html> — sem nenhuma explicação antes ou depois. Use português do Brasil.`,

  banner: `Você é um designer e copywriter especialista em marketing visual. Gere um banner HTML completo e autossuficiente.

REGRAS OBRIGATÓRIAS:
- Retorne APENAS o bloco HTML — sem explicações, sem markdown, sem backticks, sem código fora do HTML.
- Comece DIRETAMENTE com <!DOCTYPE html>.
- Use CSS inline em todos os elementos (style="..."). NUNCA use <style> ou <link>.
- Dimensões padrão: width:1200px; height:400px (banner horizontal).
- Layout em 3 colunas: [copy principal + subtítulo à esq] [placeholder de produto ao centro] [oferta + CTA à dir].
- Fundo: gradiente azul escuro corporativo (#0a1628 → #1a3a6e).
- Copy: headline grande e bold (branco), subtítulo menor (azul claro), descrição concisa.
- CTA: botão pill com fundo verde (#22c55e) ou laranja, texto branco bold.
- Oferta em badge/pill destacado com fundo amarelo-dourado (#f59e0b), texto escuro bold.
- Placeholder de produto: div com borda tracejada branca, texto "[ Produto ]" centralizado.
- Fonte: Montserrat via Google Fonts embed (<link> no <head> é permitido APENAS para fontes).
- Adapte cores e copy ao briefing recebido.`,

  instagram: `Você é um designer especialista em posts para Instagram. Gere um post HTML completo e autossuficiente.

REGRAS OBRIGATÓRIAS:
- Retorne APENAS o bloco HTML — sem explicações, sem markdown, sem backticks.
- Comece DIRETAMENTE com <!DOCTYPE html>.
- Use CSS inline em todos os elementos. NUNCA use <style> ou <link> (exceto Google Fonts no <head>).
- Dimensões: width:1080px; height:1080px (formato quadrado).
- Layout vertical com impacto visual imediato.
- Fundo: gradiente marcante adaptado à marca.
- Headline grande e bold no centro ou topo.
- Subtítulo menor com emoji estratégico.
- Badge ou pill com oferta/CTA na parte inferior.
- Nome da marca em destaque.`,

  datasheet: `Você é um especialista em conteúdo de marketing técnico. Gere uma ficha técnica de produto em Markdown bem estruturado, com seções: Visão Geral, Características, Especificações (tabela), Benefícios, Casos de Uso e CTA. Use apenas Markdown válido. Português do Brasil.`,

  text: `Você é um copywriter sênior de marketing. Escreva conteúdo persuasivo, claro e direto em português do Brasil. Use Markdown quando ajudar a leitura.`,
};

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "dist/client")));

app.post("/api/chat", async (req, res) => {
  const { prompt, intent = "text", model = DEFAULT_MODEL } = req.body ?? {};
  if (!prompt?.trim()) return res.status(400).json({ error: "Campo 'prompt' é obrigatório" });

  const systemPrompt = SYSTEM_PROMPTS[intent] ?? SYSTEM_PROMPTS.text;
  const fullPrompt = `${systemPrompt}\n\nPedido do usuário:\n${prompt.trim()}`;
  const isHtml = HTML_INTENTS.has(intent);

  let ollamaRes;
  try {
    ollamaRes = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: fullPrompt,
        stream: true,
        options: {
          num_predict: isHtml ? 2048 : 1024,
          temperature: isHtml ? 0.3 : 0.7,
        },
      }),
    });
  } catch (err) {
    return res.status(502).json({ error: `Ollama inacessível: ${err.message}` });
  }

  if (!ollamaRes.ok || !ollamaRes.body) {
    const text = await ollamaRes.text().catch(() => "");
    return res.status(502).json({ error: `Ollama ${ollamaRes.status}: ${text}` });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const reader = ollamaRes.body.getReader();
  const decoder = new TextDecoder();
  let lineBuffer = "";
  let htmlAccum = "";
  let htmlStarted = false;
  // Guarda o último token HTML enviado para poder strip do ``` no fim
  let lastHtmlToken = "";
  let lastHtmlTokenSent = false;

  const sendToken = (token) => res.write(`data: ${JSON.stringify(token)}\n\n`);

  const finish = () => {
    if (isHtml && !htmlStarted && htmlAccum) {
      sendToken(stripMarkdownWrapper(htmlAccum));
    }
    res.write("data: [DONE]\n\n");
    res.end();
  };

  const pump = async () => {
    try {
      const { done, value } = await reader.read();
      if (done) { finish(); return; }

      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        let parsed;
        try { parsed = JSON.parse(line); } catch { continue; }

        const token = parsed.response ?? "";

        if (isHtml) {
          if (!htmlStarted) {
            htmlAccum += token;
            const idx = htmlAccum.toLowerCase().indexOf("<!doctype");
            if (idx !== -1) {
              htmlStarted = true;
              sendToken(htmlAccum.slice(idx));
              htmlAccum = "";
            }
          } else {
            // Ignorar tokens que sejam apenas backticks (wrapper de fecho do modelo)
            const trimmed = token.trim();
            if (trimmed && /^`+$/.test(trimmed)) {
              // é só backticks — descartar
            } else if (token) {
              sendToken(token);
            }
          }
        } else {
          if (token) sendToken(token);
        }

        if (parsed.done) { finish(); return; }
      }

      pump();
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      finish();
    }
  };

  req.on("close", () => reader.cancel());
  pump();
});

function stripMarkdownWrapper(text) {
  return text
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

// SSR
const assetsDir = path.join(__dirname, "dist/server/assets");
const serverFile = readdirSync(assetsDir).find(f => f.startsWith("server-") && f.endsWith(".js"));
if (!serverFile) throw new Error("Ficheiro server-*.js não encontrado em dist/server/assets/");
console.log(`📦 Handler SSR: ${serverFile}`);
const { default: handler } = await import(`./dist/server/assets/${serverFile}`);

app.use(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (v != null) headers[k] = Array.isArray(v) ? v.join(", ") : v;
    }
    const response = await handler.fetch(new Request(url.toString(), { headers }));
    res.status(response.status);
    response.headers.forEach((v, k) => res.setHeader(k, v));
    res.end(await response.text());
  } catch (err) {
    res.status(500).send(`<pre>SSR Error: ${err.message}</pre>`);
  }
});

app.listen(PORT, "0.0.0.0", () => console.log(`✅ BrieFlow on :${PORT}`));
