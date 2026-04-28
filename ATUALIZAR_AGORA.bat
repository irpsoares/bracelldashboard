@echo off
chcp 65001 >nul
title Bracell Dashboard - Atualizacao Manual
color 0E

echo ===============================================================
echo  ATUALIZACAO MANUAL - 1 ciclo completo
echo ===============================================================
echo.
echo Coletando: Mercado (BCB+AlphaVantage) + Gas Natural + Noticias
echo Tempo estimado: 60-90 segundos
echo.

cd /d "%~dp0"
python data_engine.py --once

echo.
echo ===============================================================
echo  CICLO FINALIZADO
echo ===============================================================
echo.
echo Verifique os dados em data\internal\
echo Logs em logs\
echo.
pause
