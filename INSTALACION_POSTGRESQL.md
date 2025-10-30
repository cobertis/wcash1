# 🗄️ Instalación de PostgreSQL en tu Servidor

## 📋 Paso 1: Instalar PostgreSQL

### Ubuntu/Debian:
```bash
# Actualizar el sistema
sudo apt update && sudo apt upgrade -y

# Instalar PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Verificar que se instaló correctamente
sudo systemctl status postgresql
```

### CentOS/RHEL/Amazon Linux:
```bash
# Instalar PostgreSQL
sudo yum install postgresql-server postgresql-contrib -y

# Inicializar la base de datos
sudo postgresql-setup initdb

# Habilitar e iniciar el servicio
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

## 🔧 Paso 2: Configurar PostgreSQL

### Acceder como usuario postgres:
```bash
sudo -u postgres psql
```

### Crear base de datos y usuario:
```sql
-- Crear la base de datos
CREATE DATABASE walgreens_offers;

-- Crear usuario con password seguro
CREATE USER walgreens_user WITH ENCRYPTED PASSWORD 'MiPasswordSeguro123!';

-- Dar todos los permisos al usuario
GRANT ALL PRIVILEGES ON DATABASE walgreens_offers TO walgreens_user;

-- Dar permisos de creación de tablas
ALTER USER walgreens_user CREATEDB;

-- Salir de PostgreSQL
\q
```

## 🔐 Paso 3: Configurar Acceso Remoto (Opcional)

Si necesitas acceso desde otras máquinas:

### Editar postgresql.conf:
```bash
sudo nano /etc/postgresql/*/main/postgresql.conf
```

Buscar y cambiar:
```
listen_addresses = 'localhost'
```
Por:
```
listen_addresses = '*'
```

### Editar pg_hba.conf:
```bash
sudo nano /etc/postgresql/*/main/pg_hba.conf
```

Agregar al final:
```
host    walgreens_offers    walgreens_user    0.0.0.0/0    md5
```

### Reiniciar PostgreSQL:
```bash
sudo systemctl restart postgresql
```

## ✅ Paso 4: Probar la Conexión

```bash
# Probar conexión local
psql -h localhost -U walgreens_user -d walgreens_offers

# Si te pide password, ingresa: MiPasswordSeguro123!
```

## 🎯 Paso 5: Tu String de Conexión

Con la configuración anterior, tu string de conexión será:

```env
DATABASE_URL=postgresql://walgreens_user:MiPasswordSeguro123!@localhost:5432/walgreens_offers
```

## 🚀 Configuración Recomendada para Producción

### Optimizar PostgreSQL:
```bash
sudo nano /etc/postgresql/*/main/postgresql.conf
```

Configurar estos valores (ajusta según tu RAM):
```
# Memory (Para servidor con 4GB RAM)
shared_buffers = 1GB
effective_cache_size = 3GB
work_mem = 64MB
maintenance_work_mem = 256MB

# Connections
max_connections = 100

# WAL
wal_buffers = 16MB
checkpoint_completion_target = 0.9
```

## 🔒 Seguridad Adicional

### Crear usuario específico del sistema:
```bash
# Crear usuario del sistema para la aplicación
sudo adduser walgreens-app

# Cambiar a ese usuario para ejecutar la app
sudo su - walgreens-app
```

### Configurar firewall:
```bash
# Permitir solo puerto PostgreSQL desde localhost
sudo ufw allow from 127.0.0.1 to any port 5432

# Si necesitas acceso remoto, especifica IPs
sudo ufw allow from TU_IP_PUBLICA to any port 5432
```

## 📊 Comandos Útiles

### Verificar estado:
```bash
sudo systemctl status postgresql
```

### Ver logs:
```bash
sudo tail -f /var/log/postgresql/postgresql-*-main.log
```

### Backup:
```bash
pg_dump -h localhost -U walgreens_user walgreens_offers > backup.sql
```

### Restaurar:
```bash
psql -h localhost -U walgreens_user walgreens_offers < backup.sql
```

## 🎯 Configuración Final en .env

Una vez instalado, usa esta configuración en tu archivo `.env`:

```env
# EJEMPLO CON DATOS REALES:
DATABASE_URL=postgresql://walgreens_user:MiPasswordSeguro123!@localhost:5432/walgreens_offers

# TUS 4 API KEYS:
WALGREENS_API_KEY=NQpKJZXdhbI2KRbfApYXcvtcYHtxjyFW
WALGREENS_AFF_ID=AAAAAAAAAA
WALGREENS_API_KEY_CLAUDIO=uu6AyeO7XCwo5moFWSrMJ6HHhKMQ2FZW
WALGREENS_API_KEY_ESTRELLA=rTIthoVNMd81ZNE2KAuyZP5GB8HZzbsp
WALGREENS_API_KEY_RICHARD=rwwrfKcBcOG0gXXSo2S5JNEGfCwykaaB
WALGREENS_API_KEY_XAVI=NQpKJZXdhbI2KRbfApYXcvtcYHtxjyFW
WALGREENS_AFF_ID_ALL=AAAAAAAAAA
WALGREENS_API_BASE_URL=https://services.walgreens.com
PORT=5000
NODE_ENV=production
```

## ⚠️ Notas Importantes

1. **Password Seguro**: Cambia `MiPasswordSeguro123!` por un password más seguro
2. **Permisos**: El usuario `walgreens_user` tiene los permisos necesarios
3. **Puerto**: PostgreSQL usa el puerto 5432 por defecto
4. **Backup**: Programa backups automáticos regulares

Con esta instalación tendrás PostgreSQL listo para tu aplicación Walgreens con máximo rendimiento.