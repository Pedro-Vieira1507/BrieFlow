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
// IMAGE SEARCH — DDG + Bing fallback
// ─────────────────────────────────────────────────────────────────
async function searchProductImages(queries) {
  // Retorna array de até N URLs (uma por query)
  const results = [];
  for (const q of queries) {
    const url = await searchOneImage(q);
    results.push(url || null);
  }
  return results;
}

async function searchOneImage(query) {
  if (!query) return null;

  // Tentativa 1: DuckDuckGo Images
  try {
    const vqd = await getDDGToken(query);
    if (vqd) {
      const url = `https://duckduckgo.com/i.js?` +
        `q=${encodeURIComponent(query)}&` +
        `type=photo&layout=wide&vqd=${vqd}&l=pt-BR&p=2&o=json&f=,,,,,`;
      const r = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
          "Accept": "application/json",
          "Referer": "https://duckduckgo.com/",
        },
        signal: AbortSignal.timeout(6000),
      });
      if (r.ok) {
        const json = await r.json();
        const list = json?.results ?? [];
        const best = list.find(x => x.image && /product|equip|lab|instrument|kit/i.test(x.url || ""))
          ?? list[0];
        if (best?.image) return best.image;
      }
    }
  } catch { /* ignora */ }

  // Tentativa 2: Bing Images scrape
  try {
    const bingUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query + " product white background")}&form=HDRSC2&first=1&count=5&qft=+filterui:photo-photo`;
    const r = await fetch(bingUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const html = await r.text();
      const matches = [...html.matchAll(/"murl":"(https?:[^"]+)"/g)];
      if (matches.length > 0) {
        const imgUrl = matches.map(m => m[1]).find(u => /\.(jpg|jpeg|png|webp)/i.test(u));
        if (imgUrl) return imgUrl;
      }
    }
  } catch { /* ignora */ }

  return null;
}

async function getDDGToken(query) {
  try {
    const r = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&ia=images`, {
      headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const html = await r.text();
    const m = html.match(/vqd=['"](\d-[\d\w-]+)['"]/);
    return m ? m[1] : null;
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────
// TEMPLATES PROFISSIONAIS
// ─────────────────────────────────────────────────────────────────

function bannerTemplate(d) {
  const bg1    = d.bg1    || "#030d1a";
  const bg2    = d.bg2    || "#0a2d5e";
  const accent = d.accent || "#0057b8";
  const accentLight = accent === "#0057b8" ? "#4da6ff" : accent;

  // Background de laboratório — usa URL buscada ou fallback de alta qualidade
  const bgImg = d.bg_image_url
    ? `url('${d.bg_image_url}')`
    : `url('https://pplx-res.cloudinary.com/image/upload/pplx_search_images/9a019c8459d97b4ebfc8d000a89a29e9e175561c.jpg')`;

  // 3 imagens de produto — usa URLs buscadas ou fallbacks reais Shimadzu
  const FALLBACKS = [
    "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/ed15d7a7e425f0798f241a378da490563832b11b.jpg",
    "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/0c5fd1bf82083c866fc95ff2bc4bdd24c6ddbd80.jpg",
    "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/0228a5ba01bddffb53de21156e01f04080ce99a0.jpg",
  ];

  const imgs = [
    d.product_img_1 || FALLBACKS[0],
    d.product_img_2 || FALLBACKS[1],
    d.product_img_3 || FALLBACKS[2],
  ];

  const productGrid = imgs.map((url, i) => `
    <div class="prod-card${i === 1 ? " prod-card--main" : ""}">
      <img src="${url}" alt="Produto ${i + 1}" class="prod-img" />
    </div>`).join("\n");

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

/* BACKGROUND: foto de laboratório com overlay gradient escuro */
.banner{
  width:1200px;height:400px;
  background-image:${bgImg};
  background-size:cover;background-position:center;
  display:grid;grid-template-columns:420px 1fr 300px;
  position:relative;overflow:hidden
}
/* Overlay gradient direcional — escurece o BG para texto legível */
.banner::before{
  content:'';position:absolute;inset:0;
  background:linear-gradient(
    105deg,
    ${bg1}f5 0%,
    ${bg1}cc 35%,
    ${bg1}88 55%,
    ${bg2}66 75%,
    ${bg2}cc 100%
  );
  z-index:0
}
/* Grid de pontos sutil */
.banner::after{
  content:'';position:absolute;inset:0;
  background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),
                   linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);
  background-size:44px 44px;z-index:1;pointer-events:none
}

/* LEFT — copy */
.col-left{padding:36px 24px 36px 48px;display:flex;flex-direction:column;justify-content:center;position:relative;z-index:3}
.brand-tag{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);border-radius:20px;padding:4px 14px;margin-bottom:16px;width:fit-content}
.brand-tag .dot{width:7px;height:7px;background:#e8001c;border-radius:50%;box-shadow:0 0 8px #e8001c}
.brand-tag span{font-size:11px;font-weight:600;color:rgba(255,255,255,.75);letter-spacing:1.5px;text-transform:uppercase}
.headline{font-size:34px;font-weight:900;color:#fff;line-height:1.1;letter-spacing:-.5px;margin-bottom:8px;text-shadow:0 2px 12px rgba(0,0,0,.6)}
.headline em{font-style:normal;color:${accentLight}}
.subline{font-size:13px;font-weight:600;color:rgba(255,255,255,.6);margin-bottom:10px;letter-spacing:.3px}
.description{font-size:12px;font-weight:400;color:rgba(255,255,255,.45);line-height:1.65;max-width:280px}

/* CENTER — 3 product cards */
.col-center{
  display:flex;align-items:center;justify-content:center;
  gap:12px;padding:28px 16px;position:relative;z-index:3
}
.prod-card{
  width:110px;height:110px;
  background:rgba(255,255,255,.92);
  border-radius:12px;
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 6px 24px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.15);
  overflow:hidden;
  flex-shrink:0;
  transition:transform .2s
}
.prod-card--main{
  width:148px;height:148px;
  box-shadow:0 10px 36px rgba(0,90,220,.5),0 0 0 2px ${accentLight}55;
}
.prod-img{width:100%;height:100%;object-fit:contain;padding:8px}

/* RIGHT — badge + CTA */
.col-right{padding:36px 44px 36px 20px;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;position:relative;z-index:3}
.col-right::before{content:'';position:absolute;bottom:-60px;right:-60px;width:280px;height:280px;background:radial-gradient(circle,rgba(232,0,28,.18) 0%,transparent 70%);pointer-events:none;z-index:0}
.badge{background:linear-gradient(135deg,#e8001c 0%,#ff4d4d 100%);border-radius:14px;padding:16px 22px;text-align:center;margin-bottom:14px;box-shadow:0 8px 28px rgba(232,0,28,.5),0 0 0 1px rgba(255,255,255,.12);min-width:175px;position:relative;overflow:hidden}
.badge::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent)}
.badge-value{font-size:44px;font-weight:900;color:#fff;line-height:1;letter-spacing:-2px}
.badge-value sup{font-size:18px;vertical-align:super;letter-spacing:0}
.badge-label{font-size:10px;font-weight:600;color:rgba(255,255,255,.85);letter-spacing:2px;text-transform:uppercase;margin-top:2px}
.validity{font-size:10px;color:rgba(255,255,255,.45);margin-bottom:12px;text-align:right;letter-spacing:.4px}
.cta{display:block;background:linear-gradient(135deg,${accent} 0%,${accent}cc 100%);color:#fff;font-family:'Montserrat',sans-serif;font-size:13px;font-weight:700;letter-spacing:.5px;padding:12px 22px;border-radius:8px;text-decoration:none;border:1.5px solid rgba(255,255,255,.2);box-shadow:0 4px 18px ${accent}88;text-align:center;width:100%}

/* Divisores verticais */
.dv{position:absolute;top:12%;bottom:12%;width:1px;background:linear-gradient(to bottom,transparent,rgba(255,255,255,.12),transparent);z-index:2}
</style>
</head>
<body>
<div class="banner">
  <div class="dv" style="left:35%"></div>
  <div class="dv" style="left:74%"></div>

  <div class="col-left">
    <div class="brand-tag"><span class="dot"></span><span>${d.brand || "Marca"}</span></div>
    <h1 class="headline">${d.headline}<br><em>${d.highlight || ""}</em></h1>
    <p class="subline">${d.subline || ""}</p>
    <p class="description">${d.description || ""}</p>
  </div>

  <div class="col-center">
    ${productGrid}
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
// SYSTEM PROMPTS
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
  "accent": "Cor hex de destaque/botão (ex: #0057b8)",
  "bg_search_query": "Query para imagem de fundo/ambiente (ex: modern laboratory interior blue dark)",
  "search_query_1": "Query produto 1 fundo branco (ex: DLAB pipette product white background isolated)",
  "search_query_2": "Query produto 2 fundo branco (ex: laboratory micropipette set isolated)",
  "search_query_3": "Query produto 3 fundo branco (ex: pipette tips rack laboratory white background)"
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

    // Para banners: busca paralela de 4 imagens (1 background + 3 produtos)
    if (intent === "banner") {
      const bgQuery = data.bg_search_query || "modern laboratory interior dark blue";
      const q1 = data.search_query_1 || (data.search_query + " product white background");
      const q2 = data.search_query_2 || (data.search_query + " isolated white");
      const q3 = data.search_query_3 || (data.search_query + " laboratory equipment");

      try {
        const [bgUrl, img1, img2, img3] = await searchProductImages([bgQuery, q1, q2, q3]);
        if (bgUrl)  data.bg_image_url   = bgUrl;
        if (img1)   data.product_img_1  = img1;
        if (img2)   data.product_img_2  = img2;
        if (img3)   data.product_img_3  = img3;
      } catch { /* continua com fallbacks */ }
    }

    const html = intent === "banner"
      ? bannerTemplate(data)
      : instagramTemplate(data);

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
              // backticks de fecho — descartar
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
