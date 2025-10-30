#!/bin/bash

echo "================================"
echo "DIAGNÓSTICO DEL SISTEMA"
echo "================================"
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

# 1. Check Node.js
echo "🔍 Verificando Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        echo -e "${GREEN}✅ Node.js $(node -v)${NC}"
    else
        echo -e "${RED}❌ Node.js versión muy vieja: $(node -v)${NC}"
        echo "   Necesitas Node.js 18+"
        ERRORS=$((ERRORS+1))
    fi
else
    echo -e "${RED}❌ Node.js no instalado${NC}"
    ERRORS=$((ERRORS+1))
fi

# 2. Check .env
echo "🔍 Verificando archivo .env..."
if [ -f .env ]; then
    echo -e "${GREEN}✅ Archivo .env existe${NC}"
    
    # Check DATABASE_URL
    source .env
    if [ -z "$DATABASE_URL" ]; then
        echo -e "${RED}❌ DATABASE_URL no configurado${NC}"
        ERRORS=$((ERRORS+1))
    else
        echo -e "${GREEN}✅ DATABASE_URL configurado${NC}"
        
        # Try to connect
        if command -v psql &> /dev/null; then
            if psql "$DATABASE_URL" -c "SELECT 1" &> /dev/null; then
                echo -e "${GREEN}✅ Conexión a PostgreSQL exitosa${NC}"
            else
                echo -e "${RED}❌ No se puede conectar a PostgreSQL${NC}"
                echo "   Verifica que PostgreSQL esté corriendo"
                echo "   Verifica credenciales en DATABASE_URL"
                ERRORS=$((ERRORS+1))
            fi
        else
            echo -e "${YELLOW}⚠️  psql no instalado, no se puede verificar conexión${NC}"
            WARNINGS=$((WARNINGS+1))
        fi
    fi
else
    echo -e "${RED}❌ Archivo .env no existe${NC}"
    echo "   Ejecuta: cp .env.example .env"
    ERRORS=$((ERRORS+1))
fi

# 3. Check node_modules
echo "🔍 Verificando dependencias..."
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✅ node_modules existe${NC}"
else
    echo -e "${YELLOW}⚠️  node_modules no existe${NC}"
    echo "   Ejecuta: npm install"
    WARNINGS=$((WARNINGS+1))
fi

# 4. Check build
echo "🔍 Verificando build de producción..."
if [ -d "dist" ]; then
    echo -e "${GREEN}✅ Build existe (dist/)${NC}"
else
    echo -e "${YELLOW}⚠️  Build no existe${NC}"
    echo "   Ejecuta: npm run build"
    WARNINGS=$((WARNINGS+1))
fi

# 5. Check port
echo "🔍 Verificando puerto..."
PORT=${PORT:-5000}
if lsof -i:$PORT &> /dev/null; then
    echo -e "${YELLOW}⚠️  Puerto $PORT ya está en uso${NC}"
    echo "   Cambia PORT en .env o detén el proceso"
    WARNINGS=$((WARNINGS+1))
else
    echo -e "${GREEN}✅ Puerto $PORT disponible${NC}"
fi

# 6. Check PostgreSQL
echo "🔍 Verificando PostgreSQL..."
if command -v psql &> /dev/null; then
    echo -e "${GREEN}✅ psql instalado${NC}"
    if systemctl is-active --quiet postgresql 2>/dev/null; then
        echo -e "${GREEN}✅ PostgreSQL corriendo${NC}"
    elif pgrep -x postgres > /dev/null; then
        echo -e "${GREEN}✅ PostgreSQL corriendo${NC}"
    else
        echo -e "${RED}❌ PostgreSQL no está corriendo${NC}"
        echo "   Inicia PostgreSQL: sudo systemctl start postgresql"
        ERRORS=$((ERRORS+1))
    fi
else
    echo -e "${YELLOW}⚠️  psql no instalado${NC}"
    WARNINGS=$((WARNINGS+1))
fi

# 7. Check PM2
echo "🔍 Verificando PM2..."
if command -v pm2 &> /dev/null; then
    echo -e "${GREEN}✅ PM2 instalado${NC}"
else
    echo -e "${YELLOW}⚠️  PM2 no instalado (opcional)${NC}"
    echo "   Para producción: npm install -g pm2"
    WARNINGS=$((WARNINGS+1))
fi

# 8. Check drivers
echo "🔍 Verificando drivers de base de datos..."
if [ -f "node_modules/@neondatabase/serverless/index.js" ]; then
    echo -e "${GREEN}✅ Neon driver instalado${NC}"
fi
if [ -f "node_modules/pg/lib/index.js" ]; then
    echo -e "${GREEN}✅ PostgreSQL driver (pg) instalado${NC}"
fi

echo ""
echo "================================"
echo "RESUMEN"
echo "================================"
echo -e "Errores: ${RED}$ERRORS${NC}"
echo -e "Advertencias: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ Sistema listo para correr${NC}"
    echo ""
    echo "Siguiente paso:"
    echo "  ./start.sh"
    exit 0
else
    echo -e "${RED}❌ Hay $ERRORS error(es) que deben resolverse${NC}"
    exit 1
fi
