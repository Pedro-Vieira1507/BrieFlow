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
// BRAND IDENTITIES — paletas e tipografia oficiais por marca
// Adicione novas marcas aqui. A chave é lowercase sem acentos.
// O objeto é injetado diretamente no briefing enviado ao Ollama.
// ─────────────────────────────────────────────────────────────────
const BRAND_IDENTITIES = {
  forlab: {
    displayName: "FORLAB",
    bg1: "#001f5b",          // azul navy profundo
    bg2: "#003399",          // azul Forlab principal
    accent: "#0055cc",       // azul vivo para CTA
    accentLight: "#4d90fe",  // azul claro para destaques em texto
    badgeColor: "#0055cc",   // cor do badge de oferta
    dotColor: "#4d90fe",
    font: "Montserrat",
    palette: "azul corporativo — #001f5b, #003399, accent #0055cc",
    bgSearchQuery: "modern blue laboratory interior professional",
  },
  shimadzu: {
    displayName: "SHIMADZU",
    bg1: "#001433",
    bg2: "#002d6b",
    accent: "#006bb6",
    accentLight: "#5ab4f0",
    badgeColor: "#006bb6",
    dotColor: "#5ab4f0",
    font: "Montserrat",
    palette: "azul Shimadzu — #001433, #002d6b, accent #006bb6",
    bgSearchQuery: "scientific analytical laboratory instruments blue",
  },
  dlab: {
    displayName: "DLAB",
    bg1: "#1a0000",
    bg2: "#5c0000",
    accent: "#cc0000",
    accentLight: "#ff4d4d",
    badgeColor: "#cc0000",
    dotColor: "#ff4d4d",
    font: "Montserrat",
    palette: "vermelho DLAB — #1a0000, #5c0000, accent #cc0000",
    bgSearchQuery: "laboratory pipettes dark red professional background",
  },
  eppendorf: {
    displayName: "EPPENDORF",
    bg1: "#002e1f",
    bg2: "#005c3f",
    accent: "#00884a",
    accentLight: "#33cc7a",
    badgeColor: "#00884a",
    dotColor: "#33cc7a",
    font: "Montserrat",
    palette: "verde Eppendorf — #002e1f, #005c3f, accent #00884a",
    bgSearchQuery: "eppendorf laboratory green professional background",
  },
  brand_generic: {
    displayName: "",
    bg1: "#030d1a",
    bg2: "#0a2d5e",
    accent: "#0057b8",
    accentLight: "#4da6ff",
    badgeColor: "#e8001c",
    dotColor: "#e8001c",
    font: "Montserrat",
    palette: "azul padrão",
    bgSearchQuery: "modern laboratory interior dark blue",
  },
};

/**
 * Detecta qual marca está sendo mencionada no prompt (case-insensitive).
 * Retorna o objeto de identidade da marca ou o genérico.
 */
function detectBrand(prompt) {
  const lower = prompt.toLowerCase();
  for (const [key, identity] of Object.entries(BRAND_IDENTITIES)) {
    if (key === "brand_generic") continue;
    if (lower.includes(key)) return identity;
    // Tenta também o displayName em lowercase
    if (lower.includes(identity.displayName.toLowerCase())) return identity;
  }
  return BRAND_IDENTITIES.brand_generic;
}

// ─────────────────────────────────────────────────────────────────
// IMAGE SEARCH — paralelo, timeout total 12 s, nunca bloqueia
// ─────────────────────────────────────────────────────────────────
async function searchOneImage(query) {
  if (!query) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const vqdRes = await fetch(
      `https://duckduckgo.com/?q=${encodeURIComponent(query)}&ia=images`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: ctrl.signal }
    );
    if (!vqdRes.ok) throw new Error("vqd fetch failed");
    const vqdHtml = await vqdRes.text();
    const m = vqdHtml.match(/vqd=['"](\d-[\d\w-]+)['"]/);
    if (!m) throw new Error("vqd not found");
    const imgRes = await fetch(
      `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&type=photo&vqd=${m[1]}&o=json&p=1`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json",
          "Referer": "https://duckduckgo.com/",
        },
        signal: ctrl.signal,
      }
    );
    if (!imgRes.ok) throw new Error("img fetch failed");
    const json = await imgRes.json();
    const list = json?.results ?? [];
    const best = list.find(x => x.image && /\.(jpg|jpeg|png|webp)/i.test(x.image)) ?? list[0];
    if (best?.image) return best.image;
    throw new Error("no results");
  } catch (e) {
    console.log(`[img] FALHOU "${query}": ${e.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function searchProductImages(queries) {
  const promises = queries.map(q => searchOneImage(q));
  const timeout  = new Promise(resolve =>
    setTimeout(() => resolve(queries.map(() => null)), 12000)
  );
  const results = await Promise.race([Promise.all(promises), timeout]);
  console.log(`[img] resultados:`, results.map(r => r ? r.slice(0, 60) : null));
  return results;
}

// ─────────────────────────────────────────────────────────────────
// TEMPLATES
// ─────────────────────────────────────────────────────────────────
function bannerTemplate(d) {
  const bg1         = d.bg1         || "#030d1a";
  const bg2         = d.bg2         || "#0a2d5e";
  const accent      = d.accent      || "#0057b8";
  const accentLight = d.accentLight || (accent === "#0057b8" ? "#4da6ff" : accent);
  const badgeColor  = d.badgeColor  || "#e8001c";
  const dotColor    = d.dotColor    || "#e8001c";

  const bgImg = d.bg_image_url
    ? `url('${d.bg_image_url}')`
    : `url('https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1400&q=80')`;

  const FALLBACKS = [
    "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=400&q=80",
    "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400&q=80",
    "https://images.unsplash.com/photo-1554475901-4538ddfbccc2?w=400&q=80",
  ];
  const imgs = [
    d.product_img_1 || FALLBACKS[0],
    d.product_img_2 || FALLBACKS[1],
    d.product_img_3 || FALLBACKS[2],
  ];

  const productGrid = imgs.map((url, i) =>
    `<div class="prod-card${i === 1 ? " prod-card--main" : ""}">
      <img src="${url}" alt="Produto ${i + 1}" class="prod-img" loading="lazy" />
    </div>`
  ).join("\n    ");

  // badge cor da marca
  const badgeGrad = `linear-gradient(135deg,${badgeColor} 0%,${badgeColor}cc 100%)`;
  const badgeShadow = `0 8px 28px ${badgeColor}88,0 0 0 1px rgba(255,255,255,.12)`;
  const glowRight = `radial-gradient(circle,${badgeColor}22 0%,transparent 70%)`;

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
.banner{
  width:1200px;height:400px;
  background-image:${bgImg};
  background-size:cover;background-position:center;
  display:grid;grid-template-columns:420px 1fr 300px;
  position:relative;overflow:hidden
}
.banner::before{
  content:'';position:absolute;inset:0;
  background:linear-gradient(105deg,${bg1}f5 0%,${bg1}cc 35%,${bg1}88 55%,${bg2}66 75%,${bg2}cc 100%);
  z-index:0
}
.banner::after{
  content:'';position:absolute;inset:0;
  background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);
  background-size:44px 44px;z-index:1;pointer-events:none
}
.col-left{padding:36px 24px 36px 48px;display:flex;flex-direction:column;justify-content:center;position:relative;z-index:3}
.brand-tag{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);border-radius:20px;padding:4px 14px;margin-bottom:16px;width:fit-content}
.brand-tag .dot{width:7px;height:7px;background:${dotColor};border-radius:50%;box-shadow:0 0 8px ${dotColor}}
.brand-tag span{font-size:11px;font-weight:600;color:rgba(255,255,255,.75);letter-spacing:1.5px;text-transform:uppercase}
.headline{font-size:34px;font-weight:900;color:#fff;line-height:1.1;letter-spacing:-.5px;margin-bottom:8px;text-shadow:0 2px 12px rgba(0,0,0,.6)}
.headline em{font-style:normal;color:${accentLight}}
.subline{font-size:13px;font-weight:600;color:rgba(255,255,255,.6);margin-bottom:10px;letter-spacing:.3px}
.description{font-size:12px;font-weight:400;color:rgba(255,255,255,.45);line-height:1.65;max-width:280px}
.col-center{display:flex;align-items:center;justify-content:center;gap:12px;padding:28px 16px;position:relative;z-index:3}
.prod-card{width:110px;height:110px;background:rgba(255,255,255,.92);border-radius:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 24px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.15);overflow:hidden;flex-shrink:0}
.prod-card--main{width:148px;height:148px;box-shadow:0 10px 36px ${accent}88,0 0 0 2px ${accentLight}55}
.prod-img{width:100%;height:100%;object-fit:contain;padding:8px}
.col-right{padding:36px 44px 36px 20px;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;position:relative;z-index:3}
.col-right::before{content:'';position:absolute;bottom:-60px;right:-60px;width:280px;height:280px;background:${glowRight};pointer-events:none;z-index:0}
.badge{background:${badgeGrad};border-radius:14px;padding:16px 22px;text-align:center;margin-bottom:14px;box-shadow:${badgeShadow};min-width:175px;position:relative;overflow:hidden}
.badge::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent)}
.badge-value{font-size:44px;font-weight:900;color:#fff;line-height:1;letter-spacing:-2px}
.badge-value sup{font-size:18px;vertical-align:super;letter-spacing:0}
.badge-label{font-size:10px;font-weight:600;color:rgba(255,255,255,.85);letter-spacing:2px;text-transform:uppercase;margin-top:2px}
.validity{font-size:10px;color:rgba(255,255,255,.45);margin-bottom:12px;text-align:right;letter-spacing:.4px}
.cta{display:block;background:linear-gradient(135deg,${accent} 0%,${accent}cc 100%);color:#fff;font-family:'Montserrat',sans-serif;font-size:13px;font-weight:700;letter-spacing:.5px;padding:12px 22px;border-radius:8px;text-decoration:none;border:1.5px solid rgba(255,255,255,.2);box-shadow:0 4px 18px ${accent}88;text-align:center;width:100%}
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
      <div class="badge-value">${d.badge_value || "3"}<sup>${d.badge_sup || ""}</sup></div>
      <div class="badge-label">${d.badge_label || "de Desconto"}</div>
    </div>
    <p class="validity">&#x23F1; ${d.validity || "Oferta por tempo limitado"}</p>
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
.offer-pill{background:${accent};border-radius:50px;padding:16px 48px;font-size:22px;font-weight:900;color:#fff;letter-spacing:.5px;box-shadow:0 8px 32px ${accent}66}
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
    <div class="emoji-icon">${d.emoji || "\uD83D\uDE80"}</div>
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

  banner: (brandCtx) => `Você é um copywriter especialista em marketing visual. A partir do briefing recebido, extraia os dados e retorne APENAS um objeto JSON válido — sem explicações, sem markdown, sem texto extra.

${brandCtx ? `IDENTIDADE VISUAL DA MARCA (USE EXATAMENTE ESTAS CORES — NÃO ALTERE):
${brandCtx}
` : ""}
Campos obrigatórios:
{
  "brand": "Nome da marca ou produto",
  "headline": "Título principal (máx 4 palavras)",
  "highlight": "Palavra ou frase em destaque (máx 3 palavras)",
  "subline": "Subtítulo secundário (máx 8 palavras)",
  "description": "Descrição curta (máx 20 palavras)",
  "badge_value": "Número ou texto do desconto (ex: COMPRE 3)",
  "badge_sup": "Sufixo do badge (ex: % ou deixar vazio)",
  "badge_label": "Label do badge (ex: LEVE 4)",
  "validity": "Texto de validade",
  "cta": "Texto do botão CTA (máx 5 palavras)",
  "bg_search_query": "Query para imagem de fundo (em inglês)",
  "search_query_1": "Query produto 1 em inglês",
  "search_query_2": "Query produto 2 em inglês",
  "search_query_3": "Query produto 3 em inglês"
}

Retorne SOMENTE o JSON, começando com { e terminando com }.`,

  instagram: (brandCtx) => `Você é um copywriter especialista em redes sociais. A partir do briefing recebido, extraia os dados e retorne APENAS um objeto JSON válido — sem explicações, sem markdown, sem texto extra.

${brandCtx ? `IDENTIDADE VISUAL DA MARCA (USE EXATAMENTE ESTAS CORES — NÃO ALTERE):
${brandCtx}
` : ""}
Campos obrigatórios:
{
  "brand": "Nome da marca",
  "tag": "Tag curta (ex: Oferta Especial)",
  "emoji": "1 emoji relevante",
  "headline": "Título principal (máx 3 palavras)",
  "highlight": "Palavra de destaque (máx 2 palavras)",
  "subline": "Subtítulo motivacional (máx 15 palavras)",
  "offer": "Texto da pílula de oferta (ex: COMPRE 3 LEVE 4)",
  "cta": "Call to action final (máx 6 palavras)"
}

Retorne SOMENTE o JSON, começando com { e terminando com }.`,

  datasheet: `Você é um especialista em conteúdo de marketing técnico. Gere uma ficha técnica de produto em Markdown bem estruturado, com seções: Visão Geral, Características, Especificações (tabela), Benefícios, Casos de Uso e CTA. Use apenas Markdown válido. Português do Brasil.`,

  text: `Você é um copywriter sênior de marketing. Escreva conteúdo persuasivo, claro e direto em português do Brasil. Use Markdown quando ajudar a leitura.`,
};

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "dist/client")));

// ─────────────────────────────────────────────────────────────────
// HELPER: Ollama não-streaming → JSON
// ─────────────────────────────────────────────────────────────────
async function ollamaJSON(prompt, model) {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { num_predict: 600, temperature: 0.2 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}`);
  const { response } = await res.json();
  const match = response.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Modelo não devolveu JSON válido: " + response.slice(0, 200));
  return JSON.parse(match[0]);
}

// ─────────────────────────────────────────────────────────────────
// ROTA PRINCIPAL
// ─────────────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { prompt, intent = "text", model = DEFAULT_MODEL } = req.body ?? {};
  if (!prompt?.trim()) return res.status(400).json({ error: "Campo 'prompt' é obrigatório" });

  console.log(`[chat] intent=${intent} model=${model} prompt=${prompt.slice(0,80)}`);

  // ── TEMPLATE INTENTS (banner / instagram) ──
  if (intent === "banner" || intent === "instagram") {

    // 1. Detecta marca e prepara contexto de cores
    const brandIdentity = detectBrand(prompt);
    const brandCtx = [
      `Marca: ${brandIdentity.displayName || "(genérica)"}`,
      `Paleta: ${brandIdentity.palette}`,
      `bg1: ${brandIdentity.bg1}`,
      `bg2: ${brandIdentity.bg2}`,
      `accent: ${brandIdentity.accent}`,
    ].join("\n");

    console.log(`[brand] detectada: ${brandIdentity.displayName || "genérica"} | paleta: ${brandIdentity.palette}`);

    // 2. Gera prompt com system + contexto de marca
    const systemFn    = SYSTEM_PROMPTS[intent];
    const systemPrompt = typeof systemFn === "function" ? systemFn(brandCtx) : systemFn;
    const fullPrompt   = `${systemPrompt}\n\nBriefing:\n${prompt.trim()}`;

    let data;
    try {
      console.log(`[chat] chamando ollamaJSON...`);
      data = await ollamaJSON(fullPrompt, model);
      console.log(`[chat] JSON obtido:`, JSON.stringify(data).slice(0, 200));
    } catch (err) {
      console.error(`[chat] ERRO ollamaJSON:`, err.message);
      return res.status(502).json({ error: `Erro ao gerar dados: ${err.message}` });
    }

    // 3. Garante que as cores da identidade SEMPRE sobrescrevem o JSON do modelo
    data.bg1         = brandIdentity.bg1;
    data.bg2         = brandIdentity.bg2;
    data.accent      = brandIdentity.accent;
    data.accentLight = brandIdentity.accentLight;
    data.badgeColor  = brandIdentity.badgeColor;
    data.dotColor    = brandIdentity.dotColor;

    // 4. Busca paralela de imagens com timeout total 12 s
    if (intent === "banner") {
      const bgQuery = data.bg_search_query  || brandIdentity.bgSearchQuery;
      const q1      = data.search_query_1   || "laboratory pipette product white background";
      const q2      = data.search_query_2   || "micropipette set isolated white";
      const q3      = data.search_query_3   || "pipette tips rack laboratory";

      console.log(`[img] iniciando busca paralela: ["${bgQuery}","${q1}","${q2}","${q3}"]`);
      try {
        const [bgUrl, img1, img2, img3] = await searchProductImages([bgQuery, q1, q2, q3]);
        if (bgUrl) data.bg_image_url  = bgUrl;
        if (img1)  data.product_img_1 = img1;
        if (img2)  data.product_img_2 = img2;
        if (img3)  data.product_img_3 = img3;
      } catch (e) {
        console.log(`[img] busca falhou, usando fallbacks:`, e.message);
      }
    }

    const html = intent === "banner" ? bannerTemplate(data) : instagramTemplate(data);
    console.log(`[chat] HTML gerado, bytes=${html.length}, enviando...`);

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
  const systemRaw    = SYSTEM_PROMPTS[intent] ?? SYSTEM_PROMPTS.text;
  const systemPrompt = typeof systemRaw === "function" ? systemRaw("") : systemRaw;
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

  const reader    = ollamaRes.body.getReader();
  const decoder   = new TextDecoder();
  let lineBuffer  = "";
  let htmlAccum   = "";
  let htmlStarted = false;

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
            if (idx !== -1) { htmlStarted = true; sendToken(htmlAccum.slice(idx)); htmlAccum = ""; }
          } else {
            if (token && !/^`+$/.test(token.trim())) sendToken(token);
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
  return text.replace(/^```(?:html)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

// SSR
const assetsDir  = path.join(__dirname, "dist/server/assets");
const serverFile = readdirSync(assetsDir).find(f => f.startsWith("server-") && f.endsWith(".js"));
if (!serverFile) throw new Error("server-*.js não encontrado em dist/server/assets/");
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
