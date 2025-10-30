import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

import { storage } from "./storage";
import { initializeAdminUser } from "./init-admin";

const app = express();

// Enhanced error handling for production deployment
process.on('uncaughtException', (error) => {
  console.error('❌ FATAL - Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ FATAL - Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// CRITICAL: Health checks MUST respond immediately for deployment
app.get('/health', (req, res) => {
  console.log('🔍 Health check requested');
  res.status(200).send('OK');
});
app.get('/healthz', (req, res) => {
  console.log('🔍 Healthz check requested');
  res.status(200).send('OK');
});
app.get('/ready', (req, res) => {
  console.log('🔍 Ready check requested');
  res.status(200).send('OK');
});
app.get('/ping', (req, res) => {
  console.log('🔍 Ping check requested');
  res.status(200).send('PONG');
});

// PRODUCTION DIAGNOSTIC ENDPOINT
app.get('/api/production-status', (req, res) => {
  console.log('🔍 Production status check requested');
  try {
    res.json({
      status: 'OK',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      port: process.env.PORT,
      database: !!process.env.DATABASE_URL,
      uptime: process.uptime(),
      version: '1.0.0'
    });
  } catch (error) {
    console.error('❌ Production status error:', error);
    res.status(500).json({ error: 'Status check failed' });
  }
});
app.get('/', (req, res, next) => {
  // For deployment health checks, respond immediately
  if (req.headers['user-agent']?.includes('Replit') || req.headers['x-replit-deployment']) {
    return res.status(200).send('OK');
  }
  // Otherwise continue to normal app handling
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    console.error('❌ ERROR HANDLER TRIGGERED:', {
      url: req.url,
      method: req.method,
      status,
      message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });

    res.status(status).json({ 
      message,
      error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.stack
    });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port}`);
    
    // Initialize admin user (create if doesn't exist)
    await initializeAdminUser();
    
    // Only log database info in development
    if (process.env.NODE_ENV === 'development') {
      console.log('🗄️ Database ready - accounts available');
    }
    
    // Initialize auto-reset system only in production (skip during deployment)
    const isDeployment = process.env.REPLIT_DEPLOYMENT === 'true';
    if (!isDeployment) {
      try {
        const { autoResetManager } = await import('./background-jobs');
        console.log('🔄 Auto-reset system initialized for Miami midnight reset');
      } catch (error) {
        console.error('❌ Failed to initialize auto-reset system:', error);
      }
    } else {
      console.log('🚀 Deployment mode: Skipping background jobs for faster startup');
    }
    
  });

  // Health check endpoint for deployment (move outside listener)
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Graceful shutdown handling for deployment
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
})();
