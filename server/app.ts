// PRODUCTION ENTRY POINT - NO VITE DEPENDENCIES
import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import cors from "cors";
import { registerRoutes } from "./routes";
import { seedData } from "./seed-data";

// Simple production logger
function log(message: string, source = "api") {
  const t = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit", 
    second: "2-digit",
    hour12: true,
  });
  console.log(`${t} [${source}] ${message}`);
}

const app = express();

// Trust proxy for Render
app.set("trust proxy", 1);

// Core middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// CORS - Allow your Netlify domains
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || process.env.NODE_ENV !== "production") return cb(null, true);
    if (allowedOrigins.length === 0) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

// Simple request logger
app.use((req, res, next) => {
  const start = Date.now();
  let captured: unknown;
  const orig = res.json.bind(res);
  (res as Response).json = ((body: unknown) => {
    captured = body;
    return orig(body);
  }) as Response["json"];

  res.on("finish", () => {
    if (req.path.startsWith("/api")) {
      let line = `${req.method} ${req.path} ${res.statusCode} in ${Date.now() - start}ms`;
      if (captured !== undefined) {
        const s = JSON.stringify(captured);
        line += ` :: ${s.length > 120 ? s.slice(0, 119) + "…" : s}`;
      }
      log(line);
    }
  });
  next();
});

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.status(200).json({ 
    status: "ok", 
    service: "Bahr El Ghazal Clinic API", 
    timestamp: new Date().toISOString() 
  });
});

// Start the server
(async () => {
  try {
    // Seed database with initial data
    await seedData();
    log("Database seeded successfully");
    
    // Register all API routes
    await registerRoutes(app);
    
    // Error handler middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err?.status || err?.statusCode || 500;
      const message = err?.message || "Internal Server Error";
      console.error("[api-error]", status, message);
      res.status(status).json({ message });
    });

    // Catch-all for API endpoints
    app.get("*", (_req, res) => {
      res.status(404).json({ error: "API endpoint not found" });
    });

    // Start HTTP server
    const port = parseInt(process.env.PORT || "5000", 10);
    const server = createServer(app);
    
    server.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
      log(`🚀 Bahr El Ghazal Clinic API running on port ${port}`);
    });

  } catch (error) {
    console.error("[startup-error]", error);
    process.exit(1);
  }
})();
