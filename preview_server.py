"""
preview_server.py - Servidor Flask de preview para o BriefFlow v2.

Funcionalidades:
  - Renderiza o HTML gerado em tempo real via iframe
  - Exibe v1 (gerado) e v2 (refinado) lado a lado
  - Mostra a critica do modelo de design
  - Botoes: Baixar HTML, Baixar PNG (html2canvas)
  - Historico das ultimas geracoes
  - Polling automatico a cada 3s para detectar novo conteudo

Uso:
  Iniciado automaticamente pelo briefflow_v2.py
  Ou manualmente: python preview_server.py
"""

from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path

from flask import Flask, jsonify, render_template_string, request

# Estado local (quando o server roda standalone ou recebe via POST)
_estado_local = {
    "html_v1": "",
    "html_v2": "",
    "critica": "",
    "briefing": "",
    "tipo": "",
    "status": "idle",
    "etapa": "Aguardando novo material...",
    "historico": [],
}

app = Flask(__name__)
app.config["SECRET_KEY"] = "briefflow-preview-2026"

# ---------------------------------------------------------------------------
# Template HTML do painel de preview
# ---------------------------------------------------------------------------
PAINEL_HTML = """
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BriefFlow Preview</title>
<style>
  :root {
    --bg: #0f1117;
    --surface: #1a1d27;
    --surface2: #222535;
    --border: #2e3248;
    --text: #e2e8f0;
    --muted: #8892a4;
    --primary: #6366f1;
    --primary-h: #818cf8;
    --success: #22c55e;
    --warning: #f59e0b;
    --error: #ef4444;
    --radius: 10px;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; font-family: 'Inter', system-ui, sans-serif;
    background: var(--bg); color: var(--text); font-size: 14px; }

  .layout { display: grid; grid-template-columns: 280px 1fr; height: 100vh; }

  .sidebar {
    background: var(--surface); border-right: 1px solid var(--border);
    display: flex; flex-direction: column; overflow: hidden;
  }
  .sidebar-header { padding: 20px 16px 16px; border-bottom: 1px solid var(--border); }
  .logo { font-size: 18px; font-weight: 700; color: var(--primary-h); letter-spacing: -0.5px; }
  .logo span { color: var(--text); }
  .version { font-size: 11px; color: var(--muted); margin-top: 2px; }

  .status-box {
    margin: 12px 16px;
    padding: 10px 12px;
    background: var(--surface2);
    border-radius: var(--radius);
    border: 1px solid var(--border);
  }
  .status-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); margin-bottom: 4px; }
  .status-text { font-size: 12px; color: var(--text); line-height: 1.4; }
  .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
  .dot-idle    { background: var(--muted); }
  .dot-gerando { background: var(--warning); animation: pulse 1s infinite; }
  .dot-pronto  { background: var(--success); }
  .dot-erro    { background: var(--error); }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

  .critica-box {
    margin: 0 16px 12px;
    padding: 10px 12px;
    background: var(--surface2);
    border-radius: var(--radius);
    border: 1px solid var(--border);
    flex: 1; overflow-y: auto;
  }
  .critica-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); margin-bottom: 8px; }
  .critica-text { font-size: 11px; color: var(--text); line-height: 1.6; white-space: pre-wrap; }
  .critica-empty { font-size: 11px; color: var(--muted); font-style: italic; }

  .historico-box { margin: 0 16px 16px; }
  .historico-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); margin-bottom: 6px; }
  .hist-item {
    padding: 6px 10px; margin-bottom: 4px;
    background: var(--surface2); border-radius: 6px;
    border: 1px solid var(--border); cursor: pointer;
    font-size: 11px; color: var(--muted); transition: all 0.15s;
  }
  .hist-item:hover { border-color: var(--primary); color: var(--text); }

  .main { display: flex; flex-direction: column; overflow: hidden; }
  .topbar {
    padding: 14px 20px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
    background: var(--surface);
  }
  .briefing-text { font-size: 13px; color: var(--muted); max-width: 600px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .actions { display: flex; gap: 8px; }
  .btn {
    padding: 7px 14px; border-radius: 7px; border: none;
    font-size: 12px; font-weight: 600; cursor: pointer;
    transition: all 0.15s; display: inline-flex; align-items: center; gap: 5px;
  }
  .btn-primary { background: var(--primary); color: #fff; }
  .btn-primary:hover { background: var(--primary-h); }
  .btn-outline { background: transparent; color: var(--text); border: 1px solid var(--border); }
  .btn-outline:hover { border-color: var(--primary); color: var(--primary-h); }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .tabs {
    display: flex; border-bottom: 1px solid var(--border);
    background: var(--surface); padding: 0 20px;
  }
  .tab {
    padding: 10px 18px; font-size: 12px; font-weight: 500;
    color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.15s;
  }
  .tab.active { color: var(--primary-h); border-bottom-color: var(--primary); }
  .tab:hover { color: var(--text); }

  .preview-area { flex: 1; overflow: auto; background: #e8ecf0; padding: 24px;
    display: flex; align-items: flex-start; justify-content: center; gap: 24px; }
  .preview-wrap { background: #fff; border-radius: 8px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.15); overflow: hidden; position: relative; min-width: 200px; }
  .preview-tag {
    position: absolute; top: 8px; left: 8px; z-index: 10;
    padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; letter-spacing: 0.5px;
  }
  .tag-v1 { background: #f59e0b22; color: #f59e0b; border: 1px solid #f59e0b44; }
  .tag-v2 { background: #22c55e22; color: #22c55e; border: 1px solid #22c55e44; }
  .preview-frame { display: block; border: none; }

  .empty-state {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 12px; height: 100%;
    color: var(--muted); text-align: center;
  }
  .empty-icon { font-size: 48px; opacity: 0.3; }
  .empty-title { font-size: 16px; font-weight: 600; color: var(--text); }
  .empty-sub { font-size: 13px; line-height: 1.5; max-width: 320px; }

  .loading-state {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 16px; height: 100%; color: var(--muted);
  }
  .spinner {
    width: 40px; height: 40px;
    border: 3px solid var(--border);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-label { font-size: 14px; color: var(--text); font-weight: 500; }
  .loading-sub { font-size: 12px; }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--muted); }
</style>
</head>
<body>
<div class="layout">

  <div class="sidebar">
    <div class="sidebar-header">
      <div class="logo">Brief<span>Flow</span></div>
      <div class="version">v2 &middot; Preview ao vivo</div>
    </div>

    <div class="status-box">
      <div class="status-label">Status do pipeline</div>
      <div class="status-text" id="status-text">
        <span class="status-dot dot-idle" id="status-dot"></span>
        <span id="status-label">Aguardando...</span>
      </div>
      <div style="margin-top:6px;font-size:11px;color:var(--muted)" id="etapa-text"></div>
    </div>

    <div class="critica-box">
      <div class="critica-label">&#127912; Analise do Diretor de Arte</div>
      <div id="critica-content">
        <div class="critica-empty">A analise aparecera aqui apos a geracao...</div>
      </div>
    </div>

    <div class="historico-box">
      <div class="historico-label">&#128193; Historico</div>
      <div id="historico-list"></div>
    </div>
  </div>

  <div class="main">
    <div class="topbar">
      <div class="briefing-text" id="briefing-text">Nenhum material gerado ainda.</div>
      <div class="actions">
        <button class="btn btn-outline" id="btn-baixar-v1" onclick="baixarHTML('v1')" disabled>&#8595; v1</button>
        <button class="btn btn-outline" id="btn-baixar-v2" onclick="baixarHTML('v2')" disabled>&#8595; v2 HTML</button>
        <button class="btn btn-primary" id="btn-png" onclick="exportarPNG()" disabled>&#128248; Exportar PNG</button>
      </div>
    </div>

    <div class="tabs">
      <div class="tab active" onclick="mudarTab('comparar')" id="tab-comparar">Comparar v1 vs v2</div>
      <div class="tab" onclick="mudarTab('v2')" id="tab-v2">&#10024; Final (v2)</div>
      <div class="tab" onclick="mudarTab('v1')" id="tab-v1">Rascunho (v1)</div>
    </div>

    <div class="preview-area" id="preview-area">
      <div class="empty-state">
        <div class="empty-icon">&#127912;</div>
        <div class="empty-title">Nenhum material ainda</div>
        <div class="empty-sub">Execute o BriefFlow v2 e peca um banner, flyer, post ou card. O preview aparece automaticamente aqui.</div>
      </div>
    </div>
  </div>

</div>

<script>
let tabAtual = 'comparar';
let dadosAtuais = null;

function mudarTab(tab) {
  tabAtual = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  if (dadosAtuais && dadosAtuais.status === 'pronto') renderPreview(dadosAtuais);
}

function renderPreview(dados) {
  const area = document.getElementById('preview-area');
  if (!dados.html_v2 && !dados.html_v1) return;
  const escala = 0.55;
  const dims = {
    post_visual: [1080,1080], flyer_html: [794,1123],
    card_html: [600,400], banner_html: [1200,400],
  };
  const [w, h] = dims[dados.tipo] || [800, 600];
  const fw = Math.round(w * escala);
  const fh = Math.round(h * escala);
  function frameHTML(html, tag, cls) {
    const enc = encodeURIComponent(html);
    return `<div class="preview-wrap">
      <div class="preview-tag ${cls}">${tag}</div>
      <iframe class="preview-frame"
        src="data:text/html;charset=utf-8,${enc}"
        width="${w}" height="${h}"
        style="transform:scale(${escala});transform-origin:top left;display:block;"
        sandbox="allow-scripts allow-same-origin">
      </iframe>
      <div style="width:${fw}px;height:${fh}px;"></div>
    </div>`;
  }
  if (tabAtual === 'comparar') {
    area.innerHTML = '';
    if (dados.html_v1) area.innerHTML += frameHTML(dados.html_v1, 'v1 Rascunho', 'tag-v1');
    if (dados.html_v2) area.innerHTML += frameHTML(dados.html_v2, 'v2 Refinado', 'tag-v2');
  } else if (tabAtual === 'v2') {
    area.innerHTML = frameHTML(dados.html_v2 || dados.html_v1, 'v2 Final', 'tag-v2');
  } else {
    area.innerHTML = frameHTML(dados.html_v1 || dados.html_v2, 'v1 Rascunho', 'tag-v1');
  }
}

function atualizarStatus(dados) {
  const dot   = document.getElementById('status-dot');
  const label = document.getElementById('status-label');
  const etapa = document.getElementById('etapa-text');
  const mapa  = {
    idle:    ['dot-idle',    'Aguardando'],
    gerando: ['dot-gerando', 'Gerando...'],
    pronto:  ['dot-pronto',  'Pronto!'],
    erro:    ['dot-erro',    'Erro'],
  };
  const [cls, txt] = mapa[dados.status] || mapa.idle;
  dot.className = 'status-dot ' + cls;
  label.textContent = txt;
  etapa.textContent = dados.etapa || '';
  document.getElementById('briefing-text').textContent = dados.briefing || 'Nenhum material gerado ainda.';
  const critica = document.getElementById('critica-content');
  if (dados.critica) {
    critica.innerHTML = `<div class="critica-text">${dados.critica}</div>`;
  } else {
    critica.innerHTML = '<div class="critica-empty">A analise aparecera aqui apos a geracao...</div>';
  }
  document.getElementById('btn-baixar-v1').disabled = !dados.html_v1;
  document.getElementById('btn-baixar-v2').disabled = !dados.html_v2;
  document.getElementById('btn-png').disabled = dados.status !== 'pronto';
  const histEl = document.getElementById('historico-list');
  if (dados.historico && dados.historico.length) {
    histEl.innerHTML = dados.historico.map((h, i) =>
      `<div class="hist-item" onclick="carregarHistorico(${i})">${h.tipo} &middot; ${h.ts.slice(9,13)}h &middot; v2</div>`
    ).join('');
  } else {
    histEl.innerHTML = '<div class="critica-empty">Nenhum historico ainda.</div>';
  }
}

function baixarHTML(versao) {
  if (!dadosAtuais) return;
  const html = versao === 'v1' ? dadosAtuais.html_v1 : dadosAtuais.html_v2;
  if (!html) return;
  const blob = new Blob([html], {type: 'text/html'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `briefflow_${dadosAtuais.tipo || 'material'}_${versao}.html`;
  a.click();
}

function exportarPNG() {
  alert('Para exportar PNG: abra o arquivo HTML em nova aba, use Ctrl+Shift+I > Console > html2canvas ou Print to PDF no navegador.');
}

function carregarHistorico(idx) {
  if (!dadosAtuais || !dadosAtuais.historico[idx]) return;
  fetch('/api/historico/' + idx)
    .then(r => r.json())
    .then(d => {
      if (d.html) { dadosAtuais.html_v2 = d.html; dadosAtuais.tipo = d.tipo; renderPreview(dadosAtuais); }
    });
}

async function poll() {
  try {
    const r = await fetch('/api/estado');
    const dados = await r.json();
    dadosAtuais = dados;
    atualizarStatus(dados);
    const area = document.getElementById('preview-area');
    if (dados.status === 'gerando') {
      area.innerHTML = `<div class="loading-state">
        <div class="spinner"></div>
        <div class="loading-label">Gerando material...</div>
        <div class="loading-sub">${dados.etapa || ''}</div>
      </div>`;
    } else if (dados.status === 'pronto') {
      renderPreview(dados);
    } else if (dados.status === 'erro') {
      area.innerHTML = `<div class="empty-state">
        <div class="empty-icon">&#9888;&#65039;</div>
        <div class="empty-title">Erro no pipeline</div>
        <div class="empty-sub">${dados.etapa || 'Verifique o terminal.'}</div>
      </div>`;
    }
  } catch(e) {}
  setTimeout(poll, 3000);
}

poll();
</script>
</body>
</html>
"""

@app.route("/")
def index():
    return render_template_string(PAINEL_HTML)

@app.route("/api/estado")
def api_estado():
    try:
        if "briefflow_v2" in sys.modules:
            import briefflow_v2
            estado = briefflow_v2._estado
        else:
            estado = _estado_local
    except Exception:
        estado = _estado_local
    return jsonify({
        "html_v1":  estado.get("html_v1", ""),
        "html_v2":  estado.get("html_v2", ""),
        "critica":  estado.get("critica", ""),
        "briefing": estado.get("briefing", ""),
        "tipo":     estado.get("tipo", ""),
        "status":   estado.get("status", "idle"),
        "etapa":    estado.get("etapa", ""),
        "historico": [
            {"versao": h["versao"], "ts": h["ts"], "tipo": h["tipo"]}
            for h in estado.get("historico", [])
        ],
    })

@app.route("/api/estado", methods=["POST"])
def api_atualizar_estado():
    dados = request.get_json(force=True, silent=True) or {}
    for k, v in dados.items():
        if k in _estado_local:
            _estado_local[k] = v
    return jsonify({"ok": True})

@app.route("/api/historico/<int:idx>")
def api_historico_html(idx: int):
    try:
        if "briefflow_v2" in sys.modules:
            import briefflow_v2
            hist = briefflow_v2._estado.get("historico", [])
        else:
            hist = _estado_local.get("historico", [])
        if 0 <= idx < len(hist):
            return jsonify({"html": hist[idx]["html"], "tipo": hist[idx]["tipo"]})
    except Exception:
        pass
    return jsonify({"html": "", "tipo": ""})

if __name__ == "__main__":
    port = int(os.getenv("PREVIEW_PORT", "5000"))
    print(f"[BriefFlow Preview] Rodando em http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False)
