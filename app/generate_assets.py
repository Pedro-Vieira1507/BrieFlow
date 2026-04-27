"""generate_assets.py — Orquestra a geração dos 8 materiais de marketing DLAB.

Fluxo completo por arquivo de brief:
  1. Lê o brief em data/inbox/*.txt
  2. Chama a API do LLM para cada um dos 8 materiais
  3. Salva os outputs em data/processed/<nome_campanha>/:
       - slides.txt              → slides_ppt.py  → slides.pptx  (template do Drive)
       - ficha_tecnica.txt       → ficha_pdf.py   → ficha_tecnica.pdf
       - podcast_roteiro.txt     → podcast_tts.py → podcast.mp3
       - email_revendedores.txt
       - email_cliente_final.txt
       - posts_social.txt
       - roteiro_video.txt
       - folheto_a4.txt
"""
from __future__ import annotations

import logging
import os
import re
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# LLM client helper
# ---------------------------------------------------------------------------

def _get_llm_client():
    """Retorna (client, model_name) para o LLM configurado no .env."""
    provider = os.getenv("LLM_PROVIDER", "openai").strip().lower()

    if provider == "openai":
        from openai import OpenAI
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))
        model  = os.getenv("OPENAI_MODEL", "gpt-4o")
        return client, model

    if provider == "perplexity":
        from openai import OpenAI
        client = OpenAI(
            api_key=os.getenv("PERPLEXITY_API_KEY", ""),
            base_url="https://api.perplexity.ai",
        )
        model = os.getenv("PERPLEXITY_MODEL", "sonar-pro")
        return client, model

    if provider == "gemini":
        import google.generativeai as genai
        genai.configure(api_key=os.getenv("GOOGLE_GEMINI_API_KEY", ""))
        model = os.getenv("GEMINI_MODEL", "gemini-1.5-pro")
        return genai, model

    raise ValueError(f"LLM_PROVIDER desconhecido: '{provider}'. Use openai, perplexity ou gemini.")


def call_llm_api(system_prompt: str, user_content: str, temperature: float = 0.7) -> str:
    """Envia o prompt ao LLM e devolve o texto gerado."""
    provider = os.getenv("LLM_PROVIDER", "openai").strip().lower()
    client, model = _get_llm_client()

    if provider == "gemini":
        full_prompt = f"{system_prompt}\n\n---\n\n{user_content}"
        response    = client.GenerativeModel(model).generate_content(full_prompt)
        return response.text.strip()

    response = client.chat.completions.create(
        model=model,
        temperature=temperature,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_content},
        ],
    )
    return response.choices[0].message.content.strip()


# ---------------------------------------------------------------------------
# Example text loader
# ---------------------------------------------------------------------------

def load_example_text(asset_key: str) -> str:
    """
    Carrega um texto de exemplo para o asset_key, se existir.
    Os exemplos ficam em data/examples/<asset_key>.txt
    """
    examples_dir = Path("data/examples")
    examples_dir.mkdir(parents=True, exist_ok=True)
    path = examples_dir / f"{asset_key}.txt"
    if path.exists():
        return path.read_text(encoding="utf-8").strip()
    return ""


# ---------------------------------------------------------------------------
# Prompt builders — um por material
# ---------------------------------------------------------------------------

SYSTEM_BASE = (
    "Você é um especialista em marketing técnico para o laboratório Forlab, "
    "focado na linha de diagnóstico DLAB (kits para veterinários e técnicos). "
    "A campanha atual é 'Compre 3 Leve 4'. "
    "Escreva em português do Brasil. Seja específico, persuasivo e use as informações "
    "da transcrição fornecida."
)


def build_slides_prompt(brief: str) -> tuple[str, str]:
    system = (
        f"{SYSTEM_BASE}\n\n"
        "Crie o conteúdo para uma apresentação de slides de capacitação técnica de revendedores DLAB. "
        "Formato obrigatório:\n"
        "Slide 1 - Título: <título da apresentação>\n"
        "Slide 2 - Agenda: <tópico 1> | <tópico 2> | <tópico 3>\n"
        "Slide 3 - Sobre o DLAB: <3 a 5 bullets sobre os kits DLAB>\n"
        "Slide 4 - Subcategorias: <as 7 subcategorias: Canino, Felino, Bovino, Equino, Suíno, Avícola, Outros>\n"
        "Slide 5 - Detalhamento: <especificações técnicas principais>\n"
        "Slide 6 - Aplicações Clínicas: <3 a 5 casos de uso>\n"
        "Slide 7 - Diferenciais Forlab: <vantagens competitivas>\n"
        "Slide 8 - A Oferta: Compre 3 Leve 4 — <descrição da promoção>\n"
        "Slide 9 - Ecossistema Forlab: <outros produtos/serviços Forlab que complementam o DLAB>\n"
        "Slide 10 - Próximos Passos: <CTA para revendedores + contatos>\n"
        "Use marcadores com '- ' para bullets. Máximo 5 bullets por slide."
    )
    return system, brief


def build_ficha_prompt(brief: str) -> tuple[str, str]:
    system = (
        f"{SYSTEM_BASE}\n\n"
        "Gere uma Ficha Técnica completa dos kits DLAB para vendedores e revendedores. "
        "Estruture com seções em MAIÚSCULAS seguidas de tópicos. Inclua obrigatoriamente:\n"
        "DESCRIÇÃO DO PRODUTO\n"
        "SUBCATEGORIAS DISPONÍVEIS (Canino, Felino, Bovino, Equino, Suíno, Avícola, Outros — detalhe cada uma)\n"
        "ESPECIFICAÇÕES TÉCNICAS\n"
        "INDICAÇÕES E CONTRAINDICAÇÕES\n"
        "COMO USAR — PASSO A PASSO\n"
        "VANTAGENS COMPETITIVAS\n"
        "PÚBLICO-ALVO\n"
        "PREÇO SUGERIDO E CONDIÇÕES COMERCIAIS\n"
        "SUPORTE E CONTATO FORLAB\n"
        "Use formato 'Chave: Valor' onde aplicável."
    )
    return system, brief


def build_podcast_prompt(brief: str) -> tuple[str, str]:
    system = (
        f"{SYSTEM_BASE}\n\n"
        "Escreva um roteiro completo de podcast de vendas chamado 'DLAB em Foco' (duração ~8 min, ~1200 palavras). "
        "Estrutura:\n"
        "[ABERTURA] Saudação animada, apresentação do tema do episódio e da promoção Compre 3 Leve 4.\n"
        "[LINHA DLAB] Explique cada uma das 7 subcategorias: Canino, Felino, Bovino, Equino, Suíno, Avícola, Outros.\n"
        "[POR QUE VENDER] 3 argumentos de negócio para o revendedor incluir DLAB no portfólio.\n"
        "[A OFERTA] Detalhes da promoção Compre 3 Leve 4: como funciona, prazo, como pedir.\n"
        "[CTA FINAL] Convite para contato, site e encerramento.\n"
        "Tom: conversacional, entusiasmado, educativo. "
        "NÃO inclua indicações de música ou efeitos sonoros. Escreva apenas o texto falado."
    )
    return system, brief


def build_folheto_a4_prompt(brief: str) -> tuple[str, str]:
    system = (
        f"{SYSTEM_BASE}\n\n"
        "Crie o conteúdo textual de um folheto A4 frente e verso para cliente final (veterinários e clínicos). "
        "Estruture com 7 blocos de conteúdo, cada um com um título impactante e 2-3 linhas de texto:\n"
        "BLOCO 1 — HEADLINE PRINCIPAL (chamada de atenção)\n"
        "BLOCO 2 — O QUE É O DLAB (apresentação dos kits)\n"
        "BLOCO 3 — PARA QUEM É (espécies / indicações)\n"
        "BLOCO 4 — POR QUE ESCOLHER (diferenciais)\n"
        "BLOCO 5 — A OFERTA COMPRE 3 LEVE 4 (destaque visual textual)\n"
        "BLOCO 6 — DEPOIMENTO / PROVA SOCIAL (crie um depoimento fictício convincente de um veterinário)\n"
        "BLOCO 7 — CALL-TO-ACTION (onde comprar / contato / QR code placeholder)\n"
    )
    return system, brief


def build_emails_revendedores_prompt(brief: str) -> tuple[str, str]:
    system = (
        f"{SYSTEM_BASE}\n\n"
        "Escreva uma sequência de 2 e-mails para revendedores sobre a campanha Compre 3 Leve 4 DLAB:\n"
        "E-MAIL 1 — LANÇAMENTO DA CAMPANHA:\n"
        "  Assunto: <linha de assunto impactante>\n"
        "  Corpo: anúncio da promoção, condições comerciais, estoque, prazo e CTA para pedido.\n"
        "E-MAIL 2 — LEMBRETE / URGÊNCIA (enviar 5 dias antes do fim):\n"
        "  Assunto: <linha de assunto com urgência>\n"
        "  Corpo: reforço da oportunidade, destaque de quem já comprou (prova social genérica), CTA final.\n"
        "Tom: B2B, profissional, direto ao ponto."
    )
    return system, brief


def build_emails_cliente_final_prompt(brief: str) -> tuple[str, str]:
    system = (
        f"{SYSTEM_BASE}\n\n"
        "Escreva uma sequência de 3 e-mails para clientes finais (veterinários / clínicas) sobre o DLAB:\n"
        "E-MAIL 1 — TOPO DE FUNIL (Conscientização):\n"
        "  Assunto: <curiosidade ou problema que o produto resolve>\n"
        "  Corpo: problema de diagnóstico no dia a dia clínico + como o DLAB resolve.\n"
        "E-MAIL 2 — MEIO DE FUNIL (Consideração):\n"
        "  Assunto: <benefício específico ou comparação>\n"
        "  Corpo: diferenciais técnicos, facilidade de uso, resultado rápido + CTA para solicitar amostra/orçamento.\n"
        "E-MAIL 3 — FUNDO DE FUNIL (Conversão — Oferta):\n"
        "  Assunto: <urgência + benefício direto>\n"
        "  Corpo: destaque da promoção Compre 3 Leve 4, prazo, como pedir, CTA claro.\n"
        "Tom: educativo, empático, voltado ao profissional de saúde animal."
    )
    return system, brief


def build_posts_social_prompt(brief: str) -> tuple[str, str]:
    system = (
        f"{SYSTEM_BASE}\n\n"
        "Crie 6 posts de mídia social para a campanha DLAB Compre 3 Leve 4:\n"
        "POST 1 — LinkedIn (lançamento da campanha, tom profissional, 150-200 palavras + 5 hashtags)\n"
        "POST 2 — LinkedIn (conteúdo educativo sobre diagnóstico rápido, 120-150 palavras + 5 hashtags)\n"
        "POST 3 — Facebook (post de engajamento com pergunta, 80-100 palavras + 3 hashtags)\n"
        "POST 4 — Facebook (depoimento fictício de revendedor, 80-100 palavras + 3 hashtags)\n"
        "POST 5 — Instagram (legenda para imagem de produto, 60-80 palavras + 10 hashtags)\n"
        "POST 6 — Instagram (legenda com countdown / urgência, 60-80 palavras + 10 hashtags)\n"
        "Formate cada post com cabeçalho: '=== POST N — PLATAFORMA ==='"
    )
    return system, brief


def build_roteiro_video_prompt(brief: str) -> tuple[str, str]:
    system = (
        f"{SYSTEM_BASE}\n\n"
        "Escreva um roteiro para vídeo curto de 15-30 segundos (Reels/YouTube Shorts) sobre a campanha DLAB. "
        "Estruture em 4 cenas:\n"
        "CENA 1 — GANCHO (0-3s): frase de abertura que prende atenção imediata\n"
        "CENA 2 — PROBLEMA/SOLUÇÃO (3-12s): dor do veterinário + como o DLAB resolve em uma linha\n"
        "CENA 3 — OFERTA (12-22s): destaque da promoção Compre 3 Leve 4 com condições\n"
        "CENA 4 — CTA (22-30s): onde comprar / contato / link na bio\n"
        "Para cada cena informe: TEXTO EM TELA, NARRAÇÃO (fala) e SUGESTÃO DE IMAGEM/AÇÃO.\n"
        "Tom: dinâmico, visual, urgente."
    )
    return system, brief


# ---------------------------------------------------------------------------
# Parser de conteúdo
# ---------------------------------------------------------------------------

def parse_content(raw_text: str, markers: list[str] | None = None) -> dict[str, str]:
    """
    Divide o texto gerado pelo LLM em partes usando marcadores.
    Se markers for None, devolve {"full": raw_text}.
    """
    if not markers:
        return {"full": raw_text}

    result: dict[str, str] = {}
    pattern = "|".join(re.escape(m) for m in markers)
    parts   = re.split(f"({pattern})", raw_text, flags=re.IGNORECASE)

    current_key = "header"
    buffer: list[str] = []
    marker_index = 0

    for part in parts:
        is_marker = any(part.strip().upper() == m.upper() for m in markers)
        if is_marker:
            if buffer:
                result[current_key] = "\n".join(buffer).strip()
                buffer = []
            current_key  = markers[marker_index] if marker_index < len(markers) else part.strip()
            marker_index += 1
        else:
            buffer.append(part)

    if buffer:
        result[current_key] = "\n".join(buffer).strip()

    return result


# ---------------------------------------------------------------------------
# Output savers
# ---------------------------------------------------------------------------

def save_to_output(content: str, output_path: Path) -> Path:
    """Salva texto em arquivo, criando o diretório se necessário."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding="utf-8")
    logger.info(f"[SALVO] {output_path}")
    return output_path


def _run_post_processing(txt_path: Path, asset_key: str) -> None:
    """
    Executa o pós-processamento específico de cada asset:
      slides   → gera .pptx via Drive template
      ficha    → gera .pdf
      podcast  → gera .mp3 via TTS
    """
    if asset_key == "slides":
        try:
            from app.slides_ppt import slides_txt_to_ppt
            pptx_path = slides_txt_to_ppt(txt_path)
            logger.info(f"[PPTX] {pptx_path}")
        except Exception as exc:
            logger.error(f"[ERRO slides→pptx] {exc}")

    elif asset_key == "ficha":
        try:
            from app.ficha_pdf import ficha_txt_to_pdf
            pdf_path = ficha_txt_to_pdf(txt_path)
            logger.info(f"[PDF] {pdf_path}")
        except Exception as exc:
            logger.error(f"[ERRO ficha→pdf] {exc}")

    elif asset_key == "podcast":
        try:
            from app.podcast_tts import podcast_txt_to_mp3
            mp3_path = podcast_txt_to_mp3(txt_path)
            logger.info(f"[MP3] {mp3_path}")
        except Exception as exc:
            logger.error(f"[ERRO podcast→mp3] {exc}")


# ---------------------------------------------------------------------------
# Pipeline principal
# ---------------------------------------------------------------------------

def generate_assets_for_brief(brief_path: Path | str) -> dict[str, Path]:
    """
    Gera todos os 8 materiais de marketing a partir de um arquivo de brief.

    Args:
        brief_path: caminho do .txt com a transcrição/brief da campanha

    Returns:
        dict mapeando asset_key → Path do arquivo .txt gerado
    """
    brief_path = Path(brief_path)
    brief_text = brief_path.read_text(encoding="utf-8").strip()

    campaign_name = brief_path.stem
    output_dir    = Path("data/processed") / campaign_name
    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info(f"[PIPELINE] Iniciando geração para: {campaign_name}")

    # (key, nome_arquivo, builder_fn, temperature)
    assets_pipeline: list[tuple[str, str, callable, float]] = [
        ("slides",               "slides.txt",               build_slides_prompt,               0.5),
        ("ficha",                "ficha_tecnica.txt",         build_ficha_prompt,                0.4),
        ("podcast",              "podcast_roteiro.txt",       build_podcast_prompt,              0.8),
        ("folheto_a4",           "folheto_a4.txt",            build_folheto_a4_prompt,           0.7),
        ("emails_revendedores",  "email_revendedores.txt",    build_emails_revendedores_prompt,  0.7),
        ("emails_cliente_final", "email_cliente_final.txt",   build_emails_cliente_final_prompt, 0.7),
        ("posts_social",         "posts_social.txt",          build_posts_social_prompt,         0.8),
        ("roteiro_video",        "roteiro_video.txt",         build_roteiro_video_prompt,        0.8),
    ]

    generated: dict[str, Path] = {}

    for asset_key, filename, builder, temperature in assets_pipeline:
        logger.info(f"[{asset_key.upper()}] Gerando...")
        try:
            system_prompt, user_content = builder(brief_text)
            raw_output  = call_llm_api(system_prompt, user_content, temperature=temperature)
            txt_path    = save_to_output(raw_output, output_dir / filename)
            generated[asset_key] = txt_path
            # Pós-processamento: converte txt → pptx / pdf / mp3
            _run_post_processing(txt_path, asset_key)
        except Exception as exc:
            logger.error(f"[ERRO] {asset_key}: {exc}")

    logger.info(f"[PIPELINE] Concluído. {len(generated)}/8 assets gerados em: {output_dir}")
    return generated
