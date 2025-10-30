// PM2 ecosystem configuration
// Documentación: https://pm2.keymetrics.io/docs/usage/application-declaration/

module.exports = {
  apps: [{
    name: 'walgreens-scanner',
    script: './dist/index.js',
    instances: 1, // Single instance (requerido para WebSocket state)
    exec_mode: 'fork',
    
    // Auto-restart
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    
    // Logging
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Environment
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
      DATABASE_URL: 'postgresql://walgreens_user:TuNuevaPass1234@178.156.199.96:5432/walgreens_offers'
    },
    
    // Timing
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000
  }]
};
