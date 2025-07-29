#!/bin/bash

# Degrowth London - Setup Script
# This script helps set up the development environment

set -e

echo "🌱 Degrowth London - Development Setup"
echo "======================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first:"
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2)
REQUIRED_VERSION="14.0.0"

if ! node -e "process.exit(process.version.slice(1).split('.').map(Number).reduce((a,b,i)=>(a*1000+b),0) >= ${REQUIRED_VERSION//./000} ? 0 : 1)" 2>/dev/null; then
    echo "❌ Node.js version $NODE_VERSION is too old. Please upgrade to v$REQUIRED_VERSION or newer."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not available. Please install npm."
    exit 1
fi

echo "✅ npm version: $(npm --version)"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 Installing dependencies..."
    npm install
    echo "✅ Dependencies installed successfully!"
else
    echo "✅ Dependencies already installed"
fi

# Check if all required files exist
echo ""
echo "🔍 Checking project structure..."

REQUIRED_FILES=(
    "london.html"
    "assets/styles.css"
    "assets/app.js"
    "assets/story-data.json"
    "package.json"
    "server.js"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ Missing: $file"
        exit 1
    fi
done

echo ""
echo "🎉 Setup complete! You can now start the development server:"
echo ""
echo "   npm start"
echo "   # or"
echo "   npm run dev"
echo ""
echo "The application will be available at: http://localhost:3000"
echo ""
echo "📖 For more information, see README.md"
echo ""
echo "Happy exploring! 🌍"
