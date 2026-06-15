import os
import re
import logging
import time
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
load_dotenv()

import litellm

import sys
sys.path.insert(0, str(Path(__file__).parent))
from renderer import renderizar, FORMAT_MAP
from rag_loader import carregar_contexto, registrar_erro, coletar_referencias_visuais, salvar_referencia_visual

OUTPUT_DIR  = Path(os.getenv("OUTPUT_DIR", "data/output"))
MAX_TOKENS  = int(os.getenv("MAX_TOKENS",  "1200"))
TEMPERATURE = float(os.getenv("TEMPERATURE", "0.6"))

OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL",    "phi3")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_TIMEOUT  = int(os.getenv("OLLAMA_TIMEOUT", "15"))  # segundos

GEMINI_API_KEY  = os.getenv("GEMINI_API_KEY",  "")
GEMINI_MODEL    = os.getenv("GEMINI_MODEL",    "gemini-2.5-flash")
ANTHROPIC_KEY   = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-3-5-haiku-20241022")
OPENAI_KEY      = os.getenv("OPENAI_API_KEY",  "")
OPENAI_MODEL    = os.getenv("OPENAI_MODEL",    "gpt-4o-mini")

logging.basicConfig(level=logging.WARNING, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

SYSTEM_PROMPT_PATH = Path("src/prompts/system_prompt.txt")
_system_prompt_cache: Optional[str] = None


def get_system_prompt() -> str:
    global _system_prompt_cache
    if _system_prompt_cache:
        return _system_prompt_cache
    if SYSTEM_PROMPT_PATH.exists():
        _system_prompt_cache = SYSTEM_PROMPT_PATH.read_text(encoding="utf-8").strip()
    else:
        _system_prompt_cache = (
            "Voce e o BriefFlow, um agente de marketing conversacional premium. "
            "Responda as perguntas do usuario de forma direta e gere o conteudo "
            "solicitado com qualidade de agencia. Gere SOMENTE o que for pedido."
        )
    return _system_prompt_cache


def _chamar_llm(messages: list, max_tokens: int = MAX_TOKENS) -> tuple:
    providers = [
        {"nome": f"Ollama/{OLLAMA_MODEL}", "model": f"ollama/{OLLAMA_MODEL}",
         "api_key": "ollama", "api_base": OLLAMA_BASE_URL, "timeout": OLLAMA_TIMEOUT},
    ]
    if GEMINI_API_KEY:
        providers.append({"nome": f"Gemini/{GEMINI_MODEL}", "model": f"gemini/{GEMINI_MODEL}",
                          "api_key": GEMINI_API_KEY, "api_base": None, "timeout": 60})
    if ANTHROPIC_KEY:
        providers.append({"nome": f"Claude/{ANTHROPIC_MODEL}", "model": ANTHROPIC_MODEL,
                          "api_key": ANTHROPIC_KEY, "api_base": None, "timeout": 60})
    if OPENAI_KEY:
        providers.append({"nome": f"OpenAI/{OPENAI_MODEL}", "model": OPENAI_MODEL,
                          "api_key": OPENAI_KEY, "api_base": None, "timeout": 60})

    ultimo_erro = None
    for p in providers:
        try:
            kwargs = dict(
                model=p["model"],
                messages=messages,
                max_tokens=max_tokens,
                temperature=TEMPERATURE,
                api_key=p["api_key"],
                timeout=p["timeout"],
            )
            if p["api_base"]:
                kwargs["api_base"] = p["api_base"]
            resposta = litellm.completion(**kwargs)
            return resposta.choices[0].message.content.strip(), p["nome"]
        except Exception as e:
            ultimo_erro = e
            logger.warning("Falha em %s: %s - tentando proximo.", p["nome"], e)

    raise RuntimeError(
        f"Todos os providers falharam. Ultimo erro: {ultimo_erro}\n"
        "► Verifique se o Ollama esta rodando: ollama serve\n"
        "► Ou configure uma API key no .env"
    )


def _chamar_llm_multimodal(messages: list, max_tokens: int = 4096) -> tuple:
    providers = []
    if GEMINI_API_KEY:
        providers.append({"nome": f"Gemini/{GEMINI_MODEL}", "model": f"gemini/{GEMINI_MODEL}",
                          "api_key": GEMINI_API_KEY, "api_base": None, "timeout": 60})
    if OPENAI_KEY:
        providers.append({"nome": f"OpenAI/{OPENAI_MODEL}", "model": OPENAI_MODEL,
                          "api_key": OPENAI_KEY, "api_base": None, "timeout": 60})
    if ANTHROPIC_KEY:
        providers.append({"nome": f"Claude/{ANTHROPIC_MODEL}", "model": ANTHROPIC_MODEL,
                          "api_key": ANTHROPIC_KEY, "api_base": None, "timeout": 60})

    ultimo_erro = None
    for p in providers:
        try:
            kwargs = dict(
                model=p["model"],
                messages=messages,
                max_tokens=max_tokens,
                temperature=0.2,
                api_key=p["api_key"],
                timeout=p["timeout"],
            )
            if p["api_base"]:
                kwargs["api_base"] = p["api_base"]
            resposta = litellm.completion(**kwargs)
            return resposta.choices[0].message.content.strip(), p["nome"]
        except Exception as e:
            ultimo_erro = e
            logger.warning("Falha multimodal em %s: %s - tentando proximo.", p["nome"], e)

    raise RuntimeError(
        f"Nenhum provider multimodal disponivel. Ultimo erro: {ultimo_erro}\n"
        "► Configure GEMINI_API_KEY, OPENAI_API_KEY ou ANTHROPIC_API_KEY no .env"
    )


MATERIAL_MAP = {
    "banner":         "banner HTML profissional (hero com gradiente, headline bold, CTA)",
    "ficha tecnica":  "ficha tecnica HTML completa (hero + stats bar + specs + tabela + rodape)",
    "ficha":          "ficha tecnica HTML completa (hero + stats bar + specs + tabela + rodape)",
    "post linkedin":  "carrossel LinkedIn 6 slides (copy + briefing visual por slide)",
    "linkedin":       "carrossel LinkedIn 6 slides (copy + briefing visual por slide)",
    "post instagram": "post Instagram feed 1080x1080 (legenda + hashtags + briefing visual)",
    "instagram":      "post Instagram feed 1080x1080 HTML com fundo gradiente e copy pronto para captura",
    "stories":        "sequencia de 3 Instagram Stories HTML (div.story por slide, 1080x1920 cada)",
    "reels":          "roteiro Reels/TikTok 60s cena a cena com timecodes",
    "tiktok":         "roteiro Reels/TikTok 60s cena a cena com timecodes",
    "email":          "e-mail marketing HTML completo responsivo (Gmail + Outlook)",
    "e-mail":         "e-mail marketing HTML completo responsivo (Gmail + Outlook)",
    "google ads":     "3 variacoes de anuncio Google Ads RSA (headlines + descriptions + extensoes)",
    "meta ads":       "3 variacoes de anuncio Meta Ads (feed + stories + reels copy)",
    "proposta":       "one-pager proposta comercial HTML para impressao em PDF",
    "one pager":      "one-pager proposta comercial HTML para impressao em PDF",
    "whatsapp":       "script de abordagem comercial para WhatsApp",
    "script":         "script de abordagem comercial para WhatsApp",
    "card":           "card de produto HTML responsivo com foto, specs e CTA",
    "landing page":   "landing page HTML completa com hero, beneficios, prova social e CTA",
}


def detectar_material(mensagem: str) -> Optional[tuple]:
    msg_lower = mensagem.lower()
    for chave, descricao in MATERIAL_MAP.items():
        if chave in msg_lower:
            return chave, descricao
    return None


def _formato_label(chave: str) -> str:
    config = FORMAT_MAP.get(chave.lower(), {})
    fmt   = config.get("format", "txt").upper()
    label = config.get("label", chave)
    return f"{label} -> {fmt}"


def _inferir_tipo_material(texto: str) -> str:
    texto = texto.lower()
    if "banner" in texto:
        return "banner"
    if "instagram" in texto:
        return "instagram"
    if "story" in texto or "stories" in texto:
        return "stories"
    if "landing" in texto:
        return "landing page"
    return "geral"


def analisar_e_salvar_referencia_visual(image_path: Path, instrucoes_usuario: str = "") -> dict:
    titulo_base = image_path.stem.replace("_", " ").replace("-", " ").strip().title()

    system = (
        "Voce e um diretor de arte senior e analista de design. "
        "Analise a imagem enviada e responda em JSON valido com as chaves: "
        "title, material_type, description, tags, layout_notes. "
        "description deve resumir o design em 1-2 frases. "
        "tags deve ser um array curto. "
        "layout_notes deve descrever composicao, hierarquia visual, cores, tipografia, alinhamento e uso de espaco negativo."
    )
    user_parts = [
        {"type": "text", "text": f"Analise esta referencia visual. Instrucoes extras do usuario: {instrucoes_usuario or 'nenhuma'}"},
        {"type": "image_url", "image_url": {"url": f"data:image/{image_path.suffix.lower().replace('.', '')};base64," + __import__('base64').b64encode(image_path.read_bytes()).decode('utf-8')}}
    ]
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user_parts},
    ]

    resposta, provider = _chamar_llm_multimodal(messages)
    logger.info("Referencia visual analisada com %s", provider)

    try:
        cleaned = resposta.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```json\s*|^```|```$", "", cleaned, flags=re.MULTILINE).strip()
        payload = __import__('json').loads(cleaned)
    except Exception:
        payload = {
            "title": titulo_base,
            "material_type": _inferir_tipo_material(instrucoes_usuario or image_path.stem),
            "description": "Referencia visual enviada pelo usuario para orientar layout e estilo.",
            "tags": ["referencia", "visual"],
            "layout_notes": resposta[:1000],
        }

    payload.setdefault("title", titulo_base)
    payload.setdefault("material_type", _inferir_tipo_material(instrucoes_usuario or image_path.stem))
    payload.setdefault("description", "Referencia visual enviada pelo usuario para orientar layout e estilo.")
    payload.setdefault("tags", ["referencia", "visual"])
    payload.setdefault("layout_notes", "Sem notas adicionais.")

    salvar_referencia_visual(
        origem_path=image_path,
        title=payload["title"],
        material_type=payload["material_type"],
        description=payload["description"],
        tags=payload["tags"],
        layout_notes=payload["layout_notes"],
    )
    return payload


BANNER = """
+--------------------------------------------------------------+
|            BriefFlow  Agente de Marketing                    |
|  Powered by Ollama (local) + fallback Gemini/Claude/OpenAI   |
|  RAG ativo: pasta knowledge/ alimenta cada geracao           |
+--------------------------------------------------------------+
"""


def chat_loop():
    print(BANNER)
    historico        = []
    contexto_produto = ""
    system           = get_system_prompt()
    ultimo_resultado = ""
    ultima_mensagem  = ""

    while True:
        try:
            entrada = input("Voce: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nAte logo!")
            break

        if not entrada:
            continue

        if entrada.lower() in ("/sair", "sair", "exit", "quit"):
            print("Ate logo!")
            break

        if entrada.lower() == "/limpar":
            historico.clear()
            contexto_produto = ""
            ultimo_resultado = ""
            print("\n[OK] Conversa reiniciada.\n")
            continue

        if entrada.lower() == "/modelo":
            print(f"\n[Modelo] Ollama: {OLLAMA_MODEL} | Base: {OLLAMA_BASE_URL} | Timeout: {OLLAMA_TIMEOUT}s")
            print(f"  Fallback texto: Gemini={'OK' if GEMINI_API_KEY else 'nao configurado'}  "
                  f"Claude={'OK' if ANTHROPIC_KEY else 'nao configurado'}  "
                  f"OpenAI={'OK' if OPENAI_KEY else 'nao configurado'}")
            print("  Multimodal requer Gemini, Claude ou OpenAI configurado.\n")
            continue

        if entrada.lower().startswith("erro:"):
            motivo = entrada[5:].strip()
            registrar_erro(ultima_mensagem, ultimo_resultado, motivo)
            print("\n[Feedback registrado] Obrigado! Isso vai ajudar a melhorar as proximas geracoes.\n")
            continue

        if entrada.lower().startswith("contexto:"):
            contexto_produto = entrada[9:].strip()
            print("\n[Contexto registrado] Agora me diga o que gerar.\n")
            historico.append({"role": "user",      "content": entrada})
            historico.append({"role": "assistant", "content": "Contexto salvo! Me diga o que gerar."})
            continue

        ultima_mensagem = entrada
        material = detectar_material(entrada)
        rag_contexto = carregar_contexto(
            mensagem=entrada + (" " + contexto_produto if contexto_produto else ""),
            material_key=material[0] if material else None,
        )
        referencias_visuais = coletar_referencias_visuais(
            mensagem=entrada + (" " + contexto_produto if contexto_produto else ""),
            material_key=material[0] if material else None,
            limite=3,
        )
        system_com_rag = system + rag_contexto

        mensagem_final = entrada
        if contexto_produto:
            mensagem_final = f"{entrada}\n\n--- CONTEXTO DO PRODUTO/CAMPANHA ---\n{contexto_produto}"

        if material:
            chave, descricao = material
            fmt_label = _formato_label(chave)
            print(f"\n[Gerando] {fmt_label}...")
            mensagem_final += (
                f"\n\nIMPORTANTE: Gere APENAS {descricao}. "
                f"Entregue o conteudo completo diretamente, sem explicacoes introdutorias."
            )
        else:
            print("\n[...] ", end="", flush=True)

        t0 = time.time()

        try:
            if referencias_visuais and (GEMINI_API_KEY or OPENAI_KEY or ANTHROPIC_KEY):
                user_content = [{"type": "text", "text": mensagem_final}]
                for ref in referencias_visuais:
                    user_content.append({"type": "text", "text": f"Referencia visual: {ref['title']} | {ref['description']} | Layout: {ref['layout_notes']}"})
                    user_content.append({"type": "image_url", "image_url": {"url": ref["data_url"]}})
                messages = [
                    {"role": "system", "content": system_com_rag},
                    *historico[-12:],
                    {"role": "user", "content": user_content},
                ]
                resposta, provider_usado = _chamar_llm_multimodal(messages, max_tokens=4096 if material else MAX_TOKENS)
            else:
                messages = [
                    {"role": "system", "content": system_com_rag},
                    *historico[-12:],
                    {"role": "user",   "content": mensagem_final},
                ]
                resposta, provider_usado = _chamar_llm(messages, max_tokens=4096 if material else MAX_TOKENS)

            tempo = time.time() - t0
            ultimo_resultado = resposta

            print(f"\rBriefFlow ({provider_usado}) [{tempo:.1f}s]:\n")
            print(resposta)
            print()

            if material:
                chave, _ = material
                arquivos = renderizar(
                    conteudo=resposta,
                    material_key=chave,
                    output_dir=OUTPUT_DIR,
                    nome_base=chave.replace(" ", "_"),
                )
                for arq in arquivos:
                    print(f"[Salvo] {arq}")
                print()

            historico.append({"role": "user",      "content": entrada})
            historico.append({"role": "assistant", "content": resposta})
            if len(historico) > 20:
                historico = historico[-20:]

        except RuntimeError as e:
            print(f"\r[ERRO] {e}\n")
        except Exception as e:
            print(f"\r[ERRO inesperado] {e}\n")
            logger.exception("Erro no chat loop")


def main():
    chat_loop()


if __name__ == "__main__":
    main()
