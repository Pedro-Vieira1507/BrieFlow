"""
generate_assets.py — Pipeline principal de geração de assets de marketing.

Fluxo:
  1. Lê .brief.json da pasta inbox/
  2. Chama Gemini LLM para gerar: podcast, slides, ficha, emails
  3. Converte slides em PPTX
  4. (NOVO) Chama visual_ai.py para gerar versões visuais via:
     - Gamma    → Slides visuais  (gratuito)
     - Canva    → E-mails, Folhetos, Ficha (gratuito)
     - Gemini Imagen / DALL-E / Pexels → Posts (gratuito/pago)
  5. Salva manifest.json com todos os resultados
"""

from pathlib import Path
import json
import os
import random
import time
from typing import Optional, Tuple

from dotenv import load_dotenv  # ← load_dotenv deve ser chamado ANTES de os.getenv()

load_dotenv()  # ← CORRIGIDO: carregado no topo do módulo

from google import genai
from google.genai import types
from google.genai import errors as genai_errors

from app.slides_ppt import slides_txt_to_ppt
from app.visual_ai import run_visual_generation  # ← NOVO


INBOX_DIR = Path("data/inbox")
EXAMPLES_DIR = Path("data/examples")
DEFAULT_TEMPLATE_PATH = Path("data/template slides/APRESENTAÇÃO - MODELO [todos copiar].pptx")  # ← typo corrigido

PRIMARY_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
FALLBACK_MODELS = [
    m.strip()
    for m in os.getenv("GEMINI_FALLBACK_MODELS", "gemini-2.5-flash").split(",")
    if m.strip()
]

OFFLINE_MODE   = os.getenv("OFFLINE_MODE", "false").strip().lower() in {"1", "true", "yes", "on"}
SKIP_EXISTING  = os.getenv("SKIP_EXISTING", "true").strip().lower() in {"1", "true", "yes", "on"}
SKIP_VISUAL_AI = os.getenv("SKIP_VISUAL_AI", "false").strip().lower() in {"1", "true", "yes", "on"}

DEFAULT_RETRIES = int(os.getenv("GEN_RETRIES", "5"))
DEFAULT_TIMEOUT_BETWEEN_ASSETS = float(os.getenv("SLEEP_BETWEEN_ASSETS", "0.5"))


def log(message: str) -> None:
    print(message)


def get_client() -> Optional[genai.Client]:
    # load_dotenv() já foi chamado no topo — não precisa chamar novamente
    if OFFLINE_MODE:
        log("[INFO] OFFLINE_MODE ativo. A API não será chamada.")
        return None

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY não definido no .env")

    try:
        return genai.Client(api_key=api_key)
    except Exception as e:
        raise RuntimeError(f"Falha ao inicializar cliente Gemini: {e}") from e


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
        "podcast": EXAMPLES_DIR / "podcast_revendedores.txt",
        "slides":  EXAMPLES_DIR / "slides_capacitacao_10.txt",
        "ficha":   EXAMPLES_DIR / "ficha_tecnica_vendedores.txt",
        "emails":  EXAMPLES_DIR / "emails_marketing_revendedores.txt",
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


def call_model(
    client: Optional[genai.Client],
    prompt: str,
    asset_key: str,
    temperature: float = 0.5,
    max_retries: int = DEFAULT_RETRIES,
) -> Tuple[str, str]:
    if OFFLINE_MODE:
        content = load_example_text(asset_key)
        return content, "offline-example"

    if client is None:
        raise RuntimeError("Cliente Gemini não inicializado.")

    last_error: Optional[Exception] = None
    models = build_models_list()

    if not models:
        raise RuntimeError(f"Nenhum modelo configurado para asset '{asset_key}'.")

    for model in models:
        log(f"[INFO] Chamando modelo para '{asset_key}': {model}")

        for attempt in range(max_retries):
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=types.Part.from_text(text=prompt),
                    config=types.GenerateContentConfig(temperature=temperature),
                )
                text = (response.text or "").strip()
                if not text:
                    raise RuntimeError(f"Resposta vazia do modelo {model} para asset '{asset_key}'")
                return text, model

            except genai_errors.ServerError as e:
                last_error = e
                log(f"[ERRO] ServerError no asset '{asset_key}', modelo '{model}', tentativa {attempt + 1}/{max_retries}: {e}")
                wait_seconds = (2 ** attempt) + random.uniform(0.2, 1.2)
                if attempt < max_retries - 1:
                    log(f"[INFO] Aguardando {wait_seconds:.1f}s para retry...")
                    time.sleep(wait_seconds)
                else:
                    log(f"[WARN] Modelo '{model}' falhou após {max_retries} tentativas.")

            except genai_errors.APIError as e:
                last_error = e
                log(f"[ERRO] APIError no asset '{asset_key}', modelo '{model}': {e}")
                break

            except Exception as e:
                last_error = e
                log(f"[ERRO] Falha inesperada no asset '{asset_key}', modelo '{model}': {e}")
                break

    # CORRIGIDO: garante que sempre lança uma Exception válida
    raise last_error if isinstance(last_error, BaseException) else RuntimeError(
        f"Falha ao gerar asset '{asset_key}' com todos os modelos."
    )


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
    """NOVO: prompt para geração de folheto."""
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


def get_images_dir(out_dir: Path) -> Path:
    images_dir = out_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    return images_dir


def generate_one_asset(
    *,
    client: Optional[genai.Client],
    asset_key: str,
    prompt: str,
    output_path: Path,
    temperature: float,
    manifest: dict,
) -> None:
    if SKIP_EXISTING and output_path.exists():
        log(f"[SKIP] Arquivo já existe: {output_path}")
        manifest["assets"][asset_key] = {
            "status": "skipped_existing",
            "output_file": str(output_path),
            "source": "existing_file",
        }
        return

    content, source_used = call_model(
        client=client,
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
    log(f"[OK] Asset '{asset_key}' gerado com fonte/modelo: {source_used}")


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
            "reason": f"Arquivo fonte não encontrado: {slides_txt}",
        }
        log(f"[WARN] TXT de slides não encontrado, PPTX não será gerado: {slides_txt}")
        return

    if not template_path.exists():
        manifest["assets"]["slides_pptx"] = {
            "status": "error",
            "error": f"Template PPTX não encontrado: {template_path}",
        }
        log(f"[ERRO] Template PPTX não encontrado: {template_path}")
        return

    if SKIP_EXISTING and pptx_path.exists():
        log(f"[SKIP] PPTX já existe: {pptx_path}")
        manifest["assets"]["slides_pptx"] = {
            "status": "skipped_existing",
            "output_file": str(pptx_path),
        }
        return

    try:
        slides_txt_to_ppt(slides_txt, template_path=template_path, images_dir=images_dir)
        manifest["assets"]["slides_pptx"] = {
            "status": "generated",
            "output_file": str(pptx_path),
        }
        log(f"[OK] PPTX gerado: {pptx_path}")
    except Exception as e:
        manifest["assets"]["slides_pptx"] = {"status": "error", "error": str(e)}
        log(f"[ERRO] Falha ao converter slides para PPTX: {e}")


def generate_assets_for_brief(brief_path: Path) -> None:
    brief     = load_brief(brief_path)
    base_name = brief_path.stem.replace(".brief", "")
    out_dir   = brief_path.parent / f"{base_name}_assets"
    out_dir.mkdir(parents=True, exist_ok=True)

    try:
        client = get_client()
    except RuntimeError as e:
        log(f"[ERRO] Não foi possível inicializar cliente Gemini: {e}")
        if not OFFLINE_MODE:
            raise
        client = None

    images_dir = get_images_dir(out_dir)

    manifest = {
        "brief_file":      str(brief_path),
        "output_dir":      str(out_dir),
        "offline_mode":    OFFLINE_MODE,
        "skip_visual_ai":  SKIP_VISUAL_AI,
        "primary_model":   PRIMARY_MODEL,
        "fallback_models": FALLBACK_MODELS,
        "template_path":   str(DEFAULT_TEMPLATE_PATH),
        "images_dir":      str(images_dir),
        "assets":          {},
        "visual_ai":       {},
    }

    # Caminhos de output de texto
    podcast_txt = out_dir / "podcast_revendedores.txt"
    slides_txt  = out_dir / "slides_capacitacao_10.txt"
    ficha_txt   = out_dir / "ficha_tecnica_vendedores.txt"
    emails_txt  = out_dir / "emails_marketing_revendedores.txt"
    folheto_txt = out_dir / "folheto_promocional.txt"  # NOVO

    # --- Geração de texto via LLM ---
    generate_one_asset(
        client=client, asset_key="podcast",
        prompt=build_podcast_prompt(brief),
        output_path=podcast_txt, temperature=0.5, manifest=manifest,
    )
    time.sleep(DEFAULT_TIMEOUT_BETWEEN_ASSETS)

    generate_one_asset(
        client=client, asset_key="slides",
        prompt=build_slides_prompt(brief),
        output_path=slides_txt, temperature=0.4, manifest=manifest,
    )
    time.sleep(DEFAULT_TIMEOUT_BETWEEN_ASSETS)

    generate_one_asset(
        client=client, asset_key="ficha",
        prompt=build_ficha_prompt(brief),
        output_path=ficha_txt, temperature=0.4, manifest=manifest,
    )
    time.sleep(DEFAULT_TIMEOUT_BETWEEN_ASSETS)

    generate_one_asset(
        client=client, asset_key="emails",
        prompt=build_emails_prompt(brief),
        output_path=emails_txt, temperature=0.6, manifest=manifest,
    )
    time.sleep(DEFAULT_TIMEOUT_BETWEEN_ASSETS)

    generate_one_asset(
        client=client, asset_key="folheto",
        prompt=build_folheto_prompt(brief),
        output_path=folheto_txt, temperature=0.6, manifest=manifest,
    )

    # --- PPTX ---
    maybe_generate_pptx(
        slides_txt, manifest,
        template_path=DEFAULT_TEMPLATE_PATH,
        images_dir=images_dir,
    )

    # --- NOVO: Geração visual via IA ---
    if not SKIP_VISUAL_AI:
        log("[INFO] Iniciando etapa de geração visual (visual_ai)...")
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
            log(f"[OK] Geração visual concluída: {visual_results}")
        except Exception as e:
            manifest["visual_ai"]["error"] = str(e)
            log(f"[ERRO] Falha na etapa visual_ai: {e}")
    else:
        log("[INFO] SKIP_VISUAL_AI=true, etapa visual ignorada.")

    # --- Manifest ---
    manifest_path = out_dir / "generation_manifest.json"
    write_text_file(manifest_path, json.dumps(manifest, ensure_ascii=False, indent=2))
    log(f"[OK] Assets gerados em: {out_dir}")


def generate_assets_for_inbox() -> None:
    if not INBOX_DIR.exists():
        log(f"[WARN] Pasta {INBOX_DIR} não existe.")
        return

    briefs = sorted(INBOX_DIR.glob("*.brief.json"))
    if not briefs:
        log(f"[WARN] Nenhum arquivo .brief.json encontrado em {INBOX_DIR}")
        return

    for brief_path in briefs:
        log(f"[INFO] Processando brief: {brief_path}")
        try:
            generate_assets_for_brief(brief_path)
        except Exception as e:
            log(f"[ERRO] Falha ao processar {brief_path}: {e}")


if __name__ == "__main__":
    generate_assets_for_inbox()
