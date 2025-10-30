# 🗄️ Configuración de Base de Datos PostgreSQL
## Walgreens Offers Explorer

Esta guía proporciona información detallada sobre la configuración, optimización y mantenimiento de la base de datos PostgreSQL para la aplicación Walgreens Offers Explorer.

---

## 📋 Tabla de Contenido

1. [Esquema de Base de Datos](#esquema-de-base-de-datos)
2. [Instalación y Configuración](#instalación-y-configuración)
3. [Estructura de Tablas](#estructura-de-tablas)
4. [Índices y Performance](#índices-y-performance)
5. [Optimización para Producción](#optimización-para-producción)
6. [Backup y Recuperación](#backup-y-recuperación)
7. [Monitoreo y Mantenimiento](#monitoreo-y-mantenimiento)
8. [Migraciones y Actualizaciones](#migraciones-y-actualizaciones)
9. [Troubleshooting](#troubleshooting)

---

## 🏗️ Esquema de Base de Datos

La aplicación utiliza PostgreSQL como sistema de gestión de base de datos principal con Drizzle ORM para operaciones type-safe.

### Configuración de Conexión

```typescript
// Configuración de conexión usando Neon (o PostgreSQL local)
const connectionString = process.env.DATABASE_URL;
const db = drizzle(
  neon(connectionString!), 
  { schema }
);
```

### Variables de Entorno Requeridas

```env
# URL principal de conexión
DATABASE_URL="postgresql://usuario:contraseña@host:puerto/database?schema=public"

# Variables adicionales (compatibilidad)
PGHOST=localhost
PGPORT=5432
PGDATABASE=walgreens_offers
PGUSER=walgreens_user
PGPASSWORD=tu_contraseña_segura
```

---

## 🔧 Instalación y Configuración

### 1. Instalación de PostgreSQL

#### Ubuntu/Debian:
```bash
# Instalar PostgreSQL 15
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update
sudo apt install postgresql-15 postgresql-contrib-15

# Verificar instalación
sudo systemctl status postgresql
```

#### CentOS/RHEL:
```bash
# Instalar repositorio
sudo dnf install https://download.postgresql.org/pub/repos/yum/reporpms/EL-8-x86_64/pgdg-redhat-repo-latest.noarch.rpm

# Instalar PostgreSQL
sudo dnf install postgresql15-server postgresql15-contrib

# Inicializar y habilitar
sudo postgresql-15-setup initdb
sudo systemctl enable --now postgresql-15
```

### 2. Configuración Inicial

```bash
# Cambiar a usuario postgres
sudo -i -u postgres

# Crear base de datos
createdb walgreens_offers

# Crear usuario de aplicación
psql -c "CREATE USER walgreens_user WITH ENCRYPTED PASSWORD 'contraseña_muy_segura';"

# Otorgar permisos
psql -c "GRANT ALL PRIVILEGES ON DATABASE walgreens_offers TO walgreens_user;"
psql -c "ALTER USER walgreens_user CREATEDB;"

# Habilitar extensiones útiles
psql -d walgreens_offers -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
psql -d walgreens_offers -c "CREATE EXTENSION IF NOT EXISTS \"pg_stat_statements\";"

# Salir
exit
```

### 3. Configuración de Seguridad

#### Archivo pg_hba.conf:
```bash
# Editar configuración de autenticación
sudo nano /etc/postgresql/15/main/pg_hba.conf
```

```conf
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# Local connections
local   all             postgres                                peer
local   walgreens_offers walgreens_user                         md5

# IPv4 local connections:
host    walgreens_offers walgreens_user  127.0.0.1/32           md5
host    walgreens_offers walgreens_user  ::1/128                md5

# Production connections (ajustar según necesidad)
host    walgreens_offers walgreens_user  10.0.0.0/8             md5
```

#### Archivo postgresql.conf:
```bash
# Editar configuración principal
sudo nano /etc/postgresql/15/main/postgresql.conf
```

---

## 📊 Estructura de Tablas

### Tabla Principal: member_history

**Propósito**: Almacena el historial de miembros y sus datos de perfil.

```sql
CREATE TABLE member_history (
    id SERIAL PRIMARY KEY,
    phone_number TEXT NOT NULL,
    enc_loyalty_id TEXT NOT NULL,
    member_name TEXT,
    card_number TEXT,
    current_balance INTEGER,
    current_balance_dollars TEXT,
    last_activity_date TEXT,
    email_address TEXT,
    member_data JSONB,  -- Datos completos de la API
    last_accessed_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    marked_as_used BOOLEAN DEFAULT FALSE,
    marked_as_used_at TIMESTAMP
);
```

**Índices:**
```sql
-- Índices para búsquedas rápidas
CREATE INDEX idx_member_history_phone ON member_history(phone_number);
CREATE INDEX idx_member_history_enc_loyalty ON member_history(enc_loyalty_id);
CREATE INDEX idx_member_history_balance ON member_history(current_balance);
CREATE INDEX idx_member_history_marked ON member_history(marked_as_used);
CREATE INDEX idx_member_history_activity ON member_history(last_activity_date);

-- Índices compuestos para queries específicas
CREATE INDEX idx_member_history_balance_marked ON member_history(current_balance, marked_as_used);
CREATE INDEX idx_member_history_phone_marked ON member_history(phone_number, marked_as_used);

-- Índice GIN para búsquedas en JSON
CREATE INDEX idx_member_history_member_data ON member_history USING GIN (member_data);
```

### Tabla: members

**Propósito**: Configuración de miembros y tiendas asignadas.

```sql
CREATE TABLE members (
    id SERIAL PRIMARY KEY,
    phone_number TEXT NOT NULL UNIQUE,
    assigned_store_number TEXT,
    assigned_store_name TEXT,
    assigned_store_address JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Tabla: offers

**Propósito**: Catálogo de ofertas disponibles.

```sql
CREATE TABLE offers (
    id SERIAL PRIMARY KEY,
    offer_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    discount TEXT,
    category TEXT,
    image_url TEXT,
    expiry_date TEXT,
    status TEXT DEFAULT 'active',
    offer_data JSONB,  -- Datos completos de la oferta
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Tabla: clipped_offers

**Propósito**: Tracking de ofertas clipeadas por usuario.

```sql
CREATE TABLE clipped_offers (
    id SERIAL PRIMARY KEY,
    enc_loyalty_id TEXT NOT NULL,
    offer_id TEXT NOT NULL,
    channel TEXT DEFAULT 'web',
    status TEXT DEFAULT 'active',
    clipped_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraint único para evitar duplicados
    UNIQUE(enc_loyalty_id, offer_id)
);
```

### Tabla: bulk_verification_jobs

**Propósito**: Gestión de trabajos de verificación masiva (Fast Scanner).

```sql
CREATE TABLE bulk_verification_jobs (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(255) NOT NULL UNIQUE,
    status TEXT DEFAULT 'pending',  -- pending, running, completed, failed
    total_phone_numbers INTEGER,
    processed_count INTEGER DEFAULT 0,
    valid_count INTEGER DEFAULT 0,
    invalid_count INTEGER DEFAULT 0,
    progress INTEGER DEFAULT 0,  -- 0-100
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    results_summary JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Tabla: api_keys

**Propósito**: Gestión y rotación de API keys.

```sql
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    api_key TEXT NOT NULL,
    aff_id TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    request_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## ⚡ Índices y Performance

### Índices Críticos para Performance

```sql
-- ======================================
-- ÍNDICES PRINCIPALES
-- ======================================

-- Member History (tabla más importante)
CREATE INDEX CONCURRENTLY idx_member_history_phone_active 
ON member_history(phone_number) WHERE marked_as_used = false;

CREATE INDEX CONCURRENTLY idx_member_history_balance_desc 
ON member_history(current_balance DESC) WHERE marked_as_used = false;

CREATE INDEX CONCURRENTLY idx_member_history_activity_recent 
ON member_history(last_activity_date DESC) WHERE marked_as_used = false;

-- ======================================
-- ÍNDICES PARA FAST SCANNER
-- ======================================

-- Jobs de verificación
CREATE INDEX CONCURRENTLY idx_bulk_jobs_status 
ON bulk_verification_jobs(status, created_at DESC);

CREATE INDEX CONCURRENTLY idx_bulk_jobs_active 
ON bulk_verification_jobs(job_id) WHERE status IN ('pending', 'running');

-- ======================================
-- ÍNDICES PARA OFERTAS
-- ======================================

-- Ofertas por estado y fecha
CREATE INDEX CONCURRENTLY idx_offers_active 
ON offers(status, expiry_date) WHERE status = 'active';

-- Ofertas clipeadas por usuario
CREATE INDEX CONCURRENTLY idx_clipped_offers_user 
ON clipped_offers(enc_loyalty_id, clipped_at DESC);

-- ======================================
-- ÍNDICES PARA API KEYS
-- ======================================

-- API Keys activas
CREATE INDEX CONCURRENTLY idx_api_keys_active 
ON api_keys(is_active, last_used_at) WHERE is_active = true;
```

### Análisis de Performance

```sql
-- ======================================
-- QUERIES DE ANÁLISIS
-- ======================================

-- Ver tamaño de tablas
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE schemaname = 'public' 
ORDER BY tablename, attname;

-- Estadísticas de uso de índices
SELECT 
    indexrelname as index_name,
    relname as table_name,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes 
ORDER BY idx_scan DESC;

-- Queries más lentas (requiere pg_stat_statements)
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    (total_time/calls) as avg_time
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;
```

---

## 🚀 Optimización para Producción

### Configuración de postgresql.conf

```conf
# ==============================================
# CONFIGURACIÓN DE MEMORIA
# ==============================================

# Memoria compartida (25% de RAM total)
shared_buffers = 2GB

# Cache efectivo (75% de RAM total)
effective_cache_size = 6GB

# Memoria de trabajo por operación
work_mem = 64MB

# Memoria para mantenimiento
maintenance_work_mem = 512MB

# ==============================================
# CONFIGURACIÓN DE CHECKPOINT
# ==============================================

# Checkpoint completion target
checkpoint_completion_target = 0.9

# Tamaño máximo de WAL
max_wal_size = 2GB

# Tamaño mínimo de WAL
min_wal_size = 80MB

# ==============================================
# CONFIGURACIÓN DE WAL
# ==============================================

# Buffers de WAL
wal_buffers = 16MB

# Nivel de WAL
wal_level = replica

# Archivado de WAL (para backups)
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/15/main/archive/%f'

# ==============================================
# CONFIGURACIÓN DE QUERY PLANNER
# ==============================================

# Target estadístico por defecto
default_statistics_target = 100

# Costo de página aleatoria (SSD)
random_page_cost = 1.1

# Concurrencia efectiva de I/O
effective_io_concurrency = 200

# ==============================================
# CONFIGURACIÓN DE CONEXIONES
# ==============================================

# Máximo de conexiones
max_connections = 200

# Conexiones reservadas para superuser
superuser_reserved_connections = 3

# ==============================================
# CONFIGURACIÓN DE LOGS
# ==============================================

# Habilitar log de queries lentas
log_min_duration_statement = 1000  # 1 segundo

# Log de conexiones
log_connections = on
log_disconnections = on

# Log de checkpoints
log_checkpoints = on

# Log de bloqueos
log_lock_waits = on

# ==============================================
# CONFIGURACIÓN DE AUTOVACUUM
# ==============================================

# Habilitar autovacuum
autovacuum = on

# Máximo workers de autovacuum
autovacuum_max_workers = 4

# Threshold para vacuum
autovacuum_vacuum_threshold = 50

# Scale factor para vacuum
autovacuum_vacuum_scale_factor = 0.1

# Threshold para analyze
autovacuum_analyze_threshold = 50

# Scale factor para analyze
autovacuum_analyze_scale_factor = 0.05
```

### Optimizaciones a Nivel de Sistema

```bash
# ==============================================
# CONFIGURACIÓN DEL KERNEL
# ==============================================

# Agregar a /etc/sysctl.conf
echo "# PostgreSQL Optimizations" | sudo tee -a /etc/sysctl.conf
echo "kernel.shmmax = 68719476736" | sudo tee -a /etc/sysctl.conf
echo "kernel.shmall = 4294967296" | sudo tee -a /etc/sysctl.conf
echo "vm.swappiness = 1" | sudo tee -a /etc/sysctl.conf
echo "vm.dirty_background_ratio = 5" | sudo tee -a /etc/sysctl.conf
echo "vm.dirty_ratio = 10" | sudo tee -a /etc/sysctl.conf

# Aplicar configuración
sudo sysctl -p

# ==============================================
# LÍMITES DE RECURSOS
# ==============================================

# Agregar a /etc/security/limits.conf
echo "postgres soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "postgres hard nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "postgres soft nproc 8192" | sudo tee -a /etc/security/limits.conf
echo "postgres hard nproc 8192" | sudo tee -a /etc/security/limits.conf
```

---

## 💾 Backup y Recuperación

### Scripts de Backup Automatizado

#### Backup Completo:
```bash
#!/bin/bash
# backup-full.sh

DB_NAME="walgreens_offers"
DB_USER="walgreens_user"
BACKUP_DIR="/opt/backups/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)

# Crear directorio si no existe
mkdir -p $BACKUP_DIR

# Backup completo
pg_dump -h localhost -U $DB_USER -d $DB_NAME \
    --verbose --clean --no-owner --no-privileges \
    > $BACKUP_DIR/full_backup_$DATE.sql

# Comprimir
gzip $BACKUP_DIR/full_backup_$DATE.sql

# Mantener solo los últimos 7 backups
find $BACKUP_DIR -name "full_backup_*.sql.gz" -type f -mtime +7 -delete

echo "Backup completado: full_backup_$DATE.sql.gz"
```

#### Backup Incremental con WAL:
```bash
#!/bin/bash
# backup-incremental.sh

BACKUP_DIR="/opt/backups/postgresql/wal"
DATE=$(date +%Y%m%d_%H%M%S)

# Crear directorio si no existe
mkdir -p $BACKUP_DIR

# Backup base (si no existe)
if [ ! -f "$BACKUP_DIR/base_backup.tar.gz" ]; then
    sudo -u postgres pg_basebackup -D $BACKUP_DIR/base_backup -Ft -z -P
fi

# Archivar WAL files
sudo -u postgres pg_switch_wal

# Comprimir y mover WAL files antiguos
find /var/lib/postgresql/15/main/pg_wal -name "*.gz" -mtime +1 \
    -exec mv {} $BACKUP_DIR/ \;

echo "Backup incremental completado: $DATE"
```

### Recuperación desde Backup

#### Restauración Completa:
```bash
#!/bin/bash
# restore.sh

BACKUP_FILE=$1
DB_NAME="walgreens_offers"
DB_USER="walgreens_user"

if [ -z "$BACKUP_FILE" ]; then
    echo "Uso: $0 <archivo_backup.sql.gz>"
    exit 1
fi

# Detener aplicación
pm2 stop walgreens-offers-explorer

# Crear nueva base de datos temporal
sudo -u postgres createdb ${DB_NAME}_restore

# Restaurar desde backup
gunzip -c $BACKUP_FILE | sudo -u postgres psql -d ${DB_NAME}_restore

# Verificar integridad
sudo -u postgres psql -d ${DB_NAME}_restore -c "SELECT count(*) FROM member_history;"

echo "Base de datos restaurada en ${DB_NAME}_restore"
echo "Para finalizar, ejecuta:"
echo "  sudo -u postgres dropdb $DB_NAME"
echo "  sudo -u postgres psql -c \"ALTER DATABASE ${DB_NAME}_restore RENAME TO $DB_NAME;\""
echo "  pm2 start walgreens-offers-explorer"
```

---

## 📈 Monitoreo y Mantenimiento

### Monitoreo de Performance

#### Script de Monitoreo:
```bash
#!/bin/bash
# monitor-db.sh

DB_NAME="walgreens_offers"

echo "=== ESTADO DE LA BASE DE DATOS ==="
echo "Fecha: $(date)"
echo ""

# Conexiones activas
echo "=== CONEXIONES ACTIVAS ==="
sudo -u postgres psql -d $DB_NAME -c "
SELECT state, count(*) as connections 
FROM pg_stat_activity 
WHERE datname = '$DB_NAME' 
GROUP BY state;"

echo ""

# Tamaño de la base de datos
echo "=== TAMAÑO DE BASE DE DATOS ==="
sudo -u postgres psql -d $DB_NAME -c "
SELECT 
    pg_size_pretty(pg_database_size('$DB_NAME')) as database_size,
    pg_size_pretty(pg_total_relation_size('member_history')) as member_history_size,
    pg_size_pretty(pg_total_relation_size('offers')) as offers_size;"

echo ""

# Estadísticas de tablas
echo "=== ESTADÍSTICAS DE TABLAS ==="
sudo -u postgres psql -d $DB_NAME -c "
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_tuples,
    n_dead_tup as dead_tuples
FROM pg_stat_user_tables 
ORDER BY n_live_tup DESC;"

echo ""

# Uso de índices
echo "=== USO DE ÍNDICES ==="
sudo -u postgres psql -d $DB_NAME -c "
SELECT 
    indexrelname as index_name,
    relname as table_name,
    idx_scan as scans,
    idx_tup_read as tuples_read
FROM pg_stat_user_indexes 
WHERE idx_scan > 0
ORDER BY idx_scan DESC 
LIMIT 10;"

echo ""

# Locks activos
echo "=== LOCKS ACTIVOS ==="
sudo -u postgres psql -d $DB_NAME -c "
SELECT 
    mode,
    count(*) as lock_count
FROM pg_locks 
WHERE database = (SELECT oid FROM pg_database WHERE datname = '$DB_NAME')
GROUP BY mode;"
```

### Mantenimiento Automático

#### Script de Mantenimiento:
```bash
#!/bin/bash
# maintenance.sh

DB_NAME="walgreens_offers"

echo "=== INICIANDO MANTENIMIENTO DE BD ==="
echo "Fecha: $(date)"

# VACUUM y ANALYZE de tablas principales
echo "Ejecutando VACUUM ANALYZE en member_history..."
sudo -u postgres psql -d $DB_NAME -c "VACUUM ANALYZE member_history;"

echo "Ejecutando VACUUM ANALYZE en offers..."
sudo -u postgres psql -d $DB_NAME -c "VACUUM ANALYZE offers;"

echo "Ejecutando VACUUM ANALYZE en clipped_offers..."
sudo -u postgres psql -d $DB_NAME -c "VACUUM ANALYZE clipped_offers;"

# Limpiar jobs antiguos completados
echo "Limpiando jobs antiguos..."
sudo -u postgres psql -d $DB_NAME -c "
DELETE FROM bulk_verification_jobs 
WHERE status = 'completed' 
AND completed_at < NOW() - INTERVAL '30 days';"

# Actualizar estadísticas
echo "Actualizando estadísticas..."
sudo -u postgres psql -d $DB_NAME -c "ANALYZE;"

# Reindexar si es necesario
echo "Verificando índices..."
sudo -u postgres psql -d $DB_NAME -c "REINDEX DATABASE $DB_NAME;"

echo "=== MANTENIMIENTO COMPLETADO ==="
```

### Configuración de Cron Jobs

```bash
# Agregar a crontab de postgres
sudo -u postgres crontab -e

# Backup diario a las 2 AM
0 2 * * * /opt/scripts/backup-full.sh

# Mantenimiento semanal los domingos a las 3 AM
0 3 * * 0 /opt/scripts/maintenance.sh

# Monitoreo cada hora
0 * * * * /opt/scripts/monitor-db.sh >> /var/log/postgresql/monitor.log
```

---

## 🔄 Migraciones y Actualizaciones

### Usando Drizzle ORM

#### Aplicar Schema Changes:
```bash
# Desarrollo - aplicar cambios de schema
npm run db:push

# Producción - forzar cambios (cuidado!)
npm run db:push --force

# Ver schema actual
npm run db:studio
```

#### Generar Migraciones:
```bash
# Generar migración (si es necesario)
npx drizzle-kit generate:pg

# Aplicar migración
npx drizzle-kit push:pg
```

### Migraciones Manuales Seguras

#### Template de Migración:
```sql
-- Migration: YYYYMMDD_HHMMSS_description.sql
-- Descripción: [Descripción de los cambios]

BEGIN;

-- ======================================
-- VERIFICACIONES PRE-MIGRACIÓN
-- ======================================

-- Verificar que existe la tabla
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'member_history') THEN
        RAISE EXCEPTION 'Tabla member_history no existe';
    END IF;
END $$;

-- ======================================
-- CAMBIOS DE SCHEMA
-- ======================================

-- Agregar nueva columna (ejemplo)
ALTER TABLE member_history ADD COLUMN IF NOT EXISTS new_field TEXT;

-- Agregar índice
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_member_history_new_field 
ON member_history(new_field);

-- ======================================
-- VERIFICACIONES POST-MIGRACIÓN
-- ======================================

-- Verificar que la columna existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'member_history' AND column_name = 'new_field') THEN
        RAISE EXCEPTION 'Columna new_field no fue creada';
    END IF;
END $$;

COMMIT;
```

---

## 🚨 Troubleshooting

### Problemas Comunes y Soluciones

#### 1. Conexión Rechazada
```bash
# Verificar que PostgreSQL está corriendo
sudo systemctl status postgresql

# Verificar puertos
sudo netstat -tlnp | grep :5432

# Verificar configuración
sudo -u postgres psql -c "SHOW port;"

# Reiniciar servicio
sudo systemctl restart postgresql
```

#### 2. Autenticación Fallida
```bash
# Verificar pg_hba.conf
sudo cat /etc/postgresql/15/main/pg_hba.conf | grep walgreens

# Recargar configuración
sudo -u postgres psql -c "SELECT pg_reload_conf();"

# Cambiar password de usuario
sudo -u postgres psql -c "ALTER USER walgreens_user PASSWORD 'nueva_contraseña';"
```

#### 3. Performance Lenta
```bash
# Verificar queries activas
sudo -u postgres psql -d walgreens_offers -c "
SELECT pid, query_start, state, query 
FROM pg_stat_activity 
WHERE state = 'active' AND query != '<IDLE>';"

# Analizar query plan
sudo -u postgres psql -d walgreens_offers -c "
EXPLAIN ANALYZE SELECT * FROM member_history 
WHERE current_balance > 100 AND marked_as_used = false;"

# Verificar bloqueos
sudo -u postgres psql -d walgreens_offers -c "
SELECT blocked_locks.pid AS blocked_pid,
       blocked_activity.usename AS blocked_user,
       blocking_locks.pid AS blocking_pid,
       blocking_activity.usename AS blocking_user,
       blocked_activity.query AS blocked_statement,
       blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON (blocking_locks.transactionid = blocked_locks.transactionid AND blocking_locks.pid != blocked_locks.pid)
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;"
```

#### 4. Espacio en Disco
```bash
# Verificar tamaño de base de datos
sudo -u postgres psql -d walgreens_offers -c "
SELECT pg_size_pretty(pg_database_size('walgreens_offers'));"

# Verificar tablas más grandes
sudo -u postgres psql -d walgreens_offers -c "
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(tablename::regclass)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename::regclass) DESC;"

# Limpiar logs antiguos
sudo find /var/log/postgresql -name "*.log" -mtime +7 -delete

# VACUUM FULL (solo en mantenimiento)
sudo -u postgres psql -d walgreens_offers -c "VACUUM FULL;"
```

### Comandos de Diagnóstico Útiles

```bash
# Estado general de PostgreSQL
sudo -u postgres psql -c "
SELECT version();"

# Configuración actual
sudo -u postgres psql -c "
SELECT name, setting, unit, context 
FROM pg_settings 
WHERE name IN ('shared_buffers', 'effective_cache_size', 'work_mem', 'maintenance_work_mem');"

# Actividad actual
sudo -u postgres psql -d walgreens_offers -c "
SELECT count(*) as active_connections,
       count(*) FILTER (WHERE state = 'active') as active_queries,
       count(*) FILTER (WHERE state = 'idle') as idle_connections
FROM pg_stat_activity 
WHERE datname = 'walgreens_offers';"

# Uso de cache
sudo -u postgres psql -d walgreens_offers -c "
SELECT 
    sum(heap_blks_read) as heap_read,
    sum(heap_blks_hit) as heap_hit,
    round(sum(heap_blks_hit) * 100.0 / (sum(heap_blks_hit) + sum(heap_blks_read)), 2) as cache_hit_ratio
FROM pg_statio_user_tables;"
```

---

Esta configuración de PostgreSQL está optimizada para la aplicación Walgreens Offers Explorer y debería proporcionar un rendimiento excelente para las operaciones de Fast Scanner y gestión de ofertas en producción.