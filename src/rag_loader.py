"""
BriefFlow RAG Loader
--------------------
Le os arquivos Markdown do vault do Obsidian (pasta knowledge/)
e injeta o contexto relevante no prompt antes de cada geracao.

Estrategia: RAG por palavras-chave (sem embeddings) — rapido e sem dependencias extras.
Para evolucao futura com embeddings, usar LangChain + FAISS.
"""

import re
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Pasta do vault (relativa ao projeto ou configuravel via env)
KNOWLEDGE_DIR = Path("knowledge")

# Quantidade maxima de caracteres de contexto injetados no prompt
MAX_CONTEXT_CHARS = 4000

# Arquivos sempre injetados (identidade da marca, regras globais)
FIXED_FILES = [
    "identidade_visual.md",
    "tom_de_voz.md",
]


def _ler_markdown(path: Path) -> str:
    """Le um arquivo .md e remove frontmatter YAML."""
    try:
        texto = path.read_text(encoding="utf-8")
        # Remove frontmatter ---
        texto = re.sub(r"^---[\s\S]*?---\n", "", texto).strip()
        return texto
    except Exception as e:
        logger.warning("Nao foi possivel ler %s: %s", path, e)
        return ""


def _score_relevancia(texto: str, palavras_chave: list) -> int:
    """Conta quantas palavras-chave aparecem no texto (case-insensitive)."""
    texto_lower = texto.lower()
    return sum(1 for p in palavras_chave if p.lower() in texto_lower)


def _extrair_palavras_chave(mensagem: str) -> list:
    """Extrai palavras relevantes da mensagem do usuario (remove stopwords PT)."""
    stopwords = {
        "a", "o", "e", "de", "do", "da", "um", "uma", "para", "com", "em",
        "no", "na", "os", "as", "que", "se", "por", "como", "crie", "gere",
        "criar", "gerar", "me", "um", "uma", "ao", "aos"
    }
    palavras = re.findall(r"\b\w{3,}\b", mensagem.lower())
    return [p for p in palavras if p not in stopwords]


def carregar_contexto(mensagem: str, material_key: Optional[str] = None) -> str:
    """
    Carrega e retorna o contexto do vault do Obsidian relevante para a mensagem.

    Args:
        mensagem    : Mensagem do usuario (usada para busca por relevancia).
        material_key: Tipo de material sendo gerado (ex: 'banner', 'ficha').

    Returns:
        String com o contexto formatado para injecao no system prompt.
    """
    if not KNOWLEDGE_DIR.exists():
        logger.debug("Pasta knowledge/ nao encontrada. RAG desativado.")
        return ""

    palavras_chave = _extrair_palavras_chave(mensagem)
    if material_key:
        palavras_chave.append(material_key)

    contextos = []
    chars_usados = 0

    # 1. Sempre injeta arquivos fixos (identidade, tom de voz)
    for nome in FIXED_FILES:
        path = KNOWLEDGE_DIR / nome
        if path.exists():
            texto = _ler_markdown(path)
            if texto:
                bloco = f"### [{path.stem.upper().replace('_', ' ')}]\n{texto}\n"
                contextos.append(bloco)
                chars_usados += len(bloco)

    # 2. Busca arquivos relevantes na pasta knowledge/ (recursivo)
    candidatos = []
    for md_file in KNOWLEDGE_DIR.rglob("*.md"):
        # Pula arquivos fixos ja carregados
        if md_file.name in FIXED_FILES:
            continue
        texto = _ler_markdown(md_file)
        if not texto:
            continue
        score = _score_relevancia(texto + " " + md_file.name, palavras_chave)
        if score > 0:
            candidatos.append((score, md_file, texto))

    # Ordena por relevancia decrescente
    candidatos.sort(key=lambda x: x[0], reverse=True)

    # 3. Injeta candidatos ate o limite de caracteres
    for score, path, texto in candidatos:
        if chars_usados >= MAX_CONTEXT_CHARS:
            break
        bloco = f"### [{path.stem.upper().replace('_', ' ')}]\n{texto}\n"
        if chars_usados + len(bloco) <= MAX_CONTEXT_CHARS:
            contextos.append(bloco)
            chars_usados += len(bloco)

    if not contextos:
        return ""

    header = (
        "\n\n--- BASE DE CONHECIMENTO (RAG) ---\n"
        "Use as informacoes abaixo para garantir que o conteudo gerado "
        "esteja alinhado com a identidade, tom de voz e produtos da marca.\n\n"
    )
    return header + "\n".join(contextos)


def registrar_erro(mensagem_usuario: str, conteudo_gerado: str, motivo_erro: str) -> None:
    """
    Salva um exemplo ruim na pasta knowledge/erros/ para fine-tuning futuro.
    Implementa o loop de feedback de qualidade.
    """
    erros_dir = KNOWLEDGE_DIR / "erros"
    erros_dir.mkdir(parents=True, exist_ok=True)

    from datetime import datetime
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = erros_dir / f"erro_{timestamp}.md"

    conteudo = f"""# Erro de Geracao — {timestamp}

## Pedido do Usuario
{mensagem_usuario}

## Motivo do Erro
{motivo_erro}

## Conteudo Gerado (ruim)
```
{conteudo_gerado[:2000]}
```

## Tags
#erro #feedback #fine-tuning
"""
    path.write_text(conteudo, encoding="utf-8")
    logger.info("Erro registrado em %s", path)
