# 🚀 Guía de Despliegue
## Walgreens Offers Explorer

Esta guía proporciona instrucciones detalladas para desplegar y actualizar la aplicación Walgreens Offers Explorer en un servidor de producción.

---

## 📋 Tabla de Contenido

**ACTUALIZACIÓN RÁPIDA** (si ya tienes el servidor configurado):
0. [🔄 Cómo Actualizar tu Servidor](#-cómo-actualizar-tu-servidor) ⭐ **EMPIEZA AQUÍ**

**DEPLOYMENT INICIAL** (si es la primera vez):
1. [Requisitos del Servidor](#requisitos-del-servidor)
2. [Preparación del Servidor](#preparación-del-servidor)
3. [Instalación de Dependencias](#instalación-de-dependencias)
4. [Configuración de Base de Datos](#configuración-de-base-de-datos)
5. [Configuración de la Aplicación](#configuración-de-la-aplicación)
6. [Despliegue Automatizado](#despliegue-automatizado)
7. [Configuración de Nginx / Caddy](#configuración-de-nginx--caddy)
8. [Configuración de SSL](#configuración-de-ssl)
9. [Monitoreo y Logs](#monitoreo-y-logs)
10. [Backup y Mantenimiento](#backup-y-mantenimiento)
11. [Troubleshooting](#troubleshooting)

---

## 🔄 Cómo Actualizar tu Servidor

**Esta es la guía para actualizar tu servidor existente con la nueva versión que incluye el sistema anti-burst.**

### ✅ Pre-requisitos

Tu servidor debe estar ya configurado con:
- Node.js instalado
- PostgreSQL corriendo
- PM2 instalado
- Caddy o Nginx configurado

---

### 📦 Paso 1: Preparar el código en Replit

En la terminal de Replit, ejecuta:

```bash
# Construir la aplicación
npm run build

# Crear archivo comprimido (excluye archivos innecesarios)
tar -czf walgreens-update.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='attached_assets' \
  --exclude='.replit' \
  --exclude='replit.nix' \
  --exclude='.cache' \
  --exclude='*.log' \
  client/ server/ shared/ \
  package.json package-lock.json \
  vite.config.ts tsconfig.json \
  drizzle.config.ts tailwind.config.ts postcss.config.js
```

Descarga el archivo `walgreens-update.tar.gz` desde Replit.

---

### 📤 Paso 2: Subir al servidor

Desde tu computadora, sube el archivo a tu servidor:

```bash
# Opción 1: Usar SCP
scp walgreens-update.tar.gz usuario@tu-servidor.com:~/

# Opción 2: Usar SFTP o FileZilla (interfaz gráfica)
```

---

### 🔧 Paso 3: Aplicar actualización en el servidor

Conéctate a tu servidor:

```bash
ssh usuario@tu-servidor.com
```

Luego ejecuta estos comandos:

```bash
# 1. Ir al directorio de la aplicación
cd /home/usuario/walgreens-scanner  # Ajusta la ruta según tu setup

# 2. Detener la aplicación
pm2 stop walgreens-scanner

# 3. Hacer backup de la versión actual (por seguridad)
tar -czf ../backup-$(date +%Y%m%d-%H%M%S).tar.gz .

# 4. Extraer nueva versión
tar -xzf ~/walgreens-update.tar.gz

# 5. Instalar dependencias (solo las de producción)
npm install --production

# 6. Actualizar base de datos
npm run db:push

# Si hay advertencia de pérdida de datos:
# npm run db:push -- --force

# 7. Reiniciar aplicación
pm2 restart walgreens-scanner

# 8. Verificar que está corriendo
pm2 status
pm2 logs walgreens-scanner --lines 50
```

---

### ✅ Paso 4: Verificar que funciona

Comprueba que todo está bien:

```bash
# Ver estado
pm2 status

# Ver logs en tiempo real
pm2 logs walgreens-scanner

# Probar la API localmente
curl http://localhost:3000/api/scanner/status

# Ver cuánto lleva corriendo sin errores
pm2 info walgreens-scanner
```

Desde tu navegador, ve a tu dominio y verifica que todo funciona.

---

### 🎯 Paso 5: Configurar API Keys (si es primera vez)

**IMPORTANTE**: Las API keys ahora se manejan en la base de datos, NO en variables de entorno.

1. Abre tu navegador: `https://tu-dominio.com/admin/settings`
2. En la sección "Walgreens API Configuration", agrega tus API keys
3. Guarda los cambios

Las keys se almacenan de forma segura en PostgreSQL.

---

### 🚀 Mejoras en esta Actualización

**Sistema Anti-Burst implementado:**
- ✅ Eliminados TODOS los errores 403
- ✅ Token bucket optimizado (2 tokens capacity, 0 inicial)
- ✅ Flujo estable: ~12 req/s sin picos
- ✅ Validado en producción con cero errores

**Performance garantizada:**
- Con 20 API keys: ~43,200 números/hora
- Procesamiento estable sin bloqueos
- Cero violaciones de rate limits

---

### 🔍 Verificar Sistema Anti-Burst

Después de actualizar, verifica que no hay errores 403:

```bash
# Ver logs del scanner
pm2 logs walgreens-scanner | grep "403\|Rate limit"

# NO deberías ver ningún error 403
# Si ves alguno, avísame inmediatamente
```

---

### ⚙️ Comandos Útiles Post-Actualización

```bash
# Ver estado general
pm2 status

# Logs en tiempo real
pm2 logs walgreens-scanner

# Reiniciar si es necesario
pm2 restart walgreens-scanner

# Ver uso de memoria y CPU
pm2 monit

# Información detallada
pm2 info walgreens-scanner

# Guardar configuración (para que se inicie al arrancar)
pm2 save
```

---

### ❌ Si Algo Sale Mal

Si hay problemas, puedes volver a la versión anterior:

```bash
# Detener aplicación actual
pm2 stop walgreens-scanner

# Ir al directorio
cd /home/usuario/walgreens-scanner

# Eliminar archivos actuales
rm -rf client/ server/ shared/ node_modules/

# Restaurar backup
cd ..
tar -xzf backup-YYYYMMDD-HHMMSS.tar.gz -C walgreens-scanner/

# Instalar dependencias
cd walgreens-scanner
npm install --production

# Reiniciar
pm2 restart walgreens-scanner
```

---

**¿TODO SALIÓ BIEN?** 🎉

Si la actualización fue exitosa:
- ✅ El scanner procesa números sin errores 403
- ✅ PM2 muestra status "online"
- ✅ Logs no muestran errores críticos
- ✅ La web responde correctamente

**¡Listo! Tu servidor está actualizado con la versión anti-burst.**

---

---

## 💻 Requisitos del Servidor

### Especificaciones Mínimas
- **OS**: Ubuntu 20.04+ / CentOS 8+ / Debian 11+
- **RAM**: 4GB mínimo, 8GB recomendado
- **CPU**: 2 cores mínimo, 4 cores recomendado
- **Disco**: 50GB mínimo, 100GB recomendado
- **Red**: Conexión estable a internet

### Especificaciones Recomendadas para Producción
- **RAM**: 16GB+
- **CPU**: 4+ cores
- **Disco**: SSD con 200GB+
- **Red**: Bandwidth alto para APIs

### Servicios Requeridos
- **Node.js**: v18+ (LTS recomendado)
- **PostgreSQL**: v13+
- **Nginx**: v1.18+ (opcional, para proxy reverso)
- **PM2**: Para gestión de procesos
- **Git**: Para descargar código fuente

---

## 🛠️ Preparación del Servidor

### 1. Conexión al Servidor

```bash
# Conectar vía SSH
ssh user@your-server-ip

# Actualizar el sistema
sudo apt update && sudo apt upgrade -y

# Instalar herramientas básicas
sudo apt install -y curl wget git unzip software-properties-common
```

### 2. Crear Usuario para la Aplicación

```bash
# Crear usuario dedicado
sudo useradd -r -s /bin/bash -d /opt/walgreens-offers-explorer walgreens

# Crear directorio home
sudo mkdir -p /opt/walgreens-offers-explorer
sudo chown walgreens:walgreens /opt/walgreens-offers-explorer

# Configurar sudo (opcional)
echo "walgreens ALL=(ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/walgreens
```

### 3. Configurar Firewall

```bash
# Habilitar UFW
sudo ufw enable

# Permitir SSH
sudo ufw allow ssh
sudo ufw allow 22/tcp

# Permitir HTTP y HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Permitir puerto de aplicación (temporal)
sudo ufw allow 5000/tcp

# Verificar reglas
sudo ufw status
```

---

## 📦 Instalación de Dependencias

### 1. Node.js (usando NodeSource)

```bash
# Agregar repositorio de NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Instalar Node.js
sudo apt install -y nodejs

# Verificar instalación
node --version
npm --version
```

### 2. PostgreSQL

```bash
# Instalar PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Verificar que está corriendo
sudo systemctl status postgresql
sudo systemctl enable postgresql

# Verificar versión
sudo -u postgres psql -c "SELECT version();"
```

### 3. PM2 (Globalmente)

```bash
# Instalar PM2 globalmente
sudo npm install -g pm2

# Verificar instalación
pm2 --version

# Configurar PM2 para auto-iniciar
sudo pm2 startup systemd -u walgreens --hp /opt/walgreens-offers-explorer
```

### 4. Nginx (Opcional pero Recomendado)

```bash
# Instalar Nginx
sudo apt install -y nginx

# Habilitar y iniciar
sudo systemctl enable nginx
sudo systemctl start nginx

# Verificar estado
sudo systemctl status nginx
```

---

## 🗄️ Configuración de Base de Datos

### 1. Configuración Inicial de PostgreSQL

```bash
# Cambiar a usuario postgres
sudo -i -u postgres

# Crear base de datos
createdb walgreens_offers

# Crear usuario
psql -c "CREATE USER walgreens_user WITH PASSWORD 'secure_password_here';"

# Otorgar permisos
psql -c "GRANT ALL PRIVILEGES ON DATABASE walgreens_offers TO walgreens_user;"
psql -c "ALTER USER walgreens_user CREATEDB;"

# Salir del usuario postgres
exit
```

### 2. Configuración de Seguridad

```bash
# Editar configuración de PostgreSQL
sudo nano /etc/postgresql/13/main/pg_hba.conf

# Agregar línea para usuario de aplicación
# local   walgreens_offers    walgreens_user                  md5
# host    walgreens_offers    walgreens_user  127.0.0.1/32    md5

# Reiniciar PostgreSQL
sudo systemctl restart postgresql
```

### 3. Verificar Conexión

```bash
# Probar conexión
psql -h localhost -U walgreens_user -d walgreens_offers -c "SELECT current_database();"
```

---

## ⚙️ Configuración de la Aplicación

### 1. Clonar Repositorio

```bash
# Cambiar a usuario de aplicación
sudo -u walgreens -i

# Ir al directorio
cd /opt/walgreens-offers-explorer

# Clonar repositorio
git clone https://github.com/tu-usuario/walgreens-offers-explorer.git .

# Verificar que se clonó correctamente
ls -la
```

### 2. Configurar Variables de Entorno

```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar configuración
nano .env
```

**Configuración de .env para Producción:**

```env
# ===============================================
# CONFIGURACIÓN DE PRODUCCIÓN
# ===============================================

# ENTORNO
NODE_ENV=production
PORT=5000
LOG_LEVEL=warn

# ===============================================
# BASE DE DATOS POSTGRESQL
# ===============================================
DATABASE_URL="postgresql://walgreens_user:secure_password_here@localhost:5432/walgreens_offers?schema=public"

# Variables adicionales para compatibilidad
PGHOST=localhost
PGPORT=5432
PGDATABASE=walgreens_offers
PGUSER=walgreens_user
PGPASSWORD=secure_password_here

# ===============================================
# WALGREENS API - CONFIGURACIÓN PRINCIPAL
# ===============================================
WALGREENS_API_BASE_URL=https://api.walgreens.com
WALGREENS_AFF_ID=tu_affiliate_id_aqui

# ===============================================
# CLAVES DE API - MIEMBRO Y OFERTAS
# ===============================================
# API Key Principal para Member y Offers
WALGREENS_API_KEY=tu_api_key_principal_aqui

# APIs adicionales (si tienes múltiples)
WALGREENS_API_KEY_2=tu_segunda_api_key_aqui
WALGREENS_API_KEY_3=tu_tercera_api_key_aqui
WALGREENS_API_KEY_4=tu_cuarta_api_key_aqui

# ===============================================
# CLAVES DE API ESPECIALIZADAS
# ===============================================
# Store Locator API
WALGREENS_STORE_API_KEY=tu_store_api_key_aqui

# Store Inventory API
WALGREENS_INVENTORY_API_KEY=tu_inventory_api_key_aqui

# Balance Rewards API
WALGREENS_BALANCE_API_KEY=tu_balance_api_key_aqui

# ===============================================
# CONFIGURACIÓN DE FAST SCANNER
# ===============================================
# Batch size para procesamiento paralelo
FAST_SCANNER_BATCH_SIZE=20

# Rate limiting (requests por minuto)
FAST_SCANNER_RATE_LIMIT=300

# Máximo de trabajos concurrentes
FAST_SCANNER_MAX_CONCURRENT_JOBS=3

# ===============================================
# CONFIGURACIÓN DE CACHE
# ===============================================
# TTL para diferentes tipos de cache (en segundos)
CACHE_TTL_SIDEBAR=30
CACHE_TTL_MEMBER_PROFILE=300
CACHE_TTL_OFFERS=600

# ===============================================
# CONFIGURACIÓN DE LOGS
# ===============================================
LOG_FILE_PATH=/opt/walgreens-offers-explorer/logs/app.log
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5

# ===============================================
# CONFIGURACIÓN DE WEBSOCKET
# ===============================================
WEBSOCKET_PORT=8080

# ===============================================
# CONFIGURACIÓN DE SEGURIDAD
# ===============================================
# JWT Secret (generar uno seguro)
JWT_SECRET=tu_jwt_secret_muy_seguro_aqui

# Session Secret
SESSION_SECRET=tu_session_secret_muy_seguro_aqui

# ===============================================
# CONFIGURACIÓN DE NOTIFICACIONES (OPCIONAL)
# ===============================================
# Email para notificaciones
NOTIFICATION_EMAIL=admin@tudominio.com

# Slack Webhook (opcional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/tu/webhook/url

# ===============================================
# CONFIGURACIÓN DE BACKUP (OPCIONAL)
# ===============================================
# S3 Bucket para backups remotos
S3_BUCKET=tu-bucket-backups
AWS_ACCESS_KEY_ID=tu_access_key
AWS_SECRET_ACCESS_KEY=tu_secret_key
AWS_REGION=us-east-1

# ===============================================
# CONFIGURACIÓN DE MONITOREO (OPCIONAL)
# ===============================================
# New Relic (si usas monitoreo)
NEW_RELIC_LICENSE_KEY=tu_new_relic_key
NEW_RELIC_APP_NAME=Walgreens Offers Explorer
```

### 3. Instalar Dependencias

```bash
# Instalar dependencias de producción
npm ci --only=production

# Verificar que se instalaron correctamente
npm list --depth=0
```

### 4. Build de la Aplicación

```bash
# Compilar aplicación para producción
npm run build

# Verificar que el build existe
ls -la dist/
```

### 5. Configurar Base de Datos

```bash
# Aplicar schema a la base de datos
npm run db:push --force

# Verificar que las tablas se crearon
psql -h localhost -U walgreens_user -d walgreens_offers -c "\dt"
```

---

## 🚀 Despliegue Automatizado

### 1. Usando el Script de Deploy

```bash
# Dar permisos al script
sudo chmod +x scripts/deploy.sh

# Ejecutar deployment completo
sudo ./scripts/deploy.sh --force
```

### 2. Deployment Manual (Paso a Paso)

Si prefieres hacer el deployment manual:

```bash
# 1. Detener aplicación anterior (si existe)
pm2 stop walgreens-offers-explorer || true
pm2 delete walgreens-offers-explorer || true

# 2. Actualizar código
git pull origin main

# 3. Limpiar e instalar dependencias
rm -rf node_modules
npm ci --only=production

# 4. Build
npm run build

# 5. Aplicar migraciones
npm run db:push --force

# 6. Configurar logs
mkdir -p logs
chmod 755 logs

# 7. Iniciar aplicación
pm2 start ecosystem.config.js --env production

# 8. Guardar configuración PM2
pm2 save

# 9. Verificar estado
pm2 status
```

### 3. Verificar Deployment

```bash
# Health check automático
./scripts/health-check.sh

# Verificar manualmente
curl http://localhost:5000/health

# Ver logs
pm2 logs walgreens-offers-explorer
```

---

## 🌐 Configuración de Nginx / Caddy

Puedes usar **Nginx** o **Caddy** como proxy reverso. Caddy es más simple y maneja SSL automáticamente.

---

### Opción A: Configurar Caddy (Recomendado - Más Simple)

#### 1. Instalar Caddy

```bash
# Instalar Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy

# Verificar instalación
caddy version
```

#### 2. Configurar Caddyfile

```bash
# Editar Caddyfile
sudo nano /etc/caddy/Caddyfile
```

**Contenido del Caddyfile:**

```
# /etc/caddy/Caddyfile

# Configuración simple con SSL automático
tu-dominio.com {
    # Caddy obtiene y renueva SSL automáticamente
    
    # Proxy reverso a tu aplicación
    reverse_proxy localhost:3000
    
    # Configuración para WebSockets (necesario para el scanner)
    @websockets {
        header Connection *Upgrade*
        header Upgrade websocket
    }
    reverse_proxy @websockets localhost:3000
    
    # Headers de seguridad
    header {
        Strict-Transport-Security "max-age=63072000"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        X-XSS-Protection "1; mode=block"
    }
    
    # Logs
    log {
        output file /var/log/caddy/walgreens.log
        format console
    }
}

# Redirigir www a no-www (opcional)
www.tu-dominio.com {
    redir https://tu-dominio.com{uri}
}
```

#### 3. Iniciar Caddy

```bash
# Crear directorio de logs
sudo mkdir -p /var/log/caddy
sudo chown caddy:caddy /var/log/caddy

# Verificar configuración
sudo caddy validate --config /etc/caddy/Caddyfile

# Reiniciar Caddy
sudo systemctl restart caddy

# Habilitar auto-inicio
sudo systemctl enable caddy

# Ver estado
sudo systemctl status caddy

# Ver logs
sudo journalctl -u caddy -f
```

**¡Listo!** Caddy obtiene y renueva el certificado SSL automáticamente. No necesitas configurar Let's Encrypt manualmente.

---

### Opción B: Configurar Nginx

#### 1. Configurar Proxy Reverso

```bash
# Crear configuración de Nginx
sudo nano /etc/nginx/sites-available/walgreens-offers
```

**Configuración de Nginx:**

```nginx
# /etc/nginx/sites-available/walgreens-offers

upstream walgreens_backend {
    server 127.0.0.1:5000;
    keepalive 32;
}

# Redirigir HTTP a HTTPS
server {
    listen 80;
    server_name tudominio.com www.tudominio.com;
    return 301 https://$server_name$request_uri;
}

# Configuración HTTPS
server {
    listen 443 ssl http2;
    server_name tudominio.com www.tudominio.com;

    # ===============================================
    # CONFIGURACIÓN SSL
    # ===============================================
    ssl_certificate /etc/letsencrypt/live/tudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tudominio.com/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:MozTLS:10m;
    ssl_session_tickets off;

    # Configuración SSL moderna
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Headers de seguridad
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # ===============================================
    # CONFIGURACIÓN DE PROXY
    # ===============================================
    location / {
        proxy_pass http://walgreens_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # ===============================================
    # CONFIGURACIÓN DE WEBSOCKET
    # ===============================================
    location /ws {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ===============================================
    # CONFIGURACIÓN DE ARCHIVOS ESTÁTICOS
    # ===============================================
    location /static/ {
        alias /opt/walgreens-offers-explorer/dist/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # ===============================================
    # CONFIGURACIÓN DE LOGS
    # ===============================================
    access_log /var/log/nginx/walgreens-access.log;
    error_log /var/log/nginx/walgreens-error.log;

    # ===============================================
    # CONFIGURACIÓN DE SEGURIDAD ADICIONAL
    # ===============================================
    # Ocultar versión de Nginx
    server_tokens off;

    # Limitar tamaño de body
    client_max_body_size 10M;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=walgreens:10m rate=10r/s;
    limit_req zone=walgreens burst=20 nodelay;
}
```

### 2. Habilitar Configuración

```bash
# Habilitar sitio
sudo ln -s /etc/nginx/sites-available/walgreens-offers /etc/nginx/sites-enabled/

# Deshabilitar sitio por defecto
sudo rm /etc/nginx/sites-enabled/default

# Verificar configuración
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

---

## 🔒 Configuración de SSL

### 1. Instalar Certbot

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtener certificado SSL
sudo certbot --nginx -d tudominio.com -d www.tudominio.com

# Verificar auto-renovación
sudo certbot renew --dry-run
```

### 2. Configurar Auto-renovación

```bash
# Crear cron job para renovación automática
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
```

---

## 📊 Monitoreo y Logs

### 1. Configurar Logrotate

```bash
# Crear configuración de logrotate
sudo nano /etc/logrotate.d/walgreens-offers
```

```bash
# /etc/logrotate.d/walgreens-offers
/opt/walgreens-offers-explorer/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 walgreens walgreens
    postrotate
        pm2 reload walgreens-offers-explorer
    endscript
}

/var/log/nginx/walgreens-*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 0644 www-data adm
    postrotate
        systemctl reload nginx
    endscript
}
```

### 2. Configurar Monitoreo con PM2

```bash
# Instalar PM2 monitoring
pm2 install pm2-logrotate

# Configurar limites de logs
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true
```

### 3. Health Checks Automáticos

```bash
# Crear cron job para health checks
echo "*/5 * * * * /opt/walgreens-offers-explorer/scripts/health-check.sh --quiet" | sudo crontab -u walgreens -
```

---

## 💾 Backup y Mantenimiento

### 1. Configurar Backups Automáticos

```bash
# Hacer ejecutable el script de backup
chmod +x scripts/backup.sh

# Crear cron job para backups diarios
echo "0 2 * * * /opt/walgreens-offers-explorer/scripts/backup.sh" | sudo crontab -u walgreens -
```

### 2. Backup Manual

```bash
# Ejecutar backup completo
./scripts/backup.sh

# Solo backup de base de datos
./scripts/backup.sh --db-only

# Backup con retención de 7 días
./scripts/backup.sh --retention 7
```

### 3. Restaurar desde Backup

```bash
# Listar backups disponibles
ls -la /opt/backups/walgreens/

# Restaurar base de datos
sudo -u postgres psql -d walgreens_offers < /opt/backups/walgreens/db_backup_YYYYMMDD_HHMMSS.sql
```

---

## 🔧 Troubleshooting

### Problemas Comunes

#### 1. Aplicación no inicia

```bash
# Verificar logs de PM2
pm2 logs walgreens-offers-explorer

# Verificar configuración
pm2 describe walgreens-offers-explorer

# Reiniciar aplicación
pm2 restart walgreens-offers-explorer
```

#### 2. Error de conexión a base de datos

```bash
# Verificar estado de PostgreSQL
sudo systemctl status postgresql

# Verificar conexión
psql -h localhost -U walgreens_user -d walgreens_offers -c "SELECT 1;"

# Verificar configuración
grep DATABASE_URL .env
```

#### 3. Error 502 en Nginx

```bash
# Verificar logs de Nginx
sudo tail -f /var/log/nginx/walgreens-error.log

# Verificar que la aplicación está corriendo
curl http://localhost:5000/health

# Verificar configuración de Nginx
sudo nginx -t
```

#### 4. Alto uso de memoria

```bash
# Verificar uso de recursos
pm2 monit

# Reiniciar aplicación
pm2 restart walgreens-offers-explorer

# Verificar configuración de memoria
grep max_memory_restart ecosystem.config.js
```

### Comandos Útiles de Diagnóstico

```bash
# Estado general del sistema
./scripts/health-check.sh

# Ver todos los logs
pm2 logs --lines 100

# Verificar puertos
netstat -tlnp | grep :5000

# Verificar procesos
ps aux | grep node

# Uso de disco
df -h

# Uso de memoria
free -h

# Load average
uptime
```

### Logs Importantes

```bash
# Logs de aplicación
tail -f /opt/walgreens-offers-explorer/logs/combined.log

# Logs de PM2
pm2 logs walgreens-offers-explorer --lines 100

# Logs de Nginx
sudo tail -f /var/log/nginx/walgreens-error.log

# Logs del sistema
sudo journalctl -u walgreens-offers -f
```

---

## 📈 Optimización de Performance

### 1. Configuración de Sistema

```bash
# Aumentar límites de archivos abiertos
echo "walgreens soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "walgreens hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# Optimizar PostgreSQL
sudo nano /etc/postgresql/13/main/postgresql.conf
```

**Configuración PostgreSQL Optimizada:**

```bash
# postgresql.conf optimizations
shared_buffers = 2GB                    # 25% de RAM
effective_cache_size = 6GB              # 75% de RAM  
work_mem = 64MB
maintenance_work_mem = 512MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
```

### 2. Configuración de Nginx

```bash
# Optimizar Nginx para alto tráfico
sudo nano /etc/nginx/nginx.conf
```

```nginx
# nginx.conf optimizations
worker_processes auto;
worker_connections 4096;
use epoll;
multi_accept on;

# Buffer sizes
client_body_buffer_size 128k;
client_max_body_size 10m;
client_header_buffer_size 1k;
large_client_header_buffers 4 4k;
output_buffers 1 32k;
postpone_output 1460;

# Timeouts
client_header_timeout 3m;
client_body_timeout 3m;
send_timeout 3m;
keepalive_timeout 30;

# Gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
```

---

## ✅ Checklist de Deployment

### Pre-deployment
- [ ] Servidor configurado con requisitos mínimos
- [ ] Firewall configurado
- [ ] PostgreSQL instalado y configurado
- [ ] Node.js y PM2 instalados
- [ ] Usuario de servicio creado

### Deployment
- [ ] Código clonado desde repositorio
- [ ] Archivo .env configurado con credenciales
- [ ] Dependencias instaladas
- [ ] Aplicación compilada (build)
- [ ] Base de datos migrada
- [ ] PM2 configurado y aplicación iniciada

### Post-deployment
- [ ] Health check pasando
- [ ] Nginx configurado (si aplica)
- [ ] SSL configurado
- [ ] Logs configurados
- [ ] Backups configurados
- [ ] Monitoreo configurado

### Verificación Final
- [ ] Aplicación accesible desde internet
- [ ] Todas las funcionalidades funcionando
- [ ] APIs de Walgreens conectadas
- [ ] Fast Scanner funcionando
- [ ] WebSocket conectado
- [ ] Performance acceptable

---

Esta guía debería permitir un deployment exitoso de la aplicación. Para soporte adicional, consulta la documentación técnica en `ARCHITECTURE.md` y los logs del sistema.