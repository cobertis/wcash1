# Guía de Instalación en Servidor Externo

Esta guía te ayudará a instalar y configurar la aplicación Walgreens Manager en tu propio servidor.

## Requisitos Previos

- Servidor Linux (Ubuntu 20.04 o superior recomendado)
- Node.js 18.x o superior
- PostgreSQL 14.x o superior
- Git instalado
- Acceso SSH a tu servidor
- Al menos 2GB de RAM disponible

## Paso 1: Conectar Replit con GitHub

### 1.1 Crear repositorio en GitHub
1. Ve a GitHub.com y crea un nuevo repositorio privado
2. Nombra el repositorio (ejemplo: `walgreens-manager`)
3. **NO** inicialices con README, .gitignore o licencia

### 1.2 Conectar Replit con GitHub
1. En Replit, abre el panel de Git (icono de ramita en la barra lateral)
2. Haz clic en "Connect to GitHub"
3. Autoriza a Replit para acceder a tu cuenta de GitHub
4. Selecciona el repositorio que acabas de crear
5. Haz clic en "Push to GitHub"

Tu código ahora está en GitHub y listo para ser clonado.

## Paso 2: Preparar el Servidor

### 2.1 Conectarse al servidor
```bash
ssh usuario@tu-servidor.com
```

### 2.2 Instalar Node.js 18.x
```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalación
node --version
npm --version
```

### 2.3 Instalar PostgreSQL
```bash
# Instalar PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Iniciar servicio
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verificar instalación
sudo -u postgres psql --version
```

### 2.4 Instalar PM2 (gestor de procesos)
```bash
sudo npm install -g pm2
```

## Paso 3: Configurar PostgreSQL

### 3.1 Crear base de datos y usuario
```bash
# Conectarse a PostgreSQL
sudo -u postgres psql

# Dentro de PostgreSQL, ejecutar:
CREATE DATABASE walgreens_db;
CREATE USER walgreens_user WITH ENCRYPTED PASSWORD 'tu_contraseña_segura';
GRANT ALL PRIVILEGES ON DATABASE walgreens_db TO walgreens_user;
\q
```

### 3.2 Configurar acceso remoto (opcional)
Si necesitas acceder a la base de datos remotamente:
```bash
# Editar pg_hba.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf

# Agregar al final:
# host    walgreens_db    walgreens_user    0.0.0.0/0    md5

# Editar postgresql.conf
sudo nano /etc/postgresql/14/main/postgresql.conf

# Buscar y cambiar:
# listen_addresses = '*'

# Reiniciar PostgreSQL
sudo systemctl restart postgresql
```

## Paso 4: Clonar y Configurar la Aplicación

### 4.1 Clonar desde GitHub
```bash
# Crear directorio para aplicaciones
mkdir -p ~/apps
cd ~/apps

# Clonar repositorio
git clone https://github.com/tu-usuario/walgreens-manager.git
cd walgreens-manager
```

### 4.2 Configurar variables de entorno
```bash
# Crear archivo .env
nano .env
```

Pega el siguiente contenido y ajusta los valores:
```env
# Database Configuration
DATABASE_URL=postgresql://walgreens_user:tu_contraseña_segura@localhost:5432/walgreens_db
PGHOST=localhost
PGPORT=5432
PGDATABASE=walgreens_db
PGUSER=walgreens_user
PGPASSWORD=tu_contraseña_segura

# Walgreens API Keys
WALGREENS_API_KEY=tu_api_key_principal
WALGREENS_AFF_ID=tu_affiliate_id
WALGREENS_API_BASE_URL=https://services.walgreens.com

# API Keys adicionales para Fast Scanner
WALGREENS_API_KEY_CLAUDIO=tu_api_key_1
WALGREENS_API_KEY_ESTRELLA=tu_api_key_2
WALGREENS_API_KEY_RICHARD=tu_api_key_3
WALGREENS_API_KEY_XAVI=tu_api_key_4

# Application Settings
NODE_ENV=production
PORT=5000
```

Guarda con `Ctrl+O`, luego `Enter`, y sal con `Ctrl+X`.

### 4.3 Instalar dependencias
```bash
npm install
```

### 4.4 Ejecutar migraciones de base de datos
```bash
npm run db:push
```

Si hay advertencias sobre pérdida de datos, ejecuta:
```bash
npm run db:push --force
```

## Paso 5: Compilar la Aplicación

```bash
# Compilar frontend (si aplica)
npm run build
```

## Paso 6: Iniciar con PM2

### 6.1 Crear configuración de PM2
```bash
nano ecosystem.config.js
```

Pega el siguiente contenido:
```javascript
module.exports = {
  apps: [{
    name: 'walgreens-manager',
    script: 'npm',
    args: 'start',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}
```

### 6.2 Crear directorio de logs
```bash
mkdir -p logs
```

### 6.3 Iniciar aplicación
```bash
pm2 start ecosystem.config.js
```

### 6.4 Verificar que está corriendo
```bash
pm2 status
pm2 logs walgreens-manager
```

### 6.5 Configurar inicio automático
```bash
# Guardar configuración actual de PM2
pm2 save

# Generar script de inicio automático
pm2 startup

# Ejecutar el comando que PM2 te muestra (será algo como):
# sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u tu_usuario --hp /home/tu_usuario
```

## Paso 7: Configurar Nginx (Opcional pero Recomendado)

### 7.1 Instalar Nginx
```bash
sudo apt install -y nginx
```

### 7.2 Configurar reverse proxy
```bash
sudo nano /etc/nginx/sites-available/walgreens-manager
```

Pega el siguiente contenido:
```nginx
server {
    listen 80;
    server_name tu-dominio.com;  # Cambia esto por tu dominio o IP

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 7.3 Activar configuración
```bash
# Crear enlace simbólico
sudo ln -s /etc/nginx/sites-available/walgreens-manager /etc/nginx/sites-enabled/

# Verificar configuración
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

### 7.4 Configurar SSL con Let's Encrypt (Opcional)
```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtener certificado SSL
sudo certbot --nginx -d tu-dominio.com

# Renovación automática ya está configurada
```

## Paso 8: Configurar Firewall

```bash
# Permitir SSH
sudo ufw allow 22/tcp

# Permitir HTTP y HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Si NO usas Nginx, permite el puerto 5000
# sudo ufw allow 5000/tcp

# Activar firewall
sudo ufw enable
```

## Paso 9: Verificar Instalación

### 9.1 Verificar que la aplicación está corriendo
```bash
pm2 status
```

### 9.2 Ver logs en tiempo real
```bash
pm2 logs walgreens-manager
```

### 9.3 Acceder a la aplicación
- **Sin Nginx**: http://tu-servidor-ip:5000
- **Con Nginx**: http://tu-dominio.com

## Comandos Útiles de Gestión

### PM2
```bash
# Ver estado
pm2 status

# Ver logs
pm2 logs walgreens-manager

# Reiniciar aplicación
pm2 restart walgreens-manager

# Detener aplicación
pm2 stop walgreens-manager

# Ver uso de recursos
pm2 monit

# Ver información detallada
pm2 show walgreens-manager
```

### Actualizar aplicación desde GitHub
```bash
cd ~/apps/walgreens-manager

# Detener aplicación
pm2 stop walgreens-manager

# Obtener últimos cambios
git pull origin main

# Instalar nuevas dependencias
npm install

# Ejecutar migraciones si hay cambios en la base de datos
npm run db:push

# Reiniciar aplicación
pm2 restart walgreens-manager
```

### Base de datos
```bash
# Backup de base de datos
pg_dump -U walgreens_user walgreens_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar backup
psql -U walgreens_user walgreens_db < backup_20250101_120000.sql

# Conectarse a la base de datos
psql -U walgreens_user -d walgreens_db
```

## Solución de Problemas

### La aplicación no inicia
```bash
# Ver logs de error
pm2 logs walgreens-manager --err

# Verificar variables de entorno
cat .env

# Verificar conexión a base de datos
psql -U walgreens_user -d walgreens_db -c "SELECT 1;"
```

### Error de conexión a base de datos
```bash
# Verificar que PostgreSQL está corriendo
sudo systemctl status postgresql

# Verificar credenciales
sudo -u postgres psql -c "\du"
sudo -u postgres psql -c "\l"
```

### Puerto 5000 ya en uso
```bash
# Ver qué proceso usa el puerto
sudo lsof -i :5000

# Cambiar puerto en .env
nano .env
# Cambia PORT=5000 a PORT=5001 o el que prefieras

# Reiniciar aplicación
pm2 restart walgreens-manager
```

### Nginx muestra error 502 Bad Gateway
```bash
# Verificar que la aplicación Node.js está corriendo
pm2 status

# Ver logs de Nginx
sudo tail -f /var/log/nginx/error.log

# Reiniciar Nginx
sudo systemctl restart nginx
```

## Mantenimiento Regular

### Backups automáticos (recomendado)
```bash
# Crear script de backup
nano ~/backup.sh
```

Contenido del script:
```bash
#!/bin/bash
BACKUP_DIR="/home/tu_usuario/backups"
mkdir -p $BACKUP_DIR
DATE=$(date +%Y%m%d_%H%M%S)

# Backup de base de datos
pg_dump -U walgreens_user walgreens_db > $BACKUP_DIR/db_$DATE.sql

# Comprimir
gzip $BACKUP_DIR/db_$DATE.sql

# Eliminar backups antiguos (más de 7 días)
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
```

Hacer ejecutable y programar:
```bash
chmod +x ~/backup.sh

# Agregar a crontab (ejecutar diariamente a las 2 AM)
crontab -e
# Agregar: 0 2 * * * /home/tu_usuario/backup.sh
```

### Actualizar sistema
```bash
# Actualizar paquetes del sistema
sudo apt update && sudo apt upgrade -y

# Actualizar Node.js packages
cd ~/apps/walgreens-manager
npm update
```

## Seguridad Adicional

### Cambiar puerto SSH (opcional)
```bash
sudo nano /etc/ssh/sshd_config
# Cambiar Port 22 a otro número (ejemplo: Port 2222)
sudo systemctl restart sshd
```

### Instalar fail2ban (protección contra ataques de fuerza bruta)
```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

## Soporte

Si encuentras problemas durante la instalación, verifica:
1. Logs de la aplicación: `pm2 logs walgreens-manager`
2. Logs del sistema: `sudo journalctl -u nginx -f`
3. Estado de servicios: `pm2 status`, `sudo systemctl status postgresql nginx`

## Notas Importantes

- **Seguridad**: Nunca compartas tu archivo `.env` o lo subas a GitHub
- **API Keys**: Asegúrate de tener API keys válidas de Walgreens
- **Recursos**: Monitor el uso de CPU/RAM con `pm2 monit`
- **Actualizaciones**: Mantén Node.js y PostgreSQL actualizados
- **Backups**: Haz backups regulares de tu base de datos

¡Tu aplicación Walgreens Manager ahora debería estar corriendo en tu servidor!
