#!/bin/bash

echo "================================"
echo "BUILD DE PRODUCCIÓN"
echo "================================"

# 1. Clean old build
echo "🧹 Limpiando build anterior..."
rm -rf dist/

# 2. Build completo (backend + frontend)
echo "📦 Compilando aplicación..."
npm run build || {
    echo "❌ Error compilando"
    echo ""
    echo "Posibles soluciones:"
    echo "  1. Verifica que ejecutaste: npm install"
    echo "  2. Verifica que no hay errores en el código"
    echo "  3. Ejecuta: npm run check (para ver errores de TypeScript)"
    exit 1
}

echo ""
echo "✅ Build completado"
echo "Archivos generados en: dist/"
echo ""
echo "Siguiente paso:"
echo "  ./start.sh"
