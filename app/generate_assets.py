from pathlib import Path
import json
import os
import random
import time
from typing import Optional, Tuple

from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.genai import errors as genai_errors

from app.slides_ppt import slides_txt_to_ppt


INBOX_DIR = Path("data/inbox")
EXAMPLES_DIR = Path("data/examples")
DEFAULT_TEMPLATE_PATH = Path(r"data/tempalate slides/APRESENTAÇÃO - MODELO [todos copiar].pptx")

PRIMARY_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
FALLBACK_MODELS = [
    m.strip()
    for m in os.getenv("GEMINI_FALLBACK_MODELS", "gemini-2.5-flash").split(",")
    if m.strip()
]

OFFLINE_MODE = os.getenv("OFFLINE_MODE", "false").strip().lower() in {"1", "true", "yes", "on"}
SKIP_EXISTING = os.getenv("SKIP_EXISTING", "true").strip().lower() in {"1", "true", "yes", "on"}

DEFAULT_RETRIES = int(os.getenv("GEN_RETRIES", "5"))
DEFAULT_TIMEOUT_BETWEEN_ASSETS = float(os.getenv("SLEEP_BETWEEN_ASSETS", "0.5"))


def log(message: str) -> None:
    print(message)


def get_client() -> Optional[genai.Client]:
    load_dotenv()

    if OFFLINE_MODE:
        log("[INFO] OFFLINE_MODE ativo. A API não será chamada.")
        return None

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY não definido no .env")

    return genai.Client(api_key=api_key)


def load_brief(brief_path: Path) -> dict:
    return json.loads(brief_path.read_text(encoding="utf-8"))


def write_text_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.strip() + "\n", encoding="utf-8")


def load_example_text(asset_key: str) -> str:
    example_map = {
        "podcast": EXAMPLES_DIR / "podcast_revendedores.txt",
        "slides": EXAMPLES_DIR / "slides_capacitacao_10.txt",
        "ficha": EXAMPLES_DIR / "ficha_tecnica_vendedores.txt",
        "emails": EXAMPLES_DIR / "emails_marketing_revendedores.txt",
    }

    example_file = example_map.get(asset_key)
    if not example_file or not example_file.exists():
        raise FileNotFoundError(
            f"Arquivo de exemplo para OFFLINE_MODE não encontrado: {example_file}"
        )

    return example_file.read_text(encoding="utf-8")


def build_models_list() -> list[str]:
    models = [PRIMARY_MODEL] + FALLBACK_MODELS
    seen = set()
    ordered = []

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

    last_error = None
    models = build_models_list()

    for model in models:
        log(f"[INFO] Chamando modelo para '{asset_key}': {model}")

        for attempt in range(max_retries):
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=types.Part.from_text(text=prompt),
                    config=types.GenerateContentConfig(
                        temperature=temperature,
                    ),
                )

                text = (response.text or "").strip()
                if not text:
                    raise RuntimeError(f"Resposta vazia do modelo {model} para asset '{asset_key}'")

                return text, model

            except genai_errors.ServerError as e:
                last_error = e
                log(
                    f"[ERRO] ServerError no asset '{asset_key}', modelo '{model}', "
                    f"tentativa {attempt + 1}/{max_retries}: {e}"
                )

                wait_seconds = (2 ** attempt) + random.uniform(0.2, 1.2)

                if attempt < max_retries - 1:
                    log(f"[INFO] Aguardando {wait_seconds:.1f}s para retry...")
                    time.sleep(wait_seconds)
                else:
                    log(f"[WARN] Modelo '{model}' falhou após {max_retries} tentativas. Tentando fallback, se houver.")

            except genai_errors.APIError as e:
                last_error = e
                log(f"[ERRO] APIError no asset '{asset_key}', modelo '{model}': {e}")
                break

            except Exception as e:
                last_error = e
                log(f"[ERRO] Falha inesperada no asset '{asset_key}', modelo '{model}': {e}")
                break

    raise last_error or RuntimeError(f"Falha ao gerar asset '{asset_key}' com todos os modelos.")


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
- Estruture como fala, em blocos:
  * Introdução
  * Desenvolvimento (2 ou 3 blocos)
  * Encerramento
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
- Foque em conhecimento técnico com linguagem clara.
- Use EXATAMENTE este formato:

Slide 1 - Título:
- ...

Slide 2 - Assunto:
- ...

...

Slide 10 - Assunto:
- ...

- Não detalhar gráficos, apenas mencionar "gráfico de barras", "tabela comparativa" etc.
- Texto em português (pt-BR).
""".strip()


def build_ficha_prompt(brief: dict) -> str:
    return f"""
Contexto estruturado (JSON)
---------------------------
{json.dumps(brief, ensure_ascii=False, indent=2)}

Tarefa
------
Crie uma FICHA TÉCNICA textual, voltada para vendedores internos,
com 2-3 diferenciais práticos por subcategoria da linha de produtos.

Formato de saída:
Subcategoria: Nome da subcategoria
- Diferencial 1
- Diferencial 2
- Diferencial 3

Regras:
- Foco em pontos que ajudam a argumentar contra concorrentes.
- Língua portuguesa (pt-BR).
""".strip()


def build_emails_prompt(brief: dict) -> str:
    return f"""
Contexto estruturado (JSON)
---------------------------
{json.dumps(brief, ensure_ascii=False, indent=2)}

Tarefa
------
Crie uma sequência de 2 EMAILS DE MARKETING para REVENDEDORES da linha de produtos:

EMAIL 1
- Foco em apresentar a linha e posicionar a marca.

EMAIL 2
- Foco em oferta e urgência, se fizer sentido.

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
- Parágrafos curtos.
- CTA claro.
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
            "source": "slides_txt_to_ppt",
            "reason": f"Arquivo fonte não encontrado: {slides_txt}",
        }
        log(f"[WARN] TXT de slides não encontrado, PPTX não será gerado: {slides_txt}")
        return

    if not template_path.exists():
        manifest["assets"]["slides_pptx"] = {
            "status": "error",
            "source": "slides_txt_to_ppt",
            "error": f"Template PPTX não encontrado: {template_path}",
            "template_path": str(template_path),
        }
        log(f"[ERRO] Template PPTX não encontrado: {template_path}")
        return

    if SKIP_EXISTING and pptx_path.exists():
        log(f"[SKIP] PPTX já existe: {pptx_path}")
        manifest["assets"]["slides_pptx"] = {
            "status": "skipped_existing",
            "source": "existing_file",
            "output_file": str(pptx_path),
            "template_path": str(template_path),
            "images_dir": str(images_dir),
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
            "source": "slides_txt_to_ppt",
            "output_file": str(pptx_path),
            "template_path": str(template_path),
            "images_dir": str(images_dir),
        }
        log(f"[OK] PPTX gerado a partir do TXT de slides: {pptx_path}")
    except Exception as e:
        manifest["assets"]["slides_pptx"] = {
            "status": "error",
            "source": "slides_txt_to_ppt",
            "error": str(e),
            "template_path": str(template_path),
            "images_dir": str(images_dir),
        }
        log(f"[ERRO] Falha ao converter slides para PPTX: {e}")


def generate_assets_for_brief(brief_path: Path) -> None:
    brief = load_brief(brief_path)
    base_name = brief_path.stem.replace(".brief", "")
    out_dir = brief_path.parent / f"{base_name}_assets"
    out_dir.mkdir(parents=True, exist_ok=True)

    client = get_client()
    images_dir = get_images_dir(out_dir)

    manifest = {
        "brief_file": str(brief_path),
        "output_dir": str(out_dir),
        "offline_mode": OFFLINE_MODE,
        "primary_model": PRIMARY_MODEL,
        "fallback_models": FALLBACK_MODELS,
        "template_path": str(DEFAULT_TEMPLATE_PATH),
        "images_dir": str(images_dir),
        "assets": {},
    }

    podcast_txt = out_dir / "podcast_revendedores.txt"
    slides_txt = out_dir / "slides_capacitacao_10.txt"
    ficha_txt = out_dir / "ficha_tecnica_vendedores.txt"
    emails_txt = out_dir / "emails_marketing_revendedores.txt"

    generate_one_asset(
        client=client,
        asset_key="podcast",
        prompt=build_podcast_prompt(brief),
        output_path=podcast_txt,
        temperature=0.5,
        manifest=manifest,
    )
    time.sleep(DEFAULT_TIMEOUT_BETWEEN_ASSETS)

    generate_one_asset(
        client=client,
        asset_key="slides",
        prompt=build_slides_prompt(brief),
        output_path=slides_txt,
        temperature=0.4,
        manifest=manifest,
    )
    time.sleep(DEFAULT_TIMEOUT_BETWEEN_ASSETS)

    generate_one_asset(
        client=client,
        asset_key="ficha",
        prompt=build_ficha_prompt(brief),
        output_path=ficha_txt,
        temperature=0.4,
        manifest=manifest,
    )
    time.sleep(DEFAULT_TIMEOUT_BETWEEN_ASSETS)

    generate_one_asset(
        client=client,
        asset_key="emails",
        prompt=build_emails_prompt(brief),
        output_path=emails_txt,
        temperature=0.6,
        manifest=manifest,
    )

    maybe_generate_pptx(
        slides_txt,
        manifest,
        template_path=DEFAULT_TEMPLATE_PATH,
        images_dir=images_dir,
    )

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