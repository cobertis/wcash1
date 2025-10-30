#!/usr/bin/env node

/**
 * PRODUCTION START SCRIPT - OPTIMIZED FOR STABILITY
 * Prevents Internal Server Error issues in production deployment
 */

const cluster = require('cluster');
const os = require('os');

// Production environment configuration
process.env.NODE_ENV = 'production';
process.env.LOG_LEVEL = 'warn';

// Memory and performance optimizations
process.env.NODE_OPTIONS = '--max-old-space-size=2048 --optimize-for-size';

if (cluster.isMaster) {
  console.log('🚀 PRODUCTION: Starting Walgreens Offers Explorer in production mode');
  console.log(`📊 Master process ${process.pid} starting`);
  
  // Use single worker for stability (avoids port conflicts)
  const worker = cluster.fork();
  
  worker.on('exit', (code, signal) => {
    console.log(`⚠️ Worker process died with code ${code} and signal ${signal}`);
    console.log('🔄 Restarting worker...');
    cluster.fork();
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('📴 SIGTERM received, shutting down gracefully');
    worker.kill('SIGTERM');
    setTimeout(() => process.exit(0), 5000);
  });
  
} else {
  // Worker process - run the actual application
  require('./server/index.js');
}
