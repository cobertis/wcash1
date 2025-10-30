#!/bin/bash

echo "================================================================"
echo "SOLUCIÓN FINAL - Ruta Corregida"
echo "================================================================"
echo ""
echo "El archivo ecosystem.config.cjs ya está arreglado aquí."
echo "Necesitas descargarlo a tu servidor."
echo ""
echo "================================================================"
echo "OPCIÓN 1: Editar manualmente en tu servidor"
echo "================================================================"
echo ""
echo "nano /root/wcash/ecosystem.config.cjs"
echo ""
echo "Busca la línea 9:"
echo "  script: './dist/server/index.js',"
echo ""
echo "Cámbiala a:"
echo "  script: './dist/index.js',"
echo ""
echo "Guardar: Ctrl+O, Enter, Ctrl+X"
echo ""
echo "================================================================"
echo "OPCIÓN 2: Reemplazar el archivo completo"
echo "================================================================"
echo ""

cat << 'CONFIG' > /tmp/ecosystem.config.cjs.fixed
// PM2 ecosystem configuration
// Documentación: https://pm2.keymetrics.io/docs/usage/application-declaration/

module.exports = {
  apps: [{
    name: 'walgreens-scanner',
    script: './dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000
  }]
};
CONFIG

echo "Archivo corregido creado en: /tmp/ecosystem.config.cjs.fixed"
echo ""
echo "================================================================"
echo "DESPUÉS DE ARREGLAR, EJECUTA:"
echo "================================================================"

cat << 'COMMANDS'

cd /root/wcash

# Copiar archivo corregido (si usaste opción 2)
cp /tmp/ecosystem.config.cjs.fixed ecosystem.config.cjs

# Detener PM2 anterior
pm2 delete walgreens-scanner

# Reiniciar con archivo corregido
./start-pm2.sh

# Verificar
curl http://localhost:5000/health

# Ver logs
pm2 logs walgreens-scanner

COMMANDS

echo ""
echo "================================================================"
