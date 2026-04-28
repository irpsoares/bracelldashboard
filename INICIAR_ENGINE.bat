@echo off
chcp 65001 >nul
title Bracell Dashboard Engine - Loop 30min
color 0A

echo ===============================================================
echo  ENGINE EM EXECUCAO - Refresh automatico a cada 30 minutos
echo ===============================================================
echo.
echo MANTENHA ESTA JANELA ABERTA durante a apresentacao
echo Pressione Ctrl+C para encerrar
echo.

cd /d "%~dp0"
python data_engine.py
