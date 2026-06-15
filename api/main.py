"""
BriefFlow API — FastAPI backend para a interface web

Endpoints:
  POST /api/chat                  — envia mensagem e recebe resposta + arquivos gerados
  POST /api/referencias/upload    — faz upload de imagem de referencia visual
  GET  /api/referencias           — lista referencias visuais do vault
  GET  /api/download              — faz download de arquivo gerado

Rodar:
  python -m uvicorn api.main:app --reload --port 8000
"""

import os
import json
import base64
import logging
import mimetypes
import tempfile
from pathlib import Path
from typing import Optional, List

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
from rag_loader import carregar_contexto, registrar_erro, salvar_referencia_visual
from renderer import renderizar, FORMAT_MAP

try:
    from workspace_pipeline import (
        get_system_prompt, _chamar_llm, _chamar_llm_multimodal,
        detectar_material, MATERIAL_MAP, analisar_e_salvar_referencia_visual,
        coletar_referencias_visuais,
    )
except ImportError as e:
    raise RuntimeError(f"Falha ao importar workspace_pipeline: {e}")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="BriefFlow API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OUTPUT_DIR    = Path(os.getenv("OUTPUT_DIR", "data/output"))
KNOWLEDGE_DIR = Path("knowledge")
GEMINI_KEY    = os.getenv("GEMINI_API_KEY", "")
OPENAI_KEY    = os.getenv("OPENAI_API_KEY", "")
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# Diretório temporário compatível com Windows e Linux
TMP_DIR = Path(tempfile.gettempdir())


# ----- Schemas -----

class ChatRequest(BaseModel):
    message:  str
    contexto: Optional[str] = ""


# ----- Helpers -----

def _ext_to_format(path: Path) -> str:
    return path.suffix.lower().lstrip(".")


def _file_preview_url(path: Path) -> Optional[str]:
    """Gera data-URL para PNG pequeno (preview inline)."""
    if path.suffix.lower() == ".png" and path.stat().st_size < 3 * 1024 * 1024:
        data = base64.b64encode(path.read_bytes()).decode()
        return f"data:image/png;base64,{data}"
    return None


def _tem_provider() -> bool:
    """Retorna True se ao menos uma API key estiver configurada."""
    return bool(GEMINI_KEY or OPENAI_KEY or ANTHROPIC_KEY or
                os.getenv("OLLAMA_BASE_URL") or os.getenv("OLLAMA_MODEL"))


# ----- Endpoints -----

@app.get("/api/health")
async def health():
    providers = []
    if GEMINI_KEY:    providers.append("gemini")
    if OPENAI_KEY:    providers.append("openai")
    if ANTHROPIC_KEY: providers.append("anthropic")
    if os.getenv("OLLAMA_BASE_URL") or os.getenv("OLLAMA_MODEL"):
        providers.append("ollama")
    return {
        "status": "ok",
        "providers_configured": providers,
        "ready": len(providers) > 0,
    }


@app.post("/api/chat")
async def chat(req: ChatRequest):
    mensagem = req.message.strip()
    contexto = req.contexto.strip() if req.contexto else ""

    if not mensagem:
        raise HTTPException(status_code=400, detail="Mensagem vazia.")

    if not _tem_provider():
        raise HTTPException(
            status_code=503,
            detail=(
                "Nenhum provider de IA configurado. "
                "Adicione GEMINI_API_KEY, OPENAI_API_KEY ou ANTHROPIC_API_KEY no arquivo .env "
                "e reinicie a API."
            ),
        )

    material = detectar_material(mensagem)
    full_msg  = mensagem + (f"\n\n--- CONTEXTO ---\n{contexto}" if contexto else "")

    rag_ctx = carregar_contexto(
        mensagem=full_msg,
        material_key=material[0] if material else None,
    )
    refs_visuais = coletar_referencias_visuais(
        mensagem=full_msg,
        material_key=material[0] if material else None,
        limite=3,
    )

    system = get_system_prompt() + rag_ctx

    if material:
        chave, descricao = material
        full_msg += (
            f"\n\nIMPORTANTE: Gere APENAS {descricao}. "
            "Entregue o conteudo completo diretamente, sem explicacoes introdutorias."
        )

    max_tok = 4096 if material else 1200

    try:
        if refs_visuais and (GEMINI_KEY or OPENAI_KEY or ANTHROPIC_KEY):
            user_content = [{"type": "text", "text": full_msg}]
            for ref in refs_visuais:
                user_content += [
                    {"type": "text", "text": f"Referencia visual: {ref['title']} | {ref['description']} | Layout: {ref['layout_notes']}"},
                    {"type": "image_url", "image_url": {"url": ref["data_url"]}},
                ]
            messages = [{"role": "system", "content": system}, {"role": "user", "content": user_content}]
            resposta, provider = _chamar_llm_multimodal(messages, max_tokens=max_tok)
        else:
            messages = [{"role": "system", "content": system}, {"role": "user", "content": full_msg}]
            resposta, provider = _chamar_llm(messages, max_tokens=max_tok)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    # Renderiza material
    files_out  = []
    previews   = []
    if material:
        chave, _ = material
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        gerados = renderizar(
            conteudo=resposta,
            material_key=chave,
            output_dir=OUTPUT_DIR,
            nome_base=chave.replace(" ", "_"),
        )
        for g in gerados:
            fmt = _ext_to_format(g)
            files_out.append({"name": g.name, "path": str(g), "format": fmt})
            pv = _file_preview_url(g)
            if pv:
                previews.append(pv)

    return JSONResponse({
        "response": resposta,
        "provider": provider,
        "files":    files_out,
        "previews": previews,
    })


@app.post("/api/referencias/upload")
async def upload_referencia(
    file:          UploadFile = File(...),
    material_type: str        = Form("geral"),
    description:   str        = Form(""),
):
    ext = Path(file.filename).suffix.lower()
    if ext not in {".png", ".jpg", ".jpeg", ".webp"}:
        raise HTTPException(status_code=400, detail="Formato invalido. Use PNG, JPG ou WEBP.")

    # Salva em diretório temporário compatível com Windows e Linux
    safe_name = Path(file.filename).name  # evita path traversal
    tmp = TMP_DIR / safe_name
    tmp.write_bytes(await file.read())

    try:
        payload = analisar_e_salvar_referencia_visual(
            image_path=tmp,
            instrucoes_usuario=f"tipo={material_type}; {description}",
        )
    except RuntimeError as e:
        # Fallback sem analise multimodal
        payload = salvar_referencia_visual(
            origem_path=tmp,
            title=Path(file.filename).stem.replace("_", " ").title(),
            material_type=material_type,
            description=description or "Referencia visual enviada pelo usuario.",
            tags=["referencia", material_type],
            layout_notes=description or "Sem notas adicionais.",
        )

    # Preview
    refs_dir  = KNOWLEDGE_DIR / "referencias_visuais"
    img_path  = refs_dir / payload["file_name"]
    preview   = None
    if img_path.exists():
        data    = base64.b64encode(img_path.read_bytes()).decode()
        mt      = mimetypes.guess_type(str(img_path))[0] or "image/png"
        preview = f"data:{mt};base64,{data}"

    return JSONResponse({**payload, "preview_url": preview})


@app.get("/api/referencias")
async def listar_referencias():
    refs_dir = KNOWLEDGE_DIR / "referencias_visuais"
    if not refs_dir.exists():
        return JSONResponse([])

    resultado = []
    for jf in refs_dir.glob("*.json"):
        try:
            meta = json.loads(jf.read_text(encoding="utf-8"))
            img  = refs_dir / meta.get("file_name", "")
            prev = None
            if img.exists():
                data = base64.b64encode(img.read_bytes()).decode()
                mt   = mimetypes.guess_type(str(img))[0] or "image/png"
                prev = f"data:{mt};base64,{data}"
            resultado.append({**meta, "preview_url": prev})
        except Exception:
            pass
    return JSONResponse(resultado)


@app.get("/api/download")
async def download_file(path: str):
    p = Path(path)
    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=404, detail="Arquivo nao encontrado.")
    # Seguranca: apenas arquivos dentro de data/output
    try:
        p.relative_to(OUTPUT_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Acesso negado.")
    return FileResponse(p, filename=p.name)


# Serve o build do React em producao
_web_dist = Path("web/dist")
if _web_dist.exists():
    app.mount("/", StaticFiles(directory=str(_web_dist), html=True), name="static")
