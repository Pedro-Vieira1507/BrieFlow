@echo off
echo ========================================
echo   BriefFlow ^- Setup Windows
echo ========================================
echo.

REM Verifica Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Python nao encontrado.
    echo Instale em: https://www.python.org/downloads/
    echo Marque "Add Python to PATH" na instalacao.
    pause
    exit /b 1
)

echo [OK] Python encontrado.
echo.

REM Instala dependencias Python
echo Instalando dependencias Python...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

if %errorlevel% neq 0 (
    echo [ERRO] Falha ao instalar dependencias Python.
    pause
    exit /b 1
)

echo.
echo [OK] Dependencias Python instaladas.
echo.

REM Instala Playwright
echo Instalando Chromium para renderizacao PNG/PDF...
python -m playwright install chromium

echo.
echo ========================================
echo   Setup concluido!
echo ========================================
echo.
echo Para iniciar o BriefFlow:
echo.
echo   Terminal 1 (API):
echo     python -m uvicorn api.main:app --reload --port 8000
echo.
echo   Terminal 2 (Interface web):
echo     npm run dev
echo.
echo   Ou use o start.bat para subir tudo de uma vez.
echo.
pause
