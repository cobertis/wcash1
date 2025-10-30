#!/bin/bash

# =====================================
# SCRIPT DE BACKUP AUTOMATIZADO
# Walgreens Offers Explorer
# =====================================

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuración
APP_NAME="walgreens-offers-explorer"
APP_DIR="/opt/walgreens-offers-explorer"
BACKUP_DIR="/opt/backups/walgreens"
DB_NAME="walgreens_offers"
DB_USER="walgreens_user"
LOG_FILE="/var/log/walgreens-backup.log"
RETENTION_DAYS=30

# Configuración S3 (opcional)
S3_BUCKET=""
S3_ENABLED=false

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

# Verificar prerequisites
check_prerequisites() {
    log "Verificando prerequisites para backup..."
    
    # Verificar PostgreSQL
    if ! command -v pg_dump &> /dev/null; then
        error "pg_dump no está instalado"
    fi
    
    # Verificar acceso a la base de datos
    if ! sudo -u postgres psql -l | grep -q "$DB_NAME"; then
        error "Base de datos $DB_NAME no encontrada"
    fi
    
    # Crear directorio de backup si no existe
    mkdir -p "$BACKUP_DIR"
    
    # Verificar permisos de escritura
    if [ ! -w "$BACKUP_DIR" ]; then
        error "No se puede escribir en el directorio de backup: $BACKUP_DIR"
    fi
    
    # Verificar AWS CLI si S3 está habilitado
    if [ "$S3_ENABLED" = true ]; then
        if ! command -v aws &> /dev/null; then
            warn "AWS CLI no está instalado, deshabilitando backup a S3"
            S3_ENABLED=false
        fi
    fi
    
    log "Prerequisites verificados correctamente"
}

# Crear backup de base de datos
backup_database() {
    log "Iniciando backup de la base de datos..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/db_backup_$timestamp.sql"
    local compressed_file="$backup_file.gz"
    
    # Backup de la base de datos
    log "Creando backup SQL..."
    if sudo -u postgres pg_dump "$DB_NAME" > "$backup_file"; then
        log "Backup SQL creado: $backup_file"
        
        # Comprimir backup
        log "Comprimiendo backup..."
        if gzip "$backup_file"; then
            log "Backup comprimido: $compressed_file"
            
            # Verificar integridad del archivo comprimido
            if gzip -t "$compressed_file"; then
                log "Backup verificado correctamente"
            else
                error "Error en la integridad del backup comprimido"
            fi
            
            # Mostrar tamaño del backup
            local size=$(du -h "$compressed_file" | cut -f1)
            log "Tamaño del backup: $size"
            
            echo "$compressed_file"  # Retornar ruta del archivo
        else
            error "Error al comprimir el backup"
        fi
    else
        error "Error al crear backup de la base de datos"
    fi
}

# Backup de archivos de configuración
backup_config() {
    log "Iniciando backup de configuración..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local config_backup="$BACKUP_DIR/config_backup_$timestamp.tar.gz"
    
    # Lista de archivos/directorios a respaldar
    local files_to_backup=(
        "$APP_DIR/.env"
        "$APP_DIR/ecosystem.config.js"
        "$APP_DIR/package.json"
        "$APP_DIR/logs"
        "/etc/nginx/sites-available/walgreens-offers"
        "/etc/systemd/system/walgreens-offers.service"
    )
    
    # Filtrar archivos que existen
    local existing_files=()
    for file in "${files_to_backup[@]}"; do
        if [ -e "$file" ]; then
            existing_files+=("$file")
        fi
    done
    
    if [ ${#existing_files[@]} -gt 0 ]; then
        # Crear backup de configuración
        if tar -czf "$config_backup" "${existing_files[@]}" 2>/dev/null; then
            log "Backup de configuración creado: $config_backup"
            
            local size=$(du -h "$config_backup" | cut -f1)
            log "Tamaño del backup de configuración: $size"
            
            echo "$config_backup"
        else
            warn "Error al crear backup de configuración"
        fi
    else
        warn "No se encontraron archivos de configuración para respaldar"
    fi
}

# Backup de logs
backup_logs() {
    log "Iniciando backup de logs..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local logs_backup="$BACKUP_DIR/logs_backup_$timestamp.tar.gz"
    
    local log_dirs=(
        "$APP_DIR/logs"
        "/var/log/nginx"
        "/var/log/postgresql"
    )
    
    local existing_logs=()
    for log_dir in "${log_dirs[@]}"; do
        if [ -d "$log_dir" ] && [ "$(ls -A "$log_dir" 2>/dev/null)" ]; then
            existing_logs+=("$log_dir")
        fi
    done
    
    if [ ${#existing_logs[@]} -gt 0 ]; then
        # Crear backup de logs
        if tar -czf "$logs_backup" "${existing_logs[@]}" 2>/dev/null; then
            log "Backup de logs creado: $logs_backup"
            
            local size=$(du -h "$logs_backup" | cut -f1)
            log "Tamaño del backup de logs: $size"
            
            echo "$logs_backup"
        else
            warn "Error al crear backup de logs"
        fi
    else
        warn "No se encontraron logs para respaldar"
    fi
}

# Subir a S3 (si está configurado)
upload_to_s3() {
    local file_path="$1"
    
    if [ "$S3_ENABLED" != true ] || [ -z "$S3_BUCKET" ]; then
        return 0
    fi
    
    log "Subiendo backup a S3..."
    
    local filename=$(basename "$file_path")
    local s3_path="s3://$S3_BUCKET/walgreens-backups/$(date +%Y/%m)/$filename"
    
    if aws s3 cp "$file_path" "$s3_path"; then
        log "Backup subido a S3: $s3_path"
    else
        warn "Error al subir backup a S3"
    fi
}

# Limpiar backups antiguos
cleanup_old_backups() {
    log "Limpiando backups antiguos (más de $RETENTION_DAYS días)..."
    
    # Contar backups antes
    local before_count=$(find "$BACKUP_DIR" -name "*.gz" -type f | wc -l)
    
    # Eliminar archivos antiguos
    find "$BACKUP_DIR" -name "*.gz" -type f -mtime +$RETENTION_DAYS -delete
    
    # Contar backups después
    local after_count=$(find "$BACKUP_DIR" -name "*.gz" -type f | wc -l)
    local deleted_count=$((before_count - after_count))
    
    if [ $deleted_count -gt 0 ]; then
        log "Eliminados $deleted_count backups antiguos"
    else
        log "No hay backups antiguos para eliminar"
    fi
    
    # Mostrar espacio utilizado
    local space_used=$(du -sh "$BACKUP_DIR" | cut -f1)
    log "Espacio utilizado por backups: $space_used"
}

# Verificar backup
verify_backup() {
    local backup_file="$1"
    
    log "Verificando integridad del backup..."
    
    # Verificar que el archivo existe
    if [ ! -f "$backup_file" ]; then
        error "Archivo de backup no encontrado: $backup_file"
    fi
    
    # Verificar que no está vacío
    if [ ! -s "$backup_file" ]; then
        error "Archivo de backup está vacío: $backup_file"
    fi
    
    # Verificar integridad del comprimido
    if [[ "$backup_file" == *.gz ]]; then
        if ! gzip -t "$backup_file"; then
            error "Archivo de backup corrupto: $backup_file"
        fi
    fi
    
    log "Backup verificado correctamente"
}

# Crear índice de backups
create_backup_index() {
    log "Creando índice de backups..."
    
    local index_file="$BACKUP_DIR/backup_index.txt"
    
    {
        echo "# ÍNDICE DE BACKUPS - Walgreens Offers Explorer"
        echo "# Generado: $(date)"
        echo "# =================================================="
        echo ""
        
        echo "## BACKUPS DISPONIBLES"
        find "$BACKUP_DIR" -name "*.gz" -type f -printf "%TY-%Tm-%Td %TH:%TM  %s bytes  %p\n" | sort -r
        
        echo ""
        echo "## ESTADÍSTICAS"
        echo "Total de backups: $(find "$BACKUP_DIR" -name "*.gz" -type f | wc -l)"
        echo "Espacio total utilizado: $(du -sh "$BACKUP_DIR" | cut -f1)"
        echo "Backup más reciente: $(find "$BACKUP_DIR" -name "*.gz" -type f -printf '%TY-%Tm-%Td %TH:%TM %p\n' | sort -r | head -1)"
        echo "Backup más antiguo: $(find "$BACKUP_DIR" -name "*.gz" -type f -printf '%TY-%Tm-%Td %TH:%TM %p\n' | sort | head -1)"
        
    } > "$index_file"
    
    log "Índice de backups actualizado: $index_file"
}

# Enviar notificación (si está configurado)
send_notification() {
    local status="$1"
    local message="$2"
    
    # Email notification (si sendmail está instalado)
    if command -v sendmail &> /dev/null && [ -n "$NOTIFICATION_EMAIL" ]; then
        {
            echo "To: $NOTIFICATION_EMAIL"
            echo "Subject: Backup Walgreens Offers Explorer - $status"
            echo ""
            echo "Fecha: $(date)"
            echo "Servidor: $(hostname)"
            echo "Estado: $status"
            echo ""
            echo "$message"
        } | sendmail "$NOTIFICATION_EMAIL"
    fi
    
    # Slack notification (si webhook está configurado)
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        local color="good"
        if [ "$status" != "ÉXITO" ]; then
            color="danger"
        fi
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"attachments\":[{\"color\":\"$color\",\"title\":\"Backup Walgreens Offers Explorer\",\"text\":\"$message\",\"fields\":[{\"title\":\"Estado\",\"value\":\"$status\",\"short\":true},{\"title\":\"Servidor\",\"value\":\"$(hostname)\",\"short\":true}]}]}" \
            "$SLACK_WEBHOOK_URL" &>/dev/null || true
    fi
}

# Función principal
main() {
    local start_time=$(date +%s)
    
    log "=== INICIANDO BACKUP DE WALGREENS OFFERS EXPLORER ==="
    
    # Verificar prerequisites
    check_prerequisites
    
    # Variables para tracking
    local db_backup=""
    local config_backup=""
    local logs_backup=""
    local backup_success=true
    local error_messages=""
    
    # Backup de base de datos
    if db_backup=$(backup_database); then
        verify_backup "$db_backup"
        upload_to_s3 "$db_backup"
    else
        backup_success=false
        error_messages+="Error en backup de base de datos. "
    fi
    
    # Backup de configuración
    if config_backup=$(backup_config); then
        upload_to_s3 "$config_backup"
    else
        warn "Error en backup de configuración"
    fi
    
    # Backup de logs
    if logs_backup=$(backup_logs); then
        upload_to_s3 "$logs_backup"
    else
        warn "Error en backup de logs"
    fi
    
    # Limpiar backups antiguos
    cleanup_old_backups
    
    # Crear índice
    create_backup_index
    
    # Calcular tiempo total
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Mostrar resumen
    log "=== RESUMEN DEL BACKUP ==="
    log "Base de datos: ${db_backup:-'Error'}"
    log "Configuración: ${config_backup:-'No disponible'}"
    log "Logs: ${logs_backup:-'No disponible'}"
    log "Duración: ${duration}s"
    
    # Notificación
    if [ "$backup_success" = true ]; then
        log "=== BACKUP COMPLETADO EXITOSAMENTE ==="
        send_notification "ÉXITO" "Backup completado exitosamente en ${duration}s"
    else
        error "=== BACKUP FALLÓ === $error_messages"
        send_notification "ERROR" "Backup falló: $error_messages"
    fi
}

# Mostrar ayuda
show_help() {
    echo "Uso: $0 [opciones]"
    echo ""
    echo "Opciones:"
    echo "  --help, -h          Mostrar esta ayuda"
    echo "  --db-only           Backup solo de base de datos"
    echo "  --config-only       Backup solo de configuración"
    echo "  --logs-only         Backup solo de logs"
    echo "  --no-s3            Deshabilitar upload a S3"
    echo "  --retention DAYS    Días de retención (default: 30)"
    echo ""
    echo "Variables de entorno opcionales:"
    echo "  S3_BUCKET          Bucket de S3 para backups remotos"
    echo "  NOTIFICATION_EMAIL Email para notificaciones"
    echo "  SLACK_WEBHOOK_URL  Webhook de Slack para notificaciones"
    echo ""
    echo "Ejemplos:"
    echo "  $0                 # Backup completo"
    echo "  $0 --db-only       # Solo base de datos"
    echo "  $0 --retention 7   # Retener backups por 7 días"
}

# Procesar argumentos
while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_help
            exit 0
            ;;
        --db-only)
            DB_ONLY=true
            shift
            ;;
        --config-only)
            CONFIG_ONLY=true
            shift
            ;;
        --logs-only)
            LOGS_ONLY=true
            shift
            ;;
        --no-s3)
            S3_ENABLED=false
            shift
            ;;
        --retention)
            RETENTION_DAYS="$2"
            shift 2
            ;;
        *)
            echo "Opción desconocida: $1"
            show_help
            exit 1
            ;;
    esac
done

# Configurar S3 desde variables de entorno
if [ -n "$S3_BUCKET" ]; then
    S3_ENABLED=true
fi

# Ejecutar backup
main "$@"