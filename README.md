# BriefFlow — Agente de Marketing Conversacional

Interface web premium (React + Vite) + API Python (FastAPI) para geração de materiais de marketing com qualidade de agência.

---

## ⚡ Início rápido

```bash
# 1. Clone
git clone https://github.com/Pedro-Vieira1507/BriefFlow.git
cd BriefFlow

# 2. Instale dependências Python
pip install -r requirements.txt

# 3. Instale Chromium (renderização PNG/PDF)
playwright install chromium

# 4. Configure o ambiente
cp .env.example .env
# Edite com modelo Ollama e/ou API keys

# 5. Instale dependências Node
npm install

# 6. Inicie o Ollama (terminal separado)
ollama serve && ollama pull llama3

# 7. Inicie tudo com um comando
npm start
# → API:  http://localhost:8000
# → Web:  http://localhost:5173
```

> **⚠️ Atenção:** Os arquivos `briefflow_chat.py`, `briefflow_v2.py` e `preview_server.py` são o app legado e estão **desativados**. Não os execute. O novo app é `api/main.py` + `web/`.

---

## Interface web

- **Chat conversacional** com bolhas, markdown e indicador de digitação
- **Chips de material** — 1 clique para gerar Banner, Instagram, Ficha Técnica etc.
- **Sidebar** com contexto do produto e galeria de referências visuais
- **Upload de referências** — drag & drop, análise multimodal e salvamento no Obsidian
- **Preview inline de PNG** gerado diretamente na conversa
- **Download** de qualquer arquivo gerado (PNG, PDF, HTML, TXT)

---

## Formatos de saída

| Material | Formato |
|---|---|
| Banner | PNG |
| Card de produto | PNG |
| Post Instagram | PNG (1080×1080) |
| Instagram Stories | PNG (3 × 1080×1920) |
| Ficha técnica | PDF (A4) |
| Proposta / One-pager | PDF (A4) |
| Landing page | HTML |
| E-mail marketing | HTML |
| Carrossel LinkedIn | TXT |
| Reels / TikTok | TXT |
| Google Ads / Meta Ads | TXT |
| Script WhatsApp | TXT |

---

## Estrutura do projeto

```
BriefFlow/
├── api/
│   └── main.py                  # FastAPI backend
├── src/
│   ├── workspace_pipeline.py    # Chat + LLM (terminal)
│   ├── renderer.py              # PNG / PDF / HTML / TXT
│   ├── rag_loader.py            # RAG + referências visuais
│   └── prompts/
│       └── system_prompt.txt
├── web/                         # Interface React/Vite
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   └── index.html
├── knowledge/                   # Vault Obsidian (RAG)
│   ├── identidade_visual.md
│   ├── tom_de_voz.md
│   ├── produtos/
│   ├── exemplos_bons/
│   ├── erros/
│   └── referencias_visuais/
├── data/output/                 # Materiais gerados
├── vite.config.ts
├── package.json
├── tailwind.config.js
├── requirements.txt
└── README.md
```

---

## Providers suportados

| Provider | Texto | Multimodal | Config |
|---|---|---|---|
| Ollama (local) | ✅ | ❌ | `OLLAMA_MODEL`, `OLLAMA_BASE_URL` |
| Gemini | ✅ | ✅ | `GEMINI_API_KEY` |
| Claude | ✅ | ✅ | `ANTHROPIC_API_KEY` |
| OpenAI | ✅ | ✅ | `OPENAI_API_KEY` |

Fallback automático: **Ollama → Gemini → Claude → OpenAI**
