import io
import os
import re
import json
import logging
import time
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
load_dotenv()

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

import litellm

# ── Configurações ─────────────────────────────────────────────────────────────
SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
DRIVE_FOLDER_ID = os.getenv("GOOGLE_DRIVE_FOLDER_ID", "").strip()
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "data/output"))
INPUT_DIR  = Path(os.getenv("INPUT_DIR",  "data/inbox"))

LLM_MODEL   = os.getenv("LLM_MODEL",   "gpt-4o-mini")   # modelo padrão rápido
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_TIMEOUT = int(os.getenv("LLM_TIMEOUT", "60"))        # segundos

# ── Logger ────────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

# ── Cache em memória ──────────────────────────────────────────────────────────
_drive_service = None
_brand_profile_cache: dict = {}


# ─────────────────────────────────────────────────────────────────────────────
# Google Drive
# ─────────────────────────────────────────────────────────────────────────────

def get_drive_service():
    global _drive_service
    if _drive_service:
        return _drive_service

    creds = None
    token_path = Path("credentials/token.json")
    creds_path = Path("credentials/credentials.json")

    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(str(creds_path), SCOPES)
            creds = flow.run_local_server(port=0)
        token_path.parent.mkdir(parents=True, exist_ok=True)
        token_path.write_text(creds.to_json(), encoding="utf-8")

    _drive_service = build("drive", "v3", credentials=creds)
    return _drive_service


def listar_arquivos_drive(folder_id: str) -> list:
    service = get_drive_service()
    query  = f"'{folder_id}' in parents and trashed = false"
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
        or f["name"].lower().endswith((".txt", ".docx"))
    ]
    logger.info("Drive: %d arquivo(s) encontrados.", len(processable))
    return processable


def baixar_arquivo_drive(file_id: str, file_name: str, mime_type: str) -> str:
    INPUT_DIR.mkdir(parents=True, exist_ok=True)
    service   = get_drive_service()
    safe_name = re.sub(r'[<>:"/\\|?*]', "_", file_name).strip()

    if mime_type == "application/vnd.google-apps.document":
        request  = service.files().export_media(fileId=file_id, mimeType="text/plain")
        out_path = INPUT_DIR / f"{Path(safe_name).stem}.txt"
    else:
        request  = service.files().get_media(fileId=file_id, supportsAllDrives=True)
        out_path = INPUT_DIR / safe_name

    with io.FileIO(str(out_path), "wb") as fh:
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()

    return str(out_path)


# ─────────────────────────────────────────────────────────────────────────────
# Brand Extractor — identifica identidade visual do site
# ─────────────────────────────────────────────────────────────────────────────

def extrair_brand_profile(url: str, conteudo_html: str) -> dict:
    """Chama o LLM para extrair paleta, fonte e tom de voz de um site."""
    if url in _brand_profile_cache:
        logger.info("Brand profile em cache para: %s", url)
        return _brand_profile_cache[url]

    brand_prompt_path = Path("src/prompts/brand_extractor_prompt.txt")
    if brand_prompt_path.exists():
        instrucoes = brand_prompt_path.read_text(encoding="utf-8")
    else:
        instrucoes = "Extraia nome, cores HEX, fonte e tom de voz do site. Retorne JSON."

    resposta = litellm.completion(
        model=LLM_MODEL,
        api_key=LLM_API_KEY,
        messages=[
            {"role": "system", "content": instrucoes},
            {"role": "user",   "content": f"URL: {url}\n\nCONTEÚDO:\n{conteudo_html[:6000]}"}
        ],
        max_tokens=800,
        temperature=0.1,
        timeout=LLM_TIMEOUT,
    )

    raw = resposta.choices[0].message.content.strip()
    try:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        profile = json.loads(match.group(0)) if match else {}
    except Exception:
        profile = {}

    _brand_profile_cache[url] = profile
    logger.info("Brand profile extraído para: %s", url)
    return profile


# ─────────────────────────────────────────────────────────────────────────────
# Detector de intenção — qual material gerar
# ─────────────────────────────────────────────────────────────────────────────

MATERIAL_MAP = {
    "banner":           "banner HTML profissional (hero com gradiente, headline bold, CTA)",
    "ficha":            "ficha técnica HTML completa (hero + stats bar + specs + tabela + rodapé)",
    "ficha tecnica":    "ficha técnica HTML completa (hero + stats bar + specs + tabela + rodapé)",
    "post linkedin":    "carrossel LinkedIn 6 slides (copy + briefing visual por slide)",
    "linkedin":         "carrossel LinkedIn 6 slides (copy + briefing visual por slide)",
    "post instagram":   "post Instagram feed 1080x1080 (legenda + hashtags + briefing visual)",
    "instagram":        "post Instagram feed 1080x1080 (legenda + hashtags + briefing visual)",
    "stories":          "sequência de 3 Instagram Stories (narrativa dor→solução→CTA + briefing)",
    "reels":            "roteiro Reels/TikTok 60s cena a cena com timecodes",
    "tiktok":           "roteiro Reels/TikTok 60s cena a cena com timecodes",
    "email":            "e-mail marketing HTML completo responsivo (Gmail + Outlook)",
    "e-mail":           "e-mail marketing HTML completo responsivo (Gmail + Outlook)",
    "google ads":       "3 variações de anúncio Google Ads RSA (headlines + descriptions + extensões)",
    "ads":              "3 variações de anúncio Google Ads RSA (headlines + descriptions + extensões)",
    "proposta":         "one-pager proposta comercial para WhatsApp/e-mail de vendas",
    "one pager":        "one-pager proposta comercial para WhatsApp/e-mail de vendas",
    "whatsapp":         "script de abordagem comercial para WhatsApp",
    "script":           "script de abordagem comercial para WhatsApp",
}


def detectar_material(mensagem: str) -> tuple[str, str]:
    """
    Detecta qual material o usuário quer gerar.
    Retorna (chave_material, descricao_material).
    Se não detectar, retorna ('livre', mensagem original).
    """
    msg_lower = mensagem.lower()
    for chave, descricao in MATERIAL_MAP.items():
        if chave in msg_lower:
            return chave, descricao
    return "livre", mensagem


# ─────────────────────────────────────────────────────────────────────────────
# Gerador principal — on-demand, gera só o que foi pedido
# ─────────────────────────────────────────────────────────────────────────────

def gerar_conteudo(
    mensagem_usuario: str,
    contexto: str = "",
    brand_profile: Optional[dict] = None,
) -> str:
    """
    Gera SOMENTE o conteúdo solicitado na mensagem.
    Sem lote, sem materiais não pedidos.

    Args:
        mensagem_usuario: O que o usuário pediu (ex: "gere um banner para o produto X")
        contexto: Texto adicional de contexto (transcrição, dados do produto, etc.)
        brand_profile: Dicionário com identidade visual da marca (opcional)

    Returns:
        str: Conteúdo gerado pelo LLM
    """
    system_prompt_path = Path("src/prompts/system_prompt.txt")
    system_prompt = (
        system_prompt_path.read_text(encoding="utf-8").strip()
        if system_prompt_path.exists()
        else "Você é um especialista em marketing digital. Gere o conteúdo solicitado com qualidade de agência premium."
    )

    # Injeta brand profile se disponível
    brand_context = ""
    if brand_profile:
        brand_context = f"""

── IDENTIDADE VISUAL DA MARCA ──
Empresa: {brand_profile.get('nome_empresa', 'N/D')}
Slogan: {brand_profile.get('slogan', 'N/D')}
Cor primária: {brand_profile.get('cores', {}).get('primaria', '#1a4b8c')}
Cor accent: {brand_profile.get('cores', {}).get('accent', '#f97316')}
Fonte: {brand_profile.get('fonte_principal', 'Inter')}
Tom de voz: {brand_profile.get('tom_de_voz', 'profissional')}
Use EXATAMENTE estas cores e fonte em todo HTML gerado.
"""

    # Monta contexto de produto/campanha se houver
    contexto_bloco = f"\n\n── CONTEXTO DO PRODUTO/CAMPANHA ──\n{contexto.strip()}" if contexto.strip() else ""

    # Detecta o material para dar instrução focada ao LLM
    chave, descricao_material = detectar_material(mensagem_usuario)
    instrucao_foco = (
        f"\n\nGere APENAS: {descricao_material}.\nNão gere outros materiais. Não explique o raciocínio. Entregue o conteúdo diretamente."
        if chave != "livre"
        else "\nEntregue o conteúdo solicitado diretamente, sem explicações."
    )

    user_message = mensagem_usuario + instrucao_foco + brand_context + contexto_bloco

    logger.info("Gerando: '%s' | Modelo: %s", chave, LLM_MODEL)
    t0 = time.time()

    resposta = litellm.completion(
        model=LLM_MODEL,
        api_key=LLM_API_KEY,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_message},
        ],
        max_tokens=4096,
        temperature=0.5,
        timeout=LLM_TIMEOUT,
    )

    conteudo = resposta.choices[0].message.content.strip()
    logger.info("Gerado em %.1fs | Tokens usados: %s", time.time() - t0,
                resposta.usage.total_tokens if resposta.usage else "N/D")
    return conteudo


def salvar_output(conteudo: str, nome_arquivo: str) -> str:
    """Salva o conteúdo gerado em OUTPUT_DIR."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    ext = ".html" if "<!DOCTYPE" in conteudo or "<html" in conteudo.lower() else ".txt"
    path = OUTPUT_DIR / f"{nome_arquivo}_{timestamp}{ext}"
    path.write_text(conteudo, encoding="utf-8")
    logger.info("Salvo em: %s", path)
    return str(path)


# ─────────────────────────────────────────────────────────────────────────────
# Interface de chat interativo
# ─────────────────────────────────────────────────────────────────────────────

def chat_loop():
    """Loop de chat interativo no terminal."""
    print("\n" + "="*60)
    print("  BriefFlow — Agente de Marketing via Chat")
    print("  Digite 'sair' para encerrar")
    print("="*60 + "\n")

    brand_profile = None
    contexto = ""

    while True:
        try:
            mensagem = input("Você: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nEncerrando BriefFlow.")
            break

        if not mensagem:
            continue
        if mensagem.lower() in ("sair", "exit", "quit"):
            print("Até logo!")
            break

        # Detecta se o usuário colou uma URL
        url_match = re.search(r'https?://[^\s]+', mensagem)
        if url_match:
            url = url_match.group(0)
            print(f"\n🔍 Analisando identidade visual de: {url}")
            print("   (Cole o HTML da página no próximo campo para extração completa,")
            print("    ou pressione Enter para pular e informar cores manualmente)")
            html_input = input("HTML da página (ou Enter para pular): ").strip()

            if html_input:
                brand_profile = extrair_brand_profile(url, html_input)
                nome = brand_profile.get("nome_empresa", "Empresa")
                cor  = brand_profile.get("cores", {}).get("primaria", "N/D")
                fonte = brand_profile.get("fonte_principal", "N/D")
                print(f"\n✅ Marca identificada: {nome} | Cor: {cor} | Fonte: {fonte}")
            else:
                print("⚠️  HTML não fornecido. Continuando sem brand profile.")
                print("   Dica: informe as cores e nome da empresa na sua mensagem.")

        # Detecta contexto de produto (transcrição ou dados extras)
        if any(k in mensagem.lower() for k in ["contexto:", "produto:", "transcrição:", "dados:"]):
            contexto = mensagem
            print("📎 Contexto registrado. Agora me diga o que gerar.")
            continue

        # Gera o conteúdo pedido
        print("\n⏳ Gerando...")
        t0 = time.time()

        try:
            resultado = gerar_conteudo(
                mensagem_usuario=mensagem,
                contexto=contexto,
                brand_profile=brand_profile,
            )

            tempo = time.time() - t0
            print(f"\n✅ Pronto em {tempo:.1f}s\n")
            print("-" * 60)
            print(resultado)
            print("-" * 60)

            # Salva automaticamente
            chave, _ = detectar_material(mensagem)
            caminho = salvar_output(resultado, chave)
            print(f"\n💾 Salvo em: {caminho}\n")

        except Exception as e:
            logger.error("Erro na geração: %s", e)
            print(f"\n❌ Erro: {e}")
            print("Verifique sua API key e conexão.\n")


# ─────────────────────────────────────────────────────────────────────────────
# Entrypoint
# ─────────────────────────────────────────────────────────────────────────────

def main():
    if not LLM_API_KEY:
        logger.warning("LLM_API_KEY não definida no .env — verifique antes de usar.")
    chat_loop()


if __name__ == "__main__":
    main()
