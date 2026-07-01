import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { readdirSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT      = process.env.PORT        || 3000;
const OLLAMA_URL= process.env.OLLAMA_URL  ?? "http://127.0.0.1:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? "gemma3:4b";

const HTML_INTENTS = new Set(["email","banner","instagram","linkedin","landing"]);
const TEMPLATE_INTENTS = new Set(["banner","instagram","linkedin"]);

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
// IMAGE SEARCH
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
    const m=vqdHtml.match(/vqd=['"](\d-[\d\w-]+)['"]/);
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
// TEMPLATE: BANNER  1200×400
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
// TEMPLATE: INSTAGRAM  1080×1080
// Mesmo nível do banner: produto flutuante + imagem real de fundo
// ═══════════════════════════════════════════════════════════════
function instagramTemplate(d){
  const bg1=d.bg1||"#030d1a",bg2=d.bg2||"#0a2d5e";
  const accent=d.accent||"#0057b8",accentLight=d.accentLight||"#4da6ff";
  const badgeColor=d.badgeColor||"#e8001c",dotColor=d.dotColor||"#e8001c";
  const bgImg=d.bg_image_url?`url('${d.bg_image_url}')`:`url('https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1200&q=80')`;
  const prodImg=d.product_img_1||"https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=600&q=80";
  return `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=1080">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1080px;overflow:hidden;font-family:'Montserrat',sans-serif}
.post{width:1080px;height:1080px;position:relative;overflow:hidden;display:grid;grid-template-columns:1fr 380px;background:#000}
/* Fundo */
.bg{position:absolute;inset:0;background-image:${bgImg};background-size:cover;background-position:center;z-index:0}
.bg::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,${bg1}f0 0%,${bg1}d0 40%,${bg2}99 70%,transparent 100%);z-index:1}
/* Grade */
.post::before{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);background-size:54px 54px;z-index:2;pointer-events:none}
/* Glow accent no canto esquerdo */
.glow-l{position:absolute;top:-120px;left:-120px;width:500px;height:500px;background:radial-gradient(circle,${accent}30 0%,transparent 65%);z-index:2;pointer-events:none}
/* Coluna esquerda — copy */
.col-copy{padding:72px 56px;display:flex;flex-direction:column;justify-content:space-between;position:relative;z-index:4}
.brand-pill{display:inline-flex;align-items:center;gap:9px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:24px;padding:6px 18px;width:fit-content;margin-bottom:0}
.brand-pill .dot{width:8px;height:8px;border-radius:50%;background:${dotColor};box-shadow:0 0 10px ${dotColor}cc}
.brand-pill span{font-size:12px;font-weight:700;color:rgba(255,255,255,.8);letter-spacing:2px;text-transform:uppercase}
.copy-mid{flex:1;display:flex;flex-direction:column;justify-content:center;gap:16px;padding:32px 0}
.tag-line{font-size:13px;font-weight:600;color:${accentLight};letter-spacing:1.5px;text-transform:uppercase}
.headline{font-size:64px;font-weight:900;color:#fff;line-height:1.0;letter-spacing:-2px;text-shadow:0 4px 24px rgba(0,0,0,.5)}
.headline em{font-style:normal;color:${accentLight}}
.subline{font-size:18px;font-weight:400;color:rgba(255,255,255,.6);line-height:1.55;max-width:400px}
.divider{width:56px;height:3px;background:linear-gradient(90deg,${accent},${accentLight});border-radius:2px;margin:4px 0}
.bottom{display:flex;flex-direction:column;gap:14px}
.offer-badge{display:inline-flex;align-items:center;gap:0;background:${badgeColor};border-radius:12px;padding:14px 24px;width:fit-content;box-shadow:0 6px 24px ${badgeColor}88}
.offer-top{font-size:13px;font-weight:700;color:rgba(255,255,255,.85);letter-spacing:1px;text-transform:uppercase;display:block}
.offer-main{font-size:28px;font-weight:900;color:#fff;letter-spacing:-.5px;line-height:1;display:block}
.cta-btn{display:inline-flex;align-items:center;gap:10px;background:rgba(255,255,255,.12);border:1.5px solid rgba(255,255,255,.25);border-radius:10px;padding:14px 28px;color:#fff;font-size:14px;font-weight:700;letter-spacing:.5px;text-decoration:none;width:fit-content;backdrop-filter:blur(4px)}
.cta-arrow{font-size:16px}
/* Coluna direita — produto */
.col-product{position:relative;z-index:4;display:flex;align-items:flex-end;justify-content:center;padding-bottom:0;overflow:hidden}
.product-glow{position:absolute;bottom:-80px;left:50%;transform:translateX(-50%);width:340px;height:340px;background:radial-gradient(circle,${accent}40 0%,transparent 65%);z-index:0;pointer-events:none}
.product-shadow{position:absolute;bottom:30px;left:50%;transform:translateX(-50%);width:180px;height:20px;background:radial-gradient(ellipse,rgba(0,0,0,.6) 0%,transparent 70%);z-index:1}
.product-img{position:relative;z-index:2;width:340px;height:700px;object-fit:contain;mix-blend-mode:multiply;filter:drop-shadow(0 24px 48px rgba(0,0,0,.7)) drop-shadow(0 8px 16px rgba(0,0,0,.4));transform:translateY(20px)}
/* Linha divisória vertical */
.vdiv{position:absolute;top:8%;bottom:8%;left:calc(100% - 380px);width:1px;background:linear-gradient(to bottom,transparent,rgba(255,255,255,.15),transparent);z-index:3}
/* Selo de validade */
.validity-tag{position:absolute;top:56px;right:56px;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:6px 14px;font-size:11px;color:rgba(255,255,255,.55);letter-spacing:.5px;z-index:5;backdrop-filter:blur(4px)}
</style></head><body>
<div class="post">
  <div class="bg"></div>
  <div class="glow-l"></div>
  <div class="vdiv"></div>
  <span class="validity-tag">&#x23F1; ${d.validity||"Oferta por tempo limitado"}</span>
  <div class="col-copy">
    <div class="brand-pill"><span class="dot"></span><span>${d.brand||"Marca"}</span></div>
    <div class="copy-mid">
      <span class="tag-line">${d.tag||"Oferta Exclusiva"}</span>
      <h1 class="headline">${d.headline}<br><em>${d.highlight||""}</em></h1>
      <div class="divider"></div>
      <p class="subline">${d.subline||""}</p>
    </div>
    <div class="bottom">
      <div class="offer-badge">
        <span class="offer-top">${d.badge_label||"Promoção"}</span>
        <span class="offer-main">${d.badge_value||""} ${d.badge_sup||""}</span>
      </div>
      <a href="#" class="cta-btn"><span>${d.cta||"Saiba Mais"}</span><span class="cta-arrow">&#8594;</span></a>
    </div>
  </div>
  <div class="col-product">
    <div class="product-glow"></div>
    <div class="product-shadow"></div>
    <img src="${prodImg}" alt="Produto" class="product-img" onerror="this.style.opacity=0"/>
  </div>
</div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE: LINKEDIN  1200×627
// Landscape profissional com produto + copy estruturado
// ═══════════════════════════════════════════════════════════════
function linkedinTemplate(d){
  const bg1=d.bg1||"#030d1a",bg2=d.bg2||"#0a2d5e";
  const accent=d.accent||"#0057b8",accentLight=d.accentLight||"#4da6ff";
  const badgeColor=d.badgeColor||"#e8001c",dotColor=d.dotColor||"#e8001c";
  const bgImg=d.bg_image_url?`url('${d.bg_image_url}')`:`url('https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1400&q=80')`;
  const prodImg=d.product_img_1||"https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=600&q=80";
  return `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=1200">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:627px;overflow:hidden;font-family:'Montserrat',sans-serif}
.card{width:1200px;height:627px;position:relative;overflow:hidden;background:#000}
.bg{position:absolute;inset:0;background-image:${bgImg};background-size:cover;background-position:center;z-index:0}
.bg::after{content:'';position:absolute;inset:0;background:linear-gradient(100deg,${bg1}f8 0%,${bg1}e0 30%,${bg1}b0 55%,${bg2}80 75%,${bg2}d0 100%);z-index:1}
.grid-overlay{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);background-size:40px 40px;z-index:2;pointer-events:none}
.layout{position:relative;z-index:3;width:100%;height:100%;display:grid;grid-template-columns:1fr 420px}
/* Coluna copy */
.copy{padding:52px 48px 52px 60px;display:flex;flex-direction:column;justify-content:space-between}
.top-row{display:flex;align-items:center;gap:12px}
.brand-chip{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);border-radius:20px;padding:5px 16px}
.brand-chip .dot{width:7px;height:7px;border-radius:50%;background:${dotColor};box-shadow:0 0 8px ${dotColor}}
.brand-chip span{font-size:11px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,.75);text-transform:uppercase}
.category{font-size:11px;font-weight:600;color:${accentLight};letter-spacing:2px;text-transform:uppercase;opacity:.8}
.mid{flex:1;display:flex;flex-direction:column;justify-content:center;gap:12px;padding:20px 0}
.eyebrow{font-size:12px;font-weight:600;color:${accentLight};letter-spacing:2px;text-transform:uppercase}
.headline{font-size:46px;font-weight:900;color:#fff;line-height:1.05;letter-spacing:-1px;text-shadow:0 2px 16px rgba(0,0,0,.5)}
.headline em{font-style:normal;color:${accentLight}}
.bar{width:48px;height:3px;background:linear-gradient(90deg,${accent},${accentLight});border-radius:2px}
.body-text{font-size:15px;font-weight:400;color:rgba(255,255,255,.55);line-height:1.6;max-width:480px}
.bottom-row{display:flex;align-items:center;gap:16px}
.cta-primary{background:${accent};color:#fff;font-size:13px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;letter-spacing:.5px;box-shadow:0 4px 20px ${accent}66;border:1.5px solid rgba(255,255,255,.15)}
.cta-secondary{color:rgba(255,255,255,.5);font-size:12px;font-weight:500;letter-spacing:.5px;border:1px solid rgba(255,255,255,.15);padding:12px 20px;border-radius:8px;text-decoration:none}
/* Coluna produto */
.product-col{position:relative;display:flex;align-items:flex-end;justify-content:center;overflow:hidden}
.product-glow{position:absolute;bottom:-60px;right:-40px;width:400px;height:400px;background:radial-gradient(circle,${accent}35 0%,transparent 65%);pointer-events:none;z-index:0}
.product-glow2{position:absolute;top:-40px;right:20px;width:200px;height:200px;background:radial-gradient(circle,${badgeColor}20 0%,transparent 70%);pointer-events:none;z-index:0}
.product-img{position:relative;z-index:1;width:380px;height:540px;object-fit:contain;mix-blend-mode:multiply;filter:drop-shadow(0 20px 40px rgba(0,0,0,.7)) drop-shadow(0 6px 12px rgba(0,0,0,.4));transform:translateY(16px)}
.vdiv{position:absolute;top:10%;bottom:10%;left:calc(100% - 420px);width:1px;background:linear-gradient(to bottom,transparent,rgba(255,255,255,.12),transparent);z-index:3}
/* Badge de oferta — canto superior direito */
.offer-badge{position:absolute;top:44px;right:44px;background:linear-gradient(135deg,${badgeColor},${badgeColor}bb);border-radius:12px;padding:12px 18px;text-align:center;box-shadow:0 6px 20px ${badgeColor}88;z-index:5;min-width:120px}
.offer-badge::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent)}
.offer-v{font-size:32px;font-weight:900;color:#fff;line-height:1;letter-spacing:-1px}
.offer-l{font-size:9px;font-weight:600;color:rgba(255,255,255,.85);letter-spacing:2px;text-transform:uppercase;margin-top:2px}
</style></head><body>
<div class="card">
  <div class="bg"></div>
  <div class="grid-overlay"></div>
  <div class="vdiv"></div>
  <div class="layout">
    <div class="copy">
      <div class="top-row">
        <div class="brand-chip"><span class="dot"></span><span>${d.brand||"Marca"}</span></div>
        <span class="category">${d.category||"Equipamentos Laboratoriais"}</span>
      </div>
      <div class="mid">
        <span class="eyebrow">${d.eyebrow||d.tag||"Destaque"}</span>
        <h1 class="headline">${d.headline}<br><em>${d.highlight||""}</em></h1>
        <div class="bar"></div>
        <p class="body-text">${d.description||d.subline||""}</p>
      </div>
      <div class="bottom-row">
        <a href="#" class="cta-primary">${d.cta||"Saiba Mais"}</a>
        <a href="#" class="cta-secondary">${d.validity||"Solicitar Proposta"}</a>
      </div>
    </div>
    <div class="product-col">
      <div class="product-glow"></div>
      <div class="product-glow2"></div>
      <img src="${prodImg}" alt="Produto" class="product-img" onerror="this.style.opacity=0"/>
      <div class="offer-badge">
        <div class="offer-v">${d.badge_value||""}<sup style="font-size:14px">${d.badge_sup||""}</sup></div>
        <div class="offer-l">${d.badge_label||"Oferta"}</div>
      </div>
    </div>
  </div>
</div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE: E-MAIL MARKETING  (600px, CSS inline)
// ═══════════════════════════════════════════════════════════════
function emailTemplate(d){
  const accent=d.accent||"#0057b8";
  const badgeColor=d.badgeColor||"#cc0000";
  const bg1=d.bg1||"#030d1a";
  const prodImg=d.product_img_1||"https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=560&q=80";
  return `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${d.subject||"Oferta Especial"}</title>
</head>
<body style="margin:0;padding:0;background:#f1f1f1;font-family:Arial,sans-serif">
<!-- Preheader -->
<div style="display:none;max-height:0;overflow:hidden;color:#f1f1f1">${d.preheader||d.subline||""}</div>
<!-- Wrapper -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f1f1">
<tr><td align="center" style="padding:24px 12px">
<!-- Container -->
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.12)">

<!-- HERO HEADER -->
<tr><td style="background:${bg1};padding:0;position:relative">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td width="340" style="padding:48px 36px 0 40px;vertical-align:top">
      <!-- Brand chip -->
      <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px">
      <tr><td style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:20px;padding:5px 16px">
        <span style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:rgba(255,255,255,.75);letter-spacing:2px;text-transform:uppercase">${d.brand||"Marca"}</span>
      </td></tr></table>
      <!-- Headline -->
      <h1 style="font-family:Arial,sans-serif;font-size:34px;font-weight:900;color:#ffffff;line-height:1.1;letter-spacing:-1px;margin:0 0 12px 0">${d.headline} <span style="color:${accent}">${d.highlight||""}</span></h1>
      <!-- Subline -->
      <p style="font-family:Arial,sans-serif;font-size:14px;font-weight:600;color:rgba(255,255,255,.6);margin:0 0 20px 0;letter-spacing:.3px">${d.subline||""}</p>
      <!-- Badge oferta -->
      <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px">
      <tr><td style="background:${badgeColor};border-radius:12px;padding:12px 20px;text-align:center;box-shadow:0 4px 16px ${badgeColor}88">
        <div style="font-family:Arial,sans-serif;font-size:28px;font-weight:900;color:#fff;line-height:1;letter-spacing:-1px">${d.badge_value||""} ${d.badge_sup||""}</div>
        <div style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;color:rgba(255,255,255,.85);letter-spacing:2px;text-transform:uppercase;margin-top:4px">${d.badge_label||"Desconto"}</div>
      </td></tr></table>
      <!-- CTA -->
      <table cellpadding="0" cellspacing="0" border="0">
      <tr><td style="background:${accent};border-radius:8px;box-shadow:0 4px 16px ${accent}88">
        <a href="#" style="display:inline-block;padding:14px 32px;font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#fff;text-decoration:none;letter-spacing:.5px">${d.cta||"Saiba Mais"} &#8594;</a>
      </td></tr></table>
    </td>
    <td width="260" style="vertical-align:bottom;padding:0">
      <img src="${prodImg}" alt="Produto" width="240" style="display:block;width:240px;max-width:100%;margin:0 auto;object-fit:contain;mix-blend-mode:multiply;padding-top:24px" onerror="this.style.display='none'"/>
    </td>
  </tr>
  <!-- Validity bar -->
  <tr><td colspan="2" style="background:rgba(255,255,255,.05);border-top:1px solid rgba(255,255,255,.08);padding:10px 40px">
    <p style="font-family:Arial,sans-serif;font-size:11px;color:rgba(255,255,255,.4);margin:0;letter-spacing:.5px">&#x23F1; ${d.validity||"Oferta por tempo limitado"}</p>
  </td></tr>
  </table>
</td></tr>

<!-- DESCRIPTION BLOCK -->
<tr><td style="background:#fff;padding:36px 40px">
  <h2 style="font-family:Arial,sans-serif;font-size:20px;font-weight:700;color:#1a1a1a;margin:0 0 12px 0">${d.section_title||"Por que escolher?"}</h2>
  <p style="font-family:Arial,sans-serif;font-size:14px;color:#555;line-height:1.7;margin:0 0 20px 0">${d.description||""}</p>
  <!-- Features -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td width="48%" style="vertical-align:top;padding:0 8px 0 0">
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#f8f8f8;border-radius:10px;padding:16px">
      <tr><td><p style="font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:${accent};text-transform:uppercase;letter-spacing:1px;margin:0 0 4px 0">${d.feat1_title||"Qualidade"}</p>
      <p style="font-family:Arial,sans-serif;font-size:13px;color:#666;margin:0">${d.feat1_desc||""}</p></td></tr>
      </table>
    </td>
    <td width="48%" style="vertical-align:top;padding:0 0 0 8px">
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#f8f8f8;border-radius:10px;padding:16px">
      <tr><td><p style="font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:${accent};text-transform:uppercase;letter-spacing:1px;margin:0 0 4px 0">${d.feat2_title||"Suporte"}</p>
      <p style="font-family:Arial,sans-serif;font-size:13px;color:#666;margin:0">${d.feat2_desc||""}</p></td></tr>
      </table>
    </td>
  </tr>
  </table>
</td></tr>

<!-- SECONDARY CTA -->
<tr><td style="background:${bg1};padding:28px 40px;text-align:center">
  <p style="font-family:Arial,sans-serif;font-size:14px;color:rgba(255,255,255,.6);margin:0 0 16px 0">${d.footer_text||"Fale com nosso time de especialistas"}</p>
  <table cellpadding="0" cellspacing="0" border="0" align="center">
  <tr><td style="border:1.5px solid rgba(255,255,255,.2);border-radius:8px">
    <a href="#" style="display:inline-block;padding:12px 28px;font-family:Arial,sans-serif;font-size:13px;font-weight:600;color:rgba(255,255,255,.75);text-decoration:none;letter-spacing:.5px">${d.cta2||"Entre em Contato"}</a>
  </td></tr></table>
</td></tr>

<!-- FOOTER -->
<tr><td style="background:#f8f8f8;padding:20px 40px;text-align:center;border-top:1px solid #e8e8e8">
  <p style="font-family:Arial,sans-serif;font-size:11px;color:#aaa;margin:0;line-height:1.6">${d.brand||"Marca"} &bull; ${d.address||""}<br>Para cancelar o recebimento deste e-mail, <a href="#" style="color:#aaa">clique aqui</a>.</p>
</td></tr>

</table>
</td></tr></table>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE: LANDING PAGE  full responsive
// ═══════════════════════════════════════════════════════════════
function landingTemplate(d){
  const accent=d.accent||"#0057b8",accentLight=d.accentLight||"#4da6ff";
  const bg1=d.bg1||"#030d1a",bg2=d.bg2||"#0a2d5e";
  const badgeColor=d.badgeColor||"#cc0000",dotColor=d.dotColor||"#cc0000";
  const bgImg=d.bg_image_url?`url('${d.bg_image_url}')`:`url('https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1600&q=80')`;
  const prodImg=d.product_img_1||"https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=600&q=80";
  const prodImg2=d.product_img_2||"https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&q=80";
  const prodImg3=d.product_img_3||"https://images.unsplash.com/photo-1554475901-4538ddfbccc2?w=600&q=80";
  return `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${d.brand||"Marca"} — ${d.headline||"Oferta Especial"}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{font-family:'Montserrat',sans-serif;background:#fff;color:#1a1a1a;overflow-x:hidden}
a{text-decoration:none;color:inherit}
/* NAV */
nav{position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(0,0,0,.7);backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,.08)}
.nav-inner{max-width:1160px;margin:0 auto;padding:0 32px;height:64px;display:flex;align-items:center;justify-content:space-between}
.nav-brand{display:flex;align-items:center;gap:10px}
.nav-dot{width:8px;height:8px;border-radius:50%;background:${dotColor};box-shadow:0 0 10px ${dotColor}}
.nav-name{font-size:15px;font-weight:700;color:#fff;letter-spacing:1.5px;text-transform:uppercase}
.nav-cta{background:${accent};color:#fff;font-size:13px;font-weight:700;padding:10px 24px;border-radius:8px;letter-spacing:.5px;box-shadow:0 4px 16px ${accent}66}
/* HERO */
.hero{min-height:100vh;position:relative;display:flex;align-items:center;background-image:${bgImg};background-size:cover;background-position:center;padding-top:64px}
.hero::before{content:'';position:absolute;inset:0;background:linear-gradient(105deg,${bg1}f8 0%,${bg1}d0 40%,${bg2}99 70%,transparent 100%)}
.hero::after{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);background-size:50px 50px;pointer-events:none}
.hero-inner{position:relative;z-index:2;max-width:1160px;margin:0 auto;padding:80px 32px;display:grid;grid-template-columns:1fr 480px;gap:40px;align-items:center}
.hero-copy{display:flex;flex-direction:column;gap:20px}
.hero-chip{display:inline-flex;align-items:center;gap:9px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:24px;padding:6px 18px;width:fit-content}
.hero-chip .dot{width:8px;height:8px;border-radius:50%;background:${dotColor};box-shadow:0 0 10px ${dotColor}cc}
.hero-chip span{font-size:11px;font-weight:700;color:rgba(255,255,255,.8);letter-spacing:2px;text-transform:uppercase}
.hero-eyebrow{font-size:13px;font-weight:600;color:${accentLight};letter-spacing:2px;text-transform:uppercase}
.hero-h1{font-size:clamp(36px,4vw,64px);font-weight:900;color:#fff;line-height:1.05;letter-spacing:-2px}
.hero-h1 em{font-style:normal;color:${accentLight}}
.hero-bar{width:56px;height:3px;background:linear-gradient(90deg,${accent},${accentLight});border-radius:2px}
.hero-desc{font-size:16px;color:rgba(255,255,255,.55);line-height:1.7;max-width:520px}
.hero-actions{display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.btn-primary{background:${accent};color:#fff;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;letter-spacing:.5px;box-shadow:0 6px 24px ${accent}88;border:1.5px solid rgba(255,255,255,.15)}
.btn-secondary{color:rgba(255,255,255,.6);font-size:13px;font-weight:500;padding:14px 24px;border:1.5px solid rgba(255,255,255,.15);border-radius:10px}
.hero-badge{background:linear-gradient(135deg,${badgeColor},${badgeColor}cc);border-radius:12px;padding:14px 24px;display:inline-block;box-shadow:0 6px 24px ${badgeColor}88;border-top:1px solid rgba(255,255,255,.2)}
.hero-badge-v{font-size:36px;font-weight:900;color:#fff;line-height:1;letter-spacing:-1px}
.hero-badge-l{font-size:10px;font-weight:700;color:rgba(255,255,255,.85);letter-spacing:2px;text-transform:uppercase;margin-top:4px}
.hero-validity{font-size:11px;color:rgba(255,255,255,.35);letter-spacing:.5px;margin-top:8px}
/* Hero produto */
.hero-product{position:relative;display:flex;align-items:flex-end;justify-content:center;min-height:440px}
.hero-product-glow{position:absolute;bottom:-40px;left:50%;transform:translateX(-50%);width:360px;height:360px;background:radial-gradient(circle,${accent}40 0%,transparent 65%);pointer-events:none}
.hero-product-img{position:relative;z-index:1;max-width:400px;width:100%;object-fit:contain;mix-blend-mode:multiply;filter:drop-shadow(0 24px 48px rgba(0,0,0,.7))}
/* FEATURES */
.features{background:#f7f9fb;padding:80px 32px}
.section-inner{max-width:1160px;margin:0 auto}
.section-label{font-size:12px;font-weight:700;color:${accent};letter-spacing:2.5px;text-transform:uppercase;margin-bottom:10px}
.section-title{font-size:clamp(28px,3vw,44px);font-weight:900;color:#1a1a1a;line-height:1.1;letter-spacing:-1px;margin-bottom:48px}
.section-title em{font-style:normal;color:${accent}}
.features-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.feat-card{background:#fff;border-radius:16px;padding:28px 24px;border:1px solid rgba(0,0,0,.06);box-shadow:0 2px 12px rgba(0,0,0,.04)}
.feat-num{font-size:44px;font-weight:900;color:${accent};opacity:.15;line-height:1;margin-bottom:8px;letter-spacing:-2px}
.feat-title{font-size:16px;font-weight:700;color:#1a1a1a;margin-bottom:8px}
.feat-desc{font-size:13px;color:#777;line-height:1.65}
/* PRODUCTS */
.products{padding:80px 32px;background:#fff}
.products-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;margin-top:48px}
.prod-card{background:#fff;border:1px solid rgba(0,0,0,.07);border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.05)}
.prod-card-img{height:220px;background:${bg1};display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
.prod-card-img::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,${bg1},${bg2})}
.prod-card-img img{position:relative;z-index:1;max-width:80%;max-height:180px;object-fit:contain;mix-blend-mode:multiply;filter:drop-shadow(0 8px 20px rgba(0,0,0,.5))}
.prod-card-body{padding:20px 20px 24px}
.prod-card-tag{font-size:10px;font-weight:700;color:${accent};text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px}
.prod-card-name{font-size:16px;font-weight:700;color:#1a1a1a;margin-bottom:8px}
.prod-card-desc{font-size:12px;color:#888;line-height:1.6;margin-bottom:16px}
.prod-card-cta{display:inline-block;background:${accent};color:#fff;font-size:12px;font-weight:700;padding:9px 20px;border-radius:7px;letter-spacing:.5px}
/* CTA SECTION */
.cta-section{background:${bg1};padding:80px 32px;text-align:center;position:relative;overflow:hidden}
.cta-section::before{content:'';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:600px;height:600px;background:radial-gradient(circle,${accent}20 0%,transparent 65%);pointer-events:none}
.cta-section .section-inner{position:relative;z-index:1}
.cta-tagline{font-size:13px;font-weight:600;color:${accentLight};letter-spacing:2px;text-transform:uppercase;margin-bottom:16px}
.cta-h2{font-size:clamp(28px,3.5vw,52px);font-weight:900;color:#fff;letter-spacing:-1.5px;line-height:1.05;margin-bottom:16px}
.cta-h2 em{font-style:normal;color:${accentLight}}
.cta-sub{font-size:15px;color:rgba(255,255,255,.5);margin-bottom:36px;line-height:1.6}
.cta-btns{display:flex;gap:16px;justify-content:center;flex-wrap:wrap}
/* FOOTER */
footer{background:#0a0a0a;padding:32px;text-align:center;border-top:1px solid rgba(255,255,255,.06)}
footer p{font-size:12px;color:rgba(255,255,255,.3);letter-spacing:.5px}
@media(max-width:768px){
  .hero-inner,.features-grid,.products-grid{grid-template-columns:1fr}
  .hero-product{min-height:260px}
  .hero-product-img{max-width:260px}
}
</style></head><body>
<nav><div class="nav-inner">
  <div class="nav-brand"><div class="nav-dot"></div><span class="nav-name">${d.brand||"Marca"}</span></div>
  <a href="#cta" class="nav-cta">${d.cta||"Solicitar Proposta"}</a>
</div></nav>

<section class="hero">
<div class="hero-inner">
  <div class="hero-copy">
    <div class="hero-chip"><span class="dot"></span><span>${d.brand||"Marca"}</span></div>
    <span class="hero-eyebrow">${d.eyebrow||d.tag||"Oferta Exclusiva"}</span>
    <h1 class="hero-h1">${d.headline}<br><em>${d.highlight||""}</em></h1>
    <div class="hero-bar"></div>
    <p class="hero-desc">${d.description||d.subline||""}</p>
    <div>
      <div class="hero-badge">
        <div class="hero-badge-v">${d.badge_value||""} ${d.badge_sup||""}</div>
        <div class="hero-badge-l">${d.badge_label||"Promoção"}</div>
      </div>
      <p class="hero-validity">&#x23F1; ${d.validity||"Válido por tempo limitado"}</p>
    </div>
    <div class="hero-actions">
      <a href="#cta" class="btn-primary">${d.cta||"Solicitar Proposta"}</a>
      <a href="#products" class="btn-secondary">Ver Produtos &#8594;</a>
    </div>
  </div>
  <div class="hero-product">
    <div class="hero-product-glow"></div>
    <img src="${prodImg}" alt="Produto" class="hero-product-img" onerror="this.style.opacity=0"/>
  </div>
</div>
</section>

<section class="features">
<div class="section-inner">
  <p class="section-label">Por Que ${d.brand||"Nós"}?</p>
  <h2 class="section-title">Qualidade que você pode <em>confiar</em></h2>
  <div class="features-grid">
    <div class="feat-card"><div class="feat-num">01</div><h3 class="feat-title">${d.feat1_title||"Precisão"}</h3><p class="feat-desc">${d.feat1_desc||"Tecnologia de ponta para resultados precisos e repetíveis no seu laboratório."}</p></div>
    <div class="feat-card"><div class="feat-num">02</div><h3 class="feat-title">${d.feat2_title||"Durabilidade"}</h3><p class="feat-desc">${d.feat2_desc||"Construção robusta e materiais de alta qualidade para uso intensivo."}</p></div>
    <div class="feat-card"><div class="feat-num">03</div><h3 class="feat-title">${d.feat3_title||"Suporte Técnico"}</h3><p class="feat-desc">${d.feat3_desc||"Equipe especializada disponível para assistência técnica e treinamento."}</p></div>
  </div>
</div>
</section>

<section class="products" id="products">
<div class="section-inner">
  <p class="section-label">Linha de Produtos</p>
  <h2 class="section-title">${d.products_title||"Equipamentos em <em>Destaque</em>"}</h2>
  <div class="products-grid">
    <div class="prod-card"><div class="prod-card-img"><img src="${prodImg}" alt="Produto 1" onerror="this.style.opacity=0"/></div><div class="prod-card-body"><p class="prod-card-tag">${d.brand||"Marca"}</p><h3 class="prod-card-name">${d.prod1_name||d.headline||"Produto"}</h3><p class="prod-card-desc">${d.prod1_desc||d.description||""}</p><a href="#cta" class="prod-card-cta">Solicitar</a></div></div>
    <div class="prod-card"><div class="prod-card-img"><img src="${prodImg2}" alt="Produto 2" onerror="this.style.opacity=0"/></div><div class="prod-card-body"><p class="prod-card-tag">${d.brand||"Marca"}</p><h3 class="prod-card-name">${d.prod2_name||d.subline||"Produto"}</h3><p class="prod-card-desc">${d.prod2_desc||d.description||""}</p><a href="#cta" class="prod-card-cta">Solicitar</a></div></div>
    <div class="prod-card"><div class="prod-card-img"><img src="${prodImg3}" alt="Produto 3" onerror="this.style.opacity=0"/></div><div class="prod-card-body"><p class="prod-card-tag">${d.brand||"Marca"}</p><h3 class="prod-card-name">${d.prod3_name||"Produto"}</h3><p class="prod-card-desc">${d.prod3_desc||d.description||""}</p><a href="#cta" class="prod-card-cta">Solicitar</a></div></div>
  </div>
</div>
</section>

<section class="cta-section" id="cta">
<div class="section-inner">
  <p class="cta-tagline">${d.eyebrow||"Aproveite Agora"}</p>
  <h2 class="cta-h2">${d.headline} <em>${d.highlight||""}</em></h2>
  <p class="cta-sub">${d.footer_text||"Entre em contato com nossa equipe e receba uma proposta personalizada."}</p>
  <div class="cta-btns">
    <a href="#" class="btn-primary" style="font-size:15px;padding:16px 40px">${d.cta||"Solicitar Proposta"}</a>
    <a href="#" class="btn-secondary" style="font-size:13px;padding:16px 28px;color:rgba(255,255,255,.5)">${d.cta2||"WhatsApp"}</a>
  </div>
</div>
</section>

<footer><p>&copy; ${new Date().getFullYear()} ${d.brand||"Marca"} &bull; Todos os direitos reservados</p></footer>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// SYSTEM PROMPTS
// ═══════════════════════════════════════════════════════════════
const SYSTEM_PROMPTS={
  email:(brandCtx)=>`Você é um especialista em e-mail marketing. A partir do briefing recebido, retorne APENAS um objeto JSON válido — sem explicações, sem markdown, sem texto extra.
${brandCtx?`\nIDENTIDADE DA MARCA:\n${brandCtx}\n`:""}
Campos:
{
  "brand":"Nome da marca",
  "subject":"Assunto do e-mail (máx 60 chars)",
  "preheader":"Texto de previsualização (máx 80 chars)",
  "headline":"Título principal (máx 5 palavras)",
  "highlight":"Palavra em destaque (máx 3 palavras)",
  "subline":"Subtítulo (máx 10 palavras)",
  "description":"Parágrafo principal (máx 35 palavras)",
  "badge_value":"Número ou texto (ex: COMPRE 3)",
  "badge_sup":"Sufixo (ex: % ou vazio)",
  "badge_label":"Label badge (ex: LEVE 4)",
  "validity":"Texto de validade",
  "cta":"CTA primário (máx 4 palavras)",
  "cta2":"CTA secundário (máx 4 palavras)",
  "section_title":"Título da seção de features",
  "feat1_title":"Feature 1 título","feat1_desc":"Feature 1 descrição",
  "feat2_title":"Feature 2 título","feat2_desc":"Feature 2 descrição",
  "footer_text":"Texto do rodapé (máx 12 palavras)",
  "address":"Endereço ou cidade",
  "bg_search_query":"Query fundo em inglês",
  "search_query_1":"Query produto 1 em inglês"
}
Retorne SOMENTE o JSON.`,

  banner:(brandCtx)=>`Você é um copywriter especialista em marketing visual. Retorne APENAS um objeto JSON válido.
${brandCtx?`\nIDENTIDADE DA MARCA (CORES OBRIGATÓRIAS):\n${brandCtx}\n`:""}
{
  "brand":"Nome da marca",
  "headline":"Título (máx 4 palavras)",
  "highlight":"Destaque (máx 3 palavras)",
  "subline":"Subtítulo (máx 8 palavras)",
  "description":"Descrição (máx 20 palavras)",
  "badge_value":"Ex: COMPRE 3",
  "badge_sup":"Ex: % ou vazio",
  "badge_label":"Ex: LEVE 4",
  "validity":"Texto de validade",
  "cta":"CTA (máx 5 palavras)",
  "bg_search_query":"Query fundo em inglês",
  "search_query_1":"Query produto 1",
  "search_query_2":"Query produto 2",
  "search_query_3":"Query produto 3"
}
Retorne SOMENTE o JSON.`,

  instagram:(brandCtx)=>`Você é copywriter de social media. Retorne APENAS um objeto JSON válido.
${brandCtx?`\nIDENTIDADE DA MARCA:\n${brandCtx}\n`:""}
{
  "brand":"Nome da marca",
  "tag":"Tag curta",
  "headline":"Título (máx 3 palavras)",
  "highlight":"Destaque (máx 2 palavras)",
  "subline":"Subtítulo (máx 12 palavras)",
  "badge_value":"Ex: COMPRE 3",
  "badge_sup":"Ex: %",
  "badge_label":"Ex: LEVE 4",
  "validity":"Texto de validade",
  "cta":"CTA (máx 4 palavras)",
  "bg_search_query":"Query fundo em inglês",
  "search_query_1":"Query produto em inglês"
}
Retorne SOMENTE o JSON.`,

  linkedin:(brandCtx)=>`Você é copywriter de marketing B2B. Retorne APENAS um objeto JSON válido.
${brandCtx?`\nIDENTIDADE DA MARCA:\n${brandCtx}\n`:""}
{
  "brand":"Nome da marca",
  "category":"Categoria (ex: Equipamentos Laboratoriais)",
  "eyebrow":"Eyebrow (máx 5 palavras)",
  "headline":"Título (máx 5 palavras)",
  "highlight":"Destaque (máx 2 palavras)",
  "subline":"Subtítulo (máx 8 palavras)",
  "description":"Corpo do texto (máx 25 palavras)",
  "badge_value":"Ex: 15",
  "badge_sup":"Ex: %",
  "badge_label":"Ex: Desconto",
  "validity":"Texto do CTA secundário (máx 4 palavras)",
  "cta":"CTA principal (máx 4 palavras)",
  "bg_search_query":"Query fundo em inglês",
  "search_query_1":"Query produto em inglês"
}
Retorne SOMENTE o JSON.`,

  landing:(brandCtx)=>`Você é especialista em landing pages de conversão. Retorne APENAS um objeto JSON válido.
${brandCtx?`\nIDENTIDADE DA MARCA:\n${brandCtx}\n`:""}
{
  "brand":"Nome da marca",
  "eyebrow":"Eyebrow (máx 5 palavras)",
  "headline":"H1 principal (máx 5 palavras)",
  "highlight":"Palavra de destaque (máx 3 palavras)",
  "subline":"Subtítulo (máx 10 palavras)",
  "description":"Parágrafo hero (máx 30 palavras)",
  "badge_value":"Texto oferta","badge_sup":"","badge_label":"Label oferta",
  "validity":"Validade da oferta",
  "cta":"CTA principal","cta2":"CTA secundário",
  "feat1_title":"Feature 1","feat1_desc":"Descrição feature 1 (máx 20 palavras)",
  "feat2_title":"Feature 2","feat2_desc":"Descrição feature 2 (máx 20 palavras)",
  "feat3_title":"Feature 3","feat3_desc":"Descrição feature 3 (máx 20 palavras)",
  "products_title":"Título da seção de produtos",
  "prod1_name":"Nome produto 1","prod1_desc":"Desc produto 1",
  "prod2_name":"Nome produto 2","prod2_desc":"Desc produto 2",
  "prod3_name":"Nome produto 3","prod3_desc":"Desc produto 3",
  "footer_text":"Texto CTA final (máx 15 palavras)",
  "bg_search_query":"Query fundo em inglês",
  "search_query_1":"Query produto 1 em inglês",
  "search_query_2":"Query produto 2 em inglês",
  "search_query_3":"Query produto 3 em inglês"
}
Retorne SOMENTE o JSON.`,

  datasheet:`Você é especialista em marketing técnico. Gere uma ficha técnica em Markdown com: Visão Geral, Características, Especificações (tabela), Benefícios, Casos de Uso, CTA. Português do Brasil.`,
  text:`Você é copywriter sênior. Escreva conteúdo persuasivo em português do Brasil. Use Markdown quando ajudar.`,
};

// ═══════════════════════════════════════════════════════════════
// EXPRESS
// ═══════════════════════════════════════════════════════════════
const app=express();
app.use(express.json());
app.use(express.static(path.join(__dirname,"dist/client")));

async function ollamaJSON(prompt,model){
  const res=await fetch(`${OLLAMA_URL}/api/generate`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model,prompt,stream:false,options:{num_predict:900,temperature:0.2}}),
  });
  if(!res.ok) throw new Error(`Ollama ${res.status}`);
  const{response}=await res.json();
  const match=response.match(/\{[\s\S]*\}/);
  if(!match) throw new Error("JSON inválido: "+response.slice(0,200));
  return JSON.parse(match[0]);
}

app.post("/api/chat",async(req,res)=>{
  const{prompt,intent="text",model=DEFAULT_MODEL}=req.body??{};
  if(!prompt?.trim()) return res.status(400).json({error:"Campo 'prompt' é obrigatório"});
  console.log(`[chat] intent=${intent} model=${model} prompt=${prompt.slice(0,80)}`);

  // ── TEMPLATE INTENTS ──
  if(TEMPLATE_INTENTS.has(intent)||intent==="email"||intent==="landing"){
    const brandIdentity=detectBrand(prompt);
    const brandCtx=[
      `Marca: ${brandIdentity.displayName||("(genérica)")}`,
      `Paleta: ${brandIdentity.palette}`,
      `bg1: ${brandIdentity.bg1}`,
      `bg2: ${brandIdentity.bg2}`,
      `accent: ${brandIdentity.accent}`,
    ].join("\n");
    console.log(`[brand] ${brandIdentity.displayName||"genérica"} | ${brandIdentity.palette}`);

    const systemFn=SYSTEM_PROMPTS[intent];
    const systemPrompt=typeof systemFn==="function"?systemFn(brandCtx):systemFn;
    const fullPrompt=`${systemPrompt}\n\nBriefing:\n${prompt.trim()}`;

    let data;
    try{
      data=await ollamaJSON(fullPrompt,model);
      console.log(`[chat] JSON:`,JSON.stringify(data).slice(0,200));
    }catch(err){
      console.error(`[chat] ERRO JSON:`,err.message);
      return res.status(502).json({error:`Erro ao gerar dados: ${err.message}`});
    }

    // Aplica identidade da marca
    data.bg1=brandIdentity.bg1;
    data.bg2=brandIdentity.bg2;
    data.accent=brandIdentity.accent;
    data.accentLight=brandIdentity.accentLight;
    data.badgeColor=brandIdentity.badgeColor;
    data.dotColor=brandIdentity.dotColor;

    // Busca imagens
    const needsImages=["banner","instagram","linkedin","landing"].includes(intent);
    if(needsImages){
      const bgQuery=data.bg_search_query||brandIdentity.bgSearchQuery;
      let q1,q2,q3;
      if(brandIdentity.productQueries){
        [q1,q2,q3]=brandIdentity.productQueries;
        console.log(`[img] productQueries "${brandIdentity.displayName}":`,brandIdentity.productQueries);
      }else{
        q1=data.search_query_1||"laboratory equipment product white background";
        q2=data.search_query_2||"scientific instrument isolated";
        q3=data.search_query_3||"laboratory product professional";
        console.log(`[img] queries LLM:`, [q1,q2,q3]);
      }
      try{
        const[bgUrl,img1,img2,img3]=await searchProductImages([bgQuery,q1,q2,q3]);
        if(bgUrl) data.bg_image_url=bgUrl;
        if(img1)  data.product_img_1=img1;
        if(img2)  data.product_img_2=img2;
        if(img3)  data.product_img_3=img3;
      }catch(e){console.log(`[img] fallback:`,e.message);}
    }

    // Para email: busca 1 imagem de produto
    if(intent==="email"){
      const bgQuery=data.bg_search_query||brandIdentity.bgSearchQuery;
      const pQ=brandIdentity.productQueries?brandIdentity.productQueries[0]:data.search_query_1||"laboratory equipment professional";
      try{
        const[bgUrl,img1]=await searchProductImages([bgQuery,pQ]);
        if(bgUrl) data.bg_image_url=bgUrl;
        if(img1)  data.product_img_1=img1;
      }catch(e){console.log(`[img email] fallback:`,e.message);}
    }

    const TEMPLATES={banner:bannerTemplate,instagram:instagramTemplate,linkedin:linkedinTemplate,email:emailTemplate,landing:landingTemplate};
    const templateFn=TEMPLATES[intent]||bannerTemplate;
    const html=templateFn(data);
    console.log(`[chat] HTML ${intent} bytes=${html.length}`);

    res.setHeader("Content-Type","text/event-stream");
    res.setHeader("Cache-Control","no-cache, no-transform");
    res.setHeader("Connection","keep-alive");
    res.setHeader("X-Accel-Buffering","no");
    res.write(`data: ${JSON.stringify(html)}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }

  // ── STREAMING (datasheet, text) ──
  const systemRaw=SYSTEM_PROMPTS[intent]??SYSTEM_PROMPTS.text;
  const systemPrompt=typeof systemRaw==="function"?systemRaw(""):systemRaw;
  const fullPrompt=`${systemPrompt}\n\nPedido:\n${prompt.trim()}`;
  const isHtml=HTML_INTENTS.has(intent);

  let ollamaRes;
  try{
    ollamaRes=await fetch(`${OLLAMA_URL}/api/generate`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({model,prompt:fullPrompt,stream:true,options:{num_predict:isHtml?2048:1024,temperature:isHtml?0.3:0.7}}),
    });
  }catch(err){return res.status(502).json({error:`Ollama inacessível: ${err.message}`});}

  if(!ollamaRes.ok||!ollamaRes.body){
    const text=await ollamaRes.text().catch(()=>"");
    return res.status(502).json({error:`Ollama ${ollamaRes.status}: ${text}`});
  }

  res.setHeader("Content-Type","text/event-stream");
  res.setHeader("Cache-Control","no-cache, no-transform");
  res.setHeader("Connection","keep-alive");
  res.setHeader("X-Accel-Buffering","no");

  const reader=ollamaRes.body.getReader();
  const decoder=new TextDecoder();
  let lineBuffer="",htmlAccum="",htmlStarted=false;
  const sendToken=(t)=>res.write(`data: ${JSON.stringify(t)}\n\n`);
  const finish=()=>{if(isHtml&&!htmlStarted&&htmlAccum)sendToken(stripMarkdownWrapper(htmlAccum));res.write("data: [DONE]\n\n");res.end();};
  const pump=async()=>{
    try{
      const{done,value}=await reader.read();
      if(done){finish();return;}
      lineBuffer+=decoder.decode(value,{stream:true});
      const lines=lineBuffer.split("\n");
      lineBuffer=lines.pop()??"";
      for(const line of lines){
        if(!line.trim()) continue;
        let parsed;try{parsed=JSON.parse(line);}catch{continue;}
        const token=parsed.response??"";
        if(isHtml){
          if(!htmlStarted){htmlAccum+=token;const idx=htmlAccum.toLowerCase().indexOf("<!doctype");if(idx!==-1){htmlStarted=true;sendToken(htmlAccum.slice(idx));htmlAccum="";}}
          else{if(token&&!/^`+$/.test(token.trim()))sendToken(token);}
        }else{if(token)sendToken(token);}
        if(parsed.done){finish();return;}
      }
      pump();
    }catch(err){res.write(`data: ${JSON.stringify({error:err.message})}\n\n`);finish();}
  };
  req.on("close",()=>reader.cancel());
  pump();
});

function stripMarkdownWrapper(text){
  return text.replace(/^```(?:html)?\s*/i,"").replace(/\s*```\s*$/i,"").trim();
}

const assetsDir=path.join(__dirname,"dist/server/assets");
const serverFile=readdirSync(assetsDir).find(f=>f.startsWith("server-")&&f.endsWith(".js"));
if(!serverFile) throw new Error("server-*.js não encontrado em dist/server/assets/");
console.log(`📦 Handler SSR: ${serverFile}`);
const{default:handler}=await import(`./dist/server/assets/${serverFile}`);

app.use(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://localhost:${PORT}`);
    const headers={};
    for(const[k,v] of Object.entries(req.headers)){if(v!=null) headers[k]=Array.isArray(v)?v.join(", "):v;}
    const response=await handler.fetch(new Request(url.toString(),{headers}));
    res.status(response.status);
    response.headers.forEach((v,k)=>res.setHeader(k,v));
    res.end(await response.text());
  }catch(err){res.status(500).send(`<pre>SSR Error: ${err.message}</pre>`);}
});

app.listen(PORT,"0.0.0.0",()=>console.log(`✅ BrieFlow on :${PORT}`));
