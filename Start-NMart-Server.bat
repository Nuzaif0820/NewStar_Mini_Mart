@echo off
title N Mart POS & Inventory Server
color 0A
cd /d "%~dp0"

echo ===================================================
echo           N MART POS & INVENTORY SYSTEM
echo ===================================================
echo.
echo Starting N Mart Server...
start "" cmd /c "node server\server.js"

timeout /t 2 /nobreak >nul

echo Opening N Mart POS Terminal in browser...
start http://localhost:5000

echo.
echo ===================================================
echo  Server is now running!
echo  Local PC Address  : http://localhost:5000
echo  Android Phone App : Open Settings to see Wi-Fi QR
echo ===================================================
echo  Do not close this window while operating the shop.
echo ===================================================
echo.
pause
