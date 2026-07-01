import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { readdirSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:14b";

const SYSTEM_PROMPTS = {
  email: `Você é um especialista em e-mail marketing. Gere um e-mail HTML completo, responsivo, inline-styled (sem <link> externos), pronto para envio. Comece DIRETAMENTE com <!DOCTYPE html>. Não inclua explicações fora do HTML. Use português do Brasil.`,

  banner: `Você é um designer e copywriter especialista em marketing visual. Gere um banner HTML completo e autossuficiente.

REGRAS OBRIGATÓRIAS:
- Retorne APENAS o bloco HTML — sem explicações, sem markdown, sem código fora do HTML.
- Use CSS inline em todos os elementos (style="..."). NUNCA use <style> ou <link>.
- Dimensões padrão: width:1200px; height:400px (banner horizontal) ou 1080x1080 (post quadrado) conforme pedido.
- Estrutura em 3 colunas: [copy principal + subtítulo à esq] [imagem/produto ao centro] [oferta + CTA à dir].
- Use gradientes, sombras e bordas arredondadas para visual profissional.
- Fontes via Google Fonts embed no <head> (link href).
- Fundo: cor sólida ou gradiente azul/escuro corporativo, adaptável à marca do pedido.
- Copy: headline grande e bold, subtítulo menor, descrição concisa.
- CTA: botão pill colorido (verde, laranja ou cor da marca) com texto de ação.
- Oferta em badge/pill destacado (ex: "+1 grátis", "20% OFF", "Kit promocional").
- Use imagens de produto via URL fornecida no briefing ou deixe placeholder com borda tracejada e label "[ Produto ]".
- Adapte cores, tipografia e tom ao briefing recebido.
- Comece DIRETAMENTE com <!DOCTYPE html>.`,

  instagram: `Você é um designer especialista em posts para Instagram. Gere um post HTML completo e autossuficiente.

REGRAS OBRIGATÓRIAS:
- Retorne APENAS o bloco HTML — sem explicações, sem markdown.
- Use CSS inline em todos os elementos. NUNCA use <style> ou <link>.
- Dimensões: width:1080px; height:1080px (formato quadrado).
- Layout vertical com impacto visual imediato (a primeira linha deve prender a atenção).
- Fundo: gradiente ou cor sólida marcante. Pode usar padrão geométrico com CSS.
- Headline grande e bold no centro ou topo.
- Subtítulo menor e emoji estratégico.
- Badge ou pill com oferta/CTA na parte inferior.
- Marca/logo em texto no canto superior ou inferior.
- Fontes via Google Fonts embed.
- Comece DIRETAMENTE com <!DOCTYPE html>.`,

  datasheet: `Você é um especialista em conteúdo de marketing técnico. Gere uma ficha técnica de produto em Markdown bem estruturado, com seções: Visão Geral, Características, Especificações (tabela), Benefícios, Casos de Uso e CTA. Use apenas Markdown válido. Português do Brasil.`,

  text: `Você é um copywriter sênior de marketing. Escreva conteúdo persuasivo, claro e direto em português do Brasil. Use Markdown quando ajudar a leitura.`,
};

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "dist/client")));

// POST /api/chat
app.post("/api/chat", async (req, res) => {
  const { prompt, intent = "text", model = DEFAULT_MODEL } = req.body ?? {};
  if (!prompt?.trim()) return res.status(400).json({ error: "Campo 'prompt' é obrigatório" });

  const systemPrompt = SYSTEM_PROMPTS[intent] ?? SYSTEM_PROMPTS.text;
  const fullPrompt = `${systemPrompt}\n\nPedido do usuário:\n${prompt.trim()}`;

  let ollamaRes;
  try {
    ollamaRes = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: fullPrompt, stream: true }),
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
  let buffer = "";

  const pump = async () => {
    try {
      const { done, value } = await reader.read();
      if (done) { res.write("data: [DONE]\n\n"); res.end(); return; }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          if (json.response) res.write(`data: ${JSON.stringify(json.response)}\n\n`);
          if (json.done) { res.write("data: [DONE]\n\n"); res.end(); return; }
        } catch {}
      }
      pump();
    } catch (err) {
      res.write(`data: {"error":"${err.message}"}\n\n`);
      res.end();
    }
  };

  req.on("close", () => reader.cancel());
  pump();
});

// SSR — detecta automaticamente o ficheiro server-*.js
const assetsDir = path.join(__dirname, "dist/server/assets");
const serverFile = readdirSync(assetsDir).find(f => f.startsWith("server-") && f.endsWith(".js"));
if (!serverFile) throw new Error("Ficheiro server-*.js não encontrado em dist/server/assets/");
console.log(`📦 Handler SSR: ${serverFile}`);
const { default: handler } = await import(`./dist/server/assets/${serverFile}`);

// Fallback SSR para todas as rotas (SPA + SSR)
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
// (adicionar ao objecto SYSTEM_PROMPTS)
