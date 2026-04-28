@echo off
chcp 65001 >nul
title Bracell Dashboard - Instalacao
color 0B

echo ===============================================================
echo  BRACELL EXECUTIVE CONTROL TOWER - INSTALACAO
echo ===============================================================
echo.

cd /d "%~dp0"

echo [1/3] Verificando Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERRO: Python nao encontrado.
    echo Instale Python 3.9+ em https://www.python.org/downloads/
    echo Marque "Add Python to PATH" durante a instalacao.
    echo.
    pause
    exit /b 1
)
python --version
echo.

echo [2/3] Atualizando pip...
python -m pip install --upgrade pip --quiet
echo OK
echo.

echo [3/3] Instalando dependencias...
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo.
    echo ERRO ao instalar dependencias.
    pause
    exit /b 1
)
echo.

echo ===============================================================
echo  INSTALACAO CONCLUIDA
echo ===============================================================
echo.
echo Proximos passos:
echo   1) Execute ATUALIZAR_AGORA.bat para popular dados pela 1a vez
echo   2) Abra index.html no Live Server (VSCode)
echo   3) Execute INICIAR_ENGINE.bat para refresh automatico (30min)
echo.
pause
