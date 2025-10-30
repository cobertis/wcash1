#!/usr/bin/env node

// Deployment optimization script
// This script optimizes the build for faster deployment

const fs = require('fs');
const path = require('path');

console.log('🚀 Starting deployment optimization...');

// 1. Create optimized build script
const buildScript = `
#!/bin/bash
echo "🏗️ Building optimized production bundle..."

# Build frontend
echo "📦 Building frontend..."
npm run build:frontend || exit 1

# Build backend
echo "🖥️ Building backend..."
npm run build:backend || exit 1

echo "✅ Build complete!"
`;

fs.writeFileSync('build-optimized.sh', buildScript);
fs.chmodSync('build-optimized.sh', '755');

// 2. Create production start script
const startScript = `
#!/bin/bash
echo "🚀 Starting production server..."

# Set production environment
export NODE_ENV=production

# Start server
node dist/index.js
`;

fs.writeFileSync('start-production.sh', startScript);
fs.chmodSync('start-production.sh', '755');

console.log('✅ Deployment optimization complete!');
console.log('📋 Next steps:');
console.log('1. Cancel current deployment');
console.log('2. Try new deployment with optimized scripts');
console.log('3. Deployment should be faster now');