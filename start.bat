@echo off
echo ========================================
echo   BriefFlow ^- Iniciando...
echo ========================================
echo.

REM Verifica .env
if not exist .env (
    echo [AVISO] Arquivo .env nao encontrado.
    echo Copiando .env.example para .env...
    copy .env.example .env
    echo.
    echo Edite o arquivo .env com suas API keys antes de continuar.
    echo Abrindo .env para edicao...
    notepad .env
    echo.
)

echo Iniciando API Python na porta 8000...
start "BriefFlow API" cmd /k "python -m uvicorn api.main:app --reload --port 8000"

timeout /t 2 /nobreak >nul

echo Iniciando interface web na porta 5173...
start "BriefFlow Web" cmd /k "npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo   BriefFlow rodando!
echo ========================================
echo.
echo   Interface web: http://localhost:5173
echo   API:           http://localhost:8000
echo   Docs da API:   http://localhost:8000/docs
echo.
echo Pressione qualquer tecla para abrir no navegador...
pause >nul

start http://localhost:5173
