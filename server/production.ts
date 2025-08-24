// Production server entry point for Render deployment
import express from 'express';
import cookieParser from 'cookie-parser';
import { registerRoutes } from './routes';
import { seedData } from './seed-data';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer() {
  try {
    const app = express();
    
    // CRITICAL: Trust proxy for HTTPS/cookies
    app.set('trust proxy', 1);
    
    // Parse JSON and cookies
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(cookieParser());

    // CORS middleware (BEFORE routes)
    app.use((req, res, next) => {
      const allowedOrigins = [
        'https://bahrelghazalclinic.com',
        'https://www.bahrelghazalclinic.com', 
        'https://app.bahrelghazalclinic.com',
        // Include Netlify default URLs for initial deployment
        /https:\/\/.*\.netlify\.app$/
      ];
      
      const origin = req.headers.origin;
      const isAllowed = allowedOrigins.some(allowed => {
        return typeof allowed === 'string' ? allowed === origin : allowed.test(origin || '');
      });
      
      if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin!);
      }
      
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie, x-session-token');

      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }
      
      next();
    });

    // Health check endpoint (BEFORE auth routes)
    app.get('/api/health', (_req, res) => {
      res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'Bahr El Ghazal Clinic API'
      });
    });

    // Seed database (NOT in production)
    if (process.env.NODE_ENV !== 'production') {
      await seedData();
    }

    // Register all routes
    await registerRoutes(app);

    // Error handling
    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      console.error('Error:', err);
      res.status(status).json({ message });
    });

    app.listen(PORT, () => {
      console.log(`🚀 Bahr El Ghazal Clinic API running on port ${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔒 CORS enabled for custom domains`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();