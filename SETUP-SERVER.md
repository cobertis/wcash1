# 🚀 Setup en Tu Servidor (Caddy + PM2)

## Esta guía es específica para instalar en tu propio servidor con Caddy y PM2

---

## 📋 Requisitos

1. **Ubuntu/Debian 20.04+** (o similar)
2. **Root access** o sudo
3. **Dominio apuntando** a tu servidor IP

---

## 🔧 Instalación Completa

### 1. Instalar Node.js 18+

```bash
# Añadir repositorio NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Instalar Node.js
sudo apt install -y nodejs

# Verificar
node -v  # debe ser v18+
npm -v
```

### 2. Instalar PostgreSQL

```bash
# Instalar PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Iniciar servicio
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Crear usuario y base de datos
sudo -u postgres psql << EOF
CREATE USER walgreens WITH PASSWORD 'tu_password_seguro';
CREATE DATABASE walgreens_scanner OWNER walgreens;
GRANT ALL PRIVILEGES ON DATABASE walgreens_scanner TO walgreens;
\q
EOF
```

### 3. Instalar Caddy

```bash
# Añadir repo de Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list

# Instalar
sudo apt update
sudo apt install -y caddy

# Verificar
sudo systemctl status caddy
```

### 4. Clonar Repositorio

```bash
# Ir a directorio de aplicaciones
cd /var/www  # o donde quieras instalar

# Clonar (o subir tus archivos)
git clone https://github.com/tu-usuario/walgreens-scanner.git
cd walgreens-scanner

# O si subes archivos manualmente:
# sudo mkdir -p /var/www/walgreens-scanner
# sudo chown -R $USER:$USER /var/www/walgreens-scanner
# scp -r * usuario@servidor:/var/www/walgreens-scanner/
```

### 5. Configurar Variables de Entorno

```bash
# Copiar ejemplo
cp .env.example .env

# Editar con nano
nano .env
```

**Contenido MÍNIMO del .env:**

```bash
# PostgreSQL
DATABASE_URL=postgresql://walgreens:tu_password_seguro@localhost:5432/walgreens_scanner

# Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=tu_contraseña_admin

# Session
SESSION_SECRET=$(openssl rand -base64 32)

# Server
NODE_ENV=production
PORT=5000
```

**Guardar:** Ctrl+O, Enter, Ctrl+X

### 6. Ejecutar Diagnóstico

```bash
# Hacer scripts ejecutables
chmod +x diagnose.sh install.sh build-production.sh start.sh start-pm2.sh

# Ejecutar diagnóstico
./diagnose.sh
```

Si todo está ✅, continúa. Si hay ❌, arregla primero.

### 7. Instalar Aplicación

```bash
# Instalar dependencias
npm install --production

# Crear base de datos
npm run db:push --force

# Build de producción
./build-production.sh
```

### 8. Configurar Caddy

```bash
# Copiar config de ejemplo
sudo cp Caddyfile.example /etc/caddy/Caddyfile

# Editar con tu dominio
sudo nano /etc/caddy/Caddyfile
```

**Reemplaza `tu-dominio.com` con tu dominio real:**

```caddyfile
walgreens.tudominio.com {
    encode gzip
    
    reverse_proxy localhost:5000 {
        header_up Host {host}
        header_up X-Real-IP {remote}
        header_up X-Forwarded-For {remote}
        header_up X-Forwarded-Proto {scheme}
        header_up Connection {>Connection}
        header_up Upgrade {>Upgrade}
    }
    
    request_body {
        max_size 100MB
    }
}
```

**Recargar Caddy:**

```bash
sudo systemctl reload caddy
```

### 9. Instalar PM2 Global

```bash
# Instalar PM2
sudo npm install -g pm2

# Verificar
pm2 --version
```

### 10. Iniciar Aplicación con PM2

```bash
# Iniciar
./start-pm2.sh

# Verificar que está corriendo
pm2 status

# Ver logs
pm2 logs walgreens-scanner

# Configurar PM2 para auto-inicio
pm2 startup
# Ejecuta el comando que PM2 te muestra

pm2 save
```

---

## ✅ Verificar Instalación

### 1. Check Endpoint de Salud

```bash
curl http://localhost:5000/health
# Debe retornar: {"status":"ok",...}
```

### 2. Acceder desde Navegador

Abre: `https://walgreens.tudominio.com`

Deberías ver la pantalla de login.

### 3. Login

- Usuario: `admin`
- Contraseña: la que pusiste en `.env`

### 4. Configurar API Keys

1. Ve a tab **"Configuration"**
2. Click **"Add New API Key"**
3. Agrega tus keys de Walgreens

---

## 🔍 Diagnóstico de Problemas

### La app no carga

```bash
# Ver logs de PM2
pm2 logs walgreens-scanner

# Ver estado
pm2 status

# Reiniciar
pm2 restart walgreens-scanner
```

### Error de base de datos

```bash
# Verificar PostgreSQL
sudo systemctl status postgresql

# Probar conexión manual
psql postgresql://walgreens:tu_password@localhost:5432/walgreens_scanner -c "SELECT 1"

# Ver logs de PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### Error 502 Bad Gateway (Caddy)

```bash
# Verificar que PM2 está corriendo
pm2 status

# Verificar que el puerto 5000 responde
curl http://localhost:5000/health

# Ver logs de Caddy
sudo journalctl -u caddy -f
```

### WebSocket no funciona

Verifica en `Caddyfile` que tengas estas líneas:

```caddyfile
header_up Connection {>Connection}
header_up Upgrade {>Upgrade}
```

Luego recarga:

```bash
sudo systemctl reload caddy
```

---

## 🔄 Actualizar la Aplicación

```bash
# Detener PM2
pm2 stop walgreens-scanner

# Actualizar código
git pull  # o sube archivos nuevos

# Reinstalar dependencias
npm install --production

# Rebuild
./build-production.sh

# Actualizar DB
npm run db:push --force

# Reiniciar
pm2 restart walgreens-scanner

# Verificar
pm2 logs walgreens-scanner
```

---

## 📊 Monitoring

### Ver logs en tiempo real

```bash
# Logs de la app
pm2 logs walgreens-scanner

# Logs de Caddy
sudo journalctl -u caddy -f

# Logs de PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-*-main.log
```

### Ver uso de recursos

```bash
pm2 monit
```

### Ver procesos

```bash
pm2 status
```

---

## 🔒 Seguridad en Producción

### 1. Firewall

```bash
# Permitir solo puertos necesarios
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

### 2. PostgreSQL (solo localhost)

Edita `/etc/postgresql/14/main/pg_hba.conf`:

```
# Solo permitir conexiones locales
local   all             all                                     peer
host    all             all             127.0.0.1/32            md5
```

Reinicia:

```bash
sudo systemctl restart postgresql
```

### 3. Cambiar credenciales

```bash
# Generar nuevo session secret
openssl rand -base64 32

# Actualizar .env
nano .env
```

---

## 🎯 Comandos Útiles

```bash
# PM2
pm2 status                    # Ver estado
pm2 logs walgreens-scanner    # Ver logs
pm2 restart walgreens-scanner # Reiniciar
pm2 stop walgreens-scanner    # Detener
pm2 delete walgreens-scanner  # Eliminar
pm2 monit                     # Monitoring

# Caddy
sudo systemctl status caddy   # Estado
sudo systemctl reload caddy   # Recargar config
sudo systemctl restart caddy  # Reiniciar
sudo journalctl -u caddy -f   # Ver logs

# PostgreSQL
sudo systemctl status postgresql
psql $DATABASE_URL -c "SELECT COUNT(*) FROM member_history"

# Sistema
htop                          # CPU/RAM usage
df -h                         # Espacio en disco
free -h                       # Memoria disponible
```

---

## ✅ Checklist Final

- [ ] Node.js 18+ instalado
- [ ] PostgreSQL corriendo
- [ ] Caddy instalado y configurado
- [ ] `.env` configurado correctamente
- [ ] `./diagnose.sh` pasa sin errores
- [ ] Build completado (`./build-production.sh`)
- [ ] PM2 corriendo la app
- [ ] Caddy proxy funciona (HTTPS automático)
- [ ] Health check responde: `curl https://tudominio.com/health`
- [ ] Login funciona
- [ ] API Keys configuradas

---

## 🆘 ¿Problemas?

1. **Ejecuta diagnóstico**: `./diagnose.sh`
2. **Ve los logs**: `pm2 logs`
3. **Verifica health**: `curl http://localhost:5000/health`
4. **Revisa Caddy**: `sudo journalctl -u caddy -f`

Si algo no funciona, **EJECUTA EL DIAGNÓSTICO PRIMERO**:

```bash
./diagnose.sh
```

Te dirá exactamente qué está mal.
