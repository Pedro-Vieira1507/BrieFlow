import os
import re
import json
import logging
import time
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
load_dotenv()

import litellm

# ── Configurações ─────────────────────────────────────────────────────────────
OUTPUT_DIR   = Path(os.getenv("OUTPUT_DIR", "data/output"))
MAX_TOKENS   = int(os.getenv("MAX_TOKENS",   "1200"))
TEMPERATURE  = float(os.getenv("TEMPERATURE", "0.6"))

# ── Modelos por provider ───────────────────────────────────────────────────────
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL",    "llama3")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
GEMINI_API_KEY  = os.getenv("GEMINI_API_KEY",  "")
GEMINI_MODEL    = os.getenv("GEMINI_MODEL",    "gemini-2.5-flash")
ANTHROPIC_KEY   = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-3-5-haiku-20241022")
OPENAI_KEY      = os.getenv("OPENAI_API_KEY",  "")
OPENAI_MODEL    = os.getenv("OPENAI_MODEL",    "gpt-4o-mini")

# ── Logger ─────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.WARNING,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ── System prompt (cache em memória) ──────────────────────────────────────────
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
            "Você é o BriefFlow, um agente de marketing conversacional premium. "
            "Responda às perguntas do usuário de forma direta e gere o conteúdo "
            "solicitado com qualidade de agência. Gere SOMENTE o que for pedido."
        )
    return _system_prompt_cache


# ──────────────────────────────────────────────────────────────────────────────
# Seletor de provider com fallback automático
# Ordem: Ollama → Gemini → Anthropic → OpenAI
# ──────────────────────────────────────────────────────────────────────────────

def _chamar_llm(messages: list, max_tokens: int = MAX_TOKENS) -> tuple:
    """
    Tenta Ollama -> Gemini -> Anthropic -> OpenAI nessa ordem.
    Retorna (texto_gerado, nome_provider) ou lança RuntimeError.
    """
    providers = []

    # 1. Ollama (local, sempre tenta primeiro)
    providers.append({
        "nome": f"Ollama/{OLLAMA_MODEL}",
        "model": f"ollama/{OLLAMA_MODEL}",
        "api_key": "ollama",
        "api_base": OLLAMA_BASE_URL,
    })

    # 2. Gemini
    if GEMINI_API_KEY:
        providers.append({
            "nome": f"Gemini/{GEMINI_MODEL}",
            "model": f"gemini/{GEMINI_MODEL}",
            "api_key": GEMINI_API_KEY,
            "api_base": None,
        })

    # 3. Anthropic
    if ANTHROPIC_KEY:
        providers.append({
            "nome": f"Claude/{ANTHROPIC_MODEL}",
            "model": ANTHROPIC_MODEL,
            "api_key": ANTHROPIC_KEY,
            "api_base": None,
        })

    # 4. OpenAI
    if OPENAI_KEY:
        providers.append({
            "nome": f"OpenAI/{OPENAI_MODEL}",
            "model": OPENAI_MODEL,
            "api_key": OPENAI_KEY,
            "api_base": None,
        })

    ultimo_erro = None
    for p in providers:
        try:
            kwargs = dict(
                model=p["model"],
                messages=messages,
                max_tokens=max_tokens,
                temperature=TEMPERATURE,
                api_key=p["api_key"],
                timeout=120,
            )
            if p["api_base"]:
                kwargs["api_base"] = p["api_base"]

            resposta = litellm.completion(**kwargs)
            return resposta.choices[0].message.content.strip(), p["nome"]

        except Exception as e:
            ultimo_erro = e
            logger.warning("Falha em %s: %s — tentando próximo provider.", p["nome"], e)
            continue

    raise RuntimeError(
        f"Todos os providers falharam. Último erro: {ultimo_erro}\n"
        "► Verifique se o Ollama está rodando: ollama serve\n"
        "► Ou configure uma API key no .env (GEMINI_API_KEY, ANTHROPIC_API_KEY ou OPENAI_API_KEY)"
    )


# ──────────────────────────────────────────────────────────────────────────────
# Detector de intenção — qual material gerar
# ──────────────────────────────────────────────────────────────────────────────

MATERIAL_MAP = {
    "banner":         "banner HTML profissional (hero com gradiente, headline bold, CTA)",
    "ficha tecnica":  "ficha técnica HTML completa (hero + stats bar + specs + tabela + rodapé)",
    "ficha":          "ficha técnica HTML completa (hero + stats bar + specs + tabela + rodapé)",
    "post linkedin":  "carrossel LinkedIn 6 slides (copy + briefing visual por slide)",
    "linkedin":       "carrossel LinkedIn 6 slides (copy + briefing visual por slide)",
    "post instagram": "post Instagram feed 1080x1080 (legenda + hashtags + briefing visual)",
    "instagram":      "post Instagram feed 1080x1080 (legenda + hashtags + briefing visual)",
    "stories":        "sequência de 3 Instagram Stories (dor→solução→CTA + briefing)",
    "reels":          "roteiro Reels/TikTok 60s cena a cena com timecodes",
    "tiktok":         "roteiro Reels/TikTok 60s cena a cena com timecodes",
    "email":          "e-mail marketing HTML completo responsivo (Gmail + Outlook)",
    "e-mail":         "e-mail marketing HTML completo responsivo (Gmail + Outlook)",
    "google ads":     "3 variações de anúncio Google Ads RSA (headlines + descriptions + extensões)",
    "meta ads":       "3 variações de anúncio Meta Ads (feed + stories + reels copy)",
    "proposta":       "one-pager proposta comercial para WhatsApp/e-mail de vendas",
    "one pager":      "one-pager proposta comercial para WhatsApp/e-mail de vendas",
    "whatsapp":       "script de abordagem comercial para WhatsApp",
    "script":         "script de abordagem comercial para WhatsApp",
    "card":           "card de produto HTML responsivo com foto, specs e CTA",
    "landing page":   "landing page HTML completa com hero, benefícios, prova social e CTA",
}


def detectar_material(mensagem: str) -> Optional[tuple]:
    """Retorna (chave, descricao) se detectar intenção de gerar material, senão None."""
    msg_lower = mensagem.lower()
    verbos = ["gere", "crie", "cria", "faça", "faz", "gera", "monte", "monta", "escreva", "escreve", "produz"]
    tem_verbo = any(v in msg_lower for v in verbos)
    for chave, descricao in MATERIAL_MAP.items():
        if chave in msg_lower:
            return chave, descricao
    return None


def salvar_output(conteudo: str, nome: str) -> str:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    ext = ".html" if ("<!DOCTYPE" in conteudo or "<html" in conteudo.lower()) else ".txt"
    path = OUTPUT_DIR / f"{nome}_{timestamp}{ext}"
    path.write_text(conteudo, encoding="utf-8")
    return str(path)


# ──────────────────────────────────────────────────────────────────────────────
# Chat interativo — a IA responde E gera conteúdo
# ──────────────────────────────────────────────────────────────────────────────

BANNER = """
╔══════════════════════════════════════════════════════════════╗
║            BriefFlow ✦ Agente de Marketing                   ║
║  Powered by Ollama (local) + fallback Gemini/Claude/OpenAI   ║
╚══════════════════════════════════════════════════════════════╝

Como usar:
  • Converse normalmente — pergunte, peça ideias, tire dúvidas.
  • Para gerar conteúdo: "crie um banner para o produto X"
  • Para passar contexto: "contexto: [cole aqui dados do produto]"
  • Comandos: /ajuda  /modelo  /limpar  /sair

Exemplos rápidos:
  › gere um banner para pipetas sorológicas Kasvi
  › crie um post instagram sobre promoção de fim de ano
  › escreva um script whatsapp para vender microscópios
  › quais formatos de conteúdo você consegue criar?
"""

AJUDA = """
┌─ Comandos ──────────────────────────────────────────────────┐
│  /ajuda   → exibe este menu                                 │
│  /modelo  → mostra provider ativo e fallbacks               │
│  /limpar  → reinicia conversa (limpa histórico)             │
│  /sair    → encerra o BriefFlow                             │
├─ Materiais que posso gerar ─────────────────────────────────┤
│  banner · ficha técnica · card · landing page · e-mail      │
│  post instagram · stories · reels · linkedin                │
│  google ads · meta ads · script whatsapp · proposta         │
├─ Como passar contexto ──────────────────────────────────────┤
│  contexto: [nome do produto, specs, público-alvo, oferta]   │
│  Depois peça o material: "gere um banner"                   │
└─────────────────────────────────────────────────────────────┘
"""


def chat_loop():
    print(BANNER)

    historico = []         # histórico da conversa
    contexto_produto = ""  # contexto extra do usuário
    system = get_system_prompt()

    while True:
        try:
            entrada = input("Você: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nAté logo! ✦")
            break

        if not entrada:
            continue

        # ── Comandos especiais ────────────────────────────────────────────────
        if entrada.lower() in ("/sair", "sair", "exit", "quit"):
            print("Até logo! ✦")
            break

        if entrada.lower() == "/limpar":
            historico.clear()
            contexto_produto = ""
            print("\n✓ Conversa reiniciada.\n")
            continue

        if entrada.lower() == "/ajuda":
            print(AJUDA)
            continue

        if entrada.lower() == "/modelo":
            print(f"\n🔧 Ollama ativo: {OLLAMA_MODEL} | Base: {OLLAMA_BASE_URL}")
            print(f"   Fallback: "
                  f"Gemini={'✓' if GEMINI_API_KEY else '✗'}  "
                  f"Claude={'✓' if ANTHROPIC_KEY else '✗'}  "
                  f"OpenAI={'✓' if OPENAI_KEY else '✗'}\n")
            continue

        # ── Registro de contexto de produto ───────────────────────────────────
        if entrada.lower().startswith("contexto:"):
            contexto_produto = entrada[9:].strip()
            print("\n📎 Contexto registrado! Agora me diga o que gerar.\n")
            historico.append({"role": "user",      "content": entrada})
            historico.append({"role": "assistant", "content": "Contexto salvo! Me diga agora o que você precisa gerar com essas informações."})
            continue

        # ── Monta mensagem final com contexto se houver ───────────────────────
        mensagem_final = entrada
        if contexto_produto:
            mensagem_final = (
                f"{entrada}\n\n"
                f"--- CONTEXTO DO PRODUTO/CAMPANHA ---\n{contexto_produto}"
            )

        # ── Detecta se é pedido de geração de material ────────────────────────
        material = detectar_material(entrada)
        if material:
            chave, descricao = material
            mensagem_final += (
                f"\n\nIMPORTANTE: Gere APENAS {descricao}. "
                f"Entregue o conteúdo completo diretamente, sem explicações introdutórias."
            )

        # ── Chama o LLM ───────────────────────────────────────────────────────
        print("\n⏳ ", end="", flush=True)
        t0 = time.time()

        messages = [
            {"role": "system", "content": system},
            *historico[-12:],  # janela de contexto: últimas 12 trocas
            {"role": "user",   "content": mensagem_final},
        ]

        # Mais tokens para materiais de geração
        max_tok = 4096 if material else MAX_TOKENS

        try:
            resposta, provider_usado = _chamar_llm(messages, max_tokens=max_tok)
            tempo = time.time() - t0

            # ── Exibe resposta ─────────────────────────────────────────────────
            print(f"\rBriefFlow ({provider_usado}) [{tempo:.1f}s]:\n")
            print(resposta)
            print()

            # ── Salva automaticamente se for material ──────────────────────────
            if material:
                caminho = salvar_output(resposta, chave)
                print(f"💾 Salvo em: {caminho}\n")

            # ── Atualiza histórico ─────────────────────────────────────────────
            historico.append({"role": "user",      "content": entrada})
            historico.append({"role": "assistant", "content": resposta})

            # Limita histórico a 20 mensagens para não estourar contexto
            if len(historico) > 20:
                historico = historico[-20:]

        except RuntimeError as e:
            print(f"\r❌ {e}\n")
        except Exception as e:
            print(f"\r❌ Erro inesperado: {e}\n")
            logger.exception("Erro no chat loop")


# ──────────────────────────────────────────────────────────────────────────────
# Entrypoint
# ──────────────────────────────────────────────────────────────────────────────

def main():
    chat_loop()


if __name__ == "__main__":
    main()
