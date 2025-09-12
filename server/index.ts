import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { seedData } from "./seed-data";
import { registerInsuranceMonthly } from "./insurance-monthly"; // ✅ NEW

// Simple logger for production
function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configure cookie parser with proper settings
app.use(cookieParser());

// Trust proxy for correct cookie handling in development
app.set("trust proxy", 1);

// Never cache API responses that change frequently
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

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
      if (logLine.length > 80) logLine = logLine.slice(0, 79) + "…";
      log(logLine);
    }
  });

  next();
});

(async () => {
  // Seed database with initial data
  await seedData();

  // Core routes
  await registerRoutes(app);

  // ✅ Register the monthly insurance aggregation API
  registerInsuranceMonthly(app);

  const server = createServer(app);

  // Error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  // Dev: Vite; Prod: API-only
  if (app.get("env") === "development") {
    try {
      const { setupVite } = await import("./vite");
      await setupVite(app, server);
    } catch {
      log("Vite not available, running API-only mode");
    }
  } else {
    // In production, just serve API routes (no static files needed)
    app.get("*", (_req, res) => {
      res.status(404).json({ error: "API endpoint not found" });
    });
  }

  // Start server on port from environment
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    }
  );
})();
