"""
generate_assets.py — Pipeline principal de geração de assets de marketing.

Fluxo:
  1. Lê .brief.json da pasta inbox/
  2. Chama Ollama (gemma3:4b) para gerar: podcast, slides, ficha, emails, folheto
  3. Converte slides em PPTX (python-pptx)
  4. Gera versões visuais via visual_ai.py:
       - E-mails, Folheto, Ficha → HTML + PDF (WeasyPrint renderiza)
       - Posts → Pexels (fallback automático)
  5. Salva generation_manifest.json com todos os resultados

Configurações relevantes no .env:
  OLLAMA_HOST=http://localhost:11434   → URL base do Ollama
  OLLAMA_MODEL=gemma3:4b              → modelo principal
  OLLAMA_FALLBACK_MODELS=             → modelos de fallback separados por vírgula
  SKIP_VISUAL_AI=false                → true para pular toda etapa visual
  VISUAL_AI_PROVIDER_POSTS=...        → pexels | skip
  VISUAL_AI_PROVIDER_DOCS=...         → weasyprint | skip
"""

from pathlib import Path
import json
import logging
import os
import random
import time
import urllib.request
import urllib.error
from typing import Optional, Tuple

from dotenv import load_dotenv

load_dotenv()  # sempre antes de qualquer os.getenv()

from app.slides_ppt import slides_txt_to_ppt
from app.visual_ai import run_visual_generation

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


def log(message: str) -> None:
    logger.info(message)


# ---------------------------------------------------------------------------
# Configurações via .env
# ---------------------------------------------------------------------------
INBOX_DIR    = Path("data/inbox")
EXAMPLES_DIR = Path("data/examples")
DEFAULT_TEMPLATE_PATH = Path("data/template slides/APRESENTAÇÃO - MODELO [todos copiar].pptx")

OLLAMA_HOST            = os.getenv("OLLAMA_HOST", "http://localhost:11434").rstrip("/")
PRIMARY_MODEL          = os.getenv("OLLAMA_MODEL", "gemma3:4b")
FALLBACK_MODELS        = [
    m.strip()
    for m in os.getenv("OLLAMA_FALLBACK_MODELS", "").split(",")
    if m.strip()
]

OFFLINE_MODE    = os.getenv("OFFLINE_MODE",   "false").strip().lower() in {"1", "true", "yes", "on"}
SKIP_EXISTING   = os.getenv("SKIP_EXISTING",  "true" ).strip().lower() in {"1", "true", "yes", "on"}
SKIP_VISUAL_AI  = os.getenv("SKIP_VISUAL_AI", "false").strip().lower() in {"1", "true", "yes", "on"}

VISUAL_AI_PROVIDER_POSTS = os.getenv("VISUAL_AI_PROVIDER_POSTS", "pexels"    ).strip().lower()
VISUAL_AI_PROVIDER_DOCS  = os.getenv("VISUAL_AI_PROVIDER_DOCS",  "weasyprint").strip().lower()

DEFAULT_RETRIES                = int(  os.getenv("GEN_RETRIES",          "5"  ))
DEFAULT_TIMEOUT_BETWEEN_ASSETS = float(os.getenv("SLEEP_BETWEEN_ASSETS", "0.5"))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_brief(brief_path: Path) -> dict:
    return json.loads(brief_path.read_text(encoding="utf-8"))


def write_text_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        path.write_text(content.strip() + "\n", encoding="utf-8")
    except OSError as e:
        raise RuntimeError(f"Falha ao salvar arquivo {path}: {e}") from e


def load_example_text(asset_key: str) -> str:
    example_map = {
        "podcast":  EXAMPLES_DIR / "podcast_revendedores.txt",
        "slides":   EXAMPLES_DIR / "slides_capacitacao_10.txt",
        "ficha":    EXAMPLES_DIR / "ficha_tecnica_vendedores.txt",
        "emails":   EXAMPLES_DIR / "emails_marketing_revendedores.txt",
        "folheto":  EXAMPLES_DIR / "folheto_promocional.txt",
    }
    example_file = example_map.get(asset_key)
    if not example_file or not example_file.exists():
        raise FileNotFoundError(
            f"Arquivo de exemplo para OFFLINE_MODE não encontrado: {example_file}"
        )
    return example_file.read_text(encoding="utf-8")


def build_models_list() -> list[str]:
    models = [PRIMARY_MODEL] + FALLBACK_MODELS
    seen, ordered = set(), []
    for model in models:
        if model and model not in seen:
            ordered.append(model)
            seen.add(model)
    return ordered


# ---------------------------------------------------------------------------
# Ollama LLM
# ---------------------------------------------------------------------------

def _ollama_generate(model: str, prompt: str, temperature: float) -> str:
    """Chama POST /api/generate do Ollama e retorna o texto gerado."""
    url = f"{OLLAMA_HOST}/api/generate"
    payload = json.dumps({
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": temperature},
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=300) as resp:
        body = json.loads(resp.read().decode("utf-8"))

    text = body.get("response", "").strip()
    if not text:
        raise RuntimeError(f"Resposta vazia do Ollama para o modelo '{model}'")
    return text


def call_model(
    prompt: str,
    asset_key: str,
    temperature: float = 0.5,
    max_retries: int = DEFAULT_RETRIES,
) -> Tuple[str, str]:
    """Chama o Ollama com fallback entre modelos e retry com backoff exponencial."""
    if OFFLINE_MODE:
        content = load_example_text(asset_key)
        return content, "offline-example"

    last_error: Optional[Exception] = None
    models = build_models_list()

    if not models:
        raise RuntimeError(f"Nenhum modelo configurado para asset '{asset_key}'.")

    for model in models:
        log(f"Chamando Ollama para '{asset_key}': {model}")

        for attempt in range(max_retries):
            try:
                text = _ollama_generate(model, prompt, temperature)
                return text, model

            except urllib.error.URLError as e:
                last_error = e
                wait = (2 ** attempt) + random.uniform(0.2, 1.2)
                log(f"URLError '{asset_key}' modelo '{model}' tentativa {attempt + 1}/{max_retries}: {e}")
                if attempt < max_retries - 1:
                    log(f"Aguardando {wait:.1f}s para retry...")
                    time.sleep(wait)
                else:
                    log(f"Modelo '{model}' falhou após {max_retries} tentativas.")

            except Exception as e:
                last_error = e
                log(f"Falha inesperada '{asset_key}' modelo '{model}': {e}")
                break  # erro não-recuperável, tenta próximo modelo

    raise last_error if isinstance(last_error, BaseException) else RuntimeError(
        f"Falha ao gerar asset '{asset_key}' com todos os modelos."
    )


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

def build_podcast_prompt(brief: dict) -> str:
    return f"""
Contexto estruturado (JSON)
---------------------------
{json.dumps(brief, ensure_ascii=False, indent=2)}

Tarefa
------
Crie um ROTEIRO de PODCAST de até 5 minutos,
voltado para REVENDEDORES, sobre a linha de produtos descrita no contexto.

Regras:
- Foco em PEGADA COMERCIAL, com base técnica.
- Apresente rapidamente as sub-categorias relevantes.
- Destaque 2-3 vantagens chave para o revendedor.
- Termine com chamada forte para uma oferta, se fizer sentido.
- Estruture como fala, em blocos: Introdução, Desenvolvimento, Encerramento.
- Texto em português (pt-BR).
""".strip()


def build_slides_prompt(brief: dict) -> str:
    return f"""
Contexto estruturado (JSON)
---------------------------
{json.dumps(brief, ensure_ascii=False, indent=2)}

Tarefa
------
Monte uma ESTRUTURA de 10 SLIDES para uma apresentação
de capacitação técnica sobre a linha de produtos do contexto,
voltada para REVENDEDORES.

Regras:
- Use EXATAMENTE este formato:
Slide 1 - Título:
- ...
Slide 2 - Assunto:
- ...
Slide 10 - Assunto:
- ...
- Texto em português (pt-BR).
""".strip()


def build_ficha_prompt(brief: dict) -> str:
    return f"""
Contexto estruturado (JSON)
---------------------------
{json.dumps(brief, ensure_ascii=False, indent=2)}

Tarefa
------
Crie uma FICHA TÉCNICA textual para vendedores internos,
com 2-3 diferenciais práticos por subcategoria.

Formato:
Subcategoria: Nome
- Diferencial 1
- Diferencial 2
- Diferencial 3

Regras:
- Foco em argumentação contra concorrentes.
- Português (pt-BR).
""".strip()


def build_emails_prompt(brief: dict) -> str:
    return f"""
Contexto estruturado (JSON)
---------------------------
{json.dumps(brief, ensure_ascii=False, indent=2)}

Tarefa
------
Crie 2 EMAILS DE MARKETING para REVENDEDORES:

EMAIL 1 — Apresentação da linha e posicionamento da marca.
EMAIL 2 — Oferta e urgência.

Formato:
EMAIL 1
Assunto:
Pré-header:
Corpo:

EMAIL 2
Assunto:
Pré-header:
Corpo:

Regras:
- Parágrafos curtos. CTA claro. Português (pt-BR).
""".strip()


def build_folheto_prompt(brief: dict) -> str:
    return f"""
Contexto estruturado (JSON)
---------------------------
{json.dumps(brief, ensure_ascii=False, indent=2)}

Tarefa
------
Crie o TEXTO de um FOLHETO PROMOCIONAL para revendedores,
no formato A4 dobrado (3 painéis).

Estrutura:
Capa: Título impactante + subtítulo
Painel 2: Principais produtos e benefícios (bullets)
Painel 3: Oferta especial + CTA + contato

Regras:
- Linguagem comercial e direta.
- Máximo 150 palavras por painel.
- Português (pt-BR).
""".strip()


# ---------------------------------------------------------------------------
# Helpers de arquivo
# ---------------------------------------------------------------------------

def get_images_dir(out_dir: Path) -> Path:
    images_dir = out_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    return images_dir


def generate_one_asset(
    *,
    asset_key: str,
    prompt: str,
    output_path: Path,
    temperature: float,
    manifest: dict,
) -> None:
    if SKIP_EXISTING and output_path.exists():
        log(f"[SKIP] Já existe: {output_path.name}")
        manifest["assets"][asset_key] = {
            "status": "skipped_existing",
            "output_file": str(output_path),
            "source": "existing_file",
        }
        return

    content, source_used = call_model(
        prompt=prompt,
        asset_key=asset_key,
        temperature=temperature,
    )
    write_text_file(output_path, content)
    manifest["assets"][asset_key] = {
        "status": "generated",
        "output_file": str(output_path),
        "source": source_used,
        "temperature": temperature,
    }
    log(f"[OK] Asset '{asset_key}' gerado via: {source_used}")


def maybe_generate_pptx(
    slides_txt: Path,
    manifest: dict,
    *,
    template_path: Path,
    images_dir: Path,
) -> None:
    pptx_path = slides_txt.with_suffix(".pptx")

    if not slides_txt.exists():
        manifest["assets"]["slides_pptx"] = {
            "status": "skipped_missing_source",
            "reason": str(slides_txt),
        }
        log("[WARN] TXT de slides não encontrado, PPTX pulado.")
        return

    if not template_path.exists():
        manifest["assets"]["slides_pptx"] = {
            "status": "error",
            "error": f"Template não encontrado: {template_path}",
        }
        log(f"[ERRO] Template PPTX não encontrado: {template_path}")
        return

    if SKIP_EXISTING and pptx_path.exists():
        log(f"[SKIP] PPTX já existe: {pptx_path.name}")
        manifest["assets"]["slides_pptx"] = {
            "status": "skipped_existing",
            "output_file": str(pptx_path),
        }
        return

    try:
        slides_txt_to_ppt(
            slides_txt,
            template_path=template_path,
            images_dir=images_dir,
        )
        manifest["assets"]["slides_pptx"] = {
            "status": "generated",
            "output_file": str(pptx_path),
        }
        log(f"[OK] PPTX gerado: {pptx_path.name}")
    except Exception as e:
        manifest["assets"]["slides_pptx"] = {"status": "error", "error": str(e)}
        log(f"[ERRO] Falha ao gerar PPTX: {e}")


# ---------------------------------------------------------------------------
# Orquestrador principal
# ---------------------------------------------------------------------------

def generate_assets_for_brief(brief_path: Path) -> None:
    brief     = load_brief(brief_path)
    base_name = brief_path.stem.replace(".brief", "")
    out_dir   = brief_path.parent / f"{base_name}_assets"
    out_dir.mkdir(parents=True, exist_ok=True)

    log(f"=== Brief: {brief_path.name} | Output: {out_dir} ===")

    images_dir = get_images_dir(out_dir)

    manifest = {
        "brief_file":                str(brief_path),
        "output_dir":                str(out_dir),
        "offline_mode":              OFFLINE_MODE,
        "skip_visual_ai":            SKIP_VISUAL_AI,
        "visual_ai_provider_posts":  VISUAL_AI_PROVIDER_POSTS,
        "visual_ai_provider_docs":   VISUAL_AI_PROVIDER_DOCS,
        "ollama_host":               OLLAMA_HOST,
        "primary_model":             PRIMARY_MODEL,
        "fallback_models":           FALLBACK_MODELS,
        "template_path":             str(DEFAULT_TEMPLATE_PATH),
        "images_dir":                str(images_dir),
        "assets":                    {},
        "visual_ai":                 {},
    }

    podcast_txt = out_dir / "podcast_revendedores.txt"
    slides_txt  = out_dir / "slides_capacitacao_10.txt"
    ficha_txt   = out_dir / "ficha_tecnica_vendedores.txt"
    emails_txt  = out_dir / "emails_marketing_revendedores.txt"
    folheto_txt = out_dir / "folheto_promocional.txt"

    # ----------------------------------------------------------------
    # Etapa 1: Geração de texto via Ollama
    # ----------------------------------------------------------------
    log(f"--- Etapa 1/3: Geração de texto (Ollama / {PRIMARY_MODEL}) ---")

    generate_one_asset(
        asset_key="podcast",
        prompt=build_podcast_prompt(brief),
        output_path=podcast_txt, temperature=0.5, manifest=manifest,
    )
    time.sleep(DEFAULT_TIMEOUT_BETWEEN_ASSETS)

    generate_one_asset(
        asset_key="slides",
        prompt=build_slides_prompt(brief),
        output_path=slides_txt, temperature=0.4, manifest=manifest,
    )
    time.sleep(DEFAULT_TIMEOUT_BETWEEN_ASSETS)

    generate_one_asset(
        asset_key="ficha",
        prompt=build_ficha_prompt(brief),
        output_path=ficha_txt, temperature=0.4, manifest=manifest,
    )
    time.sleep(DEFAULT_TIMEOUT_BETWEEN_ASSETS)

    generate_one_asset(
        asset_key="emails",
        prompt=build_emails_prompt(brief),
        output_path=emails_txt, temperature=0.6, manifest=manifest,
    )
    time.sleep(DEFAULT_TIMEOUT_BETWEEN_ASSETS)

    generate_one_asset(
        asset_key="folheto",
        prompt=build_folheto_prompt(brief),
        output_path=folheto_txt, temperature=0.6, manifest=manifest,
    )

    # ----------------------------------------------------------------
    # Etapa 2: Geração de PPTX
    # ----------------------------------------------------------------
    log("--- Etapa 2/3: Conversão de slides para PPTX ---")
    maybe_generate_pptx(
        slides_txt, manifest,
        template_path=DEFAULT_TEMPLATE_PATH,
        images_dir=images_dir,
    )

    # ----------------------------------------------------------------
    # Etapa 3: Geração visual (HTML/PDF + imagens de posts)
    # ----------------------------------------------------------------
    if SKIP_VISUAL_AI:
        log("--- Etapa 3/3: SKIP_VISUAL_AI=true, etapa visual ignorada. ---")
    else:
        log(f"--- Etapa 3/3: Geração visual | docs={VISUAL_AI_PROVIDER_DOCS} | posts={VISUAL_AI_PROVIDER_POSTS} ---")
        try:
            visual_results = run_visual_generation(
                brief=brief,
                out_dir=out_dir,
                slides_text=slides_txt.read_text(encoding="utf-8") if slides_txt.exists() else None,
                emails_text=emails_txt.read_text(encoding="utf-8") if emails_txt.exists() else None,
                folheto_text=folheto_txt.read_text(encoding="utf-8") if folheto_txt.exists() else None,
                ficha_text=ficha_txt.read_text(encoding="utf-8") if ficha_txt.exists() else None,
                post_text=emails_txt.read_text(encoding="utf-8") if emails_txt.exists() else None,
            )
            manifest["visual_ai"] = visual_results
            gerados = [k for k, v in visual_results.items() if v]
            log(f"[OK] Visual AI concluída. Arquivos gerados: {gerados}")
        except Exception as e:
            manifest["visual_ai"]["error"] = str(e)
            log(f"[ERRO] Falha na etapa visual: {e}")

    # ----------------------------------------------------------------
    # Manifest final
    # ----------------------------------------------------------------
    manifest_path = out_dir / "generation_manifest.json"
    write_text_file(manifest_path, json.dumps(manifest, ensure_ascii=False, indent=2))
    log(f"=== Concluído. Todos os assets em: {out_dir} ===")


def generate_assets_for_inbox() -> None:
    if not INBOX_DIR.exists():
        log(f"[WARN] Pasta {INBOX_DIR} não existe.")
        return

    briefs = sorted(INBOX_DIR.glob("*.brief.json"))
    if not briefs:
        log(f"[WARN] Nenhum .brief.json encontrado em {INBOX_DIR}")
        return

    for brief_path in briefs:
        log(f"Processando brief: {brief_path.name}")
        try:
            generate_assets_for_brief(brief_path)
        except Exception as e:
            log(f"[ERRO] Falha ao processar {brief_path.name}: {e}")


if __name__ == "__main__":
    generate_assets_for_inbox()
