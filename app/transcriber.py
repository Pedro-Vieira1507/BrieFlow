from pathlib import Path
import shutil

from faster_whisper import WhisperModel

INBOX_DIR = Path("data/inbox")
PROCESSED_DIR = Path("data/processed")


def transcribe_file_local(model: WhisperModel, path: Path) -> Path:
    print(f"[TRANSCRIÇÃO LOCAL] {path.name}")

    segments, info = model.transcribe(
        str(path),
        language="pt",
        vad_filter=True,
    )

    lines = []
    for segment in segments:
        text = segment.text.strip()
        if text:
            lines.append(text)

    txt_path = path.with_suffix(".txt")
    txt_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"[OK] Transcrição salva em: {txt_path}")
    return txt_path


def move_to_processed(path: Path):
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    dest = PROCESSED_DIR / path.name
    shutil.move(str(path), dest)
    print(f"[MOVIDO] {path.name} -> {dest}")


def transcribe_inbox():
    model = WhisperModel("small", device="cpu", compute_type="int8")

    if not INBOX_DIR.exists():
        print(f"Pasta {INBOX_DIR} não existe.")
        return

    for path in INBOX_DIR.iterdir():
        if not path.is_file():
            continue
        if path.suffix.lower() not in {".mp4", ".mp3", ".wav", ".m4a"}:
            continue

        txt_path = path.with_suffix(".txt")
        if txt_path.exists():
            print(f"[IGNORADO] Já existe transcrição: {txt_path.name}")
            # mesmo assim movemos o arquivo original, pois já foi processado
            move_to_processed(path)
            continue

        transcribe_file_local(model, path)
        move_to_processed(path)


if __name__ == "__main__":
    transcribe_inbox()