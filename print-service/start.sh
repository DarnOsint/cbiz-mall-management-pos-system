#!/bin/bash
# Celebiz POS Print Service Starter
# Run this on the POS machine to start the ESC/POS print service.
# The service listens on http://127.0.0.1:9101 and accepts print jobs
# from the POS web app running in Firefox.
#
# Usage:
#   chmod +x start.sh && ./start.sh
#
# Optional environment variables:
#   PRINT_SERVICE_PORT=9101   (default: 9101)
#   PRINT_SERVICE_HOST=127.0.0.1  (default: 127.0.0.1)

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Check if node is available
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is not installed. Please install Node.js from https://nodejs.org"
  exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Starting Celebiz Print Service..."
echo "Listening on http://${PRINT_SERVICE_HOST:-127.0.0.1}:${PRINT_SERVICE_PORT:-9101}"
echo "Press Ctrl+C to stop."

exec node index.js
