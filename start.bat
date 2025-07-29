@echo off
echo.
echo 🌱 Degrowth London - Development Server
echo ====================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first:
    echo    Visit: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js found:
node --version

REM Check if npm is available
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ npm is not available. Please install npm.
    pause
    exit /b 1
)

echo ✅ npm found:
npm --version
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo 📦 Installing dependencies...
    npm install
    echo.
    if %errorlevel% neq 0 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
    echo ✅ Dependencies installed successfully!
    echo.
) else (
    echo ✅ Dependencies already installed
    echo.
)

REM Start the development server
echo 🚀 Starting development server...
echo    Press Ctrl+C to stop the server
echo.
npm start

pause
