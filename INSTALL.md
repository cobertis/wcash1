# 📥 Guía Completa de Instalación
## Walgreens Offers Explorer

Esta guía te llevará paso a paso por todo el proceso de instalación y configuración del sistema en tu propio servidor.

---

## 📋 Tabla de Contenido

1. [Requisitos del Sistema](#requisitos-del-sistema)
2. [Instalación en Ubuntu/Debian](#instalación-en-ubuntudebian)
3. [Instalación en CentOS/RHEL](#instalación-en-centosrhel)
4. [Instalación con Docker](#instalación-con-docker)
5. [Configuración de PostgreSQL](#configuración-de-postgresql)
6. [Configuración de la Aplicación](#configuración-de-la-aplicación)
7. [Configuración de Producción](#configuración-de-producción)
8. [Verificación y Testing](#verificación-y-testing)
9. [Troubleshooting](#troubleshooting)

---

## 🖥️ Requisitos del Sistema

### Requisitos Mínimos
- **OS**: Ubuntu 20.04+, Debian 11+, CentOS 8+, RHEL 8+
- **CPU**: 2 vCPUs / 2 cores
- **RAM**: 2GB (4GB recomendado)
- **Disco**: 20GB de espacio libre
- **Red**: Conexión a internet estable

### Requisitos Recomendados para Producción
- **CPU**: 4+ vCPUs / 4+ cores
- **RAM**: 4GB+ (8GB optimal)
- **Disco**: 50GB+ SSD
- **Red**: 100Mbps+ conexión
- **Backup**: Sistema de backup automático

### Software Requerido
- **Node.js**: 18.x o superior
- **PostgreSQL**: 12.x o superior
- **Git**: Para clonar el repositorio
- **PM2**: Para gestión de procesos (producción)
- **Nginx**: Para proxy reverso (opcional)

---

## 🐧 Instalación en Ubuntu/Debian

### Paso 1: Actualizar el Sistema
```bash
# Actualizar paquetes del sistema
sudo apt update && sudo apt upgrade -y

# Instalar herramientas básicas
sudo apt install -y curl wget git build-essential
```

### Paso 2: Instalar Node.js 18+
```bash
# Método A: Usando NodeSource (Recomendado)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Método B: Usando snap
# sudo snap install node --classic

# Verificar instalación
node --version  # Debe mostrar v18.x.x o superior
npm --version   # Debe mostrar 9.x.x o superior
```

### Paso 3: Instalar PostgreSQL
```bash
# Instalar PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Iniciar y habilitar PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verificar que esté corriendo
sudo systemctl status postgresql
```

### Paso 4: Configurar PostgreSQL
```bash
# Cambiar a usuario postgres
sudo -u postgres psql

# Dentro de psql, ejecutar:
-- Crear usuario para la aplicación
CREATE USER walgreens_user WITH PASSWORD 'MiPasswordSeguro123!';

-- Crear base de datos
CREATE DATABASE walgreens_offers OWNER walgreens_user;

-- Otorgar permisos
GRANT ALL PRIVILEGES ON DATABASE walgreens_offers TO walgreens_user;

-- Salir de psql
\q
```

### Paso 5: Configurar Autenticación PostgreSQL
```bash
# Editar archivo de configuración
sudo nano /etc/postgresql/*/main/pg_hba.conf

# Cambiar la línea:
# local   all             all                                     peer
# Por:
# local   all             all                                     md5

# Reiniciar PostgreSQL
sudo systemctl restart postgresql
```

### Paso 6: Configurar Firewall (UFW)
```bash
# Habilitar UFW si no está activo
sudo ufw enable

# Permitir SSH
sudo ufw allow ssh

# Permitir puerto de la aplicación
sudo ufw allow 5000

# Permitir PostgreSQL solo localmente (opcional)
sudo ufw allow from 127.0.0.1 to any port 5432

# Verificar reglas
sudo ufw status
```

### Paso 7: Clonar y Configurar la Aplicación
```bash
# Navegar al directorio de aplicaciones
cd /opt

# Clonar el repositorio
sudo git clone https://github.com/tu-usuario/walgreens-offers-explorer.git
cd walgreens-offers-explorer

# Cambiar propietario
sudo chown -R $USER:$USER /opt/walgreens-offers-explorer

# Instalar dependencias
npm install

# Crear archivo de configuración
cp .env.example .env
```

---

## 🎩 Instalación en CentOS/RHEL

### Paso 1: Actualizar el Sistema
```bash
# Para CentOS/RHEL 8+
sudo dnf update -y
sudo dnf groupinstall -y "Development Tools"
sudo dnf install -y curl wget git

# Para CentOS 7
# sudo yum update -y
# sudo yum groupinstall -y "Development Tools"
# sudo yum install -y curl wget git
```

### Paso 2: Instalar Node.js
```bash
# Método A: Usando NodeSource
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs

# Método B: Usando dnf module (CentOS 8+)
# sudo dnf module install -y nodejs:18

# Verificar instalación
node --version
npm --version
```

### Paso 3: Instalar PostgreSQL
```bash
# Para CentOS/RHEL 8+
sudo dnf install -y postgresql postgresql-server postgresql-contrib

# Para CentOS 7
# sudo yum install -y postgresql postgresql-server postgresql-contrib

# Inicializar base de datos
sudo postgresql-setup --initdb

# Iniciar y habilitar servicio
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Paso 4: Configurar SELinux (si está habilitado)
```bash
# Verificar estado de SELinux
sestatus

# Si SELinux está habilitado, configurar permisos
sudo setsebool -P httpd_can_network_connect 1
sudo semanage port -a -t http_port_t -p tcp 5000
```

### Paso 5: Configurar Firewall (firewalld)
```bash
# Verificar si firewalld está activo
sudo systemctl status firewalld

# Abrir puertos necesarios
sudo firewall-cmd --permanent --add-port=5000/tcp
sudo firewall-cmd --permanent --add-service=postgresql
sudo firewall-cmd --reload

# Verificar reglas
sudo firewall-cmd --list-all
```

---

## 🐳 Instalación con Docker

### Opción A: Solo Base de Datos con Docker

```bash
# Crear directorio para datos
mkdir -p ~/walgreens-data

# Ejecutar PostgreSQL en Docker
docker run --name walgreens-postgres \
  -e POSTGRES_USER=walgreens_user \
  -e POSTGRES_PASSWORD=MiPasswordSeguro123! \
  -e POSTGRES_DB=walgreens_offers \
  -p 5432:5432 \
  -v ~/walgreens-data:/var/lib/postgresql/data \
  -d postgres:15

# Verificar que esté corriendo
docker ps
```

### Opción B: Aplicación Completa con Docker Compose

**Crear `docker-compose.yml`:**
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: walgreens-postgres
    environment:
      POSTGRES_USER: walgreens_user
      POSTGRES_PASSWORD: MiPasswordSeguro123!
      POSTGRES_DB: walgreens_offers
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - walgreens-network

  app:
    build: .
    container_name: walgreens-app
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://walgreens_user:MiPasswordSeguro123!@postgres:5432/walgreens_offers
    ports:
      - "5000:5000"
    depends_on:
      - postgres
    volumes:
      - ./logs:/app/logs
    networks:
      - walgreens-network

volumes:
  postgres_data:

networks:
  walgreens-network:
    driver: bridge
```

**Crear `Dockerfile`:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar código fuente
COPY . .

# Build de la aplicación
RUN npm run build

# Exponer puerto
EXPOSE 5000

# Comando de inicio
CMD ["npm", "start"]
```

**Ejecutar con Docker Compose:**
```bash
# Iniciar servicios
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar servicios
docker-compose down
```

---

## 🔧 Configuración de la Aplicación

### Paso 1: Configurar Variables de Entorno

**Editar archivo `.env`:**
```bash
nano .env
```

**Configuración mínima obligatoria:**
```env
# Base de datos (ajustar según tu configuración)
DATABASE_URL="postgresql://walgreens_user:MiPasswordSeguro123!@localhost:5432/walgreens_offers"

# API Keys de Walgreens (reemplazar con tus keys reales)
WALGREENS_API_KEY=tu_api_key_principal_aqui
WALGREENS_AFF_ID=tu_affiliate_id_aqui

# Fast Scanner - 4 API Keys adicionales
WALGREENS_API_KEY_CLAUDIO=tu_segunda_api_key_aqui
WALGREENS_API_KEY_ESTRELLA=tu_tercera_api_key_aqui
WALGREENS_API_KEY_RICHARD=tu_cuarta_api_key_aqui
WALGREENS_API_KEY_XAVI=tu_quinta_api_key_aqui
WALGREENS_AFF_ID_ALL=tu_affiliate_id_aqui

# Configuración del servidor
WALGREENS_API_BASE_URL=https://services.walgreens.com
PORT=5000
NODE_ENV=production
```

### Paso 2: Configurar Esquema de Base de Datos
```bash
# Navegar al directorio de la aplicación
cd /opt/walgreens-offers-explorer

# Aplicar esquema a la base de datos
npm run db:push

# Si hay errores, forzar la aplicación
npm run db:push --force
```

### Paso 3: Verificar Conexión a Base de Datos
```bash
# Probar conexión manual
psql -U walgreens_user -h localhost -d walgreens_offers

# Dentro de psql, verificar tablas
\dt

# Salir
\q
```

---

## 🚀 Configuración de Producción

### Paso 1: Instalar PM2 para Gestión de Procesos
```bash
# Instalar PM2 globalmente
sudo npm install -g pm2

# Verificar instalación
pm2 --version
```

### Paso 2: Crear Configuración de PM2

**Crear archivo `ecosystem.config.js`:**
```javascript
module.exports = {
  apps: [{
    name: 'walgreens-offers-explorer',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    restart_delay: 1000,
    max_restarts: 5,
    min_uptime: '5s'
  }]
};
```

### Paso 3: Build y Deploy
```bash
# Crear directorio de logs
mkdir -p logs

# Build de la aplicación
npm run build

# Iniciar con PM2
pm2 start ecosystem.config.js --env production

# Verificar estado
pm2 status

# Ver logs
pm2 logs walgreens-offers-explorer
```

### Paso 4: Configurar PM2 para Auto-start
```bash
# Generar script de startup
pm2 startup

# Seguir las instrucciones que aparezcan en pantalla
# Generalmente será algo como:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp /home/$USER

# Guardar configuración actual
pm2 save
```

### Paso 5: Configurar Nginx (Opcional - Proxy Reverso)

**Instalar Nginx:**
```bash
# Ubuntu/Debian
sudo apt install -y nginx

# CentOS/RHEL
sudo dnf install -y nginx
```

**Crear configuración de sitio:**
```bash
sudo nano /etc/nginx/sites-available/walgreens-offers
```

**Contenido del archivo:**
```nginx
server {
    listen 80;
    server_name tu-dominio.com;  # Reemplazar con tu dominio

    # Logs
    access_log /var/log/nginx/walgreens-access.log;
    error_log /var/log/nginx/walgreens-error.log;

    # Proxy hacia la aplicación
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Archivos estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**Activar sitio:**
```bash
# Crear enlace simbólico
sudo ln -s /etc/nginx/sites-available/walgreens-offers /etc/nginx/sites-enabled/

# Probar configuración
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## ✅ Verificación y Testing

### Paso 1: Verificar Servicios
```bash
# Verificar PostgreSQL
sudo systemctl status postgresql

# Verificar aplicación
pm2 status

# Verificar Nginx (si se instaló)
sudo systemctl status nginx
```

### Paso 2: Probar Conectividad

**Test de base de datos:**
```bash
# Probar conexión
psql -U walgreens_user -h localhost -d walgreens_offers -c "SELECT 1;"
```

**Test de aplicación:**
```bash
# Probar endpoint de salud
curl http://localhost:5000/health

# Debería responder: OK

# Probar endpoint de estado
curl http://localhost:5000/api/production-status
```

### Paso 3: Verificar Logs
```bash
# Logs de la aplicación
pm2 logs walgreens-offers-explorer

# Logs de PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-*.log

# Logs de Nginx (si se instaló)
sudo tail -f /var/log/nginx/walgreens-access.log
```

### Paso 4: Test Funcional

**Acceder a la aplicación:**
1. Abrir navegador
2. Ir a `http://tu-servidor:5000` o `http://tu-dominio.com`
3. Verificar que se carga el dashboard
4. Probar funcionalidad de lookup
5. Verificar que los contadores del sidebar funcionan

---

## 🔧 Troubleshooting

### Problema: No se puede conectar a PostgreSQL
```bash
# Verificar que PostgreSQL esté corriendo
sudo systemctl status postgresql

# Verificar configuración de autenticación
sudo nano /etc/postgresql/*/main/pg_hba.conf

# Verificar que el usuario existe
sudo -u postgres psql -c "\du"

# Verificar que la base de datos existe
sudo -u postgres psql -c "\l"
```

### Problema: Error de permisos en PostgreSQL
```bash
# Conectar como postgres
sudo -u postgres psql

# Otorgar permisos al usuario
GRANT ALL PRIVILEGES ON DATABASE walgreens_offers TO walgreens_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO walgreens_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO walgreens_user;
```

### Problema: Aplicación no inicia
```bash
# Verificar logs de PM2
pm2 logs walgreens-offers-explorer --lines 50

# Verificar variables de entorno
pm2 show walgreens-offers-explorer

# Reiniciar aplicación
pm2 restart walgreens-offers-explorer
```

### Problema: Puerto ocupado
```bash
# Ver qué proceso usa el puerto 5000
sudo lsof -i :5000

# Matar proceso si es necesario
sudo kill -9 PID_DEL_PROCESO
```

### Problema: Error de memoria
```bash
# Verificar uso de memoria
free -h
pm2 monit

# Aumentar límite de memoria en ecosystem.config.js
# max_memory_restart: '2G'
```

### Problema: API Keys no funcionan
```bash
# Verificar que las keys están configuradas
grep WALGREENS_API_KEY .env

# Probar conexión a API de Walgreens
curl -H "apikey: tu_api_key" "https://services.walgreens.com/api/v3/stores"
```

---

## 📋 Checklist Final

### Pre-Producción
- [ ] PostgreSQL instalado y funcionando
- [ ] Usuario y base de datos creados
- [ ] Node.js 18+ instalado
- [ ] Aplicación clonada y dependencias instaladas
- [ ] Variables de entorno configuradas
- [ ] Esquema de base de datos aplicado
- [ ] PM2 instalado y configurado
- [ ] Firewall configurado correctamente

### Producción
- [ ] Aplicación compilada (`npm run build`)
- [ ] PM2 iniciado con configuración de producción
- [ ] Auto-start de PM2 configurado
- [ ] Nginx configurado (si se usa)
- [ ] SSL/HTTPS configurado (recomendado)
- [ ] Backup de base de datos configurado
- [ ] Monitoring configurado
- [ ] Logs funcionando correctamente

### Funcional
- [ ] Dashboard se carga correctamente
- [ ] Lookup de miembros funciona
- [ ] Fast Scanner operativo
- [ ] Auto-reset programado
- [ ] APIs de Walgreens respondiendo
- [ ] Base de datos recibiendo datos
- [ ] WebSockets funcionando
- [ ] Responsive design en móviles

---

## 🆘 Soporte

Si encuentras problemas durante la instalación:

1. **Revisa los logs** detalladamente
2. **Verifica prerequisites** (versiones de software)
3. **Consulta esta guía** paso a paso
4. **Crea un issue** en GitHub con:
   - Sistema operativo y versión
   - Versiones de Node.js y PostgreSQL
   - Error específico y logs
   - Pasos para reproducir el problema

---

**¡Instalación completada! Tu sistema Walgreens Offers Explorer está listo para usar. 🎉**