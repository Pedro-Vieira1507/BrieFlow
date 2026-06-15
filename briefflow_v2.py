"""
briefflow_v2.py - BriefFlow v2: Pipeline multi-modelo + preview Flask integrado.

Fluxo:
  1. Flask preview sobe na mesma thread (sem subprocess)
  2. qwen2.5-coder:7b gera HTML profissional de marketing
  3. gemma3:4b critica o design
  4. qwen2.5-coder:7b refina aplicando as melhorias
  5. Preview atualiza automaticamente em http://localhost:5000

Setup:
  pip install -r requirements.txt
  python briefflow_v2.py
"""

from __future__ import annotations

import logging
import os
import re
import sys
import threading
import time
import webbrowser
from datetime import datetime
from pathlib import Path

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template_string, request

load_dotenv()

logging.basicConfig(format="%(asctime)s | %(levelname)s | %(message)s", level=logging.WARNING)
logger = logging.getLogger("briefflow_v2")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
OUTPUT_DIR       = Path(os.getenv("OUTPUT_DIR",        "data/output"))
OLLAMA_BASE_URL  = os.getenv("OLLAMA_BASE_URL",        "http://localhost:11434").rstrip("/")
OLLAMA_TIMEOUT   = int(os.getenv("OLLAMA_TIMEOUT",     "600"))
MODEL_CODER      = os.getenv("MODEL_CODER",            "qwen2.5-coder:7b")
MODEL_CRITIC     = os.getenv("MODEL_CRITIC",           "gemma3:4b")
TEMPERATURE      = float(os.getenv("TEMPERATURE",      "0.4"))
MAX_TOKENS_HTML  = int(os.getenv("MAX_TOKENS_HTML",    "3500"))
MAX_TOKENS_CRITIC= int(os.getenv("MAX_TOKENS_CRITIC",  "500"))
MAX_TOKENS_REFINE= int(os.getenv("MAX_TOKENS_REFINE",  "3500"))
PREVIEW_PORT     = int(os.getenv("PREVIEW_PORT",       "5000"))
AUTO_OPEN_BROWSER= os.getenv("AUTO_OPEN_BROWSER",      "true").lower() == "true"

# ---------------------------------------------------------------------------
# Identidade visual Forlab/DLAB
# ---------------------------------------------------------------------------
FORLAB_BRAND = """
IDENTIDADE VISUAL FORLAB EXPRESS:
- Cores principais: Azul escuro #003366 (fundos, headers), Azul medio #0055AA, Branco #FFFFFF
- Cores de destaque: Amarelo/laranja #FFB800 ou #FF6B00 (badges, CTAs, destaques de oferta)
- Tipografia: sans-serif moderna (Arial, Inter, Helvetica)
- Tom: profissional, tecnico, confiavel, moderno
- Logo texto: FORLAB com seta diagonal azul
- Sempre incluir o texto 'FORLAB' no canto inferior direito com tagline 'Acelerando a ciencia da vida'

PRODUTOS DLAB (usar sempre estas imagens de laboratorio profissional):
- Micropipeta monocanal: https://picsum.photos/seed/pipette-lab-blue/400/500
- Micropipeta multicanal: https://picsum.photos/seed/multichannel-pipette/400/500  
- Ambiente laboratorio: https://picsum.photos/seed/laboratory-clean-white/1200/600
- Cientista com pipeta: https://picsum.photos/seed/scientist-pipette-lab/600/400

CAMPANHA ATIVA: Compre 3 Leve 4 - DLAB Linha Completa de Liquid Handling
- Micropipetas monocanal e multicanal, auxiliares de pipetagem, dispensadores, buretas digitais
- A 4a unidade (de menor valor) e gratuita
- Publico: laboratorios de pesquisa, controle de qualidade, industrias farmaceuticas
"""

# ---------------------------------------------------------------------------
# Dimensoes por tipo
# ---------------------------------------------------------------------------
DIMENSOES = {
    "banner_html":  {"w": 1200, "h": 400,  "desc": "Banner Horizontal"},
    "post_visual":  {"w": 1080, "h": 1080, "desc": "Post Quadrado Instagram"},
    "flyer_html":   {"w": 794,  "h": 1123, "desc": "Flyer A4 Vertical"},
    "card_html":    {"w": 600,  "h": 400,  "desc": "Card de Produto"},
    "stories_html": {"w": 1080, "h": 1920, "desc": "Stories 9:16"},
}

GATILHOS = {
    "banner_html":  ["banner", "crie um banner", "gere um banner", "banner para", "banner do site"],
    "post_visual":  ["post visual", "post para instagram", "post para redes", "crie um post", "gere um post", "arte para"],
    "flyer_html":   ["flyer", "panfleto", "folheto", "crie um flyer", "gere um flyer", "material grafico"],
    "card_html":    ["card de produto", "card html", "crie um card", "cartao de produto"],
    "stories_html": ["stories", "story", "crie stories", "gere stories"],
}

# ---------------------------------------------------------------------------
# Prompt de geracao profissional
# ---------------------------------------------------------------------------
PROMPT_GERADOR = """
Voce e um designer e desenvolvedor front-end senior especialista em materiais de marketing digital
para o setor de equipamentos laboratoriais. Sua especialidade e criar HTML/CSS que rivaliza com
agencias de publicidade profissionais.

Gere um arquivo HTML COMPLETO e AUTOCONTIDO seguindo RIGOROSAMENTE as instrucoes abaixo.

REGRAS ABSOLUTAS:
1. Retorne APENAS o HTML. Sem texto antes ou depois. Sem markdown. Sem explicacoes.
2. Comece OBRIGATORIAMENTE com <!DOCTYPE html> e termine com </html>.
3. Todo CSS dentro de <style>. Sem frameworks externos. Sem Google Fonts (use system fonts).
4. Use <img> com src de URLs reais do Picsum (formato: https://picsum.photos/seed/TEMA/W/H).
5. O canvas do material deve ter as dimensoes exatas especificadas.
6. Fundo da pagina: #e8ecf0. Canvas centralizado na pagina.

PADROES DE QUALIDADE PROFISSIONAL OBRIGATORIOS:
- Layout em grid CSS com multiplas colunas (NUNCA uma unica coluna de texto)
- Foto de produto ou laboratorio ocupando pelo menos 40% do espaco visual
- Hierarquia tipografica clara: headline grande (48-72px) + subtitulo + corpo
- Badge/selo de oferta com fundo amarelo/laranja (#FFB800 ou #FF6B00), formato circular ou estrela
- Gradiente de fundo no canvas (de #003366 para #0055AA ou similar)
- CTA (call-to-action) com botao destacado, fundo colorido, texto em maiusculo
- Sombras (box-shadow) em elementos importantes
- Elementos geometricos de design (bordas coloridas, divisores, formas)
- Texto BRANCO sobre fundos escuros para maximo contraste
- Logo/marca FORLAB no canto inferior direito

PROIBIDO:
- Fundo branco liso sem gradiente ou imagem
- Layout de uma so coluna com texto centralizado
- Texto preto/cinza sobre fundo branco (visual de documento Word)
- Ausencia de imagens de produto
- Visual de template basico ou "primeiro site HTML"
- Fontes serif (Times, Georgia)
"""

PROMPT_CRITICO = """
Voce e um Diretor de Arte senior de uma agencia de publicidade especializada em B2B industrial.
Avalie o HTML abaixo como se fosse um material real que vai ao ar amanha.

Liste EXATAMENTE 3 melhorias ESPECIFICAS e CIRURGICAS. Seja brutal e objetivo.

FORMATO OBRIGATORIO (retorne so isso):
1. [ELEMENTO ESPECIFICO] Problema atual -> Solucao CSS/HTML exata
2. [ELEMENTO ESPECIFICO] Problema atual -> Solucao CSS/HTML exata  
3. [ELEMENTO ESPECIFICO] Problema atual -> Solucao CSS/HTML exata

Avaliar: impacto visual nos primeiros 3 segundos, legibilidade do headline, forca do CTA,
qualidade percebida da marca, proporcao imagem vs texto.
"""

PROMPT_REFINADOR = """
Voce e um dev front-end senior. Recebeu um HTML de marketing e 3 melhorias de um Diretor de Arte.
Aplique TODAS as 3 melhorias no HTML.

REGRAS:
1. Retorne APENAS o HTML corrigido. Sem explicacoes.
2. Comece com <!DOCTYPE html> e termine com </html>.
3. Aplique cada melhoria com precisao. Nao quebre o que ja esta bom.
4. Se uma melhoria pedir mudanca de cor, fonte ou tamanho, aplique exatamente.
"""

# ---------------------------------------------------------------------------
# Estado compartilhado (Flask + pipeline na mesma thread)
# ---------------------------------------------------------------------------
_estado: dict = {
    "html_v1": "",
    "html_v2": "",
    "critica":  "",
    "briefing": "",
    "tipo":     "",
    "status":   "idle",
    "etapa":    "",
    "historico": [],
}

# ---------------------------------------------------------------------------
# Flask app
# ---------------------------------------------------------------------------
app = Flask(__name__)

PAINEL_HTML = r"""
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>BriefFlow — Preview</title>
<style>
:root{
  --bg:#0f1117;--s1:#1a1d27;--s2:#222535;--bd:#2e3248;
  --tx:#e2e8f0;--mu:#8892a4;--pr:#6366f1;--ph:#818cf8;
  --ok:#22c55e;--wa:#f59e0b;--er:#ef4444;--r:10px;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;font-family:Inter,system-ui,sans-serif;background:var(--bg);color:var(--tx);font-size:14px}
.layout{display:grid;grid-template-columns:300px 1fr;height:100vh}

/* Sidebar */
.sb{background:var(--s1);border-right:1px solid var(--bd);display:flex;flex-direction:column;overflow:hidden}
.sb-h{padding:20px 16px 14px;border-bottom:1px solid var(--bd)}
.logo{font-size:20px;font-weight:800;color:var(--ph);letter-spacing:-1px}
.logo span{color:var(--tx)}
.ver{font-size:11px;color:var(--mu);margin-top:2px}

/* Briefing input na sidebar */
.sb-input{margin:12px 16px 0}
.sb-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--mu);margin-bottom:6px}
textarea{
  width:100%;background:var(--s2);border:1px solid var(--bd);
  border-radius:var(--r);color:var(--tx);font-size:12px;
  padding:10px;resize:vertical;min-height:90px;line-height:1.5;
  font-family:inherit;
}
textarea:focus{outline:none;border-color:var(--pr)}

.tipo-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:10px 16px 0}
.tipo-btn{
  padding:7px 6px;background:var(--s2);border:1px solid var(--bd);
  border-radius:8px;color:var(--mu);font-size:11px;cursor:pointer;
  text-align:center;transition:all 0.15s;font-family:inherit;
}
.tipo-btn:hover,.tipo-btn.sel{border-color:var(--pr);color:var(--ph);background:rgba(99,102,241,0.08)}

.gerar-btn{
  margin:10px 16px 0;width:calc(100% - 32px);
  padding:10px;background:var(--pr);border:none;border-radius:var(--r);
  color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;
  transition:background 0.15s;
}
.gerar-btn:hover{background:var(--ph)}
.gerar-btn:disabled{opacity:0.4;cursor:not-allowed}

.status-box{margin:12px 16px 0;padding:10px 12px;background:var(--s2);border-radius:var(--r);border:1px solid var(--bd)}
.s-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--mu);margin-bottom:4px}
.s-row{display:flex;align-items:center;gap:6px}
.dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.d-idle{background:var(--mu)}.d-gen{background:var(--wa);animation:pulse 1s infinite}
.d-ok{background:var(--ok)}.d-err{background:var(--er)}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
.etapa{font-size:11px;color:var(--mu);margin-top:5px;line-height:1.4}

.critica-box{margin:10px 16px 0;padding:10px 12px;background:var(--s2);border-radius:var(--r);border:1px solid var(--bd);flex:1;overflow-y:auto}
.c-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--mu);margin-bottom:6px}
.c-text{font-size:11px;color:var(--tx);line-height:1.6;white-space:pre-wrap}
.c-empty{font-size:11px;color:var(--mu);font-style:italic}

.hist-box{margin:10px 16px 14px}
.h-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--mu);margin-bottom:6px}
.h-item{padding:6px 10px;margin-bottom:4px;background:var(--s2);border-radius:6px;border:1px solid var(--bd);cursor:pointer;font-size:11px;color:var(--mu);transition:all .15s}
.h-item:hover{border-color:var(--pr);color:var(--tx)}

/* Main */
.main{display:flex;flex-direction:column;overflow:hidden}
.topbar{padding:12px 20px;border-bottom:1px solid var(--bd);display:flex;align-items:center;justify-content:space-between;background:var(--s1)}
.briefing-txt{font-size:12px;color:var(--mu);max-width:500px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.actions{display:flex;gap:8px}
.btn{padding:7px 13px;border-radius:7px;border:none;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;font-family:inherit;display:inline-flex;align-items:center;gap:4px}
.btn-pr{background:var(--pr);color:#fff}.btn-pr:hover{background:var(--ph)}
.btn-ol{background:transparent;color:var(--tx);border:1px solid var(--bd)}
.btn-ol:hover{border-color:var(--pr);color:var(--ph)}
.btn:disabled{opacity:.4;cursor:not-allowed}

.tabs{display:flex;border-bottom:1px solid var(--bd);background:var(--s1);padding:0 20px}
.tab{padding:10px 16px;font-size:12px;font-weight:500;color:var(--mu);cursor:pointer;border-bottom:2px solid transparent;transition:all .15s}
.tab.active{color:var(--ph);border-bottom-color:var(--pr)}
.tab:hover{color:var(--tx)}

.preview-area{flex:1;overflow:auto;background:#c8cdd5;padding:24px;display:flex;align-items:flex-start;justify-content:center;gap:24px}
.pw{background:#fff;border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,.25);overflow:hidden;position:relative}
.ptag{position:absolute;top:8px;left:8px;z-index:10;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:.5px}
.tv1{background:#f59e0b22;color:#f59e0b;border:1px solid #f59e0b44}
.tv2{background:#22c55e22;color:#22c55e;border:1px solid #22c55e44}
.pframe{display:block;border:none}

.empty-s{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;height:100%;color:var(--mu);text-align:center}
.empty-ico{font-size:52px;opacity:.25}
.empty-t{font-size:16px;font-weight:700;color:var(--tx)}
.empty-sub{font-size:13px;line-height:1.5;max-width:360px}

.loading-s{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;height:100%;color:var(--mu)}
.spin{width:44px;height:44px;border:3px solid var(--bd);border-top-color:var(--pr);border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.l-label{font-size:14px;color:var(--tx);font-weight:600}
.l-sub{font-size:12px}

::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--bd);border-radius:3px}
</style>
</head>
<body>
<div class="layout">

<div class="sb">
  <div class="sb-h">
    <div class="logo">Brief<span>Flow</span></div>
    <div class="ver">v2 &middot; Gerador de Marketing Profissional</div>
  </div>

  <div class="sb-input">
    <div class="sb-label">&#128221; Briefing do material</div>
    <textarea id="ta-briefing" placeholder="Ex: Banner da campanha Compre 3 Leve 4 DLAB, micropipetas, fundo azul escuro, badge +1 gratis, CTA Monte seu kit..."></textarea>
  </div>

  <div class="sb-label" style="margin:10px 16px 4px">Tipo de material</div>
  <div class="tipo-grid" id="tipo-grid">
    <button class="tipo-btn sel" data-tipo="banner_html" onclick="selTipo(this)">&#127760; Banner (1200x400)</button>
    <button class="tipo-btn" data-tipo="post_visual" onclick="selTipo(this)">&#128247; Post Insta (1080x1080)</button>
    <button class="tipo-btn" data-tipo="flyer_html" onclick="selTipo(this)">&#128196; Flyer A4</button>
    <button class="tipo-btn" data-tipo="card_html" onclick="selTipo(this)">&#128230; Card Produto</button>
    <button class="tipo-btn" data-tipo="stories_html" onclick="selTipo(this)">&#128250; Stories 9:16</button>
  </div>

  <button class="gerar-btn" id="btn-gerar" onclick="gerarMaterial()">&#9889; Gerar Material</button>

  <div class="status-box">
    <div class="s-label">Pipeline</div>
    <div class="s-row">
      <div class="dot d-idle" id="s-dot"></div>
      <span id="s-txt" style="font-size:12px">Aguardando...</span>
    </div>
    <div class="etapa" id="s-etapa"></div>
  </div>

  <div class="critica-box">
    <div class="c-label">&#127912; Diretor de Arte</div>
    <div id="critica-el"><div class="c-empty">A analise aparecera apos a geracao...</div></div>
  </div>

  <div class="hist-box">
    <div class="h-label">&#128193; Historico</div>
    <div id="hist-el"><div class="c-empty">Nenhum historico ainda.</div></div>
  </div>
</div>

<div class="main">
  <div class="topbar">
    <div class="briefing-txt" id="briefing-el">Nenhum material gerado ainda.</div>
    <div class="actions">
      <button class="btn btn-ol" id="btn-v1" onclick="baixar('v1')" disabled>&#8595; v1</button>
      <button class="btn btn-ol" id="btn-v2" onclick="baixar('v2')" disabled>&#8595; Final HTML</button>
      <button class="btn btn-pr" id="btn-nova" onclick="abrirNovaAba()">&#128065; Abrir em nova aba</button>
    </div>
  </div>

  <div class="tabs">
    <div class="tab active" onclick="tab('comparar')" id="tab-comparar">Comparar v1 vs v2</div>
    <div class="tab" onclick="tab('v2')" id="tab-v2">&#10024; Final (v2)</div>
    <div class="tab" onclick="tab('v1')" id="tab-v1">Rascunho (v1)</div>
  </div>

  <div class="preview-area" id="preview-area">
    <div class="empty-s">
      <div class="empty-ico">&#127912;</div>
      <div class="empty-t">Pronto para gerar</div>
      <div class="empty-sub">Escreva o briefing na barra lateral, escolha o tipo de material e clique em Gerar.</div>
    </div>
  </div>
</div>

</div>
<script>
let tabAtual='comparar', dados=null, tipoSel='banner_html';

function selTipo(el){
  document.querySelectorAll('.tipo-btn').forEach(b=>b.classList.remove('sel'));
  el.classList.add('sel');
  tipoSel=el.dataset.tipo;
}

async function gerarMaterial(){
  const briefing=document.getElementById('ta-briefing').value.trim();
  if(!briefing){alert('Escreva o briefing primeiro!');return;}
  document.getElementById('btn-gerar').disabled=true;
  await fetch('/api/gerar',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({briefing,tipo:tipoSel})});
}

function tab(t){
  tabAtual=t;
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  document.getElementById('tab-'+t).classList.add('active');
  if(dados&&dados.status==='pronto')render(dados);
}

function render(d){
  const area=document.getElementById('preview-area');
  if(!d.html_v2&&!d.html_v1)return;
  const sc=0.52;
  const dim={banner_html:[1200,400],post_visual:[1080,1080],flyer_html:[794,1123],card_html:[600,400],stories_html:[1080,1920]};
  const [w,h]=dim[d.tipo]||[900,600];
  const fw=Math.round(w*sc),fh=Math.round(h*sc);
  const fr=(html,tag,cls)=>{
    const enc=encodeURIComponent(html);
    return `<div class="pw"><div class="ptag ${cls}">${tag}</div>
      <iframe class="pframe" src="data:text/html;charset=utf-8,${enc}" width="${w}" height="${h}"
        style="transform:scale(${sc});transform-origin:top left;display:block;"
        sandbox="allow-scripts allow-same-origin"></iframe>
      <div style="width:${fw}px;height:${fh}px"></div></div>`;
  };
  if(tabAtual==='comparar'){
    area.innerHTML='';
    if(d.html_v1)area.innerHTML+=fr(d.html_v1,'v1 Rascunho','tv1');
    if(d.html_v2)area.innerHTML+=fr(d.html_v2,'v2 Refinado ✨','tv2');
  }else if(tabAtual==='v2'){
    area.innerHTML=fr(d.html_v2||d.html_v1,'v2 Final ✨','tv2');
  }else{
    area.innerHTML=fr(d.html_v1||d.html_v2,'v1 Rascunho','tv1');
  }
}

function atualizarUI(d){
  const dot=document.getElementById('s-dot'),txt=document.getElementById('s-txt'),etapa=document.getElementById('s-etapa');
  const map={idle:['d-idle','Aguardando'],gerando:['d-gen','Gerando...'],pronto:['d-ok','Pronto!'],erro:['d-err','Erro']};
  const[cls,lab]=map[d.status]||map.idle;
  dot.className='dot '+cls;txt.textContent=lab;
  etapa.textContent=d.etapa||'';
  document.getElementById('briefing-el').textContent=d.briefing||'Nenhum material gerado.';
  const cel=document.getElementById('critica-el');
  cel.innerHTML=d.critica?`<div class="c-text">${d.critica}</div>`:'<div class="c-empty">A analise aparecera apos a geracao...</div>';
  document.getElementById('btn-v1').disabled=!d.html_v1;
  document.getElementById('btn-v2').disabled=!d.html_v2;
  if(d.status!=='gerando')document.getElementById('btn-gerar').disabled=false;
  const hel=document.getElementById('hist-el');
  if(d.historico&&d.historico.length){
    hel.innerHTML=d.historico.map((h,i)=>`<div class="h-item" onclick="loadHist(${i})">${h.tipo} &middot; ${h.ts.slice(9,13)}h</div>`).join('');
  }
}

function baixar(v){
  if(!dados)return;
  const html=v==='v1'?dados.html_v1:dados.html_v2;
  if(!html)return;
  const b=new Blob([html],{type:'text/html'});
  const a=document.createElement('a');a.href=URL.createObjectURL(b);
  a.download=`briefflow_${dados.tipo||'mat'}_${v}.html`;a.click();
}

function abrirNovaAba(){
  if(!dados||!dados.html_v2)return;
  const b=new Blob([dados.html_v2],{type:'text/html'});
  window.open(URL.createObjectURL(b),'_blank');
}

async function loadHist(i){
  const r=await fetch('/api/historico/'+i);
  const d=await r.json();
  if(d.html){dados.html_v2=d.html;dados.tipo=d.tipo;render(dados);}
}

async function poll(){
  try{
    const r=await fetch('/api/estado');
    const d=await r.json();
    dados=d;
    atualizarUI(d);
    const area=document.getElementById('preview-area');
    if(d.status==='gerando'){
      area.innerHTML=`<div class="loading-s"><div class="spin"></div><div class="l-label">Gerando material profissional...</div><div class="l-sub">${d.etapa||''}</div></div>`;
    }else if(d.status==='pronto'){
      render(d);
    }else if(d.status==='erro'){
      area.innerHTML=`<div class="empty-s"><div class="empty-ico">&#9888;</div><div class="empty-t">Erro no pipeline</div><div class="empty-sub">${d.etapa||'Verifique o terminal.'}</div></div>`;
    }
  }catch(e){}
  setTimeout(poll,2500);
}
poll();
</script>
</body></html>
"""

# ---------------------------------------------------------------------------
# Rotas Flask
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    return render_template_string(PAINEL_HTML)

@app.route("/api/estado")
def api_estado():
    return jsonify({
        "html_v1":  _estado["html_v1"],
        "html_v2":  _estado["html_v2"],
        "critica":  _estado["critica"],
        "briefing": _estado["briefing"],
        "tipo":     _estado["tipo"],
        "status":   _estado["status"],
        "etapa":    _estado["etapa"],
        "historico": [
            {"versao": h["versao"], "ts": h["ts"], "tipo": h["tipo"]}
            for h in _estado["historico"]
        ],
    })

@app.route("/api/gerar", methods=["POST"])
def api_gerar():
    if _estado["status"] == "gerando":
        return jsonify({"ok": False, "msg": "Pipeline ocupado"})
    dados = request.get_json(force=True, silent=True) or {}
    briefing = dados.get("briefing", "").strip()
    tipo = dados.get("tipo", "banner_html")
    if not briefing:
        return jsonify({"ok": False, "msg": "Briefing vazio"})
    if tipo not in DIMENSOES:
        tipo = "banner_html"
    t = threading.Thread(target=executar_pipeline, args=(briefing, tipo), daemon=True)
    t.start()
    return jsonify({"ok": True})

@app.route("/api/historico/<int:idx>")
def api_historico_html(idx: int):
    hist = _estado.get("historico", [])
    if 0 <= idx < len(hist):
        return jsonify({"html": hist[idx]["html"], "tipo": hist[idx]["tipo"]})
    return jsonify({"html": "", "tipo": ""})

# ---------------------------------------------------------------------------
# Ollama
# ---------------------------------------------------------------------------
def _verificar_ollama() -> None:
    try:
        r = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        r.raise_for_status()
        modelos = [m["name"].split(":")[0] for m in r.json().get("models", [])]
        for m in [MODEL_CODER, MODEL_CRITIC]:
            base = m.split(":")[0]
            if modelos and base not in modelos:
                print(f"[AVISO] Modelo '{m}' nao encontrado. Instale: ollama pull {m}")
    except requests.exceptions.ConnectionError:
        print(f"[ERRO] Ollama offline em {OLLAMA_BASE_URL}")
        print("  Execute em outro terminal: ollama serve")
        sys.exit(1)

def _chamar_ollama(modelo: str, prompt: str, max_tokens: int) -> str:
    payload = {
        "model": modelo,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": TEMPERATURE, "num_predict": max_tokens},
    }
    try:
        resp = requests.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload, timeout=OLLAMA_TIMEOUT)
        resp.raise_for_status()
        return resp.json().get("response", "").strip()
    except requests.exceptions.Timeout:
        raise RuntimeError(f"Timeout ({OLLAMA_TIMEOUT}s) com {modelo}. Reduza MAX_TOKENS_HTML no .env")
    except Exception as e:
        raise RuntimeError(f"Erro Ollama ({modelo}): {e}")

def _extrair_html(texto: str) -> str:
    m = re.search(r"```(?:html)?\s*([\s\S]+?)```", texto, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    m = re.search(r"(<!DOCTYPE[\s\S]+</html>)", texto, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return texto.strip()

# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------
def executar_pipeline(briefing: str, tipo: str) -> None:
    dim = DIMENSOES[tipo]
    _estado.update({"briefing": briefing, "tipo": tipo, "status": "gerando",
                    "html_v1": "", "html_v2": "", "critica": ""})
    try:
        _estado["etapa"] = f"[1/3] {MODEL_CODER} gerando HTML profissional..."
        print(f"\n  {_estado['etapa']}", flush=True)

        prompt_g = (
            f"{PROMPT_GERADOR}\n"
            f"\n{FORLAB_BRAND}\n"
            f"TIPO DE MATERIAL: {dim['desc']}\n"
            f"DIMENSOES EXATAS DO CANVAS: {dim['w']}px largura x {dim['h']}px altura\n"
            f"BRIEFING DO CLIENTE: {briefing}\n\n"
            f"INSTRUCOES ADICIONAIS DE LAYOUT PARA {dim['desc'].upper()}:\n"
        )
        if tipo == "banner_html":
            prompt_g += (
                "- Layout horizontal: ESQUERDA (40%) texto/headline + DIREITA (60%) foto de produto\n"
                "- Headline principal: 52-64px, negrito, branco, max 5 palavras\n"
                "- Badge de oferta: circulo ou hexagono amarelo #FFB800, no canto superior direito\n"
                "- Gradiente de fundo: linear-gradient(135deg, #003366 0%, #0055AA 50%, #003366 100%)\n"
                "- Botao CTA: fundo #FFB800, texto #003366, uppercase, border-radius 25px\n"
                "- Foto laboratorio: https://picsum.photos/seed/lab-pipette-blue-professional/700/400\n"
            )
        elif tipo == "post_visual":
            prompt_g += (
                "- Layout quadrado com foto de produto ocupando 50% do espaco\n"
                "- Badge circular de oferta no topo direito: 110px, fundo #FFB800\n"
                "- Headline: 56-72px, branco, negrito extremo\n"
                "- Fundo: gradiente de #001f4d para #003d99\n"
                "- Foto: https://picsum.photos/seed/pipette-set-laboratory/540/540\n"
            )
        elif tipo == "flyer_html":
            prompt_g += (
                "- Layout vertical A4 com secoes distintas\n"
                "- Header colorido com logo e headline\n"
                "- Secao de produtos com grid 2 colunas\n"
                "- Secao de oferta destacada com fundo colorido\n"
                "- Footer com contatos\n"
                "- Foto: https://picsum.photos/seed/lab-equipment-professional/780/350\n"
            )
        elif tipo == "stories_html":
            prompt_g += (
                "- Layout vertical 9:16 muito alto\n"
                "- Conteudo dividido em 3 zonas verticais (topo/meio/baixo)\n"
                "- Foto grande no centro\n"
                "- Headline muito grande (80-96px) para mobile\n"
                "- CTA na zona inferior com botao grande touch-friendly\n"
                "- Foto: https://picsum.photos/seed/scientist-lab-stories/1080/1920\n"
            )
        prompt_g += "\nHTML completo (comece AGORA com <!DOCTYPE html>):\n"

        raw_v1 = _chamar_ollama(MODEL_CODER, prompt_g, MAX_TOKENS_HTML)
        html_v1 = _extrair_html(raw_v1)
        _estado["html_v1"] = html_v1

        _estado["etapa"] = f"[2/3] {MODEL_CRITIC} analisando design..."
        print(f"  {_estado['etapa']}", flush=True)

        prompt_c = (
            f"{PROMPT_CRITICO}\n"
            f"TIPO: {dim['desc']} | CANVAS: {dim['w']}x{dim['h']}px\n"
            f"BRIEFING ORIGINAL: {briefing}\n\n"
            f"HTML A AVALIAR:\n{html_v1[:4000]}\n\n"
            "3 melhorias objetivas:"
        )
        critica = _chamar_ollama(MODEL_CRITIC, prompt_c, MAX_TOKENS_CRITIC)
        _estado["critica"] = critica

        _estado["etapa"] = f"[3/3] {MODEL_CODER} refinando..."
        print(f"  {_estado['etapa']}", flush=True)

        prompt_r = (
            f"{PROMPT_REFINADOR}\n"
            f"MELHORIAS DO DIRETOR DE ARTE:\n{critica}\n\n"
            f"HTML ORIGINAL:\n{html_v1}\n\n"
            "HTML REFINADO (comece com <!DOCTYPE html>):\n"
        )
        raw_v2 = _chamar_ollama(MODEL_CODER, prompt_r, MAX_TOKENS_REFINE)
        html_v2 = _extrair_html(raw_v2)
        if len(html_v2) < 300:
            html_v2 = html_v1
        _estado["html_v2"] = html_v2

        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        (OUTPUT_DIR / f"{tipo}_v1_{ts}.html").write_text(html_v1, encoding="utf-8")
        (OUTPUT_DIR / f"{tipo}_v2_{ts}.html").write_text(html_v2, encoding="utf-8")

        _estado["historico"].insert(0, {"versao": f"{tipo}_v2_{ts}", "html": html_v2, "ts": ts, "tipo": tipo})
        if len(_estado["historico"]) > 10:
            _estado["historico"] = _estado["historico"][:10]

        _estado["status"] = "pronto"
        _estado["etapa"] = "Concluido! Preview atualizado automaticamente."
        print(f"  [OK] Salvo em {OUTPUT_DIR}/")

    except RuntimeError as e:
        _estado["status"] = "erro"
        _estado["etapa"] = str(e)
        print(f"  [ERRO] {e}")
    except Exception as e:
        logger.exception("Erro inesperado")
        _estado["status"] = "erro"
        _estado["etapa"] = str(e)

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    _verificar_ollama()

    print("\n" + "+" + "=" * 60 + "+")
    print("|{:^60}|".format("BriefFlow v2 - Gerador de Marketing DLAB/Forlab"))
    print("|{:^60}|".format(f"Preview: http://localhost:{PREVIEW_PORT}"))
    print("+" + "=" * 60 + "+")
    print(f"  Abrindo http://localhost:{PREVIEW_PORT} ...")

    # Abre o browser depois que o Flask subir
    if AUTO_OPEN_BROWSER:
        threading.Timer(1.5, lambda: webbrowser.open(f"http://localhost:{PREVIEW_PORT}")).start()

    # Flask roda na thread principal (bloqueia)
    app.run(host="0.0.0.0", port=PREVIEW_PORT, debug=False, use_reloader=False)

if __name__ == "__main__":
    main()
