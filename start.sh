#!/bin/bash

echo "================================"
echo "WALGREENS SCANNER - INICIANDO"
echo "================================"

# Cargar variables de entorno
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Verificar que existe build
if [ ! -f "dist/index.js" ]; then
    echo "❌ Build no encontrado"
    echo ""
    echo "Ejecuta primero:"
    echo "  ./build-production.sh"
    echo ""
    exit 1
fi

# Iniciar servidor
echo "🚀 Iniciando servidor en puerto ${PORT:-5000}..."
echo ""
echo "Accede a: http://localhost:${PORT:-5000}"
echo "Presiona Ctrl+C para detener"
echo ""

NODE_ENV=production node dist/index.js
