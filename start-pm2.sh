#!/bin/bash

echo "================================"
echo "WALGREENS SCANNER - PM2 START"
echo "================================"

# Verificar PM2
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 no está instalado"
    echo "Instala PM2 con: npm install -g pm2"
    exit 1
fi

# Cargar variables de entorno del .env
if [ -f .env ]; then
    echo "📋 Cargando variables de entorno desde .env..."
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "⚠️  Archivo .env no encontrado"
fi

# Detener procesos anteriores
pm2 delete walgreens-scanner 2>/dev/null || true

# Iniciar con PM2 (las variables de entorno ya están exportadas)
pm2 start ecosystem.config.cjs --update-env

# Guardar configuración
pm2 save

echo ""
echo "✅ Scanner iniciado con PM2"
echo ""
echo "Comandos útiles:"
echo "  pm2 status           - Ver estado"
echo "  pm2 logs             - Ver logs en tiempo real"
echo "  pm2 restart all      - Reiniciar"
echo "  pm2 stop all         - Detener"
echo ""
