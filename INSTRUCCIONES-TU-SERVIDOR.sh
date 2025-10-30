#!/bin/bash

echo "================================================"
echo "INSTALACIÓN PARA TU SERVIDOR"
echo "================================================"
echo ""
echo "Tu configuración:"
echo "  Database: postgresql://walgreens_user:***@localhost:5432/walgreens_offers"
echo ""
echo "Pasos a ejecutar EN TU SERVIDOR:"
echo ""

cat << 'STEPS'
# 1. Asegúrate que PostgreSQL está corriendo
sudo systemctl status postgresql
# Debe decir: Active (running)

# 2. Verifica que la base de datos existe
psql -U walgreens_user -d walgreens_offers -c "SELECT 1"
# Debe retornar: 1

# 3. En tu directorio de la app (/root/wcash)
cd /root/wcash

# 4. Asegúrate que .env tiene tu DATABASE_URL
cat > .env << 'ENVFILE'
DATABASE_URL="postgresql://walgreens_user:TuNuevaPass1234@localhost:5432/walgreens_offers"
ADMIN_USERNAME=admin
ADMIN_PASSWORD=cambiar123
SESSION_SECRET=$(openssl rand -base64 32 | tr -d '\n')
NODE_ENV=production
PORT=5000
ENVFILE

# 5. Reemplaza los archivos con las versiones arregladas
# (git pull o copia los nuevos install.sh y build-production.sh)

# 6. Limpia instalación anterior
rm -rf node_modules dist

# 7. Ejecuta instalación
chmod +x install.sh diagnose.sh build-production.sh start-pm2.sh
./install.sh

# 8. Si el paso anterior funciona, build:
./build-production.sh

# 9. Iniciar con PM2
npm install -g pm2
./start-pm2.sh

# 10. Verificar que funciona
curl http://localhost:5000/health
# Debe retornar: {"status":"ok",...}

# 11. Ver logs
pm2 logs walgreens-scanner
STEPS

echo ""
echo "================================================"
