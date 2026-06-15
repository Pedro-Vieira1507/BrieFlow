import os
import re
import logging
import time
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
load_dotenv()

import litellm

# Importa renderer (mesmo diretorio)
import sys
sys.path.insert(0, str(Path(__file__).parent))
from renderer import renderizar, FORMAT_MAP

# Configuracoes
OUTPUT_DIR  = Path(os.getenv("OUTPUT_DIR", "data/output"))
MAX_TOKENS  = int(os.getenv("MAX_TOKENS",  "1200"))
TEMPERATURE = float(os.getenv("TEMPERATURE", "0.6"))

# Modelos por provider
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL",    "llama3")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
GEMINI_API_KEY  = os.getenv("GEMINI_API_KEY",  "")
GEMINI_MODEL    = os.getenv("GEMINI_MODEL",    "gemini-2.5-flash")
ANTHROPIC_KEY   = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-3-5-haiku-20241022")
OPENAI_KEY      = os.getenv("OPENAI_API_KEY",  "")
OPENAI_MODEL    = os.getenv("OPENAI_MODEL",    "gpt-4o-mini")

logging.basicConfig(level=logging.WARNING, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

# System prompt (cache em memoria)
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


# Seletor de provider com fallback automatico
# Ordem: Ollama -> Gemini -> Anthropic -> OpenAI

def _chamar_llm(messages: list, max_tokens: int = MAX_TOKENS) -> tuple:
    providers = [
        {"nome": f"Ollama/{OLLAMA_MODEL}", "model": f"ollama/{OLLAMA_MODEL}",
         "api_key": "ollama", "api_base": OLLAMA_BASE_URL},
    ]
    if GEMINI_API_KEY:
        providers.append({"nome": f"Gemini/{GEMINI_MODEL}", "model": f"gemini/{GEMINI_MODEL}",
                          "api_key": GEMINI_API_KEY, "api_base": None})
    if ANTHROPIC_KEY:
        providers.append({"nome": f"Claude/{ANTHROPIC_MODEL}", "model": ANTHROPIC_MODEL,
                          "api_key": ANTHROPIC_KEY, "api_base": None})
    if OPENAI_KEY:
        providers.append({"nome": f"OpenAI/{OPENAI_MODEL}", "model": OPENAI_MODEL,
                          "api_key": OPENAI_KEY, "api_base": None})

    ultimo_erro = None
    for p in providers:
        try:
            kwargs = dict(model=p["model"], messages=messages, max_tokens=max_tokens,
                          temperature=TEMPERATURE, api_key=p["api_key"], timeout=120)
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


# Detector de intencao
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


# Chat interativo

BANNER = """
+--------------------------------------------------------------+
|            BriefFlow  Agente de Marketing                    |
|  Powered by Ollama (local) + fallback Gemini/Claude/OpenAI   |
+--------------------------------------------------------------+

Formatos de saida automaticos:
  banner / card / instagram  ->  PNG
  stories                    ->  PNG (3 arquivos 1080x1920)
  ficha tecnica / proposta   ->  PDF (A4)
  landing page / e-mail      ->  HTML
  linkedin / ads / scripts   ->  TXT

Como usar:
  * Converse normalmente - pergunte, peca ideias, tire duvidas.
  * Para gerar: "crie um banner para o produto X"
  * Para passar contexto: "contexto: [dados do produto]"
  * Comandos: /ajuda  /modelo  /limpar  /sair
"""

AJUDA = """
+--- Comandos ---------------------------------------------------+
|  /ajuda   -> exibe este menu                                  |
|  /modelo  -> mostra provider ativo e fallbacks                |
|  /limpar  -> reinicia conversa                                |
|  /sair    -> encerra o BriefFlow                              |
+--- Materiais e formatos ---------------------------------------+
|  banner              ->  PNG                                  |
|  card de produto     ->  PNG                                  |
|  post instagram      ->  PNG (1080x1080)                      |
|  stories             ->  PNG (3 x 1080x1920)                  |
|  ficha tecnica       ->  PDF (A4)                             |
|  proposta / one pager->  PDF (A4)                             |
|  landing page        ->  HTML                                 |
|  e-mail marketing    ->  HTML                                 |
|  linkedin / reels    ->  TXT                                  |
|  google ads / meta   ->  TXT                                  |
|  script whatsapp     ->  TXT                                  |
+--- Como passar contexto ---------------------------------------+
|  contexto: [nome, specs, publico-alvo, oferta]                |
|  Depois peca o material: "gere um banner"                     |
+---------------------------------------------------------------+
"""


def chat_loop():
    print(BANNER)
    historico        = []
    contexto_produto = ""
    system           = get_system_prompt()

    while True:
        try:
            entrada = input("Voce: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nAte logo!")
            break

        if not entrada:
            continue

        # Comandos especiais
        if entrada.lower() in ("/sair", "sair", "exit", "quit"):
            print("Ate logo!")
            break

        if entrada.lower() == "/limpar":
            historico.clear()
            contexto_produto = ""
            print("\n[OK] Conversa reiniciada.\n")
            continue

        if entrada.lower() == "/ajuda":
            print(AJUDA)
            continue

        if entrada.lower() == "/modelo":
            print(f"\n[Modelo] Ollama: {OLLAMA_MODEL} | Base: {OLLAMA_BASE_URL}")
            print(f"  Fallback: Gemini={'OK' if GEMINI_API_KEY else 'nao configurado'}  "
                  f"Claude={'OK' if ANTHROPIC_KEY else 'nao configurado'}  "
                  f"OpenAI={'OK' if OPENAI_KEY else 'nao configurado'}\n")
            continue

        # Registro de contexto
        if entrada.lower().startswith("contexto:"):
            contexto_produto = entrada[9:].strip()
            print("\n[Contexto registrado] Agora me diga o que gerar.\n")
            historico.append({"role": "user",      "content": entrada})
            historico.append({"role": "assistant", "content": "Contexto salvo! Me diga o que gerar."})
            continue

        # Monta mensagem final
        mensagem_final = entrada
        if contexto_produto:
            mensagem_final = f"{entrada}\n\n--- CONTEXTO DO PRODUTO/CAMPANHA ---\n{contexto_produto}"

        # Detecta material e informa formato de saida
        material = detectar_material(entrada)
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

        # Chama o LLM
        t0       = time.time()
        messages = [
            {"role": "system", "content": system},
            *historico[-12:],
            {"role": "user",   "content": mensagem_final},
        ]
        max_tok = 4096 if material else MAX_TOKENS

        try:
            resposta, provider_usado = _chamar_llm(messages, max_tokens=max_tok)
            tempo = time.time() - t0

            print(f"\rBriefFlow ({provider_usado}) [{tempo:.1f}s]:\n")
            print(resposta)
            print()

            # Renderiza e salva no formato correto
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

            # Atualiza historico
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
