import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { readdirSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? "gemma3:4b";

const HTML_INTENTS = new Set(["email", "banner", "instagram"]);

// ─────────────────────────────────────────────────────────────────
// TEMPLATES PROFISSIONAIS
// O Ollama gera apenas o JSON com os textos; o servidor monta o HTML.
// ─────────────────────────────────────────────────────────────────

function bannerTemplate(d) {
  // d = { headline, highlight, subline, description, badge, cta, bg1, bg2, accent }
  const bg1    = d.bg1    || "#030d1a";
  const bg2    = d.bg2    || "#0a2d5e";
  const accent = d.accent || "#0057b8";
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=1200">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:400px;overflow:hidden;font-family:'Montserrat',sans-serif}
.banner{width:1200px;height:400px;background:linear-gradient(135deg,${bg1} 0%,${bg2} 100%);display:grid;grid-template-columns:1fr 300px 1fr;position:relative;overflow:hidden}
.banner::before{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:44px 44px;pointer-events:none}
.banner::after{content:'';position:absolute;top:-100px;left:-100px;width:440px;height:440px;background:radial-gradient(circle,rgba(0,120,255,.22) 0%,transparent 70%);pointer-events:none}
/* LEFT */
.col-left{padding:40px 28px 40px 52px;display:flex;flex-direction:column;justify-content:center;position:relative;z-index:2}
.brand-tag{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:20px;padding:4px 14px;margin-bottom:18px;width:fit-content}
.brand-tag .dot{width:7px;height:7px;background:#e8001c;border-radius:50%;box-shadow:0 0 8px #e8001c}
.brand-tag span{font-size:11px;font-weight:600;color:rgba(255,255,255,.7);letter-spacing:1.5px;text-transform:uppercase}
.headline{font-size:36px;font-weight:900;color:#fff;line-height:1.1;letter-spacing:-.5px;margin-bottom:8px}
.headline em{font-style:normal;color:${accent === "#0057b8" ? "#4da6ff" : accent}}
.subline{font-size:14px;font-weight:600;color:rgba(255,255,255,.55);margin-bottom:10px;letter-spacing:.3px}
.description{font-size:13px;font-weight:400;color:rgba(255,255,255,.5);line-height:1.6;max-width:300px}
/* CENTER */
.col-center{display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;z-index:2}
.product-glow{position:absolute;width:260px;height:260px;background:radial-gradient(circle,rgba(0,120,255,.15) 0%,transparent 70%);border-radius:50%}
.product-frame{width:200px;height:200px;border:1.5px dashed rgba(255,255,255,.28);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(255,255,255,.04);backdrop-filter:blur(4px);position:relative}
.product-svg{opacity:.55;margin-bottom:10px}
.product-label{font-size:11px;font-weight:600;color:rgba(255,255,255,.35);letter-spacing:2px;text-transform:uppercase}
/* RIGHT */
.col-right{padding:40px 52px 40px 28px;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;position:relative;z-index:2}
.col-right::before{content:'';position:absolute;bottom:-60px;right:-60px;width:300px;height:300px;background:radial-gradient(circle,rgba(232,0,28,.15) 0%,transparent 70%);pointer-events:none}
.badge{background:linear-gradient(135deg,#e8001c 0%,#ff4d4d 100%);border-radius:14px;padding:18px 26px;text-align:center;margin-bottom:16px;box-shadow:0 8px 28px rgba(232,0,28,.45),0 0 0 1px rgba(255,255,255,.1);min-width:190px;position:relative;overflow:hidden}
.badge::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent)}
.badge-value{font-size:48px;font-weight:900;color:#fff;line-height:1;letter-spacing:-2px}
.badge-value sup{font-size:20px;vertical-align:super;letter-spacing:0}
.badge-label{font-size:10px;font-weight:600;color:rgba(255,255,255,.85);letter-spacing:2px;text-transform:uppercase;margin-top:2px}
.validity{font-size:10px;color:rgba(255,255,255,.5);margin-bottom:14px;text-align:right;letter-spacing:.4px}
.cta{display:block;background:linear-gradient(135deg,${accent} 0%,${accent}cc 100%);color:#fff;font-family:'Montserrat',sans-serif;font-size:14px;font-weight:700;letter-spacing:.5px;padding:13px 26px;border-radius:8px;text-decoration:none;border:1.5px solid rgba(255,255,255,.2);box-shadow:0 4px 18px ${accent}88;text-align:center;width:100%}
/* dividers */
.dv{position:absolute;top:15%;bottom:15%;width:1px;background:linear-gradient(to bottom,transparent,rgba(255,255,255,.1),transparent);z-index:2}
</style>
</head>
<body>
<div class="banner">
  <div class="dv" style="left:33.33%"></div>
  <div class="dv" style="left:66.66%"></div>
  <div class="col-left">
    <div class="brand-tag"><span class="dot"></span><span>${d.brand || "Marca"}</span></div>
    <h1 class="headline">${d.headline}<br><em>${d.highlight || ""}</em></h1>
    <p class="subline">${d.subline || ""}</p>
    <p class="description">${d.description || ""}</p>
  </div>
  <div class="col-center">
    <div class="product-glow"></div>
    <div class="product-frame">
      <svg class="product-svg" width="64" height="64" viewBox="0 0 72 72" fill="none">
        <rect x="16" y="28" width="40" height="28" rx="3" stroke="rgba(255,255,255,.5)" stroke-width="1.5"/>
        <rect x="28" y="18" width="16" height="12" rx="2" stroke="rgba(255,255,255,.5)" stroke-width="1.5"/>
        <line x1="36" y1="10" x2="36" y2="18" stroke="rgba(255,255,255,.5)" stroke-width="1.5"/>
        <circle cx="36" cy="8" r="3" stroke="rgba(100,180,255,.7)" stroke-width="1.5"/>
        <line x1="22" y1="38" x2="50" y2="38" stroke="rgba(100,180,255,.4)" stroke-width="1"/>
        <line x1="22" y1="44" x2="44" y2="44" stroke="rgba(100,180,255,.4)" stroke-width="1"/>
        <line x1="22" y1="50" x2="38" y2="50" stroke="rgba(100,180,255,.4)" stroke-width="1"/>
      </svg>
      <span class="product-label">[ Produto ]</span>
    </div>
  </div>
  <div class="col-right">
    <div class="badge">
      <div class="badge-value">${d.badge_value || "3"}<sup>%</sup></div>
      <div class="badge-label">${d.badge_label || "de Desconto"}</div>
    </div>
    <p class="validity">⏱ ${d.validity || "Oferta por tempo limitado"}</p>
    <a href="#" class="cta">${d.cta || "Saiba Mais"}</a>
  </div>
</div>
</body>
</html>`;
}

function instagramTemplate(d) {
  const bg1    = d.bg1    || "#0f0c29";
  const bg2    = d.bg2    || "#302b63";
  const bg3    = d.bg3    || "#24243e";
  const accent = d.accent || "#f59e0b";
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=1080">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1080px;overflow:hidden;font-family:'Montserrat',sans-serif}
.post{width:1080px;height:1080px;background:linear-gradient(160deg,${bg1} 0%,${bg2} 50%,${bg3} 100%);display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:64px 72px;position:relative;overflow:hidden}
.post::before{content:'';position:absolute;inset:0;background-image:radial-gradient(circle at 80% 20%,rgba(255,255,255,.06) 0%,transparent 50%),radial-gradient(circle at 20% 80%,${accent}22 0%,transparent 50%);pointer-events:none}
.top{width:100%;display:flex;justify-content:space-between;align-items:center}
.brand{font-size:13px;font-weight:700;color:rgba(255,255,255,.5);letter-spacing:3px;text-transform:uppercase}
.tag{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:20px;padding:6px 16px;font-size:12px;font-weight:600;color:rgba(255,255,255,.7);letter-spacing:1px;text-transform:uppercase}
.mid{display:flex;flex-direction:column;align-items:center;text-align:center;flex:1;justify-content:center;gap:20px}
.emoji-icon{font-size:64px;line-height:1;margin-bottom:4px}
.headline{font-size:72px;font-weight:900;color:#fff;line-height:1.0;letter-spacing:-2px;max-width:880px}
.headline em{font-style:normal;color:${accent}}
.subline{font-size:22px;font-weight:400;color:rgba(255,255,255,.65);max-width:680px;line-height:1.5}
.bottom{width:100%;display:flex;flex-direction:column;align-items:center;gap:20px}
.offer-pill{background:${accent};border-radius:50px;padding:16px 48px;font-size:22px;font-weight:900;color:#000;letter-spacing:.5px;box-shadow:0 8px 32px ${accent}66}
.cta-line{font-size:14px;font-weight:600;color:rgba(255,255,255,.45);letter-spacing:2px;text-transform:uppercase}
</style>
</head>
<body>
<div class="post">
  <div class="top">
    <span class="brand">${d.brand || "Marca"}</span>
    <span class="tag">${d.tag || "Oferta Especial"}</span>
  </div>
  <div class="mid">
    <div class="emoji-icon">${d.emoji || "🚀"}</div>
    <h1 class="headline">${d.headline}<br><em>${d.highlight || ""}</em></h1>
    <p class="subline">${d.subline || ""}</p>
  </div>
  <div class="bottom">
    <div class="offer-pill">${d.offer || "Desconto Exclusivo"}</div>
    <p class="cta-line">${d.cta || "Entre em contacto agora"}</p>
  </div>
</div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────
// SYSTEM PROMPTS — Ollama gera APENAS JSON para banner/instagram
// ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPTS = {
  email: `Você é um especialista em e-mail marketing. Gere um e-mail HTML completo, responsivo, com CSS inline em todos os elementos (sem <style> ou <link> externos), pronto para envio. Comece DIRETAMENTE com <!DOCTYPE html> — sem nenhuma explicação antes ou depois. Use português do Brasil.`,

  banner: `Você é um copywriter especialista em marketing visual. A partir do briefing recebido, extraia os dados e retorne APENAS um objeto JSON válido — sem explicações, sem markdown, sem texto extra.

Campos obrigatórios:
{
  "brand": "Nome da marca ou produto",
  "headline": "Título principal (máx 4 palavras)",
  "highlight": "Palavra ou frase em destaque (máx 3 palavras)",
  "subline": "Subtítulo secundário (máx 8 palavras)",
  "description": "Descrição curta (máx 20 palavras)",
  "badge_value": "Número ou texto do desconto (ex: 3 ou COMPRE 3)",
  "badge_label": "Label do badge (ex: % de Desconto ou LEVE 4)",
  "validity": "Texto de validade (ex: Oferta por tempo limitado)",
  "cta": "Texto do botão CTA (máx 5 palavras)",
  "bg1": "Cor hex do fundo início (ex: #030d1a)",
  "bg2": "Cor hex do fundo fim (ex: #0a2d5e)",
  "accent": "Cor hex de destaque/botão (ex: #0057b8)"
}

Retorne SOMENTE o JSON, começando com { e terminando com }.`,

  instagram: `Você é um copywriter especialista em redes sociais. A partir do briefing recebido, extraia os dados e retorne APENAS um objeto JSON válido — sem explicações, sem markdown, sem texto extra.

Campos obrigatórios:
{
  "brand": "Nome da marca",
  "tag": "Tag curta (ex: Oferta Especial)",
  "emoji": "1 emoji relevante",
  "headline": "Título principal (máx 3 palavras)",
  "highlight": "Palavra de destaque (máx 2 palavras)",
  "subline": "Subtítulo motivacional (máx 15 palavras)",
  "offer": "Texto da pílula de oferta (ex: 3% OFF)",
  "cta": "Call to action final (máx 6 palavras)",
  "bg1": "Hex fundo cor 1 (ex: #0f0c29)",
  "bg2": "Hex fundo cor 2 (ex: #302b63)",
  "bg3": "Hex fundo cor 3 (ex: #24243e)",
  "accent": "Hex cor de destaque (ex: #f59e0b)"
}

Retorne SOMENTE o JSON, começando com { e terminando com }.`,

  datasheet: `Você é um especialista em conteúdo de marketing técnico. Gere uma ficha técnica de produto em Markdown bem estruturado, com seções: Visão Geral, Características, Especificações (tabela), Benefícios, Casos de Uso e CTA. Use apenas Markdown válido. Português do Brasil.`,

  text: `Você é um copywriter sênior de marketing. Escreva conteúdo persuasivo, claro e direto em português do Brasil. Use Markdown quando ajudar a leitura.`,
};

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "dist/client")));

// ─────────────────────────────────────────────────────────────────
// HELPER: chama Ollama de forma não-streaming e extrai JSON
// ─────────────────────────────────────────────────────────────────
async function ollamaJSON(prompt, model) {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { num_predict: 512, temperature: 0.2 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}`);
  const { response } = await res.json();
  // Extrair o JSON mesmo que o modelo devolva ```json ... ```
  const match = response.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Modelo não devolveu JSON válido");
  return JSON.parse(match[0]);
}

// ─────────────────────────────────────────────────────────────────
// ROTA PRINCIPAL
// ─────────────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { prompt, intent = "text", model = DEFAULT_MODEL } = req.body ?? {};
  if (!prompt?.trim()) return res.status(400).json({ error: "Campo 'prompt' é obrigatório" });

  // ── TEMPLATE INTENTS (banner / instagram) ──
  if (intent === "banner" || intent === "instagram") {
    const systemPrompt = SYSTEM_PROMPTS[intent];
    const fullPrompt   = `${systemPrompt}\n\nBriefing:\n${prompt.trim()}`;

    let data;
    try {
      data = await ollamaJSON(fullPrompt, model);
    } catch (err) {
      return res.status(502).json({ error: `Erro ao gerar dados: ${err.message}` });
    }

    const html = intent === "banner"
      ? bannerTemplate(data)
      : instagramTemplate(data);

    // Devolve em SSE para manter compatibilidade com o frontend
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.write(`data: ${JSON.stringify(html)}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }

  // ── STREAMING INTENTS (email, datasheet, text) ──
  const systemPrompt = SYSTEM_PROMPTS[intent] ?? SYSTEM_PROMPTS.text;
  const fullPrompt   = `${systemPrompt}\n\nPedido do usuário:\n${prompt.trim()}`;
  const isHtml       = HTML_INTENTS.has(intent);

  let ollamaRes;
  try {
    ollamaRes = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: fullPrompt,
        stream: true,
        options: { num_predict: isHtml ? 2048 : 1024, temperature: isHtml ? 0.3 : 0.7 },
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

  const reader     = ollamaRes.body.getReader();
  const decoder    = new TextDecoder();
  let lineBuffer   = "";
  let htmlAccum    = "";
  let htmlStarted  = false;

  const sendToken = (token) => res.write(`data: ${JSON.stringify(token)}\n\n`);
  const finish    = () => {
    if (isHtml && !htmlStarted && htmlAccum) sendToken(stripMarkdownWrapper(htmlAccum));
    res.write("data: [DONE]\n\n");
    res.end();
  };

  const pump = async () => {
    try {
      const { done, value } = await reader.read();
      if (done) { finish(); return; }

      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split("\n");
      lineBuffer  = lines.pop() ?? "";

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
            const trimmed = token.trim();
            if (trimmed && /^`+$/.test(trimmed)) {
              // backticks de fecho do modelo — descartar
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
const assetsDir  = path.join(__dirname, "dist/server/assets");
const serverFile = readdirSync(assetsDir).find(f => f.startsWith("server-") && f.endsWith(".js"));
if (!serverFile) throw new Error("Ficheiro server-*.js não encontrado em dist/server/assets/");
console.log(`📦 Handler SSR: ${serverFile}`);
const { default: handler } = await import(`./dist/server/assets/${serverFile}`);

app.use(async (req, res) => {
  try {
    const url     = new URL(req.url, `http://localhost:${PORT}`);
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
