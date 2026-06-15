# BriefFlow — Agente de Marketing Conversacional

Gera materiais de marketing com qualidade de agência premium — via **interface web** (React/Vite) ou **terminal**.

---

## Início rápido

```bash
# 1. Clone
git clone https://github.com/Pedro-Vieira1507/BriefFlow.git
cd BriefFlow

# 2. Instale dependências Python
pip install -r requirements.txt

# 3. Instale Chromium (para PNG/PDF)
playwright install chromium

# 4. Configure o ambiente
cp .env.example .env
# Edite com seu modelo Ollama e/ou API keys

# 5. Inicie o Ollama (terminal separado)
ollama serve
ollama pull llama3

# 6. Inicie a API
uvicorn api.main:app --reload --port 8000

# 7. Inicie a interface web (terminal separado)
cd web && npm install && npm run dev
# Abra http://localhost:5173
```

---

## Interface web

- **Chat conversacional** com bolhas de mensagem e indicador de digitação
- **Chips de material** para acionar geração em 1 clique (Banner, Instagram, Ficha Técnica...)
- **Sidebar** com contexto do produto e galeria de referências visuais salvas
- **Upload de referências** — arraste uma imagem, escolha o tipo e salve no vault do Obsidian
- **Preview inline** de PNG gerado diretamente no chat
- **Download** de qualquer arquivo gerado com 1 clique

---

## Formatos de saída por material

| Material | Formato |
|---|---|
| Banner | PNG |
| Card de produto | PNG |
| Post Instagram | PNG (1080x1080) |
| Instagram Stories | PNG (3 x 1080x1920) |
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
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── knowledge/                   # Vault Obsidian (RAG)
│   ├── identidade_visual.md
│   ├── tom_de_voz.md
│   ├── produtos/
│   ├── exemplos_bons/
│   ├── erros/
│   └── referencias_visuais/
├── data/
│   └── output/                  # Materiais gerados
├── .env.example
├── requirements.txt
└── README.md
```

---

## Providers suportados

| Provider | Texto | Multimodal | Configuração |
|---|---|---|---|
| Ollama (local) | ✅ | ❌ | `OLLAMA_MODEL`, `OLLAMA_BASE_URL` |
| Gemini | ✅ | ✅ | `GEMINI_API_KEY` |
| Claude | ✅ | ✅ | `ANTHROPIC_API_KEY` |
| OpenAI | ✅ | ✅ | `OPENAI_API_KEY` |

Fallback automático: Ollama → Gemini → Claude → OpenAI
