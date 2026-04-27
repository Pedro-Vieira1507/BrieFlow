# generate_assets.py
"""
Pipeline de geração de materiais de marketing para a campanha
"Compre 3 Leve 4 — DLAB" da Forlab.

LLM utilizado: Google Gemini (google-genai SDK) — sem custo de créditos OpenAI.
TTS utilizado: Google Cloud Text-to-Speech — compartilha credenciais OAuth2 do Drive.
"""
import os
import logging
from dotenv import load_dotenv

from app.ficha_pdf import save_ficha_as_pdf
from app.slides_ppt import (
    build_presentation_from_template,
    download_template_from_drive,
    parse_slides_content,
)
from app.podcast_tts import generate_podcast_audio

load_dotenv()
logger = logging.getLogger(__name__)

# ── Configuração do LLM (Gemini) ─────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "gemini-2.0-flash")

if not GEMINI_API_KEY:
    logger.warning(
        "[LLM] GEMINI_API_KEY não definida no .env. "
        "Obtenha sua chave gratuita em: https://aistudio.google.com/app/apikey"
    )


# ─────────────────────────────────────────────
# PROMPT BUILDERS
# ─────────────────────────────────────────────

def build_ficha_prompt(brief: str) -> str:
    return f"""Você é um especialista em produtos laboratoriais da Forlab.
Com base no briefing abaixo, gere uma FICHA TÉCNICA completa para a campanha
\"Compre 3 Leve 4 — DLAB\".

A ficha deve cobrir obrigatoriamente as 7 subcategorias DLAB:
1. Vidraria
2. Plásticos
3. Reagentes
4. Equipamentos
5. EPI
6. Descartáveis
7. Papelaria Técnica

Para cada subcategoria, inclua:
- Nome dos produtos elegíveis
- Código SKU (se disponível)
- Faixa de preço sugerida
- Pontos de diferenciação técnica
- Observações de uso/armazenamento

Formato de saída: Markdown estruturado com ## para cada subcategoria.

BRIEFING:
{brief}"""


def build_slides_prompt(brief: str) -> str:
    return f"""Você é um especialista em apresentações comerciais e marketing B2B.
Com base no briefing abaixo, crie o CONTEÚDO para uma apresentação PowerPoint
da campanha \"Compre 3 Leve 4 — DLAB\" da Forlab.

Gere exatamente 10 slides no formato:
SLIDE 1 | <Título>
- <bullet 1>
- <bullet 2>
- <bullet 3>

SLIDE 2 | <Título>
...

Estrutura recomendada:
- Slide 1: Capa (Título da campanha + subtítulo)
- Slide 2: Sobre a Forlab
- Slide 3: O que é a campanha Compre 3 Leve 4
- Slide 4-8: Uma subcategoria DLAB por slide (Vidraria, Plásticos, Reagentes, Equipamentos, EPI)
- Slide 9: Descartáveis + Papelaria Técnica
- Slide 10: Como participar / CTA

BRIEFING:
{brief}"""


def build_podcast_prompt(brief: str) -> str:
    return f"""Você é um roteirista de podcast de negócios e marketing B2B.
Com base no briefing abaixo, escreva um ROTEIRO COMPLETO para um episódio de podcast
sobre a campanha \"Compre 3 Leve 4 — DLAB\" da Forlab.

O roteiro deve ter entre 800 e 1200 palavras e incluir:

[ABERTURA] — Saudação + apresentação do tema (2-3 frases)
[CONTEXTO] — Por que a campanha existe, o problema que resolve
[LINHA DLAB] — Apresentação das 7 subcategorias: Vidraria, Plásticos, Reagentes,
               Equipamentos, EPI, Descartáveis, Papelaria Técnica
[OFERTA] — Mecânica do Compre 3 Leve 4, como funciona na prática
[BENEFÍCIOS] — Para o revendedor e para o cliente final
[CTA] — Como participar, onde encontrar, próximos passos
[ENCERRAMENTO] — Frase de impacto + despedida

Tom: Profissional mas acessível. Direto ao ponto. Sem jargões excessivos.
Escreva em português brasileiro.
ATENÇÃO: O texto será convertido em áudio por TTS. NÃO use markdown,
símbolos especiais ([, ], *, #) nem emojis — apenas texto corrido com pontuação normal.

BRIEFING:
{brief}"""


def build_folheto_a4_prompt(brief: str) -> str:
    return f"""Você é um redator especialista em materiais promocionais para laboratórios.
Com base no briefing abaixo, crie o TEXTO COMPLETO para um FOLHETO A4 impresso
da campanha \"Compre 3 Leve 4 — DLAB\" da Forlab.

O folheto deve conter:
[CABEÇALHO] — Título chamativo da campanha (máx. 10 palavras)
[SUBTÍTULO] — Reforço do benefício (máx. 15 palavras)
[DESTAQUE CENTRAL] — Bloco visual: \"Compre 3 produtos DLAB, leve o 4º grátis!\"
[CATEGORIAS] — Lista visual das 7 subcategorias com 1 produto destaque cada
[CONDIÇÕES] — Validade, como participar, restrições
[RODAPÉ] — Site, WhatsApp, e-mail de contato da Forlab

Tom: Impactante, claro e comercial. Linguagem para cliente final.

BRIEFING:
{brief}"""


def build_emails_revendedores_prompt(brief: str) -> str:
    return f"""Você é um especialista em e-mail marketing B2B para distribuidores.
Com base no briefing abaixo, escreva UMA SEQUÊNCIA DE 2 E-MAILS para revendedores
sobre a campanha \"Compre 3 Leve 4 — DLAB\" da Forlab.

E-MAIL 1 — Lançamento da campanha:
- Assunto impactante
- Apresentação da mecânica
- Benefícios de margem para o revendedor
- CTA: acessar tabela de preços ou falar com representante

E-MAIL 2 — Lembrete (enviar 5 dias depois):
- Assunto com senso de urgência
- Reforço dos produtos mais rentáveis
- Depoimento ou case de sucesso fictício
- CTA: Fechar pedido agora

Tom: Profissional, parceiro, focado em negócio.

BRIEFING:
{brief}"""


def build_emails_cliente_final_prompt(brief: str) -> str:
    return f"""Você é um especialista em e-mail marketing B2C para laboratórios.
Com base no briefing abaixo, escreva UMA SEQUÊNCIA DE 3 E-MAILS para cliente final
sobre a campanha \"Compre 3 Leve 4 — DLAB\" da Forlab.

E-MAIL 1 (Topo do funil) — Conscientização:
- Assunto: curiosidade/benefício
- Apresenta o problema (necessidade de suprimentos)
- Introduz a solução Forlab/DLAB

E-MAIL 2 (Meio do funil) — Consideração:
- Assunto: prova social ou dado
- Detalha a campanha e os produtos
- Lista as 7 subcategorias com exemplos práticos

E-MAIL 3 (Fundo do funil) — Conversão:
- Assunto: urgência/oferta
- Mecânica clara do Compre 3 Leve 4
- CTA direto: comprar agora / falar com consultor

Tom: Educativo, confiável, com senso de oportunidade.

BRIEFING:
{brief}"""


def build_posts_social_prompt(brief: str) -> str:
    return f"""Você é um social media especialista em marcas B2B de laboratório.
Com base no briefing abaixo, crie 6 POSTS para redes sociais da Forlab
sobre a campanha \"Compre 3 Leve 4 — DLAB\".

- 2 posts para LinkedIn (tom profissional, foco em revendedores e gestores)
- 2 posts para Facebook (tom mais acessível, foco em clientes finais)
- 2 posts para Instagram (tom visual e dinâmico, com sugestão de hashtags)

Cada post deve ter:
- Texto principal (máx. 150 palavras)
- Sugestão de CTA
- Para Instagram: lista de 5-8 hashtags relevantes
- Sugestão de tipo de imagem/visual a acompanhar

BRIEFING:
{brief}"""


def build_roteiro_video_prompt(brief: str) -> str:
    return f"""Você é um roteirista especialista em vídeos curtos para redes sociais B2B.
Com base no briefing abaixo, crie um ROTEIRO PARA VÍDEO CURTO (Reels/YouTube Shorts)
sobre a campanha \"Compre 3 Leve 4 — DLAB\" da Forlab.

O roteiro deve ter exatamente 4 cenas para um vídeo de 25-35 segundos:

CENA 1 (0-5s) — GANCHO: Frase de impacto ou pergunta instigante (narração + texto na tela)
CENA 2 (5-15s) — PROBLEMA/CONTEXTO: O desafio do laboratório e como a Forlab resolve
CENA 3 (15-25s) — SOLUÇÃO: A campanha Compre 3 Leve 4 — produtos destaque DLAB
CENA 4 (25-35s) — CTA: Call-to-action claro + onde acessar

Para cada cena, especifique:
- Narração (texto falado)
- Texto na tela (legenda ou overlay)
- Sugestão de imagem/clipe
- Duração em segundos

BRIEFING:
{brief}"""


# ─────────────────────────────────────────────
# LLM (Gemini) + HELPERS
# ─────────────────────────────────────────────

def call_llm_api(prompt: str, temperature: float = 0.7) -> str:
    """
    Envia um prompt para o Google Gemini e retorna o texto gerado.
    Usa o SDK google-genai (já presente no requirements.txt).

    Args:
        prompt: Texto completo do prompt.
        temperature: Criatividade (0.0 = determinístico, 1.0 = criativo).

    Returns:
        Texto gerado pelo modelo.
    """
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=GEMINI_API_KEY)

        logger.info(
            f"[LLM] Chamando {LLM_MODEL} via Gemini (temperature={temperature})..."
        )

        response = client.models.generate_content(
            model=LLM_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=8192,
            ),
        )

        content = response.text or ""
        logger.info(f"[LLM] ✅ Resposta recebida ({len(content)} caracteres)")
        return content

    except Exception as e:
        logger.error(f"[LLM] Erro na chamada Gemini API: {e}")
        raise


def load_example_text(asset_key: str) -> str:
    """
    Carrega texto de exemplo da pasta data/examples/ para um determinado asset.
    Usado como fallback ou referência de estilo.
    """
    examples_map = {
        "ficha":                "ficha_tecnica_exemplo.txt",
        "slides":               "slides_exemplo.txt",
        "podcast":              "podcast_exemplo.txt",
        "folheto_a4":           "folheto_a4_exemplo.txt",
        "emails_revendedores":  "emails_revendedores_exemplo.txt",
        "emails_cliente_final": "emails_cliente_final_exemplo.txt",
        "posts_social":         "posts_social_exemplo.txt",
        "roteiro_video":        "roteiro_video_exemplo.txt",
    }
    filename = examples_map.get(asset_key)
    if not filename:
        return ""
    path = os.path.join("data", "examples", filename)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    return ""


# ─────────────────────────────────────────────
# PIPELINE PRINCIPAL
# ─────────────────────────────────────────────

def generate_assets_for_brief(
    brief_text: str,
    output_folder: str,
    drive_service=None,
) -> dict[str, str]:
    """
    Executa o pipeline completo de geração de materiais de marketing
    para um briefing de campanha.

    Fluxo por asset:
      1. Monta o prompt específico com o briefing
      2. Chama o Gemini para gerar o conteúdo textual
      3. Salva no formato correto (.pdf, .pptx, .mp3, .txt)

    Args:
        brief_text: Texto do briefing extraído do arquivo de reunião.
        output_folder: Pasta local onde os arquivos gerados serão salvos.
        drive_service: Serviço autenticado do Google Drive API (necessário
                       para baixar o template de slides).

    Returns:
        Dict com {asset_key: caminho_local_do_arquivo_gerado}.
    """
    os.makedirs(output_folder, exist_ok=True)

    # Baixa o template de slides do Drive (apenas na primeira execução)
    if drive_service:
        try:
            download_template_from_drive(drive_service)
        except Exception as e:
            logger.warning(
                f"[Pipeline] Não foi possível baixar template do Drive: {e}. "
                "Usando template local se disponível."
            )

    # Declaração do pipeline:
    # (chave, nome_do_arquivo, função_builder, temperatura, formato_de_saída)
    assets_pipeline = [
        ("ficha",                "ficha_tecnica.pdf",           build_ficha_prompt,                0.3,  "pdf"),
        ("slides",               "apresentacao_dlab.pptx",      build_slides_prompt,               0.5,  "pptx"),
        ("podcast",              "podcast_dlab.mp3",            build_podcast_prompt,              0.7,  "mp3"),
        ("folheto_a4",           "folheto_a4.txt",              build_folheto_a4_prompt,           0.7,  "txt"),
        ("emails_revendedores",  "emails_revendedores.txt",     build_emails_revendedores_prompt,  0.6,  "txt"),
        ("emails_cliente_final", "emails_cliente_final.txt",    build_emails_cliente_final_prompt, 0.6,  "txt"),
        ("posts_social",         "posts_social.txt",            build_posts_social_prompt,         0.8,  "txt"),
        ("roteiro_video",        "roteiro_video.txt",           build_roteiro_video_prompt,        0.75, "txt"),
    ]

    results: dict[str, str] = {}

    for key, filename, builder_fn, temp, fmt in assets_pipeline:
        output_path = os.path.join(output_folder, filename)
        logger.info(f"[Pipeline] ▶ Gerando: {key} → {filename} (formato: {fmt})")

        try:
            prompt = builder_fn(brief_text)
            raw_text = call_llm_api(prompt, temperature=temp)

            if fmt == "pdf":
                save_ficha_as_pdf(
                    content=raw_text,
                    output_path=output_path,
                    title="Ficha Técnica DLAB — Compre 3 Leve 4",
                )

            elif fmt == "pptx":
                slides_data = parse_slides_content(raw_text)
                build_presentation_from_template(
                    slides_content=slides_data,
                    output_path=output_path,
                )

            elif fmt == "mp3":
                generate_podcast_audio(
                    script=raw_text,
                    output_path=output_path,
                )

            else:  # txt
                with open(output_path, "w", encoding="utf-8") as f:
                    f.write(raw_text)

            results[key] = output_path
            logger.info(f"[Pipeline] ✅ {key} → {output_path}")

        except Exception as e:
            logger.error(f"[Pipeline] ❌ Erro ao gerar '{key}': {e}")
            results[key] = f"ERRO: {e}"

    logger.info(
        f"[Pipeline] Pipeline concluído. "
        f"{sum(1 for v in results.values() if not v.startswith('ERRO'))} de "
        f"{len(results)} asset(s) gerado(s) com sucesso."
    )
    return results
