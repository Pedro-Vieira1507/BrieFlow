# app/generate_assets.py
# Pipeline de geração de assets de marketing a partir de um brief estruturado (JSON).
# Usa ASSET_REGISTRY para determinar o formato de saída de cada tipo de material.

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

from app.renderers import render_txt, render_pdf, render_banner_image, render_pptx


# ── Diretórios e configurações ─────────────────────────────────────────────────
INBOX_DIR = Path("data/inbox")
EXAMPLES_DIR = Path("data/examples")
DEFAULT_TEMPLATE_PATH = Path(
    r"data/tempalate slides/APRESENTAÇÃO - MODELO [todos copiar].pptx"
)

PRIMARY_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
FALLBACK_MODELS = [
    m.strip()
    for m in os.getenv("GEMINI_FALLBACK_MODELS", "gemini-2.5-flash").split(",")
    if m.strip()
]

OFFLINE_MODE = os.getenv("OFFLINE_MODE", "false").strip().lower() in {
    "1", "true", "yes", "on"
}
SKIP_EXISTING = os.getenv("SKIP_EXISTING", "true").strip().lower() in {
    "1", "true", "yes", "on"
}

DEFAULT_RETRIES = int(os.getenv("GEN_RETRIES", "5"))
DEFAULT_SLEEP = float(os.getenv("SLEEP_BETWEEN_ASSETS", "0.5"))


# ── Logging ────────────────────────────────────────────────────────────────────
def log(message: str) -> None:
    print(message)


# ── Cliente Gemini ─────────────────────────────────────────────────────────────
def get_client() -> Optional[genai.Client]:
    load_dotenv()
    if OFFLINE_MODE:
        log("[INFO] OFFLINE_MODE ativo. A API não será chamada.")
        return None
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY não definido no .env")
    return genai.Client(api_key=api_key)


# ── Leitura do brief ───────────────────────────────────────────────────────────
def load_brief(brief_path: Path) -> dict:
    return json.loads(brief_path.read_text(encoding="utf-8"))


# ── Exemplos offline ───────────────────────────────────────────────────────────
def load_example_text(asset_key: str) -> str:
    example_map = {
        "podcast": EXAMPLES_DIR / "podcast_revendedores.txt",
        "slides": EXAMPLES_DIR / "slides_capacitacao_10.txt",
        "ficha": EXAMPLES_DIR / "ficha_tecnica_vendedores.txt",
        "emails": EXAMPLES_DIR / "emails_marketing_revendedores.txt",
        "banner": EXAMPLES_DIR / "banner_copy.txt",
    }
    example_file = example_map.get(asset_key)
    if not example_file or not example_file.exists():
        raise FileNotFoundError(
            f"Exemplo offline não encontrado para '{asset_key}': {example_file}"
        )
    return example_file.read_text(encoding="utf-8")


# ── Modelos com fallback ───────────────────────────────────────────────────────
def build_models_list() -> list[str]:
    models = [PRIMARY_MODEL] + FALLBACK_MODELS
    seen, ordered = set(), []
    for m in models:
        if m and m not in seen:
            ordered.append(m)
            seen.add(m)
    return ordered


def call_model(
    client: Optional[genai.Client],
    prompt: str,
    asset_key: str,
    temperature: float = 0.5,
    max_retries: int = DEFAULT_RETRIES,
) -> Tuple[str, str]:
    if OFFLINE_MODE:
        return load_example_text(asset_key), "offline-example"

    if client is None:
        raise RuntimeError("Cliente Gemini não inicializado.")

    last_error = None
    for model in build_models_list():
        log(f"[INFO] Gerando '{asset_key}' com modelo: {model}")
        for attempt in range(max_retries):
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=types.Part.from_text(text=prompt),
                    config=types.GenerateContentConfig(temperature=temperature),
                )
                text = (response.text or "").strip()
                if not text:
                    raise RuntimeError(f"Resposta vazia do modelo {model} para '{asset_key}'")
                return text, model
            except genai_errors.ServerError as e:
                last_error = e
                wait = (2 ** attempt) + random.uniform(0.2, 1.2)
                log(f"[ERRO] ServerError em '{asset_key}', tentativa {attempt + 1}/{max_retries}: {e}")
                if attempt < max_retries - 1:
                    log(f"[INFO] Aguardando {wait:.1f}s...")
                    time.sleep(wait)
                else:
                    log(f"[WARN] Modelo '{model}' esgotou tentativas. Tentando fallback...")
            except (genai_errors.APIError, Exception) as e:
                last_error = e
                log(f"[ERRO] Falha em '{asset_key}', modelo '{model}': {e}")
                break

    raise last_error or RuntimeError(f"Todos os modelos falharam para asset '{asset_key}'.")


# ── Builders de prompt ─────────────────────────────────────────────────────────
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
- Destaque 2-3 vantagens chave para o revendedor.
- Termine com chamada forte para a oferta.
- Estruture como fala: Introdução / Desenvolvimento / Encerramento.
- Português (pt-BR).
""".strip()


def build_slides_prompt(brief: dict) -> str:
    return f"""
Contexto estruturado (JSON)
---------------------------
{json.dumps(brief, ensure_ascii=False, indent=2)}

Tarefa
------
Monte uma ESTRUTURA de 10 SLIDES para capacitação técnica voltada a REVENDEDORES.

Use EXATAMENTE este formato:

Slide 1 - Título:
- ...

Slide 2 - Assunto:
- ...

...

Slide 10 - Assunto:
- ...

Regras:
- Linguagem clara, foco técnico.
- Mencione gráficos/tabelas apenas como referência (ex: "gráfico de barras").
- Português (pt-BR).
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

Formato obrigatório:
Subcategoria: Nome da subcategoria
- Diferencial 1
- Diferencial 2
- Diferencial 3

Regras:
- Foco em argumentos contra concorrentes.
- Português (pt-BR).
""".strip()


def build_emails_prompt(brief: dict) -> str:
    return f"""
Contexto estruturado (JSON)
---------------------------
{json.dumps(brief, ensure_ascii=False, indent=2)}

Tarefa
------
Crie uma sequência de 2 EMAILS DE MARKETING para REVENDEDORES:

EMAIL 1 – Apresentar a linha e posicionar a marca.
EMAIL 2 – Oferta e urgência.

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
- Parágrafos curtos, CTA claro.
- Português (pt-BR).
""".strip()


def build_banner_prompt(brief: dict) -> str:
    return f"""
Contexto estruturado (JSON)
---------------------------
{json.dumps(brief, ensure_ascii=False, indent=2)}

Tarefa
------
Crie o COPY VISUAL para um BANNER de marketing (1200x628px), destinado a
campanha digital (e-mail marketing, LinkedIn, WhatsApp Business).

Formato de saída — use EXATAMENTE estas 4 linhas:
Linha 1: Título principal (máximo 8 palavras, impactante)
Linha 2: Subtítulo / proposta de valor (máximo 12 palavras)
Linha 3: CTA — chamada para ação (máximo 5 palavras)
Linha 4: Rodapé informativo (ex: validade da oferta, slogan da marca)

Regras:
- Texto direto, sem pontuação excessiva.
- Português (pt-BR).
""".strip()


# ── ASSET_REGISTRY — fonte única da verdade para formatos de saída ─────────────
#
# Adicionar um novo asset: basta criar uma entrada aqui.
# Campos:
#   prompt_builder : função que recebe o brief (dict) e retorna o prompt (str)
#   output_format  : extensão final do arquivo (sem ponto)
#   renderer       : função de app.renderers que salva o arquivo no formato correto
#   filename       : nome base do arquivo de saída (sem extensão)
#   temperature    : criatividade do LLM para esse asset
#
ASSET_REGISTRY: dict[str, dict] = {
    "podcast": {
        "prompt_builder": build_podcast_prompt,
        "output_format": "txt",
        "renderer": render_txt,
        "filename": "podcast_revendedores",
        "temperature": 0.5,
    },
    "slides": {
        "prompt_builder": build_slides_prompt,
        "output_format": "pptx",
        "renderer": render_pptx,
        "filename": "slides_capacitacao_10",
        "temperature": 0.4,
    },
    "ficha": {
        "prompt_builder": build_ficha_prompt,
        "output_format": "pdf",
        "renderer": render_pdf,
        "filename": "ficha_tecnica_vendedores",
        "temperature": 0.4,
    },
    "emails": {
        "prompt_builder": build_emails_prompt,
        "output_format": "txt",
        "renderer": render_txt,
        "filename": "emails_marketing_revendedores",
        "temperature": 0.6,
    },
    "banner": {
        "prompt_builder": build_banner_prompt,
        "output_format": "png",
        "renderer": render_banner_image,
        "filename": "banner_campanha",
        "temperature": 0.7,
    },
}


# ── Motor de geração universal ─────────────────────────────────────────────────
def generate_one_asset(
    *,
    client: Optional[genai.Client],
    asset_key: str,
    brief: dict,
    out_dir: Path,
    manifest: dict,
) -> None:
    config      = ASSET_REGISTRY[asset_key]
    ext         = config["output_format"]
    filename    = config["filename"]
    output_path = out_dir / f"{filename}.{ext}"

    if SKIP_EXISTING and output_path.exists():
        log(f"[SKIP] Já existe: {output_path}")
        manifest["assets"][asset_key] = {
            "status": "skipped_existing",
            "output_file": str(output_path),
            "output_format": ext,
        }
        return

    prompt = config["prompt_builder"](brief)
    content, model_used = call_model(
        client=client,
        prompt=prompt,
        asset_key=asset_key,
        temperature=config["temperature"],
    )

    # 🎯 Renderiza no formato correto conforme o registry
    renderer = config["renderer"]
    renderer(content, output_path)

    manifest["assets"][asset_key] = {
        "status": "generated",
        "output_file": str(output_path),
        "output_format": ext,
        "model": model_used,
        "temperature": config["temperature"],
    }
    log(f"[OK] Asset '{asset_key}' → {ext.upper()} ({model_used})")


def get_images_dir(out_dir: Path) -> Path:
    images_dir = out_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    return images_dir


# ── Orquestrador principal ─────────────────────────────────────────────────────
def generate_assets_for_brief(brief_path: Path) -> None:
    brief    = load_brief(brief_path)
    base     = brief_path.stem.replace(".brief", "")
    out_dir  = brief_path.parent / f"{base}_assets"
    out_dir.mkdir(parents=True, exist_ok=True)

    client = get_client()

    manifest = {
        "brief_file": str(brief_path),
        "output_dir": str(out_dir),
        "offline_mode": OFFLINE_MODE,
        "primary_model": PRIMARY_MODEL,
        "fallback_models": FALLBACK_MODELS,
        "assets": {},
    }

    for asset_key in ASSET_REGISTRY:
        log(f"\n[INFO] ── Gerando asset: {asset_key} ──")
        try:
            generate_one_asset(
                client=client,
                asset_key=asset_key,
                brief=brief,
                out_dir=out_dir,
                manifest=manifest,
            )
        except Exception as e:
            log(f"[ERRO] Falha ao gerar '{asset_key}': {e}")
            manifest["assets"][asset_key] = {
                "status": "error",
                "error": str(e),
            }
        time.sleep(DEFAULT_SLEEP)

    manifest_path = out_dir / "generation_manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    log(f"\n[OK] Todos os assets gerados em: {out_dir}")


def generate_assets_for_inbox() -> None:
    if not INBOX_DIR.exists():
        log(f"[WARN] Pasta {INBOX_DIR} não existe.")
        return

    briefs = sorted(INBOX_DIR.glob("*.brief.json"))
    if not briefs:
        log(f"[WARN] Nenhum arquivo .brief.json encontrado em {INBOX_DIR}")
        return

    for brief_path in briefs:
        log(f"[INFO] Processando brief: {brief_path.name}")
        try:
            generate_assets_for_brief(brief_path)
        except Exception as e:
            log(f"[ERRO] Falha ao processar {brief_path.name}: {e}")


if __name__ == "__main__":
    generate_assets_for_inbox()
