#!/bin/bash

# Script de instalación automática de PostgreSQL para Walgreens Offers Explorer
# Ejecutar con: chmod +x SCRIPT_INSTALACION_DB.sh && ./SCRIPT_INSTALACION_DB.sh

echo "🚀 INSTALANDO POSTGRESQL PARA WALGREENS OFFERS EXPLORER"
echo "======================================================"

# Detectar sistema operativo
if [ -f /etc/debian_version ]; then
    OS="debian"
    echo "✅ Sistema detectado: Ubuntu/Debian"
elif [ -f /etc/redhat-release ]; then
    OS="rhel"
    echo "✅ Sistema detectado: CentOS/RHEL"
else
    echo "❌ Sistema operativo no soportado"
    exit 1
fi

# Actualizar sistema
echo "📦 Actualizando sistema..."
if [ "$OS" = "debian" ]; then
    sudo apt update && sudo apt upgrade -y
else
    sudo yum update -y
fi

# Instalar PostgreSQL
echo "🗄️ Instalando PostgreSQL..."
if [ "$OS" = "debian" ]; then
    sudo apt install postgresql postgresql-contrib -y
else
    sudo yum install postgresql-server postgresql-contrib -y
    sudo postgresql-setup initdb
fi

# Iniciar y habilitar PostgreSQL
echo "🔧 Configurando PostgreSQL..."
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Esperar a que PostgreSQL esté listo
sleep 5

# Verificar que PostgreSQL está corriendo
if sudo systemctl is-active --quiet postgresql; then
    echo "✅ PostgreSQL instalado y corriendo"
else
    echo "❌ Error: PostgreSQL no está corriendo"
    exit 1
fi

# Configurar base de datos
echo "🔐 Configurando base de datos walgreens_offers..."

# Generar password aleatorio seguro
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

# Crear usuario y base de datos
sudo -u postgres psql << EOF
CREATE DATABASE walgreens_offers;
CREATE USER walgreens_user WITH ENCRYPTED PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE walgreens_offers TO walgreens_user;
ALTER USER walgreens_user CREATEDB;
\q
EOF

# Probar conexión
echo "🔍 Probando conexión a la base de datos..."
export PGPASSWORD=$DB_PASSWORD
if psql -h localhost -U walgreens_user -d walgreens_offers -c "SELECT version();" > /dev/null 2>&1; then
    echo "✅ Conexión a base de datos exitosa"
else
    echo "❌ Error en conexión a base de datos"
    exit 1
fi

# Crear archivo .env con la configuración
echo "📝 Creando archivo de configuración..."
cat > .env << EOF
# Database Configuration - GENERADO AUTOMÁTICAMENTE
DATABASE_URL=postgresql://walgreens_user:$DB_PASSWORD@localhost:5432/walgreens_offers

# TUS API KEYS - ACTUALIZA CON TUS KEYS REALES
WALGREENS_API_KEY=uu6AyeO7XCwo5moFWSrMJ6HHhKMQ2FZW
WALGREENS_AFF_ID=AAAAAAAAAA
WALGREENS_API_KEY_CLAUDIO=uu6AyeO7XCwo5moFWSrMJ6HHhKMQ2FZW
WALGREENS_API_KEY_ESTRELLA=rTIthoVNMd81ZNE2KAuyZP5GB8HZzbsp
WALGREENS_API_KEY_RICHARD=rwwrfKcBcOG0gXXSo2S5JNEGfCwykaaB
WALGREENS_API_KEY_XAVI=NQpKJZXdhbI2KRbfApYXcvtcYHtxjyFW
WALGREENS_AFF_ID_ALL=AAAAAAAAAA
WALGREENS_API_BASE_URL=https://services.walgreens.com
PORT=5000
NODE_ENV=production
EOF

# Mostrar resumen
echo ""
echo "🎉 INSTALACIÓN COMPLETADA EXITOSAMENTE"
echo "======================================"
echo "✅ PostgreSQL instalado y configurado"
echo "✅ Base de datos 'walgreens_offers' creada"
echo "✅ Usuario 'walgreens_user' configurado"
echo "✅ Archivo .env generado con configuración completa"
echo ""
echo "📋 DATOS DE CONEXIÓN:"
echo "Database: walgreens_offers"
echo "User: walgreens_user"
echo "Password: $DB_PASSWORD"
echo "Host: localhost"
echo "Port: 5432"
echo ""
echo "🔗 String de conexión:"
echo "postgresql://walgreens_user:$DB_PASSWORD@localhost:5432/walgreens_offers"
echo ""
echo "📝 PRÓXIMOS PASOS:"
echo "1. Instalar dependencias: npm install"
echo "2. Ejecutar migraciones: npm run db:push"
echo "3. Iniciar aplicación: npm start"
echo ""
echo "🔒 IMPORTANTE: Guarda el password de la base de datos en un lugar seguro"
echo "Password de DB: $DB_PASSWORD"
echo ""

# Crear script de backup
echo "📦 Creando script de backup automático..."
cat > backup_db.sh << 'EOF'
#!/bin/bash
# Script de backup automático
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups"
mkdir -p $BACKUP_DIR
pg_dump -h localhost -U walgreens_user walgreens_offers > $BACKUP_DIR/walgreens_backup_$DATE.sql
echo "Backup created: $BACKUP_DIR/walgreens_backup_$DATE.sql"
EOF

chmod +x backup_db.sh
echo "✅ Script de backup creado: ./backup_db.sh"
echo ""
echo "🎯 INSTALACIÓN COMPLETADA - SISTEMA LISTO PARA USAR"