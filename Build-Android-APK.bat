@echo off
title Build N Mart Android APK
color 0B
cd /d "%~dp0"

echo ===================================================
echo        N MART - ANDROID APK BUILD SCRIPT
echo ===================================================
echo.

set "JAVA_HOME=C:\Program Files\Java\jdk-23"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"

echo [1/4] Building web application assets...
cd client
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Error building frontend assets.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/4] Syncing assets with native Android project...
call npx cap sync android
if %ERRORLEVEL% NEQ 0 (
    echo Error syncing with Capacitor Android.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [3/4] Compiling Android APK with Gradle 8.14.3...
cd android
call "gradle-dist\gradle-8.14.3\bin\gradle.bat" assembleDebug
if %ERRORLEVEL% NEQ 0 (
    echo Gradle APK build failed.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [4/4] Copying final APK to workspace root...
cd /d "%~dp0"
copy /y "client\android\app\build\outputs\apk\debug\app-debug.apk" "NMart-POS.apk"

echo.
echo ===================================================
echo           APK BUILD SUCCESSFUL!
echo ===================================================
echo  Generated APK: "%~dp0NMart-POS.apk"
echo.
echo  How to install on any Android Phone:
echo  1. Send "NMart-POS.apk" to your phone via WhatsApp,
echo     USB cable, Bluetooth, or Google Drive.
echo  2. Tap the file on your phone and tap "Install".
echo  3. Ensure your phone is connected to the shop Wi-Fi!
echo ===================================================
echo.
pause
