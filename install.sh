#!/bin/bash
set -e

echo "================================"
echo "WALGREENS SCANNER - INSTALACIÓN"
echo "================================"
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Verificar Node.js
echo -e "${YELLOW}[1/5]${NC} Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js no está instalado${NC}"
    echo "Instala Node.js 18+ desde: https://nodejs.org"
    exit 1
fi
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js versión $NODE_VERSION es muy vieja${NC}"
    echo "Necesitas Node.js 18 o superior"
    exit 1
fi
echo -e "${GREEN}✅ Node.js $(node -v) detectado${NC}"

# 2. Verificar archivo .env
echo -e "${YELLOW}[2/5]${NC} Verificando configuración..."
if [ ! -f .env ]; then
    echo -e "${RED}❌ Archivo .env no encontrado${NC}"
    echo ""
    echo "Crea tu archivo .env:"
    echo "  cp .env.example .env"
    echo "  nano .env"
    echo ""
    echo "Edita al menos:"
    echo "  - DATABASE_URL (tu conexión PostgreSQL)"
    echo "  - ADMIN_PASSWORD (tu contraseña de admin)"
    echo "  - SESSION_SECRET (un string random)"
    exit 1
fi
echo -e "${GREEN}✅ Archivo .env encontrado${NC}"

# 3. Instalar dependencias
echo -e "${YELLOW}[3/5]${NC} Instalando dependencias..."
npm install
echo -e "${GREEN}✅ Dependencias instaladas${NC}"

# 4. Verificar PostgreSQL
echo -e "${YELLOW}[4/5]${NC} Verificando base de datos..."
source .env
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL no está configurado en .env${NC}"
    exit 1
fi
echo -e "${GREEN}✅ DATABASE_URL configurado${NC}"

# 5. Crear/actualizar base de datos
echo -e "${YELLOW}[5/5]${NC} Inicializando base de datos..."
npm run db:push --force || {
    echo -e "${RED}❌ Error al crear base de datos${NC}"
    echo "Verifica que PostgreSQL esté corriendo y DATABASE_URL sea correcto"
    exit 1
}
echo -e "${GREEN}✅ Base de datos inicializada${NC}"

echo ""
echo "================================"
echo -e "${GREEN}✅ INSTALACIÓN COMPLETA${NC}"
echo "================================"
echo ""
echo "Siguiente paso:"
echo "  ./start.sh"
echo ""
echo "Luego accede a:"
echo "  http://localhost:5000"
echo ""
echo "Login:"
echo "  Usuario: $ADMIN_USERNAME"
echo "  Contraseña: [la que pusiste en .env]"
echo ""
echo "Configurar API Keys:"
echo "  1. Login en http://localhost:5000"
echo "  2. Ve a la pestaña 'Configuration'"
echo "  3. Agrega tus API keys de Walgreens"
echo ""
