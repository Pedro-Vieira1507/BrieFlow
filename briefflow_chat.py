"""
briefflow_chat.py - BriefFlow: Assistente conversacional de marketing B2B.

Tecnologia:
  - Chamada direta ao Ollama via /api/generate (compativel com todos os modelos)
  - Geracao HTML em 2 etapas: diretor criativo (blueprint) + executor HTML (codigo)
  - Zero dependencias de cloud - 100% local e gratuito

Setup:
  1. Instale Ollama: https://ollama.com
  2. Execute: ollama pull gemma3:4b
  3. No .env defina: OLLAMA_MODEL=gemma3:4b
  4. pip install requests python-dotenv
  5. python briefflow_chat.py
"""

from __future__ import annotations

import logging
import os
import re
import webbrowser
from datetime import datetime
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(format="%(asctime)s | %(levelname)s | %(message)s", level=logging.WARNING)
logger = logging.getLogger("briefflow")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
OUTPUT_DIR      = Path(os.getenv("OUTPUT_DIR",    "data/output"))
MAX_TOKENS      = int(os.getenv("MAX_TOKENS",      "1200"))
MAX_TOKENS_BP   = int(os.getenv("MAX_TOKENS_BP",   "600"))   # blueprint - conciso
MAX_TOKENS_HTML = int(os.getenv("MAX_TOKENS_HTML", "2800"))  # html - balanceado
TEMPERATURE     = float(os.getenv("TEMPERATURE",   "0.6"))
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL",         "gemma3:4b").strip()
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL",      "http://localhost:11434").strip().rstrip("/")
OLLAMA_TIMEOUT  = int(os.getenv("OLLAMA_TIMEOUT",   "480"))

# ---------------------------------------------------------------------------
# Dimensoes por tipo de material visual
# ---------------------------------------------------------------------------
DIMENSOES_HTML = {
    "post_visual": {"width": "1080px", "height": "1080px", "desc": "Post Redes Sociais 1:1"},
    "flyer_html":  {"width": "794px",  "height": "1123px", "desc": "Flyer A4 Vertical"},
    "card_html":   {"width": "600px",  "height": "400px",  "desc": "Card de Produto"},
    "banner_html": {"width": "1200px", "height": "400px",  "desc": "Banner Horizontal"},
}

# ---------------------------------------------------------------------------
# System prompt - Chat de texto
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = f"""Voce e o BriefFlow, assistente de marketing B2B para distribuidores de produtos tecnicos.

MATERIAIS DE TEXTO: podcast, slides, ficha_tecnica, email, folheto, post_instagram, post_linkedin, roteiro_video
MATERIAIS VISUAIS HTML: post_visual, flyer_html, card_html, banner_html

REGRAS:
- Gere o conteudo COMPLETO quando solicitado.
- Apos gerar, pergunte se o usuario quer salvar.
- Se faltar contexto, faca UMA pergunta.
- Responda SEMPRE em portugues pt-BR.
- Limite: {MAX_TOKENS} tokens."""

# ---------------------------------------------------------------------------
# Etapa 1 - Diretor Criativo (Blueprint conciso)
# ---------------------------------------------------------------------------
PROMPT_DIRETOR = """Voce e um Diretor Criativo Senior. Planeje o design de um material grafico B2B.
Seja CONCISO e DIRETO. Gere apenas o blueprint estruturado abaixo.

[CONCEITO] Uma frase do conceito criativo.
[PALETA] fundo: #hex | destaque: #hex | texto: #hex | acento: #hex
[TIPOGRAFIA] titulo: Npx/peso/cor | subtitulo: Npx/peso/cor | corpo: Npx/cor
[LAYOUT] Descreva em 3-5 linhas o grid e composicao visual das secoes.
[COMPONENTES] Liste 4-6 elementos visuais (badge, CTA, card, faixa, icone CSS).
[HIERARQUIA] O que o olho ve primeiro, segundo, terceiro.
"""

def _prompt_diretor(tipo: str, briefing: str) -> str:
    dim = DIMENSOES_HTML.get(tipo, DIMENSOES_HTML["flyer_html"])
    return (
        f"{PROMPT_DIRETOR}"
        f"MATERIAL: {dim['desc']} | CANVAS: {dim['width']} x {dim['height']}\n"
        f"BRIEFING: {briefing}\n\n"
        "Blueprint criativo conciso:"
    )

# ---------------------------------------------------------------------------
# Etapa 2 - Executor HTML (usa o blueprint)
# ---------------------------------------------------------------------------
PROMPT_EXECUTOR = """Voce e um dev front-end especialista em HTML/CSS para marketing.
Converta o blueprint em HTML completo autocontido. Seja eficiente no codigo.

REGRAS:
1. Retorne SOMENTE o HTML. Sem explicacoes ou markdown.
2. Comece com <!DOCTYPE html> e termine com </html>.
3. CSS apenas em <style>. Sem libs externas.
4. Siga o blueprint: paleta, layout, tipografia, componentes.
5. Visual rico: gradientes suaves, sombras, border-radius moderno.
6. Canvas centralizado na pagina com fundo externo #e8ecf0.
7. Texto em portugues pt-BR.
8. Codigo CSS compacto (sem comentarios desnecessarios).

PROIBIDO: layout simples, colunas de texto seco, visual amador, bordas pesadas.
"""

def _prompt_executor(tipo: str, briefing: str, blueprint: str) -> str:
    dim = DIMENSOES_HTML.get(tipo, DIMENSOES_HTML["flyer_html"])
    return (
        f"{PROMPT_EXECUTOR}"
        f"MATERIAL: {dim['desc']} | CANVAS: {dim['width']} x {dim['height']}\n"
        f"BRIEFING: {briefing}\n"
        f"BLUEPRINT:\n{blueprint}\n\n"
        "HTML completo (comece com <!DOCTYPE html>):"
    )

# ---------------------------------------------------------------------------
# Historico e estado
# ---------------------------------------------------------------------------
_historico: list[tuple[str, str]] = []
_ultimo_material: dict = {"conteudo": "", "tipo": "", "html": False}

def _montar_prompt(entrada: str) -> str:
    partes = [SYSTEM_PROMPT, ""]
    for user_msg, assistant_msg in _historico[-6:]:
        partes.append(f"Usuario: {user_msg}")
        partes.append(f"BriefFlow: {assistant_msg}")
        partes.append("")
    partes.append(f"Usuario: {entrada}")
    partes.append("BriefFlow:")
    return "\n".join(partes)

# ---------------------------------------------------------------------------
# Gatilhos visuais
# ---------------------------------------------------------------------------
_GATILHOS_VISUAIS = {
    "post_visual": ["post visual", "post grafico", "post para instagram", "post para redes",
                    "imagem de post", "arte para", "crie um post", "gere um post"],
    "flyer_html":  ["flyer", "panfleto", "folheto visual", "crie um flyer", "gere um flyer",
                    "material grafico", "layout grafico"],
    "card_html":   ["card de produto", "card html", "cartao de produto", "crie um card"],
    "banner_html": ["banner", "banner html", "crie um banner", "gere um banner"],
}

def _detectar_tipo_visual(texto: str) -> str | None:
    t = texto.lower()
    for tipo, gatilhos in _GATILHOS_VISUAIS.items():
        if any(g in t for g in gatilhos):
            return tipo
    return None

# ---------------------------------------------------------------------------
# Verificacao Ollama
# ---------------------------------------------------------------------------
def _verificar_ollama() -> None:
    try:
        r = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=4)
        r.raise_for_status()
        modelos = [m["name"].split(":")[0] for m in r.json().get("models", [])]
        base = OLLAMA_MODEL.split(":")[0]
        if modelos and base not in modelos:
            print(
                f"\n[AVISO] Modelo '{OLLAMA_MODEL}' nao encontrado.\n"
                f"  Disponiveis: {', '.join(modelos)}\n"
                f"  Instalar: ollama pull {OLLAMA_MODEL}\n"
            )
    except requests.exceptions.ConnectionError:
        print(f"\n[ERRO] Ollama nao esta rodando em {OLLAMA_BASE_URL}\n  Execute: ollama serve\n")
        raise SystemExit(1)
    except Exception as e:
        print(f"\n[ERRO] Falha ao verificar Ollama: {e}\n")
        raise SystemExit(1)

# ---------------------------------------------------------------------------
# Chamada ao Ollama
# ---------------------------------------------------------------------------
def _chamar_ollama(prompt: str, max_tokens: int) -> str:
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": TEMPERATURE,
            "num_predict": max_tokens,
            "stop": ["\nUsuario:", "\nVoce:"],
        },
    }
    try:
        resp = requests.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload, timeout=OLLAMA_TIMEOUT)
        resp.raise_for_status()
    except requests.exceptions.ConnectionError:
        raise RuntimeError("Ollama parou. Execute 'ollama serve' em outro terminal.")
    except requests.exceptions.Timeout:
        raise RuntimeError(
            f"Ollama nao respondeu em {OLLAMA_TIMEOUT}s.\n"
            "Dica: reduza MAX_TOKENS_HTML no .env (ex: MAX_TOKENS_HTML=2000) para gerar mais rapido."
        )
    except requests.exceptions.HTTPError as e:
        status = e.response.status_code if e.response is not None else "?"
        corpo  = e.response.text[:300] if e.response is not None else ""
        raise RuntimeError(f"Erro {status} do Ollama.\n{corpo}")
    conteudo = resp.json().get("response", "").strip()
    if not conteudo:
        raise RuntimeError("Ollama retornou resposta vazia. Tente novamente.")
    return conteudo

def _chamar_ollama_texto(entrada: str) -> str:
    conteudo = _chamar_ollama(_montar_prompt(entrada), MAX_TOKENS)
    _historico.append((entrada, conteudo))
    if len(conteudo) > 300:
        _ultimo_material["conteudo"] = conteudo
        _ultimo_material["html"] = False
        tipo = _detectar_tipo_texto(entrada)
        if tipo:
            _ultimo_material["tipo"] = tipo
    return conteudo

def _chamar_ollama_html_2etapas(tipo: str, briefing: str) -> tuple[str, str]:
    """Etapa 1: blueprint. Etapa 2: HTML final."""
    print("  [1/2] Diretor Criativo planejando o design...", flush=True)
    blueprint = _chamar_ollama(_prompt_diretor(tipo, briefing), MAX_TOKENS_BP)

    print("  [2/2] Executor HTML gerando o layout premium...", flush=True)
    raw_html = _chamar_ollama(_prompt_executor(tipo, briefing, blueprint), MAX_TOKENS_HTML)
    html = _extrair_html(raw_html)

    _ultimo_material["conteudo"] = html
    _ultimo_material["tipo"] = tipo
    _ultimo_material["html"] = True
    return blueprint, html

def _extrair_html(texto: str) -> str:
    m = re.search(r"```(?:html)?\s*([\s\S]+?)```", texto, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    m = re.search(r"(<!DOCTYPE[\s\S]+</html>)", texto, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return texto.strip()

# ---------------------------------------------------------------------------
# Salvar
# ---------------------------------------------------------------------------
def _salvar_material(conteudo: str, nome_arquivo: str = "") -> str:
    if not conteudo or not conteudo.strip():
        return "[ERRO] Nenhum conteudo para salvar."
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ts      = datetime.now().strftime("%Y%m%d_%H%M%S")
    tipo    = _ultimo_material.get("tipo") or "material"
    eh_html = _ultimo_material.get("html", False)
    if not nome_arquivo.strip():
        ext = ".html" if eh_html else ".txt"
        nome_arquivo = f"{tipo}_{ts}{ext}"
    else:
        if eh_html and not nome_arquivo.endswith(".html"):
            nome_arquivo = re.sub(r"\.txt$", "", nome_arquivo) + ".html"
        elif not eh_html and not nome_arquivo.endswith(".txt"):
            nome_arquivo += ".txt"
    path = OUTPUT_DIR / nome_arquivo
    try:
        path.write_text(conteudo.strip() + "\n", encoding="utf-8")
        resultado = f"[OK] Salvo em: {path}"
        if eh_html:
            resultado += "\n[HTML] Abrindo no navegador..."
            webbrowser.open(path.resolve().as_uri())
        return resultado
    except OSError as e:
        return f"[ERRO] Nao foi possivel salvar: {e}"

def _salvar_blueprint(blueprint: str, tipo: str) -> None:
    try:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        ts   = datetime.now().strftime("%Y%m%d_%H%M%S")
        path = OUTPUT_DIR / f"blueprint_{tipo}_{ts}.txt"
        path.write_text(blueprint.strip() + "\n", encoding="utf-8")
    except OSError:
        pass

def _listar_materiais() -> str:
    if not OUTPUT_DIR.exists():
        return "Nenhum material salvo ainda."
    arquivos = sorted(OUTPUT_DIR.rglob("*"))
    arquivos = [a for a in arquivos if a.suffix in (".txt", ".html") and a.is_file()]
    if not arquivos:
        return "Nenhum arquivo encontrado em data/output/."
    linhas = []
    for a in arquivos:
        stat  = a.stat()
        data  = datetime.fromtimestamp(stat.st_mtime).strftime("%d/%m %H:%M")
        kb    = max(1, stat.st_size // 1024)
        icone = "🌐" if a.suffix == ".html" else "📄"
        linhas.append(f"  {icone} {a.relative_to(OUTPUT_DIR)}  ({kb} KB | {data})")
    return f"Materiais salvos ({len(arquivos)}):\n" + "\n".join(linhas)

def _detectar_tipo_texto(texto: str) -> str:
    texto = texto.lower()
    mapa = {
        "podcast":        ["podcast"],
        "slides":         ["slide", "apresentacao", "capacitacao"],
        "ficha_tecnica":  ["ficha", "especificacao"],
        "email":          ["email", "e-mail"],
        "folheto":        ["folheto"],
        "post_instagram": ["instagram"],
        "post_linkedin":  ["linkedin"],
        "roteiro_video":  ["video", "reels"],
    }
    for tipo, palavras in mapa.items():
        if any(p in texto for p in palavras):
            return tipo
    return ""

def _usuario_quer_salvar(entrada: str) -> bool:
    return any(g in entrada.lower() for g in ["sim", "salvar", "salva", "salve", "save", "gravar"])

def _extrair_nome_arquivo(entrada: str) -> str:
    for p in entrada.split():
        if len(p) > 4 and ("." in p or "_" in p):
            return p
    return ""

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------
def _banner() -> str:
    linhas = [
        "+" + "=" * 60 + "+",
        "|{:^60}|".format("BriefFlow - Assistente de Marketing B2B"),
        "|{:^60}|".format(f"Modelo: {OLLAMA_MODEL}  |  100% local"),
        "|{:^60}|".format("HTML em 2 etapas: Diretor Criativo + Executor HTML"),
        "+" + "=" * 60 + "+",
        "",
        "Materiais de TEXTO:",
        "  > Crie um podcast sobre a linha DLAB de lubrificantes",
        "  > Emails para a campanha Compre 3 Leve 4 com urgencia",
        "  > 3 posts de Instagram sobre pipetas sorologicas",
        "",
        "Materiais VISUAIS premium (HTML em 2 etapas):",
        "  > Crie um flyer da oferta Compre 3 Leve 4 Kasvi",
        "  > Gere um post visual moderno sobre auxiliar de pipetagem",
        "  > Crie um card de produto para micropipeta DLAB",
        "  > Gere um banner profissional da Forlab Express",
        "",
        "  > Liste os materiais ja salvos",
        "",
        "Dica: se travar, reduza MAX_TOKENS_HTML=2000 no .env",
        "Digite 'sair' para encerrar.",
    ]
    return "\n".join(linhas)

# ---------------------------------------------------------------------------
# Loop principal
# ---------------------------------------------------------------------------
def main() -> None:
    _verificar_ollama()
    print(_banner())
    aguardando_salvamento = False

    while True:
        try:
            entrada = input("\nVoce: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nEncerrando. Ate mais!")
            break

        if not entrada:
            continue
        if entrada.lower() in {"sair", "exit", "quit", "q"}:
            print("\nEncerrando o BriefFlow. Ate mais!")
            break

        if any(k in entrada.lower() for k in ("liste", "listar materiais", "o que foi salvo")):
            print(f"\nBriefFlow: {_listar_materiais()}")
            continue

        if aguardando_salvamento and _usuario_quer_salvar(entrada):
            nome     = _extrair_nome_arquivo(entrada)
            conteudo = _ultimo_material.get("conteudo", "")
            if conteudo:
                print(f"\nBriefFlow: {_salvar_material(conteudo, nome)}")
            else:
                print("\nBriefFlow: Nao ha material recente para salvar.")
            aguardando_salvamento = False
            continue

        tipo_visual = _detectar_tipo_visual(entrada)
        print("\nBriefFlow: ", end="", flush=True)

        try:
            if tipo_visual:
                dim = DIMENSOES_HTML[tipo_visual]
                print(f"Gerando {dim['desc']} em 2 etapas (aguarde ~2 min)...")
                blueprint, html = _chamar_ollama_html_2etapas(tipo_visual, entrada)
                _salvar_blueprint(blueprint, tipo_visual)
                ts        = datetime.now().strftime("%Y%m%d_%H%M%S")
                resultado = _salvar_material(html, f"{tipo_visual}_{ts}.html")
                print(resultado)
                print("\nDescreva ajustes para refinar a arte, ou 'sair' para encerrar.")
                aguardando_salvamento = False
            else:
                resposta = _chamar_ollama_texto(entrada)
                print(resposta)
                aguardando_salvamento = any(
                    k in resposta.lower()
                    for k in ("quer salvar", "deseja salvar", "salvar este", "salvar o material")
                )
        except RuntimeError as e:
            print(f"\n[ERRO] {e}")
        except Exception as e:
            logger.exception("Erro inesperado")
            print(f"\n[ERRO] {e}")

if __name__ == "__main__":
    main()
