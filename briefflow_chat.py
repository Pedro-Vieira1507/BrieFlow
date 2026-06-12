"""
briefflow_chat.py - BriefFlow: Assistente conversacional de marketing B2B.

Tecnologia:
  - Chamada direta ao Ollama via /api/generate (compativel com todos os modelos)
  - Historico de conversa montado manualmente no prompt
  - Geracao de HTML visual: post_visual, flyer_html, card_html, banner_html
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

logging.basicConfig(
    format="%(asctime)s | %(levelname)s | %(message)s",
    level=logging.WARNING,
)
logger = logging.getLogger("briefflow")

OUTPUT_DIR      = Path(os.getenv("OUTPUT_DIR",   "data/output"))
MAX_TOKENS      = int(os.getenv("MAX_TOKENS",     "1200"))
MAX_TOKENS_HTML = int(os.getenv("MAX_TOKENS_HTML", "4200"))
TEMPERATURE     = float(os.getenv("TEMPERATURE",  "0.65"))
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL",        "gemma3:4b").strip()
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL",     "http://localhost:11434").strip().rstrip("/")
OLLAMA_TIMEOUT  = int(os.getenv("OLLAMA_TIMEOUT",  "300"))

SYSTEM_PROMPT = f"""Voce e o BriefFlow, assistente especializado em criar materiais de marketing B2B \
para revendedores e distribuidores de produtos tecnicos (laboratorio, industrial, hidraulica, etc).

MATERIAIS DE TEXTO QUE VOCE CRIA:
  podcast         - Roteiro de podcast de 5 minutos
  slides          - 10 slides de capacitacao tecnica
  ficha_tecnica   - Ficha com specs e argumentos para vendedores
  email           - 2 emails (apresentacao + oferta com urgencia)
  folheto         - Texto de folheto A4 em 3 paineis
  post_instagram  - 3 posts com legenda e hashtags
  post_linkedin   - 2 posts B2B profissionais
  roteiro_video   - Roteiro de video de 60-90 segundos

MATERIAIS VISUAIS (HTML) QUE VOCE CRIA:
  post_visual     - Post para redes sociais (quadrado 1080x1080)
  flyer_html      - Flyer/panfleto promocional (A4 vertical)
  card_html       - Card de produto para catalogo digital
  banner_html     - Banner horizontal para site ou email

REGRAS:
- Gere o conteudo COMPLETO e formatado quando solicitado.
- Apos gerar, pergunte se o usuario quer salvar o material.
- Se faltar contexto, faca UMA pergunta objetiva.
- Responda SEMPRE em portugues pt-BR, de forma direta e amigavel.
- Limite por resposta: {MAX_TOKENS} tokens."""

SYSTEM_PROMPT_HTML = """Voce e um diretor de arte senior, designer de interface premium e especialista em materiais graficos B2B modernos.
Sua tarefa e gerar um arquivo HTML completo e autocontido com CSS embutido, com aparencia PROFISSIONAL, MODERNA, SOFISTICADA e visual de agencia especialista.

OBJETIVO VISUAL:
- O material deve parecer criado por um designer senior, nao por iniciante.
- O layout deve ter acabamento premium, visual limpo, elegante, moderno e comercialmente forte.
- Pense como uma mistura de design corporativo premium + marketing de alta conversao.

REGRAS OBRIGATORIAS:
1. Retorne SOMENTE o codigo HTML, sem explicacoes, sem markdown e sem comentarios fora do HTML.
2. O HTML deve comecar com <!DOCTYPE html> e terminar com </html>.
3. Use apenas HTML + CSS em <style>, sem bibliotecas externas.
4. O layout deve ficar visualmente pronto para apresentar ao cliente.
5. Todo o texto deve estar em portugues pt-BR.
6. O design precisa usar hierarquia forte, composicao profissional e acabamento refinado.

DIRECAO DE ARTE OBRIGATORIA:
- Fundo sofisticado com degradês suaves, blocos bem definidos ou composicao corporativa premium.
- Tipografia elegante com hierarquia clara: titulo muito forte, subtitulo refinado, blocos bem organizados.
- Use espacamento generoso, grid limpo e alinhamento consistente.
- Crie profundidade com sombras suaves, bordas leves, cards premium e contrastes equilibrados.
- Destaque visual forte para oferta, CTA, diferenciais e beneficios.
- O material deve ter cara de campanha profissional e nao de documento simples.
- Evite visual escolar, basico, quadrado ou apenas texto em caixas simples.
- Use selo, faixa promocional, bloco de destaque, callout visual ou box de autoridade quando fizer sentido.

IDENTIDADE VISUAL PADRAO:
- Azul profundo: #163a63
- Azul secundario: #214f86
- Laranja destaque: #f28c28
- Branco: #ffffff
- Cinza claro sofisticado: #f4f7fb
- Texto escuro: #102030

ELEMENTOS VISUAIS QUE DEVEM SER PRIORIZADOS:
- Hero principal impactante
- Cards ou blocos com acabamento premium
- CTA forte e bem desenhado
- Bloco de oferta com grande destaque visual
- Lista de beneficios com icones simples em CSS ou bullets estilizados
- Rodape elegante quando fizer sentido

REGRAS DE QUALIDADE:
- Nao entregar HTML minimalista demais.
- Nao usar apenas uma coluna de texto seco.
- Nao deixar tudo centralizado sem criterio.
- Nao gerar cara de template amador.
- Nao usar bordas pesadas e feias.
- Nao usar combinacoes pobres de cores.
- Nao deixar o layout vazio.
- Se o briefing tiver poucos dados, valorize o visual e a composicao.

ESTRUTURA TECNICA:
- Centralize o material na pagina com fundo externo neutro.
- Crie um container principal com dimensao exata do material.
- Use border-radius moderno e sombra profissional.
- Pode usar pseudo-elementos visuais via CSS, gradientes, overlays, linhas suaves e pads elegantes.
- Garanta boa legibilidade.

IMPORTANTE:
Se houver oferta, ela deve parecer campanha promocional premium.
Se houver produto tecnico, o layout deve equilibrar sofisticacao visual + clareza comercial.
Se houver marca, valorize a marca como elemento de confianca.
"""

DIMENSOES_HTML = {
    "post_visual":  {"width": "1080px", "height": "1080px", "desc": "Post Redes Sociais 1:1"},
    "flyer_html":   {"width": "794px",  "height": "1123px", "desc": "Flyer A4 Vertical"},
    "card_html":    {"width": "600px",  "height": "400px",  "desc": "Card de Produto"},
    "banner_html":  {"width": "1200px", "height": "400px",  "desc": "Banner Horizontal"},
}

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


def _montar_prompt_html(tipo: str, briefing: str) -> str:
    dim = DIMENSOES_HTML.get(tipo, DIMENSOES_HTML["flyer_html"])
    return (
        f"{SYSTEM_PROMPT_HTML}\n\n"
        f"TIPO DE MATERIAL: {dim['desc']}\n"
        f"DIMENSOES EXATAS DO CANVAS: {dim['width']} x {dim['height']}\n"
        f"BRIEFING DO USUARIO:\n{briefing}\n\n"
        "INSTRUCOES FINAIS DE EXECUCAO:\n"
        "- Gere um layout visualmente rico, moderno e com acabamento premium.\n"
        "- Crie composicao de alto nivel, com contraste, destaque e senso de direcao de arte.\n"
        "- Organize o conteudo com cara de peca publicitaria profissional.\n"
        "- Entregue o HTML completo agora.\n"
    )


_GATILHOS_VISUAIS = {
    "post_visual":  ["post visual", "post grafico", "post para instagram", "post para redes", "imagem de post", "arte para", "crie um post", "gere um post"],
    "flyer_html":   ["flyer", "panfleto", "folheto visual", "flyer html", "crie um flyer", "gere um flyer", "material grafico", "layout grafico"],
    "card_html":    ["card de produto", "card html", "cartao de produto", "crie um card"],
    "banner_html":  ["banner", "banner html", "crie um banner", "gere um banner"],
}


def _detectar_tipo_visual(texto: str) -> str | None:
    t = texto.lower()
    for tipo, gatilhos in _GATILHOS_VISUAIS.items():
        if any(g in t for g in gatilhos):
            return tipo
    return None


def _verificar_ollama() -> None:
    try:
        r = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=4)
        r.raise_for_status()
        modelos_instalados = [m["name"].split(":")[0] for m in r.json().get("models", [])]
        modelo_base = OLLAMA_MODEL.split(":")[0]
        if modelos_instalados and modelo_base not in modelos_instalados:
            print(
                f"\n[AVISO] Modelo '{OLLAMA_MODEL}' nao encontrado.\n"
                f"  Modelos disponiveis: {', '.join(modelos_instalados)}\n"
                f"  Para instalar: ollama pull {OLLAMA_MODEL}\n"
                f"  Ou troque OLLAMA_MODEL no .env para um dos modelos acima.\n"
            )
    except requests.exceptions.ConnectionError:
        print(
            f"\n[ERRO] Ollama nao esta rodando em {OLLAMA_BASE_URL}\n"
            "  1. Abra outro terminal e execute: ollama serve\n"
            f"  2. Execute novamente: python briefflow_chat.py\n"
        )
        raise SystemExit(1)
    except Exception as e:
        print(f"\n[ERRO] Falha ao verificar Ollama: {e}\n")
        raise SystemExit(1)


def _chamar_ollama(prompt: str, max_tokens: int | None = None) -> str:
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": TEMPERATURE,
            "num_predict": max_tokens or MAX_TOKENS,
            "stop": ["\nUsuario:", "\nVoce:"],
        },
    }
    try:
        resp = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json=payload,
            timeout=OLLAMA_TIMEOUT,
        )
        resp.raise_for_status()
    except requests.exceptions.ConnectionError:
        raise RuntimeError(
            "Ollama parou de responder.\n"
            "Execute 'ollama serve' em outro terminal e tente novamente."
        )
    except requests.exceptions.Timeout:
        raise RuntimeError(
            f"Ollama nao respondeu em {OLLAMA_TIMEOUT}s. O modelo pode estar carregando.\n"
            "Aguarde alguns segundos e tente novamente."
        )
    except requests.exceptions.HTTPError as e:
        status = e.response.status_code if e.response is not None else "?"
        corpo = e.response.text[:300] if e.response is not None else ""
        raise RuntimeError(
            f"Erro {status} do Ollama.\nDetalhe: {corpo}\n"
            f"Verifique se o modelo '{OLLAMA_MODEL}' esta instalado: ollama list"
        )
    conteudo = resp.json().get("response", "").strip()
    if not conteudo:
        raise RuntimeError("Ollama retornou resposta vazia. Tente novamente.")
    return conteudo


def _chamar_ollama_texto(entrada: str) -> str:
    prompt = _montar_prompt(entrada)
    conteudo = _chamar_ollama(prompt, MAX_TOKENS)
    _historico.append((entrada, conteudo))
    if len(conteudo) > 300:
        _ultimo_material["conteudo"] = conteudo
        _ultimo_material["html"] = False
        tipo = _detectar_tipo_texto(entrada)
        if tipo:
            _ultimo_material["tipo"] = tipo
    return conteudo


def _chamar_ollama_html(tipo: str, briefing: str) -> str:
    prompt = _montar_prompt_html(tipo, briefing)
    raw = _chamar_ollama(prompt, MAX_TOKENS_HTML)
    html = _extrair_html(raw)
    _ultimo_material["conteudo"] = html
    _ultimo_material["tipo"] = tipo
    _ultimo_material["html"] = True
    return html


def _extrair_html(texto: str) -> str:
    m = re.search(r"```(?:html)?\s*([\s\S]+?)```", texto, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    m = re.search(r"(<!DOCTYPE[\s\S]+</html>)", texto, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return texto.strip()


def _salvar_material(conteudo: str, nome_arquivo: str = "") -> str:
    if not conteudo or not conteudo.strip():
        return "[ERRO] Nenhum conteudo para salvar."
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    tipo = _ultimo_material.get("tipo") or "material"
    eh_html = _ultimo_material.get("html", False)
    if not nome_arquivo.strip():
        ext = ".html" if eh_html else ".txt"
        nome_arquivo = f"{tipo}_{ts}{ext}"
    else:
        if eh_html and not nome_arquivo.endswith(".html"):
            nome_arquivo = nome_arquivo.rstrip(".txt") + ".html"
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


def _listar_materiais() -> str:
    if not OUTPUT_DIR.exists():
        return "Nenhum material salvo ainda."
    arquivos = sorted(OUTPUT_DIR.rglob("*"))
    arquivos = [a for a in arquivos if a.suffix in (".txt", ".html") and a.is_file()]
    if not arquivos:
        return "Nenhum arquivo encontrado em data/output/."
    linhas = []
    for a in arquivos:
        stat = a.stat()
        data = datetime.fromtimestamp(stat.st_mtime).strftime("%d/%m %H:%M")
        kb = max(1, stat.st_size // 1024)
        icone = "🌐" if a.suffix == ".html" else "📄"
        linhas.append(f"  {icone} {a.relative_to(OUTPUT_DIR)}  ({kb} KB | {data})")
    return f"Materiais salvos ({len(arquivos)}):\n" + "\n".join(linhas)


def _detectar_tipo_texto(texto: str) -> str:
    texto = texto.lower()
    mapa = {
        "podcast": ["podcast"],
        "slides": ["slide", "apresentacao", "capacitacao"],
        "ficha_tecnica": ["ficha", "especificacao"],
        "email": ["email", "e-mail"],
        "folheto": ["folheto"],
        "post_instagram": ["instagram"],
        "post_linkedin": ["linkedin"],
        "roteiro_video": ["video", "reels"],
    }
    for tipo, palavras in mapa.items():
        if any(p in texto for p in palavras):
            return tipo
    return ""


def _usuario_quer_salvar(entrada: str) -> bool:
    return any(g in entrada.lower() for g in ["sim", "salvar", "salva", "salve", "save", "gravar"])


def _extrair_nome_arquivo(entrada: str) -> str:
    for p in entrada.split():
        if (len(p) > 4) and ("." in p or "_" in p):
            return p
    return ""


def _banner() -> str:
    linhas = [
        "+" + "=" * 57 + "+",
        "|{:^57}|".format("BriefFlow - Assistente de Marketing B2B"),
        "|{:^57}|".format(f"Modelo: {OLLAMA_MODEL}  |  100% local"),
        "|{:^57}|".format(f"Limite: {MAX_TOKENS} tokens  |  Temp: {TEMPERATURE}"),
        "+" + "=" * 57 + "+",
        "",
        "Exemplos de materiais de TEXTO:",
        "  > Crie um podcast sobre a linha DLAB de lubrificantes",
        "  > Emails para a campanha Compre 3 Leve 4 com urgencia",
        "  > 3 posts de Instagram sobre pipetas sorologicas",
        "",
        "Exemplos de materiais VISUAIS (HTML):",
        "  > Crie um flyer premium sobre o auxiliar de pipetagem Kasvi",
        "  > Gere um post visual moderno da campanha Compre 3 Leve 4",
        "  > Crie um card de produto sofisticado para a micropipeta DLAB",
        "  > Gere um banner profissional da Forlab para o site",
        "",
        "  > Liste os materiais ja salvos",
        "",
        "Digite 'sair' para encerrar.",
    ]
    return "\n".join(linhas)


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
            nome = _extrair_nome_arquivo(entrada)
            conteudo = _ultimo_material.get("conteudo", "")
            if conteudo:
                resultado = _salvar_material(conteudo, nome)
                print(f"\nBriefFlow: {resultado}")
            else:
                print("\nBriefFlow: Nao ha material recente para salvar. Gere um primeiro.")
            aguardando_salvamento = False
            continue
        tipo_visual = _detectar_tipo_visual(entrada)
        print("\nBriefFlow: ", end="", flush=True)
        try:
            if tipo_visual:
                dim = DIMENSOES_HTML[tipo_visual]
                print(f"Gerando {dim['desc']} em HTML premium... (pode levar 30-90s)")
                html = _chamar_ollama_html(tipo_visual, entrada)
                ts = datetime.now().strftime("%Y%m%d_%H%M%S")
                nome_html = f"{tipo_visual}_{ts}.html"
                resultado = _salvar_material(html, nome_html)
                print(resultado)
                print("\nO layout premium abriu no navegador. Descreva agora os ajustes desejados para refinar a arte.")
                aguardando_salvamento = False
            else:
                resposta = _chamar_ollama_texto(entrada)
                print(resposta)
                aguardando_salvamento = any(
                    k in resposta.lower() for k in ("quer salvar", "deseja salvar", "salvar este", "salvar o material")
                )
        except RuntimeError as e:
            print(f"\n[ERRO] {e}")
        except Exception as e:
            logger.exception("Erro inesperado")
            print(f"\n[ERRO] {e}")


if __name__ == "__main__":
    main()
