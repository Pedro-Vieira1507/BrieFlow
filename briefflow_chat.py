"""
briefflow_chat.py - BriefFlow: Assistente conversacional de marketing B2B.

Tecnologia:
  - Chamada direta ao Ollama via requests (sem LiteLLM / Strands)
  - Historico de conversa em memoria
  - Tools implementadas localmente (sem function calling externo)
  - Zero dependencias de cloud - 100% local e gratuito

Setup:
  1. Instale Ollama: https://ollama.com
  2. Execute: ollama pull llama3
  3. No .env defina: OLLAMA_MODEL=llama3
  4. pip install -r requirements.txt
  5. python briefflow_chat.py
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    format="%(asctime)s | %(levelname)s | %(message)s",
    level=logging.WARNING,
)
logger = logging.getLogger("briefflow")

# ---------------------------------------------------------------------------
# Config via .env
# ---------------------------------------------------------------------------
OUTPUT_DIR      = Path(os.getenv("OUTPUT_DIR",      "data/output"))
MAX_TOKENS      = int(os.getenv("MAX_TOKENS",        "1200"))
TEMPERATURE     = float(os.getenv("TEMPERATURE",     "0.7"))
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL",           "llama3").strip()
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL",        "http://localhost:11434").strip().rstrip("/")
OLLAMA_TIMEOUT  = int(os.getenv("OLLAMA_TIMEOUT",     "120"))

# ---------------------------------------------------------------------------
# Verificacao do Ollama
# ---------------------------------------------------------------------------

def _verificar_ollama() -> None:
    """Checa se o servidor Ollama esta acessivel. Encerra com mensagem clara se nao."""
    try:
        r = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3)
        r.raise_for_status()
        modelos = [m["name"].split(":")[0] for m in r.json().get("models", [])]
        modelo_base = OLLAMA_MODEL.split(":")[0]
        if modelos and modelo_base not in modelos:
            print(
                f"\n[AVISO] Modelo '{OLLAMA_MODEL}' nao encontrado no Ollama.\n"
                f"  Modelos instalados: {', '.join(modelos)}\n"
                f"  Para instalar: ollama pull {OLLAMA_MODEL}\n"
            )
    except requests.exceptions.ConnectionError:
        print(
            f"\n[ERRO] Ollama nao esta rodando em {OLLAMA_BASE_URL}\n\n"
            "Solucao:\n"
            "  1. Abra outro terminal\n"
            "  2. Execute: ollama serve\n"
            "  3. Aguarde aparecer 'Listening on ...' e execute novamente: python briefflow_chat.py\n\n"
            f"  Modelo configurado: {OLLAMA_MODEL}\n"
            f"  Para instalar: ollama pull {OLLAMA_MODEL}\n"
        )
        raise SystemExit(1)
    except Exception as e:
        print(f"\n[ERRO] Falha ao conectar no Ollama: {e}\n")
        raise SystemExit(1)


# ---------------------------------------------------------------------------
# Historico de conversa
# ---------------------------------------------------------------------------
_historico: list[dict] = []
_ultimo_material: dict = {"conteudo": "", "tipo": "", "descricao": ""}

SYSTEM_PROMPT = f"""\
Voce e o BriefFlow, assistente de IA especializado em criar materiais de \
marketing B2B para revendedores e distribuidores de produtos tecnicos \
(laboratorio, industrial, hidraulica, etc).

FORMA DE TRABALHO:
- Voce raciocina a partir do que o usuario ESCREVE na conversa.
- Nao precisa de arquivos ou documentos externos.
- Extrai produto, campanha e contexto diretamente da mensagem.

MATERIAIS QUE VOCE CRIA:
  podcast         Roteiro de podcast de 5 minutos
  slides          10 slides de capacitacao tecnica
  ficha_tecnica   Ficha com specs e argumentos para vendedores
  email           2 emails (apresentacao + oferta/urgencia)
  folheto         Texto de folheto A4 em 3 paineis
  post_instagram  3 posts com legenda, hashtags e sugestao de imagem
  post_linkedin   2 posts B2B profissionais
  roteiro_video   Roteiro de video de 60-90 segundos

REGRAS:
1. Ao receber pedido de material: gere o conteudo COMPLETO e formatado.
2. Apos gerar, pergunte: "Quer salvar este material? Se sim, informe o nome do arquivo."
3. Para salvar: o usuario dira "sim" ou informara o nome, entao confirme com [SALVAR:<nome_arquivo>].
4. Se faltar contexto, faca UMA pergunta objetiva.
5. Limite por resposta: {MAX_TOKENS} tokens. Para conteudos longos, oferea continuar em partes.
6. Responda SEMPRE em portugues pt-BR, de forma direta e amigavel.
7. Nunca mencione detalhes tecnicos, modelos de IA ou providers ao usuario.
"""

# ---------------------------------------------------------------------------
# Chamada ao Ollama
# ---------------------------------------------------------------------------

def _chamar_ollama(mensagem_usuario: str) -> str:
    """Envia mensagem ao Ollama e retorna a resposta como string."""
    _historico.append({"role": "user", "content": mensagem_usuario})

    payload = {
        "model":   OLLAMA_MODEL,
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}] + _historico,
        "stream":  False,
        "options": {
            "temperature": TEMPERATURE,
            "num_predict": MAX_TOKENS,
        },
    }

    try:
        resp = requests.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            json=payload,
            timeout=OLLAMA_TIMEOUT,
        )
        resp.raise_for_status()
    except requests.exceptions.ConnectionError:
        _historico.pop()
        raise RuntimeError(
            "Ollama parou de responder.\n"
            "Execute 'ollama serve' em outro terminal e tente novamente."
        )
    except requests.exceptions.Timeout:
        _historico.pop()
        raise RuntimeError(
            f"Ollama nao respondeu em {OLLAMA_TIMEOUT}s.\n"
            "O modelo pode estar carregando. Aguarde e tente novamente.\n"
            f"Para aumentar o tempo: defina OLLAMA_TIMEOUT=180 no .env"
        )
    except requests.exceptions.HTTPError as e:
        _historico.pop()
        raise RuntimeError(f"Erro HTTP do Ollama: {e}\nVerifique se o modelo '{OLLAMA_MODEL}' esta instalado.")

    data = resp.json()
    conteudo = data.get("message", {}).get("content", "").strip()

    if not conteudo:
        _historico.pop()
        raise RuntimeError("Ollama retornou resposta vazia.")

    _historico.append({"role": "assistant", "content": conteudo})
    return conteudo


# ---------------------------------------------------------------------------
# Salvar material
# ---------------------------------------------------------------------------

def _salvar_material(conteudo: str, nome_arquivo: str = "", subpasta: str = "") -> str:
    """Persiste o conteudo em data/output/ como .txt."""
    if not conteudo or not conteudo.strip():
        return "[ERRO] Nenhum conteudo para salvar."

    out_dir = OUTPUT_DIR / subpasta.strip() if subpasta.strip() else OUTPUT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)

    if not nome_arquivo.strip():
        ts   = datetime.now().strftime("%Y%m%d_%H%M%S")
        tipo = _ultimo_material.get("tipo") or "material"
        nome_arquivo = f"{tipo}_{ts}.txt"

    if not nome_arquivo.endswith(".txt"):
        nome_arquivo += ".txt"

    path = out_dir / nome_arquivo
    try:
        path.write_text(conteudo.strip() + "\n", encoding="utf-8")
        _ultimo_material["conteudo"] = conteudo
        return f"[OK] Material salvo em: {path}"
    except OSError as e:
        return f"[ERRO] Falha ao salvar: {e}"


def _listar_materiais() -> str:
    if not OUTPUT_DIR.exists():
        return "Nenhum material salvo ainda."
    arquivos = sorted(OUTPUT_DIR.rglob("*.txt"))
    if not arquivos:
        return "Nenhum arquivo encontrado em data/output/."
    linhas = []
    for a in arquivos:
        stat = a.stat()
        data = datetime.fromtimestamp(stat.st_mtime).strftime("%d/%m %H:%M")
        kb   = max(1, stat.st_size // 1024)
        linhas.append(f"  {a.relative_to(OUTPUT_DIR)}  ({kb} KB | {data})")
    return f"Materiais salvos ({len(arquivos)}):\n" + "\n".join(linhas)


# ---------------------------------------------------------------------------
# Processamento local de comandos especiais
# ---------------------------------------------------------------------------

def _processar_resposta(resposta: str, entrada_usuario: str) -> str:
    """
    Detecta marcador [SALVAR:<nome>] na resposta do modelo e executa o salvamento.
    Tambem trata comandos de listagem diretos.
    """
    # Listagem de materiais (comando direto do usuario)
    entrada_lower = entrada_usuario.lower().strip()
    if any(k in entrada_lower for k in ("liste", "listar", "o que foi salvo", "materiais salvos")):
        lista = _listar_materiais()
        return resposta + f"\n\n{lista}"

    # Marcador de salvamento gerado pelo modelo
    if "[SALVAR:" in resposta:
        inicio = resposta.index("[SALVAR:") + len("[SALVAR:")
        fim    = resposta.index("]", inicio)
        nome   = resposta[inicio:fim].strip()
        conteudo_para_salvar = _ultimo_material.get("conteudo") or resposta
        # Remove o marcador da resposta exibida
        resposta_limpa = resposta[:resposta.index("[SALVAR:")].strip()
        resultado_save = _salvar_material(conteudo_para_salvar, nome)
        return f"{resposta_limpa}\n\n{resultado_save}"

    # Armazena ultimo material gerado (heuristica: resposta longa = material)
    if len(resposta) > 300:
        _ultimo_material["conteudo"] = resposta
        tipo_detectado = _detectar_tipo(entrada_usuario)
        if tipo_detectado:
            _ultimo_material["tipo"] = tipo_detectado

    return resposta


def _detectar_tipo(texto: str) -> str:
    texto = texto.lower()
    mapa  = {
        "podcast":        ["podcast", "roteiro de audio"],
        "slides":         ["slide", "apresentacao", "powerpoint", "capacitacao"],
        "ficha_tecnica":  ["ficha tecnica", "ficha", "especificacao"],
        "email":          ["email", "e-mail", "mensagem"],
        "folheto":        ["folheto", "flyer", "panfleto"],
        "post_instagram": ["instagram", "post", "stories"],
        "post_linkedin":  ["linkedin"],
        "roteiro_video":  ["video", "roteiro de video", "reels"],
    }
    for tipo, palavras in mapa.items():
        if any(p in texto for p in palavras):
            return tipo
    return ""


# ---------------------------------------------------------------------------
# Tratamento de salvamento solicitado pelo usuario
# ---------------------------------------------------------------------------

def _usuario_quer_salvar(entrada: str) -> bool:
    gatilhos = ["sim", "salvar", "salva", "salve", "save", "gravar", "arquivar", "s,", "s."]
    return any(g in entrada.lower() for g in gatilhos)


def _nome_do_arquivo_na_entrada(entrada: str) -> str:
    """Extrai nome de arquivo se o usuario informou diretamente."""
    palavras = entrada.split()
    for p in palavras:
        if "." in p and len(p) > 3:
            return p
        if "_" in p and len(p) > 3:
            return p
    return ""


# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------

def _banner() -> str:
    lines = [
        "+" + "=" * 55 + "+",
        "|{:^55}|".format("BriefFlow - Assistente de Marketing B2B"),
        "|{:^55}|".format(f"Modelo: {OLLAMA_MODEL}  |  100% local"),
        "|{:^55}|".format(f"Limite: {MAX_TOKENS} tokens  |  Temp: {TEMPERATURE}"),
        "+" + "=" * 55 + "+",
        "",
        "Exemplos do que voce pode pedir:",
        "  > Crie um podcast sobre a linha DLAB de lubrificantes",
        "  > Emails para a campanha Compre 3 Leve 4 com urgencia",
        "  > 3 posts de Instagram sobre pipetas sorologicas",
        "  > Ficha tecnica dos auxiliares de pipetagem Kasvi",
        "  > Liste os materiais ja salvos",
        "",
        "Digite 'sair' para encerrar.",
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Loop principal
# ---------------------------------------------------------------------------

def main() -> None:
    _verificar_ollama()
    print(_banner())

    _aguardando_salvamento = False

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

        # Verifica se usuario esta respondendo pedido de salvamento
        if _aguardando_salvamento and _usuario_quer_salvar(entrada):
            nome = _nome_do_arquivo_na_entrada(entrada)
            conteudo = _ultimo_material.get("conteudo", "")
            if conteudo:
                resultado = _salvar_material(conteudo, nome)
                print(f"\nBriefFlow: {resultado}")
            else:
                print("\nBriefFlow: Nao ha material recente para salvar. Gere um primeiro.")
            _aguardando_salvamento = False
            continue

        print(f"\nBriefFlow: ", end="", flush=True)
        try:
            resposta = _chamar_ollama(entrada)
            resposta = _processar_resposta(resposta, entrada)
            print(resposta)

            # Detecta se o modelo perguntou sobre salvamento
            resp_lower = resposta.lower()
            _aguardando_salvamento = any(
                k in resp_lower for k in ("quer salvar", "deseja salvar", "salvar este", "salvar o material")
            )

        except RuntimeError as e:
            print(f"\n[ERRO] {e}")
        except Exception as e:
            logger.exception("Erro inesperado")
            print(f"\n[ERRO INESPERADO] {e}")


if __name__ == "__main__":
    main()
