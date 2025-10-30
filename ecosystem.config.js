module.exports = {
  apps: [
    {
      // ========================================
      // APLICACIÓN PRINCIPAL - WALGREENS OFFERS EXPLORER
      // ========================================
      name: 'walgreens-offers-explorer',
      script: 'dist/index.js', // Usar build compilado para mejor performance
      
      // ========================================
      // CONFIGURACIÓN DE INSTANCIAS
      // ========================================
      instances: 'max', // Usar todos los CPU cores disponibles
      exec_mode: 'cluster', // Modo cluster para mejor rendimiento
      
      // ========================================
      // CONFIGURACIÓN DE MEMORIA Y RECURSOS
      // ========================================
      max_memory_restart: '2G', // Reiniciar si excede 2GB
      node_args: '--max-old-space-size=2048 --optimize-for-size',
      
      // ========================================
      // CONFIGURACIÓN DE RESTART Y ESTABILIDAD
      // ========================================
      autorestart: true,
      watch: false, // No watch en producción
      restart_delay: 1000, // 1 segundo entre reintentos
      max_restarts: 15, // Máximo 15 reintentos por hora
      min_uptime: '5s', // Mínimo 5 segundos para considerar estable
      kill_timeout: 5000, // 5 segundos para kill graceful
      
      // ========================================
      // VARIABLES DE ENTORNO - PRODUCCIÓN
      // ========================================
      env: {
        NODE_ENV: 'production',
        PORT: 5000, // Puerto estándar de la aplicación
        LOG_LEVEL: 'warn'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
        LOG_LEVEL: 'warn'
      },
      
      // ========================================
      // CONFIGURACIÓN DE LOGS
      // ========================================
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      log_type: 'json', // Logs estructurados
      
      // ========================================
      // HEALTH MONITORING
      // ========================================
      health_check_url: 'http://localhost:5000/health',
      health_check_grace_period: 3000,
      
      // ========================================
      // CONFIGURACIÓN AVANZADA
      // ========================================
      listen_timeout: 3000,
      kill_retry_time: 100,
      pmx: true, // Habilitar métricas de PM2
      
      // ========================================
      // CONFIGURACIÓN DE DESARROLLO (comentado)
      // ========================================
      // env_development: {
      //   NODE_ENV: 'development',
      //   PORT: 5000,
      //   LOG_LEVEL: 'debug'
      // }
    }
  ],
  
  // ========================================
  // CONFIGURACIÓN GLOBAL DE PM2
  // ========================================
  deploy: {
    production: {
      user: 'deploy',
      host: ['your-server.com'],
      ref: 'origin/main',
      repo: 'git@github.com:tu-usuario/walgreens-offers-explorer.git',
      path: '/var/www/walgreens-offers-explorer',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'git clone git@github.com:tu-usuario/walgreens-offers-explorer.git .',
      env: {
        NODE_ENV: 'production'
      }
    }
  }
};