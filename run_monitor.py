# run_monitor.py
"""
Ponto de entrada para executar o monitor do Google Drive.

Uso:
    python run_monitor.py

Requisitos:
    - Arquivo .env configurado com:
        DRIVE_INPUT_FOLDER_ID   = ID da pasta de entrada no Drive
        DRIVE_OUTPUT_FOLDER_ID  = ID da pasta de saída no Drive (opcional)
        GOOGLE_SERVICE_ACCOUNT_FILE = caminho para o JSON da conta de serviço
        OPENAI_API_KEY          = chave da API OpenAI
        DOWNLOAD_DIR            = data/downloads  (padrão)
        OUTPUT_DIR              = data/output     (padrão)
"""
import logging
import sys

# Configuração de logging antes de qualquer import do app
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)

from app.drive_monitor import DriveMonitor  # noqa: E402


def main():
    try:
        monitor = DriveMonitor()
        monitor.process_new_files()
    except EnvironmentError as e:
        logging.error(str(e))
        logging.error(
            "\n📋 Verifique se o arquivo .env está configurado corretamente."
            "\nConsulte o README para as variáveis necessárias."
        )
        sys.exit(1)
    except FileNotFoundError as e:
        logging.error(str(e))
        sys.exit(1)
    except KeyboardInterrupt:
        logging.info("\n[Monitor] Interrompido pelo usuário.")
        sys.exit(0)
    except Exception as e:
        logging.exception(f"[Monitor] Erro inesperado: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
