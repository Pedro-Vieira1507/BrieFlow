/**
 * BrieFlow — Production Server
 *
 * Arquitectura:
 *   1. Express regista /api/chat, /api/translate, /api/generate-banner
 *   2. Todas as outras rotas passam ao handler Nitro do TanStack Start
 *      (.output/server/index.mjs) via toNodeListener() do h3
 *
 * NOTA: O TanStack Start (Nitro) gera o output em .output/, NÃO em dist/.
 *       O server-express.mjs NÃO importa createExpressApp — usa toNodeListener.
 */

import express    from "express";
import path       from "path";
import { fileURLToPath } from "url";
import http       from "http";

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const PORT       = process.env.PORT        || 3000;
const OLLAMA_URL = process.env.OLLAMA_URL  ?? "http://127.0.0.1:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:14b";

const HTML_INTENTS     = new Set(["email","banner","instagram","linkedin","landing"]);

// ═══════════════════════════════════════════════════════════════
// BRAND IDENTITIES
// ═══════════════════════════════════════════════════════════════
const BRAND_IDENTITIES = {
  forlab:{
    displayName:"FORLAB",
    bg1:"#001f5b",bg2:"#003399",
    accent:"#0055cc",accentLight:"#4d90fe",
    badgeColor:"#0055cc",dotColor:"#4d90fe",
    font:"Montserrat",
    palette:"azul corporativo — #001f5b, #003399, accent #0055cc",
    bgSearchQuery:"modern blue laboratory interior professional dark",
    productQueries:[
      "FORLAB pipette laboratory equipment product white background",
      "FORLAB micropipette single channel professional",
      "FORLAB laboratory analytical equipment",
    ],
  },
  shimadzu:{
    displayName:"SHIMADZU",
    bg1:"#001433",bg2:"#002d6b",
    accent:"#006bb6",accentLight:"#5ab4f0",
    badgeColor:"#006bb6",dotColor:"#5ab4f0",
    font:"Montserrat",
    palette:"azul Shimadzu — #001433, #002d6b, accent #006bb6",
    bgSearchQuery:"scientific analytical laboratory instruments professional blue",
    productQueries:[
      "Shimadzu HPLC analytical instrument white background",
      "Shimadzu spectrophotometer UV-Vis laboratory equipment",
      "Shimadzu analytical balance weighing laboratory",
    ],
  },
  dlab:{
    displayName:"DLAB",
    bg1:"#1a0000",bg2:"#5c0000",
    accent:"#cc0000",accentLight:"#ff4d4d",
    badgeColor:"#cc0000",dotColor:"#ff4d4d",
    font:"Montserrat",
    palette:"vermelho DLAB — #1a0000, #5c0000, accent #cc0000",
    bgSearchQuery:"laboratory professional dark red premium background",
    productQueries:[
      "DLAB pipette micropipette white background product",
      "DLAB single channel adjustable pipette laboratory",
      "DLAB multichannel pipette set laboratory equipment",
    ],
  },
  eppendorf:{
    displayName:"EPPENDORF",
    bg1:"#002e1f",bg2:"#005c3f",
    accent:"#00884a",accentLight:"#33cc7a",
    badgeColor:"#00884a",dotColor:"#33cc7a",
    font:"Montserrat",
    palette:"verde Eppendorf — #002e1f, #005c3f, accent #00884a",
    bgSearchQuery:"eppendorf laboratory green professional dark background",
    productQueries:[
      "Eppendorf Research Plus pipette white background product",
      "Eppendorf centrifuge 5427 laboratory equipment",
      "Eppendorf ThermoMixer laboratory instrument",
    ],
  },
  brand_generic:{
    displayName:"",
    bg1:"#030d1a",bg2:"#0a2d5e",
    accent:"#0057b8",accentLight:"#4da6ff",
    badgeColor:"#e8001c",dotColor:"#e8001c",
    font:"Montserrat",
    palette:"azul padrão",
    bgSearchQuery:"modern laboratory interior dark blue professional",
    productQueries:null,
  },
};

function detectBrand(prompt){
  const lower=prompt.toLowerCase();
  for(const[key,id] of Object.entries(BRAND_IDENTITIES)){
    if(key==="brand_generic") continue;
    if(lower.includes(key)||lower.includes(id.displayName.toLowerCase())) return id;
  }
  return BRAND_IDENTITIES.brand_generic;
}

// ═══════════════════════════════════════════════════════════════
// IMAGE SEARCH (DuckDuckGo)
// ═══════════════════════════════════════════════════════════════
async function searchOneImage(query){
  if(!query) return null;
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),8000);
  try{
    const vqdRes=await fetch(
      `https://duckduckgo.com/?q=${encodeURIComponent(query)}&ia=images`,
      {headers:{"User-Agent":"Mozilla/5.0"},signal:ctrl.signal}
    );
    if(!vqdRes.ok) throw new Error("vqd fetch failed");
    const vqdHtml=await vqdRes.text();
    const m=vqdHtml.match(/vqd=['"]([\d\w-]+)['"]/);
    if(!m) throw new Error("vqd not found");
    const imgRes=await fetch(
      `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&type=photo&vqd=${m[1]}&o=json&p=1`,
      {headers:{"User-Agent":"Mozilla/5.0","Accept":"application/json","Referer":"https://duckduckgo.com/"},signal:ctrl.signal}
    );
    if(!imgRes.ok) throw new Error("img fetch failed");
    const json=await imgRes.json();
    const list=json?.results??[];
    const best=list.find(x=>x.image&&/\.(jpg|jpeg|png|webp)/i.test(x.image))??list[0];
    if(best?.image) return best.image;
    throw new Error("no results");
  }catch(e){
    console.log(`[img] FALHOU "${query}": ${e.message}`);
    return null;
  }finally{
    clearTimeout(timer);
  }
}

async function searchProductImages(queries){
  const promises=queries.map(q=>searchOneImage(q));
  const timeout=new Promise(resolve=>setTimeout(()=>resolve(queries.map(()=>null)),14000));
  const results=await Promise.race([Promise.all(promises),timeout]);
  console.log(`[img] resultados:`,results.map(r=>r?r.slice(0,60):null));
  return results;
}

// ═══════════════════════════════════════════════════════════════
// MULTI-AGENT PIPELINE
// ═══════════════════════════════════════════════════════════════
const POLLINATIONS_NEG = "professional macro product photography, isolated on pure white background, no humans, nobody, no people, empty scene, no faces, no hands, no body parts";

const STRATEGIST_SYSTEM = {
  banner:`Você é um Copywriter B2B de Elite especializado em conversão.
FRAMEWORK OBRIGATÓRIO: AIDA (Atenção, Interesse, Desejo, Ação).

REGRAS ABSOLUTAS:
- NUNCA produza HTML, CSS, código ou tags de qualquer tipo.
- NUNCA use jargões de IA: "revolucionário", "inovador", "eleve seu nível", "desvende o poder".
- Tom: corporativo realista, focado em dor, métricas e eficiência.

ESTRUTURA DE SAÍDA OBRIGATÓRIA:
[HEADLINE]: (A promessa principal — máx 5 palavras, impacto máximo)
[SUBTITLE]: (O apoio ou oferta específica — máx 10 palavras)
[CTA]: (Ação direta e específica — ex: "Solicitar Diagnóstico Gratuito")`,

  instagram:`Você é um Copywriter B2B de Redes Sociais especializado em Swiss Design visual.
FRAMEWORK OBRIGATÓRIO: PAS (Problema, Agitação, Solução).

REGRAS ABSOLUTAS:
- NUNCA produza HTML, CSS ou código de qualquer tipo.
- Tom: provocativo mas profissional.

ESTRUTURA DE SAÍDA OBRIGATÓRIA:
[HEADLINE]: (Máx 6 palavras)
[SUBTITLE]: (Máx 10 palavras)
[CAPTION]: (3 parágrafos curtos seguindo PAS)`,

  email:`Você é um Copywriter B2B de E-mail Marketing de Elite.
FRAMEWORK OBRIGATÓRIO: AIDA.

REGRAS ABSOLUTAS:
- NUNCA produza HTML, CSS ou código.
- Parágrafos curtos: máximo 2 frases.

ESTRUTURA DE SAÍDA OBRIGATÓRIA:
[SUBJECT]: (máx 50 caracteres)
[HEADLINE]: (título interno impactante)
[BODY]: (corpo AIDA, escaneável)
[CTA]: (específico e direto)`,
};

const BANNER_TEMPLATE = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;900&display=swap');*{box-sizing:border-box;margin:0;padding:0;font-family:'Inter',sans-serif;}body{width:1200px;height:500px;overflow:hidden;}.banner{width:1200px;height:500px;display:flex;overflow:hidden;background:[PRIMARY_COLOR];color:#fff;position:relative;}.content{flex:1;padding:60px 80px;display:flex;flex-direction:column;justify-content:center;z-index:3;background:[PRIMARY_COLOR];}.title{font-size:56px;font-weight:900;line-height:1.05;letter-spacing:-1.5px;margin-bottom:20px;color:#fff;}.subtitle{font-size:22px;font-weight:600;color:rgba(255,255,255,0.85);margin-bottom:35px;}.cta{display:inline-flex;background:#fff;color:[PRIMARY_COLOR];padding:18px 42px;border-radius:8px;font-weight:800;font-size:16px;text-decoration:none;width:fit-content;}.image-side{width:550px;position:relative;display:flex;align-items:center;justify-content:center;padding:30px;overflow:hidden;}.image-side img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(-10px 20px 30px rgba(0,0,0,0.45));transform:scale(1.08);position:relative;z-index:2;}.gradient-overlay{position:absolute;top:0;bottom:0;left:0;width:220px;background:linear-gradient(to right,[PRIMARY_COLOR] 0%,transparent 100%);z-index:3;}</style></head><body><div class="banner"><div class="content"><h1 class="title">HEADLINE_AQUI</h1><p class="subtitle">SUBTITLE_AQUI</p><a href="#" class="cta">CTA_AQUI</a></div><div class="image-side"><div class="gradient-overlay"></div><img src="https://image.pollinations.ai/prompt/PRODUCT_DESCRIPTION_EN?width=600&height=500&nologo=true&seed=SEED" alt="product"/></div></div></body></html>`;

const INSTAGRAM_TEMPLATE = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');*{box-sizing:border-box;margin:0;padding:0;font-family:'Inter',sans-serif;}body{width:1080px;height:1080px;overflow:hidden;}.post{width:1080px;height:1080px;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;}.bg-image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1;}.color-overlay{position:absolute;inset:0;background:[PRIMARY_COLOR];opacity:0.82;z-index:2;}.content{position:relative;z-index:3;text-align:center;color:#fff;padding:80px;display:flex;flex-direction:column;align-items:center;gap:32px;}.headline{font-size:88px;font-weight:900;line-height:0.95;letter-spacing:-3px;text-transform:uppercase;}.subtitle{font-size:32px;font-weight:400;opacity:0.88;}.divider{width:80px;height:4px;background:rgba(255,255,255,0.6);border-radius:2px;}</style></head><body><div class="post"><img class="bg-image" src="https://image.pollinations.ai/prompt/PRODUCT_DESCRIPTION_EN?width=1080&height=1080&nologo=true&seed=SEED" alt="background"/><div class="color-overlay"></div><div class="content"><h1 class="headline">HEADLINE_AQUI</h1><div class="divider"></div><p class="subtitle">SUBTITLE_AQUI</p></div></div></body></html>`;

const EMAIL_TEMPLATE = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>EMAIL_SUBJECT_AQUI</title></head><body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;"><table width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f4f4f5"><tr><td align="center" style="padding:40px 10px;"><table width="600" border="0" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="border-radius:8px;overflow:hidden;"><tr><td bgcolor="[PRIMARY_COLOR]" style="padding:36px 48px;"><p style="margin:0;color:rgba(255,255,255,0.7);font-size:12px;text-transform:uppercase;letter-spacing:2px;">NOME_EMPRESA_AQUI</p><h1 style="margin:12px 0 0;color:#ffffff;font-size:28px;font-weight:700;">HEADLINE_AQUI</h1></td></tr><tr><td style="padding:40px 48px;"><table width="100%" border="0" cellpadding="0" cellspacing="0"><tr><td style="color:#374151;font-size:16px;line-height:1.7;">BODY_AQUI</td></tr><tr><td style="padding-top:32px;"></td></tr><tr><td align="center"><table border="0" cellpadding="0" cellspacing="0"><tr><td bgcolor="[PRIMARY_COLOR]" style="border-radius:6px;"><a href="#" style="display:inline-block;padding:16px 40px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;">CTA_AQUI</a></td></tr></table></td></tr></table></td></tr><tr><td bgcolor="#f9fafb" style="padding:24px 48px;border-top:1px solid #e5e7eb;"><p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">Recebeu este e-mail pois está na nossa lista de contactos B2B.</p></td></tr></table></td></tr></table></body></html>`;

const TEMPLATES_MAP = { banner: BANNER_TEMPLATE, instagram: INSTAGRAM_TEMPLATE, email: EMAIL_TEMPLATE };

function buildDesignerPrompt(intent, strategicCopy) {
  const template = TEMPLATES_MAP[intent] ?? TEMPLATES_MAP.banner;
  return `Você é o Diretor de Arte HTML — um coder de precisão de nível agência.

O Copywriter Estratégico gerou o seguinte copy perfeito. Injete-o EXATAMENTE no template.

=== COPY GERADO ===
${strategicCopy}
===================

REGRAS ABSOLUTAS:
1. Use o template HTML exato fornecido abaixo — NÃO altere a estrutura CSS.
2. Substitua todos os placeholders (HEADLINE_AQUI, SUBTITLE_AQUI, etc.) pelo copy acima.
3. Para [PRIMARY_COLOR]: derive uma cor sólida da marca a partir do briefing. Se não houver indicação, use #1a1a2e.
4. Para a URL Pollinations: descrição em inglês com negative prompts: "${POLLINATIONS_NEG}". NUNCA descreva humanos. Substitua SEED por número entre 1000-9999.
5. Retorne APENAS o HTML completo — sem explicações, sem markdown, sem blocos de código.

=== TEMPLATE HTML OBRIGATÓRIO ===
${template}`;
}

async function runCopywriterAgent(prompt, intent, model, contextRules = "") {
  const system = (STRATEGIST_SYSTEM[intent] ?? STRATEGIST_SYSTEM.banner) + contextRules;
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, system, prompt, stream: false }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Agente 1 falhou (${res.status}): ${txt}`);
  }
  const data = await res.json();
  return data.response ?? "";
}

// ═══════════════════════════════════════════════════════════════
// BANNER TEMPLATE LEGADO
// ═══════════════════════════════════════════════════════════════
function bannerTemplate(d){
  const bg1=d.bg1||"#030d1a",bg2=d.bg2||"#0a2d5e";
  const accent=d.accent||"#0057b8",accentLight=d.accentLight||"#4da6ff";
  const badgeColor=d.badgeColor||"#e8001c",dotColor=d.dotColor||"#e8001c";
  const bgImg=d.bg_image_url?`url('${d.bg_image_url}')`:`url('https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1400&q=80')`;
  const FALLBACKS=[
    "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=400&q=80",
    "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400&q=80",
    "https://images.unsplash.com/photo-1554475901-4538ddfbccc2?w=400&q=80",
  ];
  const imgs=[d.product_img_1||FALLBACKS[0],d.product_img_2||FALLBACKS[1],d.product_img_3||FALLBACKS[2]];
  const badgeGrad=`linear-gradient(135deg,${badgeColor} 0%,${badgeColor}cc 100%)`;
  const badgeShadow=`0 8px 28px ${badgeColor}88,0 0 0 1px rgba(255,255,255,.12)`;
  return `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=1200">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:400px;overflow:hidden;font-family:'Montserrat',sans-serif}
.banner{width:1200px;height:400px;background-image:${bgImg};background-size:cover;background-position:center;display:grid;grid-template-columns:420px 1fr 300px;position:relative;overflow:hidden}
.banner::before{content:'';position:absolute;inset:0;background:linear-gradient(105deg,${bg1}f5 0%,${bg1}cc 35%,${bg1}88 55%,${bg2}66 75%,${bg2}cc 100%);z-index:0}
.banner::after{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);background-size:44px 44px;z-index:1;pointer-events:none}
.col-left{padding:36px 24px 36px 48px;display:flex;flex-direction:column;justify-content:center;position:relative;z-index:3}
.brand-tag{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);border-radius:20px;padding:4px 14px;margin-bottom:16px;width:fit-content}
.brand-tag .dot{width:7px;height:7px;background:${dotColor};border-radius:50%;box-shadow:0 0 8px ${dotColor}}
.brand-tag span{font-size:11px;font-weight:600;color:rgba(255,255,255,.75);letter-spacing:1.5px;text-transform:uppercase}
.headline{font-size:34px;font-weight:900;color:#fff;line-height:1.1;letter-spacing:-.5px;margin-bottom:8px;text-shadow:0 2px 12px rgba(0,0,0,.6)}
.headline em{font-style:normal;color:${accentLight}}
.subline{font-size:13px;font-weight:600;color:rgba(255,255,255,.6);margin-bottom:10px;letter-spacing:.3px}
.description{font-size:12px;color:rgba(255,255,255,.45);line-height:1.65;max-width:280px}
.col-center{display:flex;align-items:flex-end;justify-content:center;padding:0 8px;position:relative;z-index:3;overflow:visible}
.prod-float{position:relative;display:flex;align-items:flex-end;justify-content:center;flex-shrink:0}
.prod-float--left{width:160px;height:340px;margin-right:-20px;transform:rotate(-4deg) translateY(8px);z-index:4}
.prod-float--center{width:220px;height:380px;z-index:6}
.prod-float--right{width:160px;height:340px;margin-left:-20px;transform:rotate(4deg) translateY(8px);z-index:4}
.prod-img{width:100%;height:100%;object-fit:contain;mix-blend-mode:multiply;filter:drop-shadow(0 16px 32px rgba(0,0,0,.55)) drop-shadow(0 4px 8px rgba(0,0,0,.35))}
.col-right{padding:36px 44px 36px 20px;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;position:relative;z-index:3}
.col-right::before{content:'';position:absolute;bottom:-60px;right:-60px;width:280px;height:280px;background:radial-gradient(circle,${badgeColor}22 0%,transparent 70%);pointer-events:none;z-index:0}
.badge{background:${badgeGrad};border-radius:14px;padding:16px 22px;text-align:center;margin-bottom:14px;box-shadow:${badgeShadow};min-width:175px;position:relative;overflow:hidden}
.badge::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent)}
.badge-value{font-size:44px;font-weight:900;color:#fff;line-height:1;letter-spacing:-2px}
.badge-value sup{font-size:18px;vertical-align:super;letter-spacing:0}
.badge-label{font-size:10px;font-weight:600;color:rgba(255,255,255,.85);letter-spacing:2px;text-transform:uppercase;margin-top:2px}
.validity{font-size:10px;color:rgba(255,255,255,.45);margin-bottom:12px;text-align:right;letter-spacing:.4px}
.cta{display:block;background:linear-gradient(135deg,${accent} 0%,${accent}cc 100%);color:#fff;font-family:'Montserrat',sans-serif;font-size:13px;font-weight:700;letter-spacing:.5px;padding:12px 22px;border-radius:8px;text-decoration:none;border:1.5px solid rgba(255,255,255,.2);box-shadow:0 4px 18px ${accent}88;text-align:center;width:100%}
.dv{position:absolute;top:12%;bottom:12%;width:1px;background:linear-gradient(to bottom,transparent,rgba(255,255,255,.12),transparent);z-index:2}
</style></head><body>
<div class="banner">
  <div class="dv" style="left:35%"></div>
  <div class="dv" style="left:74%"></div>
  <div class="col-left">
    <div class="brand-tag"><span class="dot"></span><span>${d.brand||"Marca"}</span></div>
    <h1 class="headline">${d.headline}<br><em>${d.highlight||""}</em></h1>
    <p class="subline">${d.subline||""}</p>
    <p class="description">${d.description||""}</p>
  </div>
  <div class="col-center">
    <div class="prod-float prod-float--left"><img src="${imgs[0]}" alt="Produto 1" class="prod-img" loading="lazy" onerror="this.style.opacity=0"/></div>
    <div class="prod-float prod-float--center"><img src="${imgs[1]}" alt="Produto 2" class="prod-img" loading="lazy" onerror="this.style.opacity=0"/></div>
    <div class="prod-float prod-float--right"><img src="${imgs[2]}" alt="Produto 3" class="prod-img" loading="lazy" onerror="this.style.opacity=0"/></div>
  </div>
  <div class="col-right">
    <div class="badge"><div class="badge-value">${d.badge_value||"3"}<sup>${d.badge_sup||""}</sup></div><div class="badge-label">${d.badge_label||"de Desconto"}</div></div>
    <p class="validity">&#x23F1; ${d.validity||"Oferta por tempo limitado"}</p>
    <a href="#" class="cta">${d.cta||"Saiba Mais"}</a>
  </div>
</div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// EXPRESS APP — rotas API
// ═══════════════════════════════════════════════════════════════
const app = express();
app.use(express.json({ limit: "4mb" }));

// ── POST /api/chat ────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { prompt, intent = "text", model = DEFAULT_MODEL, reasoning } = req.body ?? {};

  if (!prompt) return res.status(400).json({ error: "Falta prompt" });

  const isVisualIntent = ["banner", "email", "instagram"].includes(intent);
  const contextRules = reasoning
    ? `\n\n[DIRETRIZ ESTRATÉGICA]\nObjetivo: ${reasoning.objective}\nFunil: ${reasoning.funnelStage}\nTom: ${reasoning.tone}`
    : "";

  let finalSystemPrompt = "";
  let finalUserPrompt   = prompt;

  if (isVisualIntent) {
    let strategicCopy;
    try {
      strategicCopy = await runCopywriterAgent(prompt, intent, model, contextRules);
      console.log(`[Agent1] Copy gerado para "${intent}":\n${strategicCopy.slice(0,200)}...`);
    } catch (err) {
      console.error("[Agent1] ERRO:", err);
      return res.status(502).json({ error: `Agente 1 (Copywriter) falhou: ${err}` });
    }
    finalSystemPrompt = buildDesignerPrompt(intent, strategicCopy);
    finalUserPrompt   = `Renderize o HTML com base no copy acima. Diretrizes de marca do utilizador: ${prompt}`;
  } else {
    const singleAgentSystem = {
      text:      `Você é um Copywriter Sénior B2B. Escreva texto direto, sem jargões de IA. Use Markdown.${contextRules}`,
      datasheet: `Você é um Engenheiro de Produto. Escreva conteúdo técnico e preciso em Markdown.${contextRules}`,
    };
    finalSystemPrompt = singleAgentSystem[intent] ?? singleAgentSystem.text;
  }

  let ollamaRes;
  try {
    ollamaRes = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, system: finalSystemPrompt, prompt: finalUserPrompt.trim(), stream: true }),
    });
  } catch (err) {
    console.error("[Agent2] Fetch error:", err);
    return res.status(502).json({ error: `Ollama stream error: ${err}` });
  }

  if (!ollamaRes.ok) {
    const txt = await ollamaRes.text().catch(() => "");
    return res.status(502).json({ error: `Ollama respondeu ${ollamaRes.status}: ${txt}` });
  }

  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of ollamaRes.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        if (json.response) res.write(`data: ${JSON.stringify(json.response)}\n\n`);
        if (json.done) { res.write("data: [DONE]\n\n"); res.end(); return; }
      } catch { /* linha inválida */ }
    }
  }
  res.write("data: [DONE]\n\n");
  res.end();
});

// ── POST /api/translate ───────────────────────────────────────
app.post("/api/translate", async (req, res) => {
  const { prompt, model = DEFAULT_MODEL } = req.body ?? {};
  if (!prompt) return res.json({ englishPrompt: prompt });
  try {
    const r = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: `Translate the following marketing image brief into a concise, vivid English prompt for an image generator. Return ONLY the English prompt — no quotes, no preface, no explanation.\n\n${prompt}`,
        stream: false,
      }),
    });
    if (!r.ok) return res.json({ englishPrompt: prompt });
    const data = await r.json();
    const englishPrompt = (data.response ?? prompt).trim().replace(/^["']|["']$/g, "");
    return res.json({ englishPrompt });
  } catch {
    return res.json({ englishPrompt: prompt });
  }
});

// ── POST /api/generate-banner (legado) ────────────────────────
app.post("/api/generate-banner", async (req,res)=>{
  const body=req.body||{};
  const prompt=body.prompt||"";
  const model=body.model||DEFAULT_MODEL;
  const brand=detectBrand(prompt);

  let productImages=[null,null,null];
  if(brand.productQueries){
    try{ productImages=await searchProductImages(brand.productQueries); }
    catch(e){ console.error("[banner] searchProductImages error:",e); }
  }

  const schema=`Gere SOMENTE um JSON válido (sem markdown, sem blocos de código) no formato:
{"headline":"...","highlight":"...","subline":"...","description":"...","badge_value":"...","badge_sup":"...","badge_label":"...","validity":"...","cta":"..."}

Contexto da marca: ${brand.palette}
Briefing: ${prompt}`;

  let ollamaData;
  try{
    const or=await fetch(`${OLLAMA_URL}/api/generate`,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({model,prompt:schema,stream:false}),
    });
    ollamaData=await or.json();
  }catch(e){ return res.status(502).json({error:"Ollama unavailable"}); }

  let fields={};
  try{
    const raw=(ollamaData.response||"").trim();
    const m=raw.match(/\{[\s\S]*\}/);
    if(m) fields=JSON.parse(m[0]);
  }catch(e){ console.error("[banner] JSON parse error",e); }

  const d={
    ...brand, brand:brand.displayName, bg_image_url:null,
    product_img_1:productImages[0], product_img_2:productImages[1], product_img_3:productImages[2],
    headline:fields.headline||"Precisão que transforma",
    highlight:fields.highlight||"",
    subline:fields.subline||"",
    description:fields.description||"",
    badge_value:fields.badge_value||"3",
    badge_sup:fields.badge_sup||"%",
    badge_label:fields.badge_label||"de Desconto",
    validity:fields.validity||"Oferta por tempo limitado",
    cta:fields.cta||"Ver Oferta",
  };
  res.setHeader("Content-Type","text/html;charset=utf-8");
  res.send(bannerTemplate(d));
});

// ═══════════════════════════════════════════════════════════════
// NITRO / TANSTACK START HANDLER
//
// O TanStack Start (Nitro) gera .output/server/index.mjs
// Esse ficheiro exporta { handler } — um h3 event-handler.
// Convertemos com toNodeListener() do h3 para usar com Express.
//
// Se .output não existir (antes do build), o servidor arranque
// em modo "só API" sem crash — útil para testes locais.
// ═══════════════════════════════════════════════════════════════
const outputPath = path.join(__dirname, ".output/server/index.mjs");
let nitroAttached = false;

try {
  const nitro = await import(outputPath);

  // h3 exporta toNodeListener; Nitro re-exporta o mesmo util
  const { toNodeListener } = await import("h3").catch(async () => {
    // fallback: tentar importar de dentro do .output
    return await import(path.join(__dirname, ".output/server/node_modules/h3/dist/index.mjs"))
      .catch(() => ({ toNodeListener: null }));
  });

  const handler = nitro.handler ?? nitro.default ?? nitro;

  if (toNodeListener && typeof handler === "function") {
    // Modo preferido: toNodeListener converte h3 handler → Node.js requestListener
    app.use(toNodeListener(handler));
    nitroAttached = true;
    console.log("[BrieFlow] Nitro SSR handler ligado via toNodeListener");
  } else if (typeof handler === "function") {
    // Fallback: tentar usar directamente como middleware Node.js
    app.use((req, res) => handler(req, res));
    nitroAttached = true;
    console.log("[BrieFlow] Nitro SSR handler ligado via middleware directo");
  }
} catch (e) {
  console.warn("[BrieFlow] .output/server/index.mjs não encontrado — a correr em modo API-only.");
  console.warn("           Execute 'npm run build' para activar o SSR do TanStack Start.");
  console.warn("           Detalhe:", e.message);

  // Servir client build estático como fallback (se existir)
  const clientBuild = path.join(__dirname, ".output/public");
  app.use(express.static(clientBuild));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientBuild, "index.html"), (err) => {
      if (err) res.status(503).send("BrieFlow: build não encontrado. Execute npm run build.");
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n[BrieFlow] ✓ Servidor em http://0.0.0.0:${PORT}`);
  console.log(`[BrieFlow] Ollama: ${OLLAMA_URL} | Modelo: ${DEFAULT_MODEL}`);
  console.log(`[BrieFlow] SSR: ${nitroAttached ? "Nitro activo" : "modo API-only (sem build)"}\n`);
});
