"""
briefflow_chat.py — BriefFlow: Assistente conversacional de marketing B2B.

Tecnologia:
  - Strands Agents como orquestrador
  - Modelo GRATUITO: amazon.titan-text-lite-v1 (Amazon Bedrock — sem custo)
  - Limite de tokens configuravel via .env (MAX_TOKENS, padrao 800)
  - Raciocina a partir da conversa — sem necessidade de briefs em disco

Uso:
  python briefflow_chat.py

Exemplos de conversa:
  "Crie um podcast para lancar a linha de lubrificantes DLAB"
  "Gere um email marketing para revendedores sobre a campanha Compre 3 Leve 4"
  "Escreva 3 posts de Instagram para divulgar hidraulicos industriais"
  "Salve o ultimo material gerado como podcast_dlab.txt"
  "Liste o que ja foi salvo"
"""

from __future__ import annotations

import logging
import os
import re
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from strands import Agent, tool
from strands.models import BedrockModel

# ---------------------------------------------------------------------------
# Logging — silencia Strands para deixar o chat limpo
# ---------------------------------------------------------------------------
logging.basicConfig(format="%(asctime)s | %(levelname)s | %(message)s", level=logging.WARNING)
logger = logging.getLogger("briefflow")

# ---------------------------------------------------------------------------
# Config via .env
# ---------------------------------------------------------------------------
OUTPUT_DIR  = Path(os.getenv("OUTPUT_DIR",  "data/output"))

# Modelo GRATUITO no Amazon Bedrock
# amazon.titan-text-lite-v1 — sem custo, ideal para textos estruturados
BEDROCK_MODEL_ID = os.getenv(
    "BEDROCK_MODEL_ID",
    "amazon.titan-text-lite-v1",          # <-- gratuito
)
BEDROCK_REGION = os.getenv("AWS_DEFAULT_REGION", "us-east-1")

# Limite de tokens para nao gastar indevidamente
# Titan Lite: max 4096. Padrao conservador: 800 tokens por resposta.
MAX_TOKENS  = int(os.getenv("MAX_TOKENS",  "800"))
TEMPERATURE = float(os.getenv("TEMPERATURE", "0.6"))

# ---------------------------------------------------------------------------
# Estado em memoria — guarda o ultimo material gerado para salvar depois
# ---------------------------------------------------------------------------
_ultimo_material: dict = {"conteudo": "", "tipo": "", "descricao": ""}


# ---------------------------------------------------------------------------
# TOOLS — acoes que o agente pode executar
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
    Gera um material de marketing B2B a partir de uma descricao livre em linguagem natural.
    Nao precisa de arquivo de brief — o proprio agente extrai as informacoes da conversa.

    Args:
        tipo (str): Tipo do material. Opcoes:
                    'podcast', 'slides', 'ficha_tecnica', 'email',
                    'folheto', 'post_instagram', 'post_linkedin', 'roteiro_video'.
        descricao (str): Descricao completa do produto/campanha/contexto extraida da conversa.
                         Ex: 'Linha de lubrificantes DLAB, campanha Compre 3 Leve 4,
                              foco em revendedores do setor industrial'
        publico_alvo (str): Para quem o material sera direcionado. Padrao: 'revendedores'.
        tom (str): Tom de comunicacao desejado. Padrao: 'comercial e direto'.
        detalhes_extras (str): Informacoes adicionais que o usuario mencionou na conversa.

    Returns:
        str: Prompt estruturado para o agente gerar o material via LLM.
    """
    global _ultimo_material

    TEMPLATES = {
        "podcast": """Crie um ROTEIRO DE PODCAST de ate 5 minutos.
Estrutura obrigatoria:
- INTRODUCAO (30s): gancho e apresentacao
- DESENVOLVIMENTO (3min): 3 beneficios principais, dados ou argumentos
- ENCERRAMENTO (1min): recapitulacao e chamada para acao
Texto em formato de fala natural, portugues pt-BR.""",

        "slides": """Crie uma ESTRUTURA DE 10 SLIDES para apresentacao de capacitacao.
Use EXATAMENTE este formato para cada slide:
Slide N - [Titulo do Slide]:
- Ponto 1
- Ponto 2
- Ponto 3
Portugues pt-BR.""",

        "ficha_tecnica": """Crie uma FICHA TECNICA para equipe de vendas.
Formato:
PRODUTO/SUBCATEGORIA: [nome]
- Diferencial 1: [descricao objetiva]
- Diferencial 2: [argumento contra concorrente]
- Diferencial 3: [beneficio pratico para o cliente final]
Portugues pt-BR.""",

        "email": """Crie 2 EMAILS DE MARKETING:
EMAIL 1 — Apresentacao e posicionamento de marca
Assunto: [linha de assunto]
Pre-header: [texto do pre-header]
Corpo: [corpo do email, paragrafos curtos]

EMAIL 2 — Oferta com urgencia
Assunto: [linha de assunto]
Pre-header: [texto do pre-header]
Corpo: [corpo do email com CTA claro]
Portugues pt-BR.""",

        "folheto": """Crie o TEXTO DE UM FOLHETO PROMOCIONAL (formato A4 dobrado, 3 paineis):
CAPA:
[titulo impactante]
[subtitulo]

PAINEL 2 — Produtos e Beneficios:
[bullets dos principais produtos/beneficios, max 150 palavras]

PAINEL 3 — Oferta e CTA:
[oferta especial + chamada para acao + contato]
Portugues pt-BR.""",

        "post_instagram": """Crie 3 POSTS PARA INSTAGRAM:
POST 1:
Legenda: [max 150 palavras, engajamento emocional]
Hashtags: [10 hashtags relevantes]
Sugestao de imagem: [descricao da imagem ideal]

POST 2:
Legenda: [foco em beneficio ou oferta]
Hashtags: [10 hashtags]
Sugestao de imagem: [descricao]

POST 3:
Legenda: [prova social ou depoimento ficticio]
Hashtags: [10 hashtags]
Sugestao de imagem: [descricao]
Portugues pt-BR.""",

        "post_linkedin": """Crie 2 POSTS PARA LINKEDIN (B2B, tom profissional):
POST 1:
[gancho forte na primeira linha]
[desenvolvimento em paragrafos curtos]
[CTA claro]
[3-5 hashtags profissionais]

POST 2:
[dado ou insight de mercado como gancho]
[argumentacao com beneficios para o negocio]
[CTA]
[hashtags]
Max 200 palavras cada. Portugues pt-BR.""",

        "roteiro_video": """Crie um ROTEIRO DE VIDEO CURTO (60-90 segundos):
HOOK (0-5s): [frase de abertura impactante]
PROBLEMA (5-15s): [dor ou desafio do publico]
SOLUCAO (15-45s): [como o produto resolve]
PROVA (45-60s): [resultado ou beneficio concreto]
CTA (60-75s): [chamada para acao clara]
Portugues pt-BR.""",
    }

    tipo_norm = tipo.lower().strip().replace(" ", "_")
    template = TEMPLATES.get(tipo_norm)
    if not template:
        tipos_validos = "\n".join(f"  - {t}" for t in TEMPLATES)
        return f"Tipo '{tipo}' nao reconhecido. Tipos disponiveis:\n{tipos_validos}"

    extras = f"\n\nDetalhes adicionais mencionados:\n{detalhes_extras}" if detalhes_extras.strip() else ""

    prompt = f"""Voce e um redator senior de marketing B2B especializado em conteudo para revendedores.

CONTEXTO DA CAMPANHA/PRODUTO:
{descricao}

PUBLICO-ALVO: {publico_alvo}
TOM DE COMUNICACAO: {tom}{extras}

TAREFA:
{template}

IMPORTANTE:
- Seja especifico ao contexto fornecido (nao use exemplos genericos)
- Mantenha o tom {tom}
- Conteudo pronto para uso, sem explicacoes adicionais
"""
    # Registra para possivel salvamento posterior
    _ultimo_material["tipo"] = tipo_norm
    _ultimo_material["descricao"] = descricao[:80]

    return prompt


@tool
def salvar_material(conteudo: str, nome_arquivo: str = "", subpasta: str = "") -> str:
    """
    Salva um material de marketing gerado em um arquivo .txt em data/output/.

    Args:
        conteudo (str): Texto completo do material a salvar.
        nome_arquivo (str): Nome do arquivo (ex: 'podcast_dlab.txt').
                            Se vazio, gera automaticamente com timestamp.
        subpasta (str): Subpasta em data/output/ para organizar por campanha (opcional).

    Returns:
        str: Confirmacao com o caminho completo do arquivo salvo.
    """
    if not conteudo or not conteudo.strip():
        return "Nenhum conteudo fornecido para salvar."

    out_dir = OUTPUT_DIR / subpasta if subpasta.strip() else OUTPUT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)

    if not nome_arquivo.strip():
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        tipo = _ultimo_material.get("tipo", "material") or "material"
        nome_arquivo = f"{tipo}_{ts}.txt"

    if not nome_arquivo.endswith(".txt"):
        nome_arquivo += ".txt"

    path = out_dir / nome_arquivo
    try:
        path.write_text(conteudo.strip() + "\n", encoding="utf-8")
        _ultimo_material["conteudo"] = conteudo
        return f"Material salvo com sucesso em: {path}"
    except OSError as e:
        return f"Erro ao salvar arquivo: {e}"


@tool
def listar_materiais_salvos(subpasta: str = "") -> str:
    """
    Lista todos os materiais ja salvos em data/output/.

    Args:
        subpasta (str): Filtra por subpasta especifica (opcional).

    Returns:
        str: Lista formatada dos arquivos com data de criacao e tamanho.
    """
    base = OUTPUT_DIR / subpasta if subpasta.strip() else OUTPUT_DIR
    if not base.exists():
        return f"Nenhum material salvo ainda em '{base}'."

    arquivos = sorted(base.rglob("*.txt")) + sorted(base.rglob("*.pptx"))
    if not arquivos:
        return f"Nenhum arquivo encontrado em '{base}'."

    linhas = []
    for a in arquivos:
        stat = a.stat()
        data = datetime.fromtimestamp(stat.st_mtime).strftime("%d/%m %H:%M")
        kb = max(1, stat.st_size // 1024)
        linhas.append(f"  {a.relative_to(OUTPUT_DIR)}  ({kb}KB, {data})")

    return f"Materiais salvos ({len(arquivos)}):\n" + "\n".join(linhas)


@tool
def ler_material_salvo(nome_arquivo: str, subpasta: str = "") -> str:
    """
    Le e exibe o conteudo de um material ja salvo.

    Args:
        nome_arquivo (str): Nome do arquivo (ex: 'podcast_dlab.txt').
        subpasta (str): Subpasta onde o arquivo esta (opcional).

    Returns:
        str: Conteudo completo do arquivo.
    """
    base = OUTPUT_DIR / subpasta if subpasta.strip() else OUTPUT_DIR
    path = base / nome_arquivo

    if not path.exists():
        encontrados = list(OUTPUT_DIR.rglob(nome_arquivo))
        if encontrados:
            path = encontrados[0]
        else:
            return f"Arquivo '{nome_arquivo}' nao encontrado em '{base}'."

    return path.read_text(encoding="utf-8")


@tool
def tipos_de_material_disponiveis() -> str:
    """
    Mostra todos os tipos de materiais de marketing que o BriefFlow consegue gerar
    e exemplos de como solicitar cada um.

    Returns:
        str: Lista de tipos com descricao e exemplos de uso.
    """
    return """Tipos de materiais que posso gerar para voce:

  podcast          - Roteiro de podcast de ate 5 minutos para revendedores
                     Ex: "Crie um podcast sobre a linha de hidraulicos DLAB"

  slides           - Estrutura de 10 slides para capacitacao tecnica
                     Ex: "Monte slides de treinamento sobre lubrificantes industriais"

  ficha_tecnica    - Ficha com diferenciais por subcategoria para vendedores
                     Ex: "Faca uma ficha tecnica dos produtos da campanha Compre 3 Leve 4"

  email            - 2 emails de marketing (apresentacao + oferta/urgencia)
                     Ex: "Escreva emails para revendedores sobre o lancamento DLAB"

  folheto          - Texto de folheto A4 dobrado em 3 paineis
                     Ex: "Crie um folheto promocional para distribuidores"

  post_instagram   - 3 posts para Instagram com legenda, hashtags e sugestao de imagem
                     Ex: "Gere posts de Instagram para a campanha de setembro"

  post_linkedin    - 2 posts para LinkedIn com tom profissional B2B
                     Ex: "Crie posts de LinkedIn sobre os novos hidraulicos"

  roteiro_video    - Roteiro de video curto de 60-90 segundos
                     Ex: "Escreva um roteiro de video para o lancamento da linha DLAB"

Para qualquer tipo, basta descrever o produto/campanha diretamente na conversa!"""


# ---------------------------------------------------------------------------
# Modelo e Agente
# ---------------------------------------------------------------------------

bedrock_model = BedrockModel(
    model_id=BEDROCK_MODEL_ID,
    region_name=BEDROCK_REGION,
    # Limita tokens para controlar custos
    max_tokens=MAX_TOKENS,
    temperature=TEMPERATURE,
)

SYSTEM_PROMPT = f"""\
Voce e o BriefFlow, um assistente de IA especializado em criar materiais
de marketing B2B para revendedores e distribuidores.

Como voce funciona:
- Voce RACIOCINA a partir do que o usuario ESCREVE na conversa.
- Nao precisa de arquivos de brief, JSON ou documentos externos.
- O usuario descreve o produto, campanha ou contexto em linguagem natural,
  e voce extrai as informacoes necessarias automaticamente.

Ferramentas disponiveis:
  gerar_material_de_marketing  -> extrai contexto da mensagem e gera o prompt do material
  salvar_material              -> salva o conteudo gerado em disco
  listar_materiais_salvos      -> lista arquivos ja gerados
  ler_material_salvo           -> le um material salvo
  tipos_de_material_disponiveis -> mostra o que voce pode criar

Regras de comportamento:
1. Quando o usuario pedir um material, use gerar_material_de_marketing para obter o prompt
   estruturado, depois use ESSE PROMPT para gerar o texto completo voce mesmo com sua LLM.
2. Apos gerar o conteudo, SEMPRE pergunte se o usuario quer salvar.
3. Se o usuario disser "salva", "salve" ou "pode salvar", use salvar_material automaticamente.
4. Se nao souber o produto/campanha, faca UMA pergunta objetiva para clarificar.
5. Limite de tokens por resposta: {MAX_TOKENS}. Para materiais longos, divida em partes
   se necessario e avise o usuario.
6. Responda SEMPRE em portugues pt-BR, de forma direta e amigavel.
7. Quando gerar um material, entregue o conteudo completo e formatado na resposta.
8. Se o usuario pedir ajustes, peca apenas o que precisa mudar (nao regenere tudo sem necessidade).

Exemplos de como voce age:
  Usuario: "Crie um podcast sobre lubrificantes DLAB para revendedores"
  Voce: [chama gerar_material_de_marketing com tipo=podcast, descricao=lubrificantes DLAB]
        [gera o roteiro completo]
        [pergunta se quer salvar]

  Usuario: "Faca emails para a campanha Compre 3 Leve 4 com foco em preco"
  Voce: [chama gerar_material_de_marketing com tipo=email, descricao=campanha Compre 3 Leve 4, detalhes=foco em preco]
        [gera os 2 emails]
        [pergunta se quer salvar]
"""

agent = Agent(
    model=bedrock_model,
    system_prompt=SYSTEM_PROMPT,
    tools=[
        gerar_material_de_marketing,
        salvar_material,
        listar_materiais_salvos,
        ler_material_salvo,
        tipos_de_material_disponiveis,
    ],
)


# ---------------------------------------------------------------------------
# Loop de chat
# ---------------------------------------------------------------------------

BANNER = """
+=======================================================+
|          BriefFlow — Assistente de Marketing          |
|  Modelo: {modelo:<38}|
|  Max tokens por resposta: {tokens:<28}|
+=======================================================+

So me diga o que precisa criar. Exemplos:
  > Crie um podcast para lancar a linha de hidraulicos DLAB
  > Escreva emails para revendedores sobre a campanha Compre 3 Leve 4
  > Gere 3 posts de Instagram com foco nos lubrificantes industriais
  > Que tipos de material voce consegue criar?
  > Liste o que ja foi salvo

Digite 'sair' para encerrar.
""".format(
    modelo=BEDROCK_MODEL_ID,
    tokens=str(MAX_TOKENS) + " tokens",
)


def main() -> None:
    print(BANNER)

    while True:
        try:
            user_input = input("Voce: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nEncerrando. Ate mais!")
            break

        if not user_input:
            continue

        if user_input.lower() in {"sair", "exit", "quit", "q"}:
            print("\nEncerrando o BriefFlow. Ate mais!")
            break

        print("\nBriefFlow: ", end="", flush=True)
        try:
            result = agent(user_input)
            print(result.message)
        except Exception as e:
            print(f"\nErro ao processar: {e}")
            logger.exception("Erro no agente")

        print()


if __name__ == "__main__":
    main()
