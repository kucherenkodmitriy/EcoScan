#!/bin/bash

# Frontend Development Startup Script

set -e

echo "🌐 Starting EcoScan Frontend Development Server..."

# Navigate to frontend directory
cd infrastructure/frontend

# Check if node_modules exists, if not install dependencies
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    pnpm install
fi

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
    echo "📝 Creating .env.local file..."
    cat > .env.local << EOF
# Frontend Environment Variables for Local Development
VITE_API_ENDPOINT=http://localhost:4566
VITE_AWS_REGION=eu-central-1
VITE_USER_POOL_ID=us-east-1_example
VITE_USER_POOL_CLIENT_ID=example
VITE_OAUTH_DOMAIN=example.auth.us-east-1.amazoncognito.com
VITE_APP_URL=http://localhost:5173
EOF
fi

# Start development server
echo "🚀 Starting Vite development server..."
pnpm run dev 