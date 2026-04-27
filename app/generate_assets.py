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
        "podcast":              EXAMPLES_DIR / "podcast_revendedores.txt",
        "slides":               EXAMPLES_DIR / "slides_capacitacao_10.txt",
        "folheto_a4":           EXAMPLES_DIR / "folheto_a4_cliente_final.txt",
        "ficha":                EXAMPLES_DIR / "ficha_tecnica_vendedores.txt",
        "emails_revendedores":  EXAMPLES_DIR / "emails_marketing_revendedores.txt",
        "emails_cliente_final": EXAMPLES_DIR / "emails_marketing_cliente_final.txt",
        "posts_social":         EXAMPLES_DIR / "posts_midia_social.txt",
        "roteiro_video":        EXAMPLES_DIR / "roteiro_video_curto.txt",
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


# ──────────────────────────────────────────────────────────────
# PROMPT BUILDERS — 8 materiais do Piloto DLAB Pipetadores
# ──────────────────────────────────────────────────────────────

def build_podcast_prompt(brief: dict) -> str:
    return f"""
Contexto estruturado (JSON)
---------------------------
{json.dumps(brief, ensure_ascii=False, indent=2)}

Tarefa
------
Crie um ROTEIRO de PODCAST de até 5 minutos voltado para REVENDEDORES
sobre a linha Pipetadores DLAB.

Subcategorias a cobrir: Micropipetas Monocanal, Micropipetas Multicanal,
Auxiliar de Pipetagem, Micropipetas Eletrônicas, Dispensadores,
Buretas Digitais e Repipetadores.

Regras:
- Foco em PEGADA COMERCIAL: como o revendedor ganha mais vendendo DLAB.
- Mencione brevemente cada subcategoria (1-2 frases cada).
- Destaque 2-3 vantagens-chave para o revendedor.
- Encerre com chamada forte para a OFERTA COMPRE 3 LEVE 4.
- Estruture como fala, em blocos:
  * Abertura (gancho + boas-vindas)
  * Bloco 1 — A Linha DLAB Pipetadores
  * Bloco 2 — Por que vender DLAB?
  * Bloco 3 — A Oferta Compre 3 Leve 4
  * Encerramento com CTA
- Português (pt-BR). Tom: animado, direto, confiante.
""".strip()


def build_slides_prompt(brief: dict) -> str:
    return f"""
Contexto estruturado (JSON)
---------------------------
{json.dumps(brief, ensure_ascii=False, indent=2)}

Tarefa
------
Monte uma ESTRUTURA de 10 SLIDES para uma apresentação de CAPACITAÇÃO TÉCNICA
voltada para REVENDEDORES sobre a linha Pipetadores DLAB.

Use EXATAMENTE este formato:

Slide 1 - Título:
- ...

Slide 2 - Assunto:
- ...

...

Slide 10 - Assunto:
- ...

Estrutura sugerida:
Slide 1: Capa — DLAB Pipetadores: A Linha Completa de Liquid Handling
Slide 2: DLAB no Mundo — líder global, presença em +100 países
Slide 3: Micropipetas Monocanal HiPette — diferenciais técnicos
Slide 4: Micropipetas Multicanal — aplicações e vantagens
Slide 5: Auxiliar de Pipetagem Motorizado — redução de fadiga do operador
Slide 6: Micropipetas Eletrônicas — precisão e automação
Slide 7: Dispensadores e Repipetadores — uso eficiente em grandes volumes
Slide 8: Buretas Digitais — precisão em titulação
Slide 9: Ecossistema Forlab — Calibração RBC, Consumíveis, Peças, Trade-in
Slide 10: Oferta Compre 3 Leve 4 + Próximos Passos

Regras:
- Linguagem técnica clara, adequada para capacitar vendedores de revendas.
- Não detalhar gráficos, apenas indicar o tipo ("tabela comparativa", "foto do produto").
- Português (pt-BR).
""".strip()


def build_folheto_a4_prompt(brief: dict) -> str:
    return f"""
Contexto estruturado (JSON)
---------------------------
{json.dumps(brief, ensure_ascii=False, indent=2)}

Tarefa
------
Crie o TEXTO COMPLETO de um FOLHETO PROMOCIONAL em formato A4 para CLIENTE FINAL,
focado na campanha COMPRE 3 LEVE 4 — Pipetadores DLAB.

Estrutura do folheto (escreva cada bloco):
1. MANCHETE PRINCIPAL — impactante, foco na oferta
2. SUBTÍTULO — reforça o benefício para o laboratório
3. BLOCO "CONHEÇA A LINHA" — 7 subcategorias com 1 linha cada:
   - Micropipetas Monocanal
   - Micropipetas Multicanal
   - Auxiliar de Pipetagem
   - Micropipetas Eletrônicas
   - Dispensadores
   - Buretas Digitais
   - Repipetadores
4. BLOCO "A OFERTA" — mecânica do Compre 3 Leve 4 em linguagem clara e simples
5. BLOCO "POR QUE FORLAB?" — 3 bullet points:
   - Calibração RBC acreditada
   - Consumíveis originais e peças de reposição
   - Programa Trade-in DLAB
6. CTA FINAL — com placeholder [TELEFONE/SITE/WHATSAPP]
7. RODAPÉ — "Válido enquanto durar o estoque. Consulte condições."

Estilo: persuasivo, visual (use **negrito** para destaques), português (pt-BR).
""".strip()


def build_ficha_prompt(brief: dict) -> str:
    return f"""
Contexto estruturado (JSON)
---------------------------
{json.dumps(brief, ensure_ascii=False, indent=2)}

Tarefa
------
Crie uma FICHA TÉCNICA para VENDEDORES INTERNOS da Forlab com 2-3 diferenciais
práticos por subcategoria dos Pipetadores DLAB.

Subcategorias obrigatórias (todas as 7):
1. Micropipetas Monocanal
2. Micropipetas Multicanal
3. Auxiliar de Pipetagem
4. Micropipetas Eletrônicas
5. Dispensadores
6. Buretas Digitais
7. Repipetadores

Formato de saída:
Subcategoria: [Nome]
- Diferencial 1
- Diferencial 2
- Diferencial 3

Regras:
- Cada diferencial deve ser um argumento de venda concreto (inclua dado técnico quando possível).
- Foco em pontos que ajudam a argumentar contra concorrentes.
- Português (pt-BR). Tom técnico e objetivo.
""".strip()


def build_emails_revendedores_prompt(brief: dict) -> str:
    return f"""
Contexto estruturado (JSON)
---------------------------
{json.dumps(brief, ensure_ascii=False, indent=2)}

Tarefa
------
Crie uma SEQUÊNCIA de 2 EMAILS DE MARKETING para REVENDEDORES da linha Pipetadores DLAB.

EMAIL 1 — Apresentação das Sub-Categorias
- Apresente a linha completa DLAB (todas as 7 subcategorias).
- Destaque a profundidade do portfólio e o ecossistema Forlab (calibração, consumíveis, trade-in).
- CTA: "Solicite nosso catálogo técnico completo".

EMAIL 2 — Apresentação da Oferta Compre 3 Leve 4
- Explique a mecânica da promoção de forma clara (4ª unidade grátis, menor valor).
- Destaque o benefício comercial para o revendedor: volume, margem e diferencial competitivo.
- Mencione a bonificação para vendedores que atingirem R$ 30.000 em vendas.
- CTA: "Faça seu pedido agora".

Formato:
EMAIL 1
Assunto:
Pré-header:
Corpo:

EMAIL 2
Assunto:
Pré-header:
Corpo:

Regras: parágrafos curtos, CTA claro em cada email, português (pt-BR).
""".strip()


def build_emails_cliente_final_prompt(brief: dict) -> str:
    return f"""
Contexto estruturado (JSON)
---------------------------
{json.dumps(brief, ensure_ascii=False, indent=2)}

Tarefa
------
Crie uma SEQUÊNCIA de 3 EMAILS DE MARKETING para CLIENTE FINAL
(laboratórios, indústrias farmacêuticas, clínicas) — Pipetadores DLAB + Oferta Compre 3 Leve 4.

EMAIL 1 — Topo de Funil: Apresentação DLAB
- DLAB como líder mundial em liquid handling (presença global, qualidade comprovada).
- Apresente os 7 tipos de pipetadores em linguagem acessível ao usuário final.
- Segurança em comprar com a Forlab: calibração RBC acreditada, peças, consumíveis, Trade-in.
- CTA leve: "Conheça a linha completa".

EMAIL 2 — Meio de Funil: Vantagens DLAB vs. concorrentes
- Melhor custo-benefício frente a marcas premium internacionais.
- Diferenciais tecnológicos da Bureta Digital, Pipeta Eletrônica e Pipeta Monocanal HiPette Color.
- Importância do ecossistema completo: Pipetador de qualidade + Consumíveis originais + Assistência + Lab. Acreditado RBC.
- CTA: "Solicite uma demonstração com nossos especialistas".

EMAIL 3 — Fundo de Funil: Oferta Compre 3 Leve 4
- Apresente a oferta com urgência e clareza (compre 3, ganhe o 4º de menor valor).
- Reforce o ecossistema Forlab como diferencial de segurança na compra.
- CTA forte: "Garanta sua oferta agora — estoque limitado".

Formato:
EMAIL 1
Assunto:
Pré-header:
Corpo:

EMAIL 2
Assunto:
Pré-header:
Corpo:

EMAIL 3
Assunto:
Pré-header:
Corpo:

Regras: tom consultivo nos emails 1-2, urgência no email 3, parágrafos curtos, português (pt-BR).
""".strip()


def build_posts_social_prompt(brief: dict) -> str:
    return f"""
Contexto estruturado (JSON)
---------------------------
{json.dumps(brief, ensure_ascii=False, indent=2)}

Tarefa
------
Crie 6 POSTS PARA MÍDIAS SOCIAIS sobre a linha Pipetadores DLAB + Oferta Compre 3 Leve 4.

POST LINKEDIN 1
Público: Gestores de laboratório, compradores técnicos, distribuidores B2B.
Foco: Autoridade e inovação (tom profissional, dado técnico, posicionamento de líder de mercado).

POST LINKEDIN 2
Público: idem.
Foco: Oferta Compre 3 Leve 4 com linguagem de ROI / eficiência orçamentária para laboratórios.

POST FACEBOOK 1
Público: Revendedores e laboratoristas em geral.
Foco: Apresentação visual e acessível da linha de pipetadores DLAB.

POST FACEBOOK 2
Público: idem.
Foco: Oferta Compre 3 Leve 4 com apelo de promoção e urgência.

POST INSTAGRAM 1
Público: Jovens cientistas, lab techs, profissionais da área laboratorial.
Foco: Conteúdo educativo ou aspiracional sobre pipetadores. Tom leve e visual.

POST INSTAGRAM 2
Público: idem.
Foco: Oferta Compre 3 Leve 4 em formato adequado para feed/Reels/Stories.

Formato de cada post:
POST [PLATAFORMA] [NÚMERO]
Legenda:
Hashtags:
Sugestão de visual: (descreva brevemente a imagem ou vídeo ideal)

Regras por plataforma:
- LinkedIn: até 1.200 caracteres, tom profissional e direto.
- Facebook: até 500 caracteres, tom amigável.
- Instagram: até 300 caracteres + hashtags, tom dinâmico.
- Use emojis com moderação. Português (pt-BR).
""".strip()


def build_roteiro_video_prompt(brief: dict) -> str:
    return f"""
Contexto estruturado (JSON)
---------------------------
{json.dumps(brief, ensure_ascii=False, indent=2)}

Tarefa
------
Crie um ROTEIRO de VÍDEO CURTO (15 a 30 segundos) para a linha Pipetadores DLAB
+ Oferta Compre 3 Leve 4. Destino: Reels (Instagram/Facebook) e YouTube Shorts.

Estrutura obrigatória de cenas:
CENA 1 (0-5s): Gancho visual + frase de impacto.
CENA 2 (5-15s): Passagem rápida pelos tipos de pipetadores (locução + sugestão visual).
CENA 3 (15-25s): Apresentação da oferta Compre 3 Leve 4 com destaque.
CENA 4 (25-30s): CTA + logo Forlab + contato.

Para cada cena, entregue exatamente neste formato:
CENA [N] — [tempo]
Locução: "..."
Visual sugerido: (descrição do que aparece em tela)
Texto na tela: "..."

Regras:
- Máximo 60 palavras de locução no total.
- Tom: energético, confiante, focado em laboratório.
- Português (pt-BR).
""".strip()


# ──────────────────────────────────────────────
# ENGINE DE GERAÇÃO
# ──────────────────────────────────────────────

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

    # Pipeline completo — 8 materiais do Piloto DLAB Pipetadores
    assets_pipeline = [
        ("podcast",               "podcast_revendedores.txt",          build_podcast_prompt,               0.5),
        ("slides",                "slides_capacitacao_10.txt",          build_slides_prompt,                0.4),
        ("folheto_a4",            "folheto_a4_cliente_final.txt",       build_folheto_a4_prompt,            0.6),
        ("ficha",                 "ficha_tecnica_vendedores.txt",       build_ficha_prompt,                 0.4),
        ("emails_revendedores",   "emails_marketing_revendedores.txt",  build_emails_revendedores_prompt,   0.6),
        ("emails_cliente_final",  "emails_marketing_cliente_final.txt", build_emails_cliente_final_prompt,  0.6),
        ("posts_social",          "posts_midia_social.txt",             build_posts_social_prompt,          0.7),
        ("roteiro_video",         "roteiro_video_curto.txt",            build_roteiro_video_prompt,         0.6),
    ]

    slides_txt = out_dir / "slides_capacitacao_10.txt"

    for asset_key, filename, prompt_builder, temp in assets_pipeline:
        generate_one_asset(
            client=client,
            asset_key=asset_key,
            prompt=prompt_builder(brief),
            output_path=out_dir / filename,
            temperature=temp,
            manifest=manifest,
        )
        time.sleep(DEFAULT_TIMEOUT_BETWEEN_ASSETS)

    maybe_generate_pptx(
        slides_txt,
        manifest,
        template_path=DEFAULT_TEMPLATE_PATH,
        images_dir=images_dir,
    )

    manifest_path = out_dir / "generation_manifest.json"
    write_text_file(manifest_path, json.dumps(manifest, ensure_ascii=False, indent=2))

    log(f"[OK] Todos os 8 assets gerados em: {out_dir}")


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