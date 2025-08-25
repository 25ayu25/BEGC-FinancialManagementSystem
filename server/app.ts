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

// CORS configuration for cross-site authentication
const allowList = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

function isAllowed(origin?: string) {
  if (!origin) return true; // same-origin/curl
  if (allowList.includes(origin)) return true;
  if (origin.endsWith(".netlify.app")) return true; // allow deploy previews too
  if (origin.endsWith(".bahrelghazalclinic.com")) return true; // allow custom domain
  return false;
}

app.use(cors({
  origin: (origin, cb) => cb(isAllowed(origin) ? null : new Error("Not allowed by CORS"), isAllowed(origin)),
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-session-token"],
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

// Error handler middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err?.status || err?.statusCode || 500;
  const message = err?.message || "Internal Server Error";
  console.error("[api-error]", status, message);
  res.status(status).json({ message });
});

// Register routes
(async () => {
  try {
    const server = await registerRoutes(app);
    
    // Catch-all for API endpoints - MUST be after all routes  
    app.get("*", (_req, res) => {
      res.status(404).json({ error: "API endpoint not found" });
    });
  } catch (error) {
    console.error("[route-setup-error]", error);
  }
})();

// Start server - this keeps process alive automatically
const port = parseInt(process.env.PORT || "5000", 10);
app.listen(port, "0.0.0.0", () => {
  log(`🚀 Bahr El Ghazal Clinic API running on port ${port}`);
  
  // Optional seeding - fire and forget, no await, no exit
  if (process.env.SEED_ON_START !== "false") {
    seedData()
      .then(() => log("Database seeded successfully"))
      .catch((e) => console.error("Seeding error:", e));
  }
});

// Clean shutdown handlers  
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
