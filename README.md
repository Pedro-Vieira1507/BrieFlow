# BriefFlow — Agente de Marketing Conversacional

Interface web premium (React + Vite) + API Python (FastAPI) para geração de materiais de marketing com qualidade de agência.

---

## ⚡ Início rápido (Windows)

### 1. Pré-requisitos

- **Python 3.10+** — [python.org/downloads](https://www.python.org/downloads/)  
  > ⚠️ Durante a instalação, marque **"Add Python to PATH"**
- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **Git** — [git-scm.com](https://git-scm.com)

### 2. Clone e setup

```powershell
git clone https://github.com/Pedro-Vieira1507/BriefFlow.git
cd BriefFlow

# Instala tudo automaticamente (Python + Node + Playwright)
setup.bat
```

### 3. Configure as API Keys

Edite o arquivo `.env` na raiz do projeto:

```env
# Escolha ao menos UMA das opções abaixo:
GEMINI_API_KEY=sua_chave_aqui
# OPENAI_API_KEY=sua_chave_aqui
# ANTHROPIC_API_KEY=sua_chave_aqui

# Ou use Ollama local (gratuito):
# OLLAMA_MODEL=llama3
# OLLAMA_BASE_URL=http://localhost:11434
```

### 4. Inicie o BriefFlow

```powershell
# Opção A: Script automático (abre tudo de uma vez)
start.bat

# Opção B: Manual (dois terminais)
# Terminal 1:
python -m uvicorn api.main:app --reload --port 8000

# Terminal 2:
npm run dev
```

Acesse: **http://localhost:5173**

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
│   ├── workspace_pipeline.py    # Chat + LLM
├── web/                         # Interface React/Vite
├── knowledge/                   # Vault Obsidian (RAG)
├── setup.bat                    # Setup automático Windows
├── start.bat                    # Inicia API + Web juntos
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

---

> **⚠️ App legado:** Os arquivos `briefflow_chat.py`, `briefflow_v2.py` e `preview_server.py` estão desativados. Não os execute.
