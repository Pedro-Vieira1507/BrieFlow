"""
briefflow_chat.py — Interface conversacional do BriefFlow.

Uso:
    python briefflow_chat.py

O agente responde em linguagem natural e executa as tools automaticamente
com base no que você pede. Exemplos de comandos:

    "Gere o podcast da campanha Compre 3 Leve 4"
    "Crie os slides de capacitação do brief DLAB.brief.json"
    "Gere todos os materiais do brief que está na inbox"
    "Liste os briefs disponíveis"
    "Mostre o conteúdo do podcast gerado"
"""

import io
import json
import logging
import os
import random
import re
import time
from pathlib import Path
from typing import Dict, List, Optional

from dotenv import load_dotenv
load_dotenv()

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

from strands import Agent, tool
from strands.models import BedrockModel

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    format="%(asctime)s | %(levelname)s | %(message)s",
    level=logging.INFO,
)
logging.getLogger("strands").setLevel(logging.WARNING)  # menos verboso no chat
logger = logging.getLogger("briefflow")

# ---------------------------------------------------------------------------
# Config via .env
# ---------------------------------------------------------------------------
INBOX_DIR   = Path(os.getenv("INPUT_DIR",   "data/inbox"))
OUTPUT_DIR  = Path(os.getenv("OUTPUT_DIR",  "data/output"))
DRIVE_FOLDER_ID = os.getenv("GOOGLE_DRIVE_FOLDER_ID", "").strip()

TOTAL_MATERIALS   = int(os.getenv("TOTAL_MATERIALS", "8"))
BEDROCK_MODEL_ID  = os.getenv("BEDROCK_MODEL_ID", "us.anthropic.claude-3-7-sonnet-20250219-v1:0")
BEDROCK_REGION    = os.getenv("AWS_DEFAULT_REGION", "us-east-1")

GOOGLE_SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

# ---------------------------------------------------------------------------
# Helpers internos (não são @tool — são chamados pelas tools)
# ---------------------------------------------------------------------------

def _get_drive_service():
    creds = None
    token_path = Path("credentials/token.json")
    creds_path = Path("credentials/credentials.json")
    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), GOOGLE_SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not creds_path.exists():
                raise FileNotFoundError(f"Credenciais não encontradas: {creds_path}")
            flow = InstalledAppFlow.from_client_secrets_file(str(creds_path), GOOGLE_SCOPES)
            creds = flow.run_local_server(port=0)
        token_path.parent.mkdir(parents=True, exist_ok=True)
        token_path.write_text(creds.to_json(), encoding="utf-8")
    return build("drive", "v3", credentials=creds)


def _parse_materials(raw_text: str) -> Dict[str, str]:
    """Fatia o texto do LLM nos marcadores MATERIAL 1 ... MATERIAL N."""
    materials: Dict[str, str] = {}
    for i in range(1, TOTAL_MATERIALS + 1):
        next_marker = f"MATERIAL\\s*{i + 1}" if i < TOTAL_MATERIALS else None
        lookahead = f"(?=\\n{next_marker}|\\Z)" if next_marker else "(?=\\Z)"
        pattern = rf"(MATERIAL\s*{i}.*?){lookahead}"
        match = re.search(pattern, raw_text, flags=re.IGNORECASE | re.DOTALL)
        materials[f"material_{i}"] = match.group(1).strip() if match else ""
    return materials


# ---------------------------------------------------------------------------
# TOOLS do agente
# ---------------------------------------------------------------------------

@tool
def listar_briefs() -> str:
    """
    Lista todos os arquivos .brief.json disponíveis na pasta inbox local.

    Returns:
        str: Lista formatada dos briefs encontrados com seus caminhos.
    """
    briefs = sorted(INBOX_DIR.glob("*.brief.json")) if INBOX_DIR.exists() else []
    if not briefs:
        return f"Nenhum brief encontrado em '{INBOX_DIR}'. Faça o upload de um .brief.json ou use 'baixar_brief_do_drive' para importar do Drive."
    linhas = [f"📄 {b.name}  →  {b}" for b in briefs]
    return f"Briefs disponíveis ({len(briefs)}):\n" + "\n".join(linhas)


@tool
def ler_brief(nome_arquivo: str) -> str:
    """
    Lê o conteúdo de um arquivo .brief.json da pasta inbox.

    Args:
        nome_arquivo (str): Nome do arquivo .brief.json (ex: 'campanha_dlab.brief.json').
                            Pode ser também o caminho completo.

    Returns:
        str: Conteúdo JSON do brief formatado.
    """
    path = Path(nome_arquivo)
    if not path.exists():
        path = INBOX_DIR / nome_arquivo
    if not path.exists():
        return f"❌ Arquivo não encontrado: {nome_arquivo}"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return json.dumps(data, ensure_ascii=False, indent=2)
    except Exception as e:
        return f"❌ Erro ao ler brief: {e}"


@tool
def baixar_brief_do_drive(folder_id: str = "") -> str:
    """
    Busca arquivos .brief.json ou transcrições .txt/.docx na pasta do Google Drive
    e os baixa para a inbox local.

    Args:
        folder_id (str): ID da pasta no Google Drive. Se vazio, usa GOOGLE_DRIVE_FOLDER_ID do .env.

    Returns:
        str: Resumo dos arquivos baixados.
    """
    fid = folder_id.strip() or DRIVE_FOLDER_ID
    if not fid:
        return "❌ folder_id não informado e GOOGLE_DRIVE_FOLDER_ID não está no .env."

    try:
        service = _get_drive_service()
    except Exception as e:
        return f"❌ Falha de autenticação com Google Drive: {e}"

    query = f"'{fid}' in parents and trashed = false"
    fields = "nextPageToken, files(id,name,mimeType)"
    all_files, page_token = [], None

    while True:
        params = dict(q=query, fields=fields, pageSize=100,
                      includeItemsFromAllDrives=True, supportsAllDrives=True)
        if page_token:
            params["pageToken"] = page_token
        result = service.files().list(**params).execute()
        all_files.extend(result.get("files", []))
        page_token = result.get("nextPageToken")
        if not page_token:
            break

    processable = [
        f for f in all_files
        if f["mimeType"] in {"text/plain", "application/vnd.google-apps.document"}
        or f["name"].lower().endswith((".txt", ".docx", ".json"))
    ]

    if not processable:
        return f"Nenhum arquivo processável encontrado na pasta '{fid}'."

    INBOX_DIR.mkdir(parents=True, exist_ok=True)
    baixados = []

    for f in processable:
        safe = re.sub(r'[<>:"/\\|?*]', "_", f["name"]).strip()
        try:
            if f["mimeType"] == "application/vnd.google-apps.document":
                req = service.files().export_media(fileId=f["id"], mimeType="text/plain")
                out = INBOX_DIR / f"{Path(safe).stem}.txt"
            else:
                req = service.files().get_media(fileId=f["id"], supportsAllDrives=True)
                out = INBOX_DIR / safe

            with io.FileIO(str(out), "wb") as fh:
                dl = MediaIoBaseDownload(fh, req)
                done = False
                while not done:
                    _, done = dl.next_chunk()
            baixados.append(out.name)
        except Exception as e:
            baixados.append(f"{f['name']} (ERRO: {e})")

    return f"✅ {len(baixados)} arquivo(s) baixados para '{INBOX_DIR}':\n" + "\n".join(f"  • {n}" for n in baixados)


@tool
def gerar_material(
    tipo: str,
    brief_json: str,
    instrucoes_extras: str = "",
) -> str:
    """
    Gera um único material de marketing com base no brief e no tipo solicitado.

    Args:
        tipo (str): Tipo do material. Valores aceitos:
                    'podcast', 'slides', 'ficha', 'email', 'folheto',
                    'post_instagram', 'post_linkedin', 'roteiro_video'.
        brief_json (str): Conteúdo do brief como string JSON.
        instrucoes_extras (str): Instruções adicionais do usuário para personalizar
                                 o material (ex: 'tom mais descontraído', 'foco em preço').

    Returns:
        str: Texto do material gerado.
    """
    try:
        brief = json.loads(brief_json)
    except Exception:
        brief = {"contexto": brief_json}

    PROMPTS = {
        "podcast": """Crie um ROTEIRO DE PODCAST de até 5 minutos voltado para REVENDEDORES sobre
        a linha de produtos do contexto. Blocos: Introdução, Desenvolvimento, Encerramento.
        Destaque 2-3 vantagens chave e termine com chamada forte. Português pt-BR.""",

        "slides": """Monte uma ESTRUTURA DE 10 SLIDES para capacitação técnica de REVENDEDORES.
        Use EXATAMENTE o formato:\nSlide 1 - Título:\n- ...\nSlide 2 - Assunto:\n- ...\nPortuguês pt-BR.""",

        "ficha": """Crie uma FICHA TÉCNICA textual para vendedores com 2-3 diferenciais práticos
        por subcategoria. Foco em argumentação contra concorrentes. Português pt-BR.""",

        "email": """Crie 2 EMAILS DE MARKETING para REVENDEDORES:\nEMAIL 1 — Apresentação e posicionamento.\n
        EMAIL 2 — Oferta e urgência. Cada um com: Assunto, Pré-header, Corpo. Português pt-BR.""",

        "folheto": """Crie o TEXTO DE UM FOLHETO PROMOCIONAL formato A4 dobrado (3 painéis):\n
        Capa (título + subtítulo), Painel 2 (produtos + benefícios em bullets),
        Painel 3 (oferta + CTA + contato). Máx 150 palavras por painel. Português pt-BR.""",

        "post_instagram": """Crie 3 POSTS PARA INSTAGRAM voltados para revendedores:\n
        Cada post com: legenda (máx 150 palavras), hashtags e sugestão de imagem. Português pt-BR.""",

        "post_linkedin": """Crie 2 POSTS PARA LINKEDIN voltados para revendedores B2B:\n
        Tom profissional, com gancho, desenvolvimento e CTA. Máx 200 palavras cada. Português pt-BR.""",

        "roteiro_video": """Crie um ROTEIRO DE VÍDEO CURTO (60-90s) para REVENDEDORES:\n
        Blocos: Hook (5s), Problema (10s), Solução (30s), Prova (15s), CTA (10s). Português pt-BR.""",
    }

    instrucao_base = PROMPTS.get(tipo.lower().strip())
    if not instrucao_base:
        tipos_validos = ", ".join(PROMPTS.keys())
        return f"❌ Tipo '{tipo}' não reconhecido. Tipos válidos: {tipos_validos}"

    extra = f"\n\nINSTRUÇÕES ADICIONAIS DO USUÁRIO:\n{instrucoes_extras}" if instrucoes_extras.strip() else ""

    prompt = f"""
Contexto do brief (JSON):
{json.dumps(brief, ensure_ascii=False, indent=2)}

Tarefa:
{instrucao_base}{extra}
""".strip()

    # Retorna o prompt para o agente gerar — o próprio LLM do agente processa
    return f"__GERAR_COM_LLM__{prompt}"


@tool
def gerar_todos_materiais(nome_brief: str, instrucoes_extras: str = "") -> str:
    """
    Gera todos os materiais de marketing (podcast, slides, ficha, email, folheto)
    para um brief e salva em data/output/<nome_brief>/.

    Args:
        nome_brief (str): Nome do arquivo .brief.json na inbox (ex: 'campanha.brief.json').
        instrucoes_extras (str): Instruções adicionais para personalizar todos os materiais.

    Returns:
        str: Resumo do que foi gerado e onde foi salvo.
    """
    path = Path(nome_brief)
    if not path.exists():
        path = INBOX_DIR / nome_brief
    if not path.exists():
        return f"❌ Brief não encontrado: {nome_brief}"

    try:
        brief = json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        return f"❌ Erro ao ler brief: {e}"

    base = path.stem.replace(".brief", "")
    out_dir = OUTPUT_DIR / base
    out_dir.mkdir(parents=True, exist_ok=True)

    extra = f"\n\nINSTRUÇÕES ADICIONAIS:\n{instrucoes_extras}" if instrucoes_extras.strip() else ""
    brief_str = json.dumps(brief, ensure_ascii=False, indent=2)

    TIPOS = {
        "podcast":  ("podcast_revendedores.txt",    0.5),
        "slides":   ("slides_capacitacao_10.txt",   0.4),
        "ficha":    ("ficha_tecnica_vendedores.txt", 0.4),
        "email":    ("emails_marketing.txt",        0.6),
        "folheto":  ("folheto_promocional.txt",     0.6),
    }

    return (
        f"__GERAR_TODOS__{base}\n"
        f"__BRIEF_JSON__{brief_str}\n"
        f"__OUT_DIR__{out_dir}\n"
        f"__EXTRA__{extra}"
    )


@tool
def salvar_material(conteudo: str, nome_arquivo: str, subpasta: str = "") -> str:
    """
    Salva o conteúdo de um material gerado em um arquivo .txt em data/output/.

    Args:
        conteudo (str): Texto do material a ser salvo.
        nome_arquivo (str): Nome do arquivo de saída (ex: 'podcast_campanha.txt').
        subpasta (str): Subpasta dentro de data/output/ (ex: 'campanha_dlab').

    Returns:
        str: Caminho completo do arquivo salvo.
    """
    out_dir = OUTPUT_DIR / subpasta if subpasta else OUTPUT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / nome_arquivo
    try:
        out_path.write_text(conteudo.strip() + "\n", encoding="utf-8")
        return f"✅ Material salvo em: {out_path}"
    except OSError as e:
        return f"❌ Erro ao salvar: {e}"


@tool
def listar_materiais_gerados(subpasta: str = "") -> str:
    """
    Lista todos os materiais já gerados em data/output/.

    Args:
        subpasta (str): Subpasta específica para listar (opcional).

    Returns:
        str: Lista dos arquivos gerados com seus tamanhos.
    """
    base = OUTPUT_DIR / subpasta if subpasta else OUTPUT_DIR
    if not base.exists():
        return f"Nenhum material gerado ainda em '{base}'."

    arquivos = sorted(base.rglob("*.txt")) + sorted(base.rglob("*.json")) + sorted(base.rglob("*.pptx"))
    if not arquivos:
        return f"Nenhum arquivo encontrado em '{base}'."

    linhas = [f"  📄 {a.relative_to(OUTPUT_DIR)}  ({a.stat().st_size // 1024} KB)" for a in arquivos]
    return f"Materiais gerados ({len(arquivos)}):\n" + "\n".join(linhas)


@tool
def ler_material_gerado(nome_arquivo: str, subpasta: str = "") -> str:
    """
    Lê e exibe o conteúdo de um material já gerado.

    Args:
        nome_arquivo (str): Nome do arquivo (ex: 'podcast_revendedores.txt').
        subpasta (str): Subpasta dentro de data/output/ (opcional).

    Returns:
        str: Conteúdo completo do arquivo.
    """
    base = OUTPUT_DIR / subpasta if subpasta else OUTPUT_DIR
    path = base / nome_arquivo
    if not path.exists():
        # tenta buscar recursivamente
        found = list(OUTPUT_DIR.rglob(nome_arquivo))
        if found:
            path = found[0]
        else:
            return f"❌ Arquivo não encontrado: {nome_arquivo}"
    return path.read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# Agente
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """Você é o BriefFlow, um assistente especializado em criação de materiais
de marketing B2B para revendedores, integrado ao Google Drive.

Você tem acesso às seguintes ferramentas:

• listar_briefs           → mostra os briefs disponíveis na inbox local
• ler_brief               → lê o conteúdo de um brief específico
• baixar_brief_do_drive   → importa arquivos do Google Drive para a inbox
• gerar_material          → gera um material específico (podcast, slides, ficha, email, folheto, post_instagram, post_linkedin, roteiro_video)
• gerar_todos_materiais   → gera todos os materiais de uma vez para um brief
• salvar_material         → salva um material gerado em disco
• listar_materiais_gerados → lista o que já foi gerado
• ler_material_gerado     → lê um material já salvo

Regras de comportamento:
1. Seja proativo: quando o usuário pedir um material, chame a tool correta imediatamente.
2. Quando gerar_material ou gerar_todos_materiais retornar texto começando com '__GERAR_COM_LLM__',
   use o prompt que vem depois para gerar o conteúdo você mesmo, depois salve automaticamente
   com salvar_material.
3. Quando gerar_todos_materiais retornar '__GERAR_TODOS__', gere cada material individualmente
   (podcast, slides, ficha, email, folheto) e salve cada um automaticamente.
4. Sempre confirme o que foi gerado e onde foi salvo.
5. Se o usuário não especificar qual brief usar e houver mais de um, pergunte qual.
6. Se o usuário pedir ajustes em um material já gerado, leia o material, ajuste e salve novamente.
7. Responda sempre em português pt-BR, de forma direta e amigável.
8. Quando listar arquivos ou materiais, use formatação clara com emojis.

Exemplos do que você pode fazer:
- "Gere o podcast da campanha DLAB"
- "Crie todos os materiais do brief campanha_q3.brief.json"
- "Baixe os arquivos do Drive"
- "Quais materiais já foram gerados?"
- "Refaça o folheto com tom mais direto e foco em preço"
- "Mostre o conteúdo do email gerado"
"""

bedrock_model = BedrockModel(
    model_id=BEDROCK_MODEL_ID,
    region_name=BEDROCK_REGION,
    temperature=0.5,
)

agent = Agent(
    model=bedrock_model,
    system_prompt=SYSTEM_PROMPT,
    tools=[
        listar_briefs,
        ler_brief,
        baixar_brief_do_drive,
        gerar_material,
        gerar_todos_materiais,
        salvar_material,
        listar_materiais_gerados,
        ler_material_gerado,
    ],
)


# ---------------------------------------------------------------------------
# Loop de chat
# ---------------------------------------------------------------------------

BANNER = """
╔══════════════════════════════════════════════════════╗
║          BriefFlow — Assistente de Marketing         ║
║  Digite sua solicitação ou 'sair' para encerrar.     ║
╚══════════════════════════════════════════════════════╝

Exemplos:
  • Gere o podcast da campanha DLAB
  • Crie todos os materiais do brief disponível
  • Baixe os arquivos do Drive
  • Quais materiais já foram gerados?
  • Refaça o email com tom mais urgente
"""


def main() -> None:
    print(BANNER)

    while True:
        try:
            user_input = input("\nVocê: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n\nEncerrando o BriefFlow. Até mais!")
            break

        if not user_input:
            continue

        if user_input.lower() in {"sair", "exit", "quit", "q"}:
            print("\nEncerrando o BriefFlow. Até mais!")
            break

        print("\nBriefFlow: ", end="", flush=True)
        try:
            result = agent(user_input)
            print(result.message)
        except Exception as e:
            print(f"\n❌ Erro ao processar: {e}")
            logger.exception("Erro no agente")


if __name__ == "__main__":
    main()
