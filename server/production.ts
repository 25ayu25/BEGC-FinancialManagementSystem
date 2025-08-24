// Production server entry point for Render deployment
import { createApp } from './app';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer() {
  try {
    const app = await createApp();

    // Health check endpoint for Render
    app.get('/api/health', (_req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Add CORS for Netlify frontend
    app.use((req, res, next) => {
      const allowedOrigins = [
        'https://bahrelghazalclinic.com',
        'https://www.bahrelghazalclinic.com',
        'https://app.bahrelghazalclinic.com'
      ];
      
      const origin = req.headers.origin;
      if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
      
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');

      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }
      
      next();
    });

    app.listen(PORT, () => {
      console.log(`🚀 Bahr El Ghazal Clinic API running on port ${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();