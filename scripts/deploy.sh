#!/bin/bash

# =====================================
# SCRIPT DE DESPLIEGUE AUTOMATIZADO
# Walgreens Offers Explorer
# =====================================

set -e  # Salir si cualquier comando falla

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
APP_NAME="walgreens-offers-explorer"
APP_DIR="/opt/walgreens-offers-explorer"
BACKUP_DIR="/opt/backups/walgreens"
LOG_FILE="/var/log/walgreens-deploy.log"
SERVICE_USER="walgreens"

# Funciones de utilidad
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}" | tee -a "$LOG_FILE"
}

# Verificar que se está ejecutando como root o con sudo
check_permissions() {
    if [[ $EUID -ne 0 ]]; then
        error "Este script debe ejecutarse como root o con sudo"
    fi
}

# Verificar prerequisites
check_prerequisites() {
    log "Verificando prerequisites..."
    
    # Verificar Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js no está instalado"
    fi
    
    # Verificar npm
    if ! command -v npm &> /dev/null; then
        error "npm no está instalado"
    fi
    
    # Verificar PM2
    if ! command -v pm2 &> /dev/null; then
        warn "PM2 no está instalado. Instalando..."
        npm install -g pm2
    fi
    
    # Verificar PostgreSQL
    if ! command -v psql &> /dev/null; then
        error "PostgreSQL no está instalado"
    fi
    
    # Verificar Git
    if ! command -v git &> /dev/null; then
        error "Git no está instalado"
    fi
    
    log "Prerequisites verificados correctamente"
}

# Crear backup de la base de datos
backup_database() {
    log "Creando backup de la base de datos..."
    
    # Crear directorio de backup si no existe
    mkdir -p "$BACKUP_DIR"
    
    # Nombre del archivo de backup
    BACKUP_FILE="$BACKUP_DIR/walgreens_$(date +%Y%m%d_%H%M%S).sql"
    
    # Crear backup
    if sudo -u postgres pg_dump walgreens_offers > "$BACKUP_FILE"; then
        log "Backup creado exitosamente: $BACKUP_FILE"
        
        # Comprimir backup
        gzip "$BACKUP_FILE"
        log "Backup comprimido: $BACKUP_FILE.gz"
        
        # Mantener solo los últimos 10 backups
        find "$BACKUP_DIR" -name "walgreens_*.sql.gz" -type f -mtime +10 -delete
        
    else
        warn "Error al crear backup de base de datos, continuando con deployment..."
    fi
}

# Clonar o actualizar código
update_code() {
    log "Actualizando código fuente..."
    
    if [ ! -d "$APP_DIR" ]; then
        log "Clonando repositorio..."
        git clone https://github.com/tu-usuario/walgreens-offers-explorer.git "$APP_DIR"
    else
        log "Actualizando repositorio existente..."
        cd "$APP_DIR"
        
        # Guardar cambios locales si existen
        git stash push -m "Auto-stash before deploy $(date)"
        
        # Actualizar desde origin
        git fetch origin
        git reset --hard origin/main
    fi
    
    # Cambiar al directorio de la aplicación
    cd "$APP_DIR"
    
    # Cambiar propietario si es necesario
    if id "$SERVICE_USER" &>/dev/null; then
        chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"
    fi
}

# Instalar dependencias
install_dependencies() {
    log "Instalando dependencias..."
    cd "$APP_DIR"
    
    # Limpiar node_modules si existe
    if [ -d "node_modules" ]; then
        rm -rf node_modules
    fi
    
    # Limpiar cache de npm
    npm cache clean --force
    
    # Instalar dependencias
    npm ci --only=production --no-audit
    
    log "Dependencias instaladas correctamente"
}

# Build de la aplicación
build_application() {
    log "Compilando aplicación..."
    cd "$APP_DIR"
    
    # Ejecutar build
    npm run build
    
    # Verificar que el build existe
    if [ ! -f "dist/index.js" ]; then
        error "Build falló - archivo dist/index.js no encontrado"
    fi
    
    log "Aplicación compilada correctamente"
}

# Aplicar migraciones de base de datos
apply_migrations() {
    log "Aplicando migraciones de base de datos..."
    cd "$APP_DIR"
    
    # Verificar que existe .env
    if [ ! -f ".env" ]; then
        warn "Archivo .env no encontrado, copiando desde .env.example"
        cp .env.example .env
        warn "IMPORTANTE: Edita el archivo .env con tus credenciales antes de continuar"
        read -p "Presiona Enter cuando hayas configurado .env..."
    fi
    
    # Aplicar schema
    npm run db:push --force
    
    log "Migraciones aplicadas correctamente"
}

# Configurar logs
setup_logs() {
    log "Configurando directorio de logs..."
    
    mkdir -p "$APP_DIR/logs"
    
    # Cambiar propietario si es necesario
    if id "$SERVICE_USER" &>/dev/null; then
        chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR/logs"
    fi
    
    # Configurar logrotate
    cat > /etc/logrotate.d/walgreens-offers << EOF
$APP_DIR/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 $SERVICE_USER $SERVICE_USER
    postrotate
        pm2 reload $APP_NAME
    endscript
}
EOF
    
    log "Configuración de logs completada"
}

# Detener aplicación
stop_application() {
    log "Deteniendo aplicación..."
    
    # Detener PM2
    if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
        pm2 stop "$APP_NAME"
        pm2 delete "$APP_NAME"
        log "Aplicación detenida"
    else
        info "Aplicación no estaba corriendo"
    fi
}

# Iniciar aplicación
start_application() {
    log "Iniciando aplicación..."
    cd "$APP_DIR"
    
    # Iniciar con PM2
    pm2 start ecosystem.config.js --env production
    
    # Guardar configuración de PM2
    pm2 save
    
    # Verificar que la aplicación está corriendo
    sleep 5
    
    if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
        log "Aplicación iniciada correctamente"
    else
        error "Error al iniciar la aplicación"
    fi
}

# Health check
health_check() {
    log "Ejecutando health check..."
    
    # Esperar a que la aplicación se inicie completamente
    sleep 10
    
    # Verificar endpoint de salud
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s http://localhost:5000/health > /dev/null; then
            log "Health check exitoso - aplicación funcionando correctamente"
            return 0
        fi
        
        info "Health check fallido, intento $attempt/$max_attempts"
        sleep 2
        ((attempt++))
    done
    
    error "Health check falló después de $max_attempts intentos"
}

# Configurar firewall
configure_firewall() {
    log "Configurando firewall..."
    
    # Verificar si ufw está instalado
    if command -v ufw &> /dev/null; then
        # Permitir puerto de la aplicación
        ufw allow 5000/tcp
        
        # Permitir SSH
        ufw allow ssh
        
        # Habilitar firewall si no está activo
        if ! ufw status | grep -q "Status: active"; then
            ufw --force enable
        fi
        
        log "Firewall configurado"
    else
        warn "UFW no está instalado, saltando configuración de firewall"
    fi
}

# Configurar servicio systemd (backup para PM2)
configure_systemd() {
    log "Configurando servicio systemd..."
    
    cat > /etc/systemd/system/walgreens-offers.service << EOF
[Unit]
Description=Walgreens Offers Explorer
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
    
    # Recargar systemd
    systemctl daemon-reload
    
    # Habilitar servicio (sin iniciarlo, PM2 se encarga)
    systemctl enable walgreens-offers
    
    log "Servicio systemd configurado"
}

# Crear usuario de servicio
create_service_user() {
    if ! id "$SERVICE_USER" &>/dev/null; then
        log "Creando usuario de servicio: $SERVICE_USER"
        useradd -r -s /bin/false -d "$APP_DIR" "$SERVICE_USER"
    else
        info "Usuario de servicio ya existe: $SERVICE_USER"
    fi
}

# Mostrar estado final
show_status() {
    log "=== ESTADO FINAL DEL DEPLOYMENT ==="
    
    # Estado de PM2
    echo -e "${BLUE}Estado de PM2:${NC}"
    pm2 status
    
    # Estado del servicio
    echo -e "${BLUE}Estado del servicio systemd:${NC}"
    systemctl status walgreens-offers --no-pager -l
    
    # Uso de memoria
    echo -e "${BLUE}Uso de memoria:${NC}"
    free -h
    
    # Espacio en disco
    echo -e "${BLUE}Espacio en disco:${NC}"
    df -h "$APP_DIR"
    
    # URL de la aplicación
    echo -e "${GREEN}=== APLICACIÓN LISTA ===${NC}"
    echo -e "${GREEN}URL: http://$(hostname -I | awk '{print $1}'):5000${NC}"
    echo -e "${GREEN}Health Check: http://$(hostname -I | awk '{print $1}'):5000/health${NC}"
    echo -e "${GREEN}Logs: pm2 logs $APP_NAME${NC}"
    echo -e "${GREEN}Estado: pm2 status${NC}"
}

# Función principal
main() {
    log "=== INICIANDO DEPLOYMENT DE WALGREENS OFFERS EXPLORER ==="
    
    # Verificaciones iniciales
    check_permissions
    check_prerequisites
    
    # Crear usuario de servicio
    create_service_user
    
    # Backup de base de datos
    backup_database
    
    # Detener aplicación actual
    stop_application
    
    # Actualizar código
    update_code
    
    # Instalar dependencias
    install_dependencies
    
    # Build de aplicación
    build_application
    
    # Aplicar migraciones
    apply_migrations
    
    # Configurar logs
    setup_logs
    
    # Configurar firewall
    configure_firewall
    
    # Configurar systemd
    configure_systemd
    
    # Iniciar aplicación
    start_application
    
    # Health check
    health_check
    
    # Mostrar estado
    show_status
    
    log "=== DEPLOYMENT COMPLETADO EXITOSAMENTE ==="
}

# Manejo de errores y cleanup
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        error "Deployment falló con código de salida $exit_code"
        
        # Intentar mostrar logs de error
        if [ -f "$LOG_FILE" ]; then
            echo -e "${RED}Últimas líneas del log:${NC}"
            tail -20 "$LOG_FILE"
        fi
        
        # Intentar revertir si es posible
        warn "Considera ejecutar un rollback si es necesario"
    fi
}

# Trap para cleanup
trap cleanup EXIT

# Verificar argumentos
if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
    echo "Uso: $0 [opciones]"
    echo "Opciones:"
    echo "  --help, -h     Mostrar esta ayuda"
    echo "  --no-backup    Saltar backup de base de datos"
    echo "  --force        Forzar deployment sin confirmación"
    echo ""
    echo "Ejemplo: sudo $0"
    exit 0
fi

# Confirmación antes de proceder (a menos que se use --force)
if [ "$1" != "--force" ]; then
    echo -e "${YELLOW}¿Estás seguro de que quieres hacer deployment a producción? [y/N]${NC}"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "Deployment cancelado"
        exit 0
    fi
fi

# Ejecutar deployment
main "$@"