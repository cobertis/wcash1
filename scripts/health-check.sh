#!/bin/bash

# =====================================
# SCRIPT DE HEALTH CHECK
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
APP_PORT=5000
DB_NAME="walgreens_offers"
LOG_FILE="/var/log/walgreens-health.log"
TIMEOUT=10

# URLs para verificar
HEALTH_URL="http://localhost:$APP_PORT/health"
STATUS_URL="http://localhost:$APP_PORT/api/production-status"
SIDEBAR_URL="http://localhost:$APP_PORT/api/member-history/sidebar-counters"

# Funciones de utilidad
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

fail() {
    echo -e "${RED}❌ $1${NC}"
}

# Verificar proceso PM2
check_pm2_process() {
    info "Verificando proceso PM2..."
    
    if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
        local status=$(pm2 jlist | jq -r ".[] | select(.name==\"$APP_NAME\") | .pm2_env.status")
        
        if [ "$status" = "online" ]; then
            success "Proceso PM2 está corriendo"
            
            # Obtener información adicional
            local uptime=$(pm2 jlist | jq -r ".[] | select(.name==\"$APP_NAME\") | .pm2_env.pm_uptime")
            local memory=$(pm2 jlist | jq -r ".[] | select(.name==\"$APP_NAME\") | .monit.memory")
            local cpu=$(pm2 jlist | jq -r ".[] | select(.name==\"$APP_NAME\") | .monit.cpu")
            
            info "Uptime: $(date -d @$((uptime/1000)) +%H:%M:%S)"
            info "Memoria: $((memory/1024/1024))MB"
            info "CPU: ${cpu}%"
            
            return 0
        else
            fail "Proceso PM2 no está online (estado: $status)"
            return 1
        fi
    else
        fail "Proceso PM2 no encontrado"
        return 1
    fi
}

# Verificar puerto
check_port() {
    info "Verificando puerto $APP_PORT..."
    
    if netstat -tlnp | grep ":$APP_PORT " > /dev/null; then
        success "Puerto $APP_PORT está escuchando"
        return 0
    else
        fail "Puerto $APP_PORT no está escuchando"
        return 1
    fi
}

# Verificar endpoint de salud
check_health_endpoint() {
    info "Verificando endpoint de salud..."
    
    local response=$(curl -s -w "%{http_code}" -o /tmp/health_response.txt --max-time $TIMEOUT "$HEALTH_URL" 2>/dev/null || echo "000")
    
    if [ "$response" = "200" ]; then
        local content=$(cat /tmp/health_response.txt)
        success "Endpoint de salud responde OK"
        info "Respuesta: $content"
        return 0
    else
        fail "Endpoint de salud falló (código: $response)"
        if [ -f /tmp/health_response.txt ]; then
            info "Respuesta: $(cat /tmp/health_response.txt)"
        fi
        return 1
    fi
}

# Verificar API de estado
check_status_api() {
    info "Verificando API de estado..."
    
    local response=$(curl -s -w "%{http_code}" -o /tmp/status_response.txt --max-time $TIMEOUT "$STATUS_URL" 2>/dev/null || echo "000")
    
    if [ "$response" = "200" ]; then
        success "API de estado responde OK"
        
        # Parsear información del estado
        if command -v jq &> /dev/null; then
            local environment=$(jq -r '.environment // "unknown"' /tmp/status_response.txt)
            local uptime=$(jq -r '.uptime // "unknown"' /tmp/status_response.txt)
            local database=$(jq -r '.database // false' /tmp/status_response.txt)
            
            info "Entorno: $environment"
            info "Uptime: ${uptime}s"
            info "Base de datos: $database"
        fi
        return 0
    else
        fail "API de estado falló (código: $response)"
        return 1
    fi
}

# Verificar conexión a base de datos
check_database() {
    info "Verificando conexión a base de datos..."
    
    # Verificar que PostgreSQL está corriendo
    if systemctl is-active --quiet postgresql; then
        success "Servicio PostgreSQL está activo"
    else
        fail "Servicio PostgreSQL no está activo"
        return 1
    fi
    
    # Verificar conexión a la base de datos
    if sudo -u postgres psql -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
        success "Conexión a base de datos exitosa"
        
        # Verificar número de tablas
        local table_count=$(sudo -u postgres psql -d "$DB_NAME" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
        info "Tablas en la base de datos: $table_count"
        
        return 0
    else
        fail "Error de conexión a base de datos"
        return 1
    fi
}

# Verificar API de sidebar
check_sidebar_api() {
    info "Verificando API de sidebar..."
    
    local response=$(curl -s -w "%{http_code}" -o /tmp/sidebar_response.txt --max-time $TIMEOUT "$SIDEBAR_URL" 2>/dev/null || echo "000")
    
    if [ "$response" = "200" ]; then
        success "API de sidebar responde OK"
        
        # Mostrar contadores si jq está disponible
        if command -v jq &> /dev/null; then
            local total=$(jq -r '.total // 0' /tmp/sidebar_response.txt)
            local accounts100=$(jq -r '.accounts100Plus // 0' /tmp/sidebar_response.txt)
            local newAccounts=$(jq -r '.newAccounts // 0' /tmp/sidebar_response.txt)
            
            info "Total de cuentas: $total"
            info "Cuentas $100+: $accounts100"
            info "Cuentas nuevas: $newAccounts"
        fi
        return 0
    else
        fail "API de sidebar falló (código: $response)"
        return 1
    fi
}

# Verificar uso de recursos
check_resources() {
    info "Verificando uso de recursos..."
    
    # Memoria
    local memory_info=$(free | grep Mem)
    local total_mem=$(echo $memory_info | awk '{print $2}')
    local used_mem=$(echo $memory_info | awk '{print $3}')
    local mem_percent=$((used_mem * 100 / total_mem))
    
    info "Uso de memoria: ${mem_percent}%"
    
    if [ $mem_percent -lt 80 ]; then
        success "Uso de memoria normal"
    elif [ $mem_percent -lt 90 ]; then
        warn "Uso de memoria alto: ${mem_percent}%"
    else
        fail "Uso de memoria crítico: ${mem_percent}%"
    fi
    
    # Disco
    local disk_usage=$(df -h / | awk 'NR==2{print $5}' | sed 's/%//')
    info "Uso de disco: ${disk_usage}%"
    
    if [ $disk_usage -lt 80 ]; then
        success "Uso de disco normal"
    elif [ $disk_usage -lt 90 ]; then
        warn "Uso de disco alto: ${disk_usage}%"
    else
        fail "Uso de disco crítico: ${disk_usage}%"
    fi
    
    # CPU Load Average
    local load_avg=$(uptime | awk -F'load average:' '{ print $2 }' | cut -d, -f1 | tr -d ' ')
    local cpu_cores=$(nproc)
    local load_percent=$(echo "$load_avg * 100 / $cpu_cores" | bc -l | cut -d. -f1)
    
    info "Load average: $load_avg (${load_percent}%)"
    
    if [ $load_percent -lt 70 ]; then
        success "Load average normal"
    elif [ $load_percent -lt 90 ]; then
        warn "Load average alto: ${load_percent}%"
    else
        fail "Load average crítico: ${load_percent}%"
    fi
}

# Verificar logs por errores
check_logs() {
    info "Verificando logs por errores..."
    
    local log_dir="/opt/walgreens-offers-explorer/logs"
    local error_count=0
    
    if [ -d "$log_dir" ]; then
        # Contar errores en los últimos 10 minutos
        error_count=$(find "$log_dir" -name "*.log" -mmin -10 -exec grep -i "error" {} \; 2>/dev/null | wc -l)
        
        info "Errores en logs (últimos 10 min): $error_count"
        
        if [ $error_count -eq 0 ]; then
            success "No hay errores recientes en logs"
        elif [ $error_count -lt 5 ]; then
            warn "Algunos errores en logs: $error_count"
        else
            fail "Muchos errores en logs: $error_count"
        fi
        
        # Mostrar últimos errores si existen
        if [ $error_count -gt 0 ]; then
            info "Últimos errores:"
            find "$log_dir" -name "*.log" -mmin -10 -exec grep -i "error" {} \; 2>/dev/null | tail -3
        fi
    else
        warn "Directorio de logs no encontrado: $log_dir"
    fi
}

# Verificar WebSocket
check_websocket() {
    info "Verificando WebSocket..."
    
    # Verificar si el puerto WebSocket está escuchando
    if netstat -tlnp | grep ":8080 " > /dev/null; then
        success "Puerto WebSocket (8080) está escuchando"
        return 0
    else
        warn "Puerto WebSocket (8080) no está escuchando"
        return 1
    fi
}

# Función para ejecutar test específico
run_specific_test() {
    local test_name="$1"
    
    case "$test_name" in
        "pm2")
            check_pm2_process
            ;;
        "port")
            check_port
            ;;
        "health")
            check_health_endpoint
            ;;
        "status")
            check_status_api
            ;;
        "database")
            check_database
            ;;
        "sidebar")
            check_sidebar_api
            ;;
        "resources")
            check_resources
            ;;
        "logs")
            check_logs
            ;;
        "websocket")
            check_websocket
            ;;
        *)
            error "Test desconocido: $test_name"
            return 1
            ;;
    esac
}

# Función principal de health check
main() {
    local start_time=$(date +%s)
    local failed_checks=0
    local total_checks=0
    
    log "=== INICIANDO HEALTH CHECK DE WALGREENS OFFERS EXPLORER ==="
    
    # Lista de verificaciones a realizar
    local checks=(
        "pm2:check_pm2_process"
        "port:check_port"
        "health:check_health_endpoint"
        "status:check_status_api"
        "database:check_database"
        "sidebar:check_sidebar_api"
        "resources:check_resources"
        "logs:check_logs"
        "websocket:check_websocket"
    )
    
    # Ejecutar verificaciones
    for check in "${checks[@]}"; do
        local check_name=$(echo "$check" | cut -d: -f1)
        local check_function=$(echo "$check" | cut -d: -f2)
        
        echo ""
        echo "=== $check_name ==="
        
        ((total_checks++))
        
        if $check_function; then
            success "✅ $check_name: OK"
        else
            fail "❌ $check_name: FALLÓ"
            ((failed_checks++))
        fi
    done
    
    # Resumen final
    echo ""
    log "=== RESUMEN DEL HEALTH CHECK ==="
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log "Verificaciones totales: $total_checks"
    log "Verificaciones exitosas: $((total_checks - failed_checks))"
    log "Verificaciones fallidas: $failed_checks"
    log "Duración: ${duration}s"
    
    # Estado general
    if [ $failed_checks -eq 0 ]; then
        success "🎉 SISTEMA SALUDABLE - Todas las verificaciones pasaron"
        exit 0
    elif [ $failed_checks -le 2 ]; then
        warn "⚠️ SISTEMA CON ADVERTENCIAS - $failed_checks verificaciones fallaron"
        exit 1
    else
        error "🚨 SISTEMA CON PROBLEMAS - $failed_checks verificaciones fallaron"
        exit 2
    fi
}

# Mostrar ayuda
show_help() {
    echo "Uso: $0 [opciones]"
    echo ""
    echo "Opciones:"
    echo "  --help, -h          Mostrar esta ayuda"
    echo "  --test NAME         Ejecutar solo un test específico"
    echo "  --timeout SECONDS   Timeout para requests HTTP (default: 10)"
    echo "  --quiet             Mostrar solo errores"
    echo "  --json              Output en formato JSON"
    echo ""
    echo "Tests disponibles:"
    echo "  pm2        Verificar proceso PM2"
    echo "  port       Verificar puerto"
    echo "  health     Verificar endpoint de salud"
    echo "  status     Verificar API de estado"
    echo "  database   Verificar base de datos"
    echo "  sidebar    Verificar API de sidebar"
    echo "  resources  Verificar uso de recursos"
    echo "  logs       Verificar logs por errores"
    echo "  websocket  Verificar WebSocket"
    echo ""
    echo "Ejemplos:"
    echo "  $0                    # Health check completo"
    echo "  $0 --test database    # Solo verificar base de datos"
    echo "  $0 --quiet            # Solo mostrar errores"
}

# Variables por defecto
QUIET=false
JSON_OUTPUT=false
SPECIFIC_TEST=""

# Procesar argumentos
while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_help
            exit 0
            ;;
        --test)
            SPECIFIC_TEST="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --quiet)
            QUIET=true
            shift
            ;;
        --json)
            JSON_OUTPUT=true
            shift
            ;;
        *)
            echo "Opción desconocida: $1"
            show_help
            exit 1
            ;;
    esac
done

# Redirigir output si está en modo quiet
if [ "$QUIET" = true ]; then
    exec > /dev/null
fi

# Ejecutar test específico o health check completo
if [ -n "$SPECIFIC_TEST" ]; then
    run_specific_test "$SPECIFIC_TEST"
else
    main
fi