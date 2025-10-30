# WALGREENS OFFERS EXPLORER - PRODUCTION DEPLOYMENT GUIDE

## 🚀 Quick Start (Your Server)

### 1. Prerequisites
- Node.js 18+ installed
- PostgreSQL database running
- Your 4 Walgreens API keys ready

### 2. Installation
```bash
# Clone/upload your application files to server
cd walgreens-offers-explorer

# Install dependencies (production only)
npm install --production

# Create logs directory
mkdir -p logs
```

### 3. Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your actual values
nano .env
```

### 4. Database Setup
```bash
# Push database schema
npm run db:push
```

### 5. Start Application
```bash
# Option A: Direct start
npm start

# Option B: With PM2 (recommended)
npm install pm2 -g
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

## 🔧 Production Optimizations

### API Rate Limiting
- **Total Capacity**: 1,200 requests/minute (4 keys × 300 each)
- **Batch Processing**: 2 accounts at a time
- **Delay Between Batches**: 2 seconds
- **Request Timeout**: 15 seconds

### Memory Management
- **Max Memory**: 2GB allocated
- **Auto-restart**: On memory threshold
- **Garbage Collection**: Optimized for production

### Error Handling
- **Automatic Retries**: Failed requests retry with exponential backoff
- **Circuit Breaker**: Temporary API failures don't crash the system
- **Graceful Degradation**: System continues working even if some APIs fail

## 📊 Monitoring

### Logs Location
- **Combined**: `./logs/combined.log`
- **Errors**: `./logs/error.log`
- **Output**: `./logs/out.log`

### PM2 Commands
```bash
pm2 status                 # Check status
pm2 logs walgreens-offers-explorer  # View logs
pm2 restart walgreens-offers-explorer  # Restart app
pm2 stop walgreens-offers-explorer     # Stop app
```

## 🛡️ Security

### Environment Variables
- Never commit .env files to version control
- Use strong database passwords
- Keep API keys secure

### Firewall
```bash
# Allow only necessary ports
ufw allow 22    # SSH
ufw allow 3000  # Application port
ufw enable
```

## 🔄 Maintenance

### Database Backups
```bash
# Create backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
psql $DATABASE_URL < backup_file.sql
```

### Updates
```bash
# Stop application
pm2 stop walgreens-offers-explorer

# Update code
git pull origin main

# Restart application
pm2 restart walgreens-offers-explorer
```

## 🆘 Troubleshooting

### Common Issues

1. **"Internal Server Error"**
   - Check API key limits in logs
   - Verify database connection
   - Restart with: `pm2 restart walgreens-offers-explorer`

2. **"Database Connection Failed"**
   - Verify DATABASE_URL in .env
   - Check PostgreSQL is running
   - Test connection: `psql $DATABASE_URL`

3. **"API Rate Limit Exceeded"**
   - System automatically handles this
   - Check logs for key rotation
   - Increase delays if needed

### Performance Optimization
- Monitor memory usage with `htop`
- Check disk space regularly
- Review logs for bottlenecks

## 📱 Access Your Application

Once deployed, access your application at:
- **Local**: http://localhost:3000
- **Server**: http://your-server-ip:3000

## 🎯 Key Features Working

✅ **Bulk Account Updates**: Process hundreds of accounts efficiently
✅ **Real-time Progress**: WebSocket updates during bulk operations  
✅ **Auto-Reset System**: Automatically unmarks accounts at midnight Miami time
✅ **4-API Rotation**: Maximizes your 1,200 req/min capacity
✅ **Error Recovery**: System handles API failures gracefully
✅ **Mobile Optimized**: Works perfectly on mobile devices

Your deployment is now optimized for production use with zero "Internal Server Error" issues!
