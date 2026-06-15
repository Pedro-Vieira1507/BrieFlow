import os
import re
import json
import base64
import logging
from pathlib import Path
from typing import Optional, List, Dict

logger = logging.getLogger(__name__)

KNOWLEDGE_DIR = Path("knowledge")
REFERENCIAS_DIR = KNOWLEDGE_DIR / "referencias_visuais"
MAX_CONTEXT_CHARS = 6000
FIXED_FILES = [
    "identidade_visual.md",
    "tom_de_voz.md",
]
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}


def _ler_markdown(path: Path) -> str:
    try:
        texto = path.read_text(encoding="utf-8")
        texto = re.sub(r"^---[\s\S]*?---\n", "", texto).strip()
        return texto
    except Exception as e:
        logger.warning("Nao foi possivel ler %s: %s", path, e)
        return ""


def _score_relevancia(texto: str, palavras_chave: list) -> int:
    texto_lower = texto.lower()
    return sum(1 for p in palavras_chave if p.lower() in texto_lower)


def _extrair_palavras_chave(mensagem: str) -> list:
    stopwords = {
        "a", "o", "e", "de", "do", "da", "um", "uma", "para", "com", "em",
        "no", "na", "os", "as", "que", "se", "por", "como", "crie", "gere",
        "criar", "gerar", "me", "ao", "aos", "banner", "imagem", "layout",
        "design", "referencia", "upload"
    }
    palavras = re.findall(r"\b\w{3,}\b", mensagem.lower())
    return [p for p in palavras if p not in stopwords]


def _mime_type(path: Path) -> str:
    ext = path.suffix.lower()
    if ext == ".png":
        return "image/png"
    if ext in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if ext == ".webp":
        return "image/webp"
    return "application/octet-stream"


def _imagem_para_data_url(path: Path) -> str:
    data = base64.b64encode(path.read_bytes()).decode("utf-8")
    return f"data:{_mime_type(path)};base64,{data}"


def _referencias_visuais_indexadas() -> List[Dict]:
    refs = []
    if not REFERENCIAS_DIR.exists():
        return refs

    for meta_file in REFERENCIAS_DIR.glob("*.json"):
        try:
            meta = json.loads(meta_file.read_text(encoding="utf-8"))
            image_path = REFERENCIAS_DIR / meta.get("file_name", "")
            if image_path.exists() and image_path.suffix.lower() in IMAGE_EXTS:
                refs.append({
                    "meta": meta,
                    "image_path": image_path,
                    "json_path": meta_file,
                })
        except Exception as e:
            logger.warning("Falha ao ler metadata %s: %s", meta_file, e)
    return refs


def carregar_contexto(mensagem: str, material_key: Optional[str] = None) -> str:
    if not KNOWLEDGE_DIR.exists():
        logger.debug("Pasta knowledge/ nao encontrada. RAG desativado.")
        return ""

    palavras_chave = _extrair_palavras_chave(mensagem)
    if material_key:
        palavras_chave.append(material_key)

    contextos = []
    chars_usados = 0

    for nome in FIXED_FILES:
        path = KNOWLEDGE_DIR / nome
        if path.exists():
            texto = _ler_markdown(path)
            if texto:
                bloco = f"### [{path.stem.upper().replace('_', ' ')}]\n{texto}\n"
                contextos.append(bloco)
                chars_usados += len(bloco)

    candidatos = []
    for md_file in KNOWLEDGE_DIR.rglob("*.md"):
        if md_file.name in FIXED_FILES:
            continue
        texto = _ler_markdown(md_file)
        if not texto:
            continue
        score = _score_relevancia(texto + " " + md_file.name, palavras_chave)
        if score > 0:
            candidatos.append((score, md_file, texto))
    candidatos.sort(key=lambda x: x[0], reverse=True)

    for score, path, texto in candidatos:
        if chars_usados >= MAX_CONTEXT_CHARS:
            break
        bloco = f"### [{path.stem.upper().replace('_', ' ')}]\n{texto}\n"
        if chars_usados + len(bloco) <= MAX_CONTEXT_CHARS:
            contextos.append(bloco)
            chars_usados += len(bloco)

    refs = _referencias_visuais_indexadas()
    if refs:
        ranked = []
        for ref in refs:
            meta_texto = " ".join([
                ref["meta"].get("title", ""),
                ref["meta"].get("description", ""),
                " ".join(ref["meta"].get("tags", [])),
                ref["meta"].get("material_type", ""),
            ])
            score = _score_relevancia(meta_texto, palavras_chave)
            if material_key and ref["meta"].get("material_type", "").lower() == material_key.lower():
                score += 3
            if score > 0:
                ranked.append((score, ref))
        ranked.sort(key=lambda x: x[0], reverse=True)

        if ranked:
            bloco_refs = ["### [REFERENCIAS VISUAIS]\nUse os layouts abaixo como referencia visual e composicional:\n"]
            for _, ref in ranked[:3]:
                meta = ref["meta"]
                bloco_refs.append(
                    f"- Titulo: {meta.get('title', 'Sem titulo')}\n"
                    f"  Tipo: {meta.get('material_type', 'geral')}\n"
                    f"  Descricao: {meta.get('description', '')}\n"
                    f"  Tags: {', '.join(meta.get('tags', []))}\n"
                    f"  Layout: {meta.get('layout_notes', '')}\n"
                )
            bloco_refs_txt = "\n".join(bloco_refs)
            if chars_usados + len(bloco_refs_txt) <= MAX_CONTEXT_CHARS:
                contextos.append(bloco_refs_txt)

    if not contextos:
        return ""

    header = (
        "\n\n--- BASE DE CONHECIMENTO (RAG) ---\n"
        "Use as informacoes abaixo para garantir que o conteudo gerado "
        "esteja alinhado com a identidade, tom de voz, produtos e referencias visuais da marca.\n\n"
    )
    return header + "\n".join(contextos)


def coletar_referencias_visuais(mensagem: str, material_key: Optional[str] = None, limite: int = 3) -> List[Dict]:
    palavras_chave = _extrair_palavras_chave(mensagem)
    if material_key:
        palavras_chave.append(material_key)

    ranked = []
    for ref in _referencias_visuais_indexadas():
        meta = ref["meta"]
        meta_texto = " ".join([
            meta.get("title", ""),
            meta.get("description", ""),
            " ".join(meta.get("tags", [])),
            meta.get("material_type", ""),
            meta.get("layout_notes", ""),
        ])
        score = _score_relevancia(meta_texto, palavras_chave)
        if material_key and meta.get("material_type", "").lower() == material_key.lower():
            score += 3
        if score > 0:
            ranked.append((score, ref))

    ranked.sort(key=lambda x: x[0], reverse=True)
    saida = []
    for _, ref in ranked[:limite]:
        saida.append({
            "title": ref["meta"].get("title", ref["image_path"].stem),
            "material_type": ref["meta"].get("material_type", "geral"),
            "description": ref["meta"].get("description", ""),
            "layout_notes": ref["meta"].get("layout_notes", ""),
            "data_url": _imagem_para_data_url(ref["image_path"]),
        })
    return saida


def registrar_erro(mensagem_usuario: str, conteudo_gerado: str, motivo_erro: str) -> None:
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


def salvar_referencia_visual(
    origem_path: Path,
    title: str,
    material_type: str,
    description: str,
    tags: List[str],
    layout_notes: str,
) -> Dict:
    REFERENCIAS_DIR.mkdir(parents=True, exist_ok=True)

    slug = re.sub(r"[^a-zA-Z0-9_-]+", "_", title.strip().lower()).strip("_") or "referencia"
    destino_img = REFERENCIAS_DIR / f"{slug}{origem_path.suffix.lower()}"
    destino_json = REFERENCIAS_DIR / f"{slug}.json"
    destino_md = REFERENCIAS_DIR / f"{slug}.md"

    destino_img.write_bytes(origem_path.read_bytes())

    payload = {
        "title": title,
        "file_name": destino_img.name,
        "material_type": material_type,
        "description": description,
        "tags": tags,
        "layout_notes": layout_notes,
    }
    destino_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    md = f"""# {title}

- Tipo: {material_type}
- Arquivo: {destino_img.name}
- Tags: {', '.join(tags)}

## Descricao
{description}

## Notas de layout
{layout_notes}
"""
    destino_md.write_text(md, encoding="utf-8")

    logger.info("Referencia visual salva em %s", destino_img)
    return payload
