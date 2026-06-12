"""
briefflow_chat.py - BriefFlow: Assistente conversacional de marketing B2B.

Tecnologia:
  - Strands Agents como orquestrador
  - Fallback REAL entre providers: Gemini -> Claude -> OpenAI
  - Se um provider falhar (rate limit, auth, timeout, saldo), tenta o proximo automaticamente
  - O agente reconstroi com o proximo provider e repete a mensagem do usuario

Setup:
  1. pip install -r requirements.txt
  2. Copie .env.example para .env
  3. Preencha ao menos UMA das chaves:
       GEMINI_API_KEY   -> https://aistudio.google.com/apikey       (gratuito)
       ANTHROPIC_API_KEY -> https://console.anthropic.com            (credito gratis no cadastro)
       OPENAI_API_KEY   -> https://platform.openai.com/api-keys     (pay-as-you-go)
  4. python briefflow_chat.py
"""

from __future__ import annotations

import logging
import os
from datetime import datetime
from pathlib import Path

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
OUTPUT_DIR  = Path(os.getenv("OUTPUT_DIR", "data/output"))
MAX_TOKENS  = int(os.getenv("MAX_TOKENS",  "1200"))
TEMPERATURE = float(os.getenv("TEMPERATURE", "0.6"))

GEMINI_API_KEY    = os.getenv("GEMINI_API_KEY",    "").strip()
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()
OPENAI_API_KEY    = os.getenv("OPENAI_API_KEY",    "").strip()

GEMINI_MODEL    = os.getenv("GEMINI_MODEL",    "gemini-2.0-flash")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5")
OPENAI_MODEL    = os.getenv("OPENAI_MODEL",    "gpt-4o-mini")

# ---------------------------------------------------------------------------
# Lista de providers disponíveis (com chave configurada)
# ---------------------------------------------------------------------------
from strands import Agent, tool
from strands.models.litellm import LiteLLMModel


def _montar_lista_providers() -> list[tuple[str, str, dict]]:
    """
    Retorna apenas os providers que têm chave configurada, na ordem de preferência.
    Cada item: (nome_legivel, model_id_litellm, client_args)
    """
    candidatos = [
        (
            "Google Gemini",
            f"gemini/{GEMINI_MODEL}",
            {"api_key": GEMINI_API_KEY},
            GEMINI_API_KEY,
        ),
        (
            "Anthropic Claude",
            f"anthropic/{ANTHROPIC_MODEL}",
            {"api_key": ANTHROPIC_API_KEY},
            ANTHROPIC_API_KEY,
        ),
        (
            "OpenAI",
            f"openai/{OPENAI_MODEL}",
            {"api_key": OPENAI_API_KEY},
            OPENAI_API_KEY,
        ),
    ]
    return [
        (nome, model_id, client_args)
        for nome, model_id, client_args, chave in candidatos
        if chave
    ]


def _criar_model(model_id: str, client_args: dict) -> LiteLLMModel:
    return LiteLLMModel(
        client_args=client_args,
        model_id=model_id,
        params={
            "max_tokens": MAX_TOKENS,
            "temperature": TEMPERATURE,
        },
    )


def _e_erro_recuperavel(e: Exception) -> bool:
    """
    Retorna True para erros que justificam tentar o próximo provider.

    Cobertos:
    - Rate limit / cota esgotada (429, quota, too many requests)
    - Autenticação inválida (401, 403, invalid key, unauthorized)
    - Saldo insuficiente (credit balance, billing, insufficient_quota, payment)
    - Modelo indisponível (overloaded, service unavailable, 503, model not found)
    - Erros de streaming no meio da resposta (midstream, mid-stream)
    - Erros genéricos de bad request causados por billing (bad request + credit/balance)
    """
    msg = str(e).lower()

    gatilhos = (
        # Rate limit
        "429", "rate limit", "too many requests", "quota", "ratelimit",
        # Autenticação
        "401", "403", "authentication", "invalid key", "invalid api key",
        "unauthorized", "permission denied", "security token",
        "unrecognized", "forbidden",
        # Saldo / billing
        "credit balance", "credit balance is too low", "balance is too low",
        "insufficient_quota", "insufficient quota", "billing",
        "payment required", "402", "upgrade or purchase",
        # Modelo indisponível
        "model not found", "does not exist", "overloaded",
        "service unavailable", "503", "502",
        # Erros de streaming (gemini mid-stream)
        "midstream", "mid-stream", "midstreamfallback",
        "stream", "incomplete stream",
    )
    return any(g in msg for g in gatilhos)


# Inicializa lista de providers disponíveis
_providers = _montar_lista_providers()

if not _providers:
    print(
        "\n[ERRO] Nenhuma chave de API encontrada no .env\n\n"
        "Configure ao menos UMA das opções abaixo:\n\n"
        "  GEMINI_API_KEY=...     -> https://aistudio.google.com/apikey  (GRATUITO)\n"
        "  ANTHROPIC_API_KEY=...  -> https://console.anthropic.com\n"
        "  OPENAI_API_KEY=...     -> https://platform.openai.com/api-keys\n"
    )
    raise SystemExit(1)

# Provider atual (índice na lista _providers)
_provider_idx: int = 0


def _provider_atual() -> tuple[str, LiteLLMModel]:
    nome, model_id, client_args = _providers[_provider_idx]
    label = f"{nome} ({model_id.split('/')[1]})"
    return label, _criar_model(model_id, client_args)


# ---------------------------------------------------------------------------
# Estado em memória
# ---------------------------------------------------------------------------
_ultimo_material: dict = {"conteudo": "", "tipo": "", "descricao": ""}


# ---------------------------------------------------------------------------
# TOOLS
# ---------------------------------------------------------------------------

@tool
def gerar_material_de_marketing(
    tipo: str,
    descricao: str,
    publico_alvo: str = "revendedores",
    tom: str = "comercial e direto",
    detalhes_extras: str = "",
) -> str:
    """
    Monta o prompt estruturado para gerar um material de marketing B2B.
    O agente usa esse prompt para escrever o conteudo final com sua LLM.
    Nao requer arquivos - extrai tudo da conversa do usuario.

    Args:
        tipo: Tipo do material:
              podcast | slides | ficha_tecnica | email |
              folheto | post_instagram | post_linkedin | roteiro_video
        descricao: Contexto extraido da conversa (produto, campanha, empresa).
        publico_alvo: Audiencia do material (padrao: revendedores).
        tom: Tom de comunicacao (comercial, tecnico, urgente, descontraido...).
        detalhes_extras: Informacoes adicionais mencionadas na conversa.

    Returns:
        Prompt estruturado pronto para geracao do material.
    """
    global _ultimo_material

    TEMPLATES: dict[str, str] = {
        "podcast": (
            "Crie um ROTEIRO DE PODCAST de ate 5 minutos.\n"
            "Estrutura:\n"
            "- INTRODUCAO (30s): gancho forte + apresentacao do tema\n"
            "- DESENVOLVIMENTO (3min): 3 beneficios/argumentos com exemplos reais\n"
            "- ENCERRAMENTO (1min): recapitulacao + chamada para acao clara\n"
            "Formato de fala natural, portugues pt-BR."
        ),
        "slides": (
            "Crie uma ESTRUTURA DE 10 SLIDES para capacitacao tecnica.\n"
            "Formato obrigatorio para cada slide:\n"
            "Slide N - [Titulo]:\n"
            "- Ponto 1\n"
            "- Ponto 2\n"
            "- Ponto 3\n"
            "Portugues pt-BR."
        ),
        "ficha_tecnica": (
            "Crie uma FICHA TECNICA detalhada para vendedores.\n"
            "Por produto/subcategoria:\n"
            "PRODUTO: [nome]\n"
            "- Especificacoes tecnicas principais\n"
            "- Diferenciais vs concorrentes\n"
            "- Argumentos de venda para o cliente final\n"
            "- Aplicacoes recomendadas\n"
            "Portugues pt-BR."
        ),
        "email": (
            "Crie 2 EMAILS DE MARKETING:\n"
            "EMAIL 1 - Apresentacao e posicionamento\n"
            "Assunto: [...]\nPre-header: [...]\nCorpo: [paragrafos curtos, beneficios, CTA]\n"
            "\nEMAIL 2 - Oferta com urgencia\n"
            "Assunto: [...]\nPre-header: [...]\nCorpo: [oferta + prazo + CTA direto]\n"
            "Portugues pt-BR."
        ),
        "folheto": (
            "Crie o TEXTO DE UM FOLHETO PROMOCIONAL (A4 dobrado, 3 paineis):\n"
            "CAPA: titulo impactante + subtitulo\n"
            "PAINEL 2: produtos e beneficios em bullets (max 150 palavras)\n"
            "PAINEL 3: oferta especial + CTA + contato\n"
            "Portugues pt-BR."
        ),
        "post_instagram": (
            "Crie 3 POSTS PARA INSTAGRAM:\n"
            "POST 1:\nLegenda: [max 150 palavras]\nHashtags: [10]\nImagem sugerida: [descricao]\n"
            "\nPOST 2:\nLegenda: [foco em beneficio]\nHashtags: [10]\nImagem sugerida: [descricao]\n"
            "\nPOST 3:\nLegenda: [prova social]\nHashtags: [10]\nImagem sugerida: [descricao]\n"
            "Portugues pt-BR."
        ),
        "post_linkedin": (
            "Crie 2 POSTS PARA LINKEDIN (B2B profissional, max 200 palavras cada):\n"
            "POST 1: gancho + desenvolvimento + CTA + 3-5 hashtags\n"
            "POST 2: dado de mercado + argumento + CTA + hashtags\n"
            "Portugues pt-BR."
        ),
        "roteiro_video": (
            "Crie um ROTEIRO DE VIDEO CURTO (60-90 segundos):\n"
            "HOOK (0-5s): frase de abertura impactante\n"
            "PROBLEMA (5-15s): dor do publico\n"
            "SOLUCAO (15-45s): como o produto resolve\n"
            "PROVA (45-60s): resultado concreto\n"
            "CTA (60-75s): chamada para acao\n"
            "Portugues pt-BR."
        ),
    }

    tipo_norm = tipo.lower().strip().replace(" ", "_")
    template  = TEMPLATES.get(tipo_norm)

    if not template:
        disponiveis = " | ".join(TEMPLATES.keys())
        return f"Tipo '{tipo}' invalido. Opcoes: {disponiveis}"

    extras = f"\nDetalhes adicionais: {detalhes_extras}" if detalhes_extras.strip() else ""

    _ultimo_material["tipo"]      = tipo_norm
    _ultimo_material["descricao"] = descricao[:80]

    return (
        f"CONTEXTO: {descricao}\n"
        f"PUBLICO: {publico_alvo}\n"
        f"TOM: {tom}"
        f"{extras}\n\n"
        f"TAREFA:\n{template}\n\n"
        "IMPORTANTE: Seja especifico ao contexto fornecido. "
        "Entregue apenas o material pronto, sem explicacoes adicionais."
    )


@tool
def salvar_material(
    conteudo: str,
    nome_arquivo: str = "",
    subpasta: str = "",
) -> str:
    """
    Salva um material gerado em data/output/ como arquivo .txt.

    Args:
        conteudo: Texto completo do material a salvar.
        nome_arquivo: Nome do arquivo (ex: podcast_dlab.txt).
                      Se omitido, gera automaticamente com timestamp.
        subpasta: Subpasta dentro de data/output/ para organizar por campanha.

    Returns:
        Caminho completo do arquivo salvo.
    """
    if not conteudo or not conteudo.strip():
        return "Nenhum conteudo para salvar."

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
        return f"Material salvo em: {path}"
    except OSError as e:
        return f"Erro ao salvar: {e}"


@tool
def listar_materiais_salvos(subpasta: str = "") -> str:
    """
    Lista todos os materiais ja salvos em data/output/.

    Args:
        subpasta: Filtra por subpasta especifica (opcional).

    Returns:
        Lista com nome, tamanho e data de cada arquivo.
    """
    base = OUTPUT_DIR / subpasta.strip() if subpasta.strip() else OUTPUT_DIR
    if not base.exists():
        return f"Nenhum material salvo ainda em '{base}'."

    arquivos = sorted(base.rglob("*.txt")) + sorted(base.rglob("*.pptx"))
    if not arquivos:
        return "Nenhum arquivo encontrado."

    linhas = []
    for a in arquivos:
        stat = a.stat()
        data = datetime.fromtimestamp(stat.st_mtime).strftime("%d/%m %H:%M")
        kb   = max(1, stat.st_size // 1024)
        linhas.append(f"  {a.relative_to(OUTPUT_DIR)}  ({kb} KB | {data})")

    return f"Materiais salvos ({len(arquivos)}):\n" + "\n".join(linhas)


@tool
def ler_material_salvo(nome_arquivo: str, subpasta: str = "") -> str:
    """
    Le e exibe o conteudo completo de um material ja salvo.

    Args:
        nome_arquivo: Nome do arquivo (ex: podcast_dlab.txt).
        subpasta: Subpasta onde o arquivo esta (opcional).

    Returns:
        Conteudo completo do arquivo.
    """
    base = OUTPUT_DIR / subpasta.strip() if subpasta.strip() else OUTPUT_DIR
    path = base / nome_arquivo
    if not path.exists():
        encontrados = list(OUTPUT_DIR.rglob(nome_arquivo))
        if encontrados:
            path = encontrados[0]
        else:
            return f"Arquivo '{nome_arquivo}' nao encontrado."
    return path.read_text(encoding="utf-8")


@tool
def tipos_de_material_disponiveis() -> str:
    """
    Lista todos os tipos de materiais que o BriefFlow pode gerar,
    com descricao e exemplos de como solicitar.

    Returns:
        Lista formatada dos tipos com exemplos.
    """
    return (
        "Tipos de materiais que posso criar:\n\n"
        "  podcast          Roteiro de podcast 5 min\n"
        '                   Ex: "Crie um podcast sobre a linha DLAB de lubrificantes"\n\n'
        "  slides           10 slides de capacitacao tecnica\n"
        '                   Ex: "Monte slides de treinamento sobre hidraulicos"\n\n'
        "  ficha_tecnica    Ficha com specs e diferenciais para vendedores\n"
        '                   Ex: "Ficha tecnica dos produtos da campanha Compre 3 Leve 4"\n\n'
        "  email            2 emails (apresentacao + oferta/urgencia)\n"
        '                   Ex: "Emails para revendedores sobre o lancamento DLAB"\n\n'
        "  folheto          Texto de folheto A4 em 3 paineis\n"
        '                   Ex: "Folheto promocional para distribuidores"\n\n'
        "  post_instagram   3 posts com legenda, hashtags e sugestao de imagem\n"
        '                   Ex: "Posts de Instagram para a campanha de setembro"\n\n'
        "  post_linkedin    2 posts B2B profissionais\n"
        '                   Ex: "Posts de LinkedIn sobre hidraulicos industriais"\n\n'
        "  roteiro_video    Roteiro de video 60-90 segundos\n"
        '                   Ex: "Roteiro de video para o lancamento da linha DLAB"\n\n'
        "Basta descrever o produto/campanha na conversa - sem precisar de arquivos!"
    )


# ---------------------------------------------------------------------------
# Construção do agente com fallback real
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = f"""\
Voce e o BriefFlow, assistente de IA especializado em criar materiais de
marketing B2B para revendedores e distribuidores.

FORMA DE TRABALHO:
- Voce raciocina a partir do que o usuario ESCREVE na conversa.
- Nao precisa de arquivos, JSON ou documentos externos.
- Extrai produto, campanha e contexto diretamente da mensagem.

FERRAMENTAS DISPONIVEIS:
  gerar_material_de_marketing  -> monta o prompt e gera o material
  salvar_material              -> salva conteudo em data/output/
  listar_materiais_salvos      -> lista arquivos ja salvos
  ler_material_salvo           -> le um arquivo salvo
  tipos_de_material_disponiveis -> mostra o que pode ser criado

REGRAS DE COMPORTAMENTO:
1. Ao receber um pedido de material:
   a) Chame gerar_material_de_marketing para obter o prompt estruturado
   b) Use esse prompt para escrever o material COMPLETO voce mesmo
   c) Entregue o conteudo formatado e pronto na resposta
   d) Pergunte: "Quer salvar esse material? Se sim, qual nome de arquivo?"
2. Se o usuario confirmar salvamento, chame salvar_material imediatamente.
3. Se faltar contexto essencial, faca UMA unica pergunta objetiva.
4. Limite por resposta: {MAX_TOKENS} tokens. Para materiais longos, avise
   que pode continuar em partes se necessario.
5. Responda SEMPRE em portugues pt-BR, direto e amigavel.
6. Para ajustes em material ja gerado: pergunte o que mudar, altere
   apenas o trecho necessario.
7. Nunca mencione providers, modelos ou detalhes tecnicos ao usuario.
"""

_TOOLS = [
    gerar_material_de_marketing,
    salvar_material,
    listar_materiais_salvos,
    ler_material_salvo,
    tipos_de_material_disponiveis,
]


def _criar_agente(model: LiteLLMModel) -> Agent:
    return Agent(
        model=model,
        system_prompt=SYSTEM_PROMPT,
        tools=_TOOLS,
    )


# Cria o agente com o primeiro provider disponível
_provider_label, _model_atual = _provider_atual()
agent = _criar_agente(_model_atual)


# ---------------------------------------------------------------------------
# Função de chamada com fallback automático
# ---------------------------------------------------------------------------

def _chamar_com_fallback(user_input: str) -> str:
    """
    Tenta chamar o agente. Se o provider atual falhar com erro recuperável,
    troca automaticamente para o próximo provider e tenta novamente.
    Repete até esgotar todos os providers disponíveis.
    """
    global _provider_idx, _provider_label, _model_atual, agent

    tentativas = list(range(len(_providers)))  # índices a tentar

    # Começa a partir do provider atual
    indices = tentativas[_provider_idx:] + tentativas[:_provider_idx]

    ultimo_erro = None
    for idx in indices:
        nome, model_id, client_args = _providers[idx]
        label = f"{nome} ({model_id.split('/')[1]})"

        # Reconstrói o agente se trocou de provider
        if idx != _provider_idx:
            print(f"\n[BriefFlow] Trocando para {label}...", flush=True)
            _provider_idx   = idx
            _provider_label = label
            _model_atual    = _criar_model(model_id, client_args)
            agent           = _criar_agente(_model_atual)

        try:
            resultado = agent(user_input)
            return resultado.message
        except Exception as e:
            ultimo_erro = e
            if _e_erro_recuperavel(e):
                logger.warning(
                    "Provider %s falhou (%s), tentando proximo...",
                    label, type(e).__name__,
                )
                continue
            # Erro não recuperável (ex: bug de código) — não tenta outro provider
            raise

    # Todos os providers falharam
    raise RuntimeError(
        f"Todos os {len(_providers)} providers falharam.\n"
        f"Ultimo erro: {ultimo_erro}"
    )


# ---------------------------------------------------------------------------
# Loop de chat
# ---------------------------------------------------------------------------

def _fmt_banner() -> str:
    nomes = " → ".join(n for n, _, _ in _providers)
    lines = [
        "+" + "=" * 57 + "+",
        "|{:^57}|".format("BriefFlow - Assistente de Marketing"),
        "|{:^57}|".format(f"Providers: {nomes}"),
        "|{:^57}|".format(f"Ativo: {_provider_label}"),
        "|{:^57}|".format(f"Limite: {MAX_TOKENS} tokens por resposta"),
        "+" + "=" * 57 + "+",
        "",
        "Descreva o que precisa criar. Exemplos:",
        "  > Crie um podcast sobre a linha de lubrificantes DLAB",
        "  > Emails para a campanha Compre 3 Leve 4 com urgencia",
        "  > 3 posts de Instagram sobre hidraulicos industriais",
        "  > Que tipos de material voce cria?",
        "  > Liste o que ja foi salvo",
        "",
        "Digite 'sair' para encerrar.",
    ]
    return "\n".join(lines)


def _msg_erro_final(e: Exception) -> str:
    msg = str(e).lower()
    if "todos os" in msg and "providers falharam" in msg:
        return (
            "[TODOS OS PROVIDERS FALHARAM]\n"
            "Possíveis causas:\n"
            "  - Gemini: limite de requisições atingido (aguarde alguns minutos)\n"
            "  - Claude: saldo insuficiente → console.anthropic.com/settings/billing\n"
            "  - OpenAI: saldo insuficiente → platform.openai.com/settings/billing\n"
            "Verifique saldos e chaves no .env e tente novamente."
        )
    if any(k in msg for k in ("timeout", "connection", "network")):
        return "[ERRO DE CONEXAO] Verifique sua conexao com a internet."
    logger.exception("Erro inesperado")
    return f"[ERRO] {e}"


def main() -> None:
    print(_fmt_banner())

    while True:
        try:
            user_input = input("\nVoce: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nEncerrando. Ate mais!")
            break

        if not user_input:
            continue

        if user_input.lower() in {"sair", "exit", "quit", "q"}:
            print("\nEncerrando o BriefFlow. Ate mais!")
            break

        print(f"\nBriefFlow [{_provider_label}]: ", end="", flush=True)
        try:
            resposta = _chamar_com_fallback(user_input)
            print(resposta)
        except Exception as e:
            print("\n" + _msg_erro_final(e))


if __name__ == "__main__":
    main()
