import os
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/drive"]

FOLDER_ID = "1SVwzMlqpNb8uZsOzzzoZtHvCefNhLWBs"

def main():
    creds = None
    token_path = "credentials/token.json"
    creds_path = "credentials/credentials.json"

    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(creds_path, SCOPES)
            creds = flow.run_local_server(port=0)

        with open(token_path, "w") as token:
            token.write(creds.to_json())

    service = build("drive", "v3", credentials=creds)

    query = f"'{FOLDER_ID}' in parents and trashed = false"

    results = service.files().list(
        q=query,
        pageSize=100,
        fields="files(id, name, mimeType, createdTime)"
    ).execute()

    items = results.get("files", [])

    if not items:
        print("Nenhum arquivo encontrado na pasta.")
        return

    print("Arquivos da pasta monitorada:")
    for item in items:
        print(f"{item['name']} | {item['mimeType']} | {item['id']} | {item.get('createdTime', '')}")

if __name__ == "__main__":
    main()