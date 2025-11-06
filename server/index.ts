import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { seedData } from "./seed-data";
import { storage } from "./storage";
import { claimReconciliationRouter } from "./src/routes/claimReconciliation";

/* ------------------------------- logging ------------------------------- */

function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

/* -------------------------------- setup -------------------------------- */

const app = express();

// trust proxy (Render/Netlify)
app.set("trust proxy", 1);

// Allowed web origins for CORS (comma-separated). Example:
// WEB_ORIGINS="https://finance.bahrelghazalclinic.com,https://your-preview-site.netlify.app"
// Also supports ALLOWED_ORIGINS for backward compatibility
const RAW_ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.WEB_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);
const isProd = app.get("env") === "production";

/* --------------------------------- CORS --------------------------------- */
/**
 * Configure CORS to allow credentials (cookies) and the fallback X-Session-Token header.
 * In production, only allow origins listed in ALLOWED_ORIGINS or WEB_ORIGINS environment variable.
 * In development, allow any origin for local testing.
 */
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) {
      return callback(null, true);
    }
    
    if (!isProd) {
      // In development, allow any origin
      return callback(null, true);
    }
    
    // In production, check against allowed origins
    if (RAW_ORIGINS.length > 0 && RAW_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    
    // Reject other origins in production
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "X-Session-Token", "Authorization"],
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS", "PUT"],
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

/* ---------- Prevent caching for API responses that change often ---------- */
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

/* --------------- Incognito-friendly session header bridge --------------- */
/**
 * Legacy middleware: If a client sends X-Session-Token header,
 * make it available as req.cookies.session for backward compatibility.
 * Note: The global auth middleware below handles both user_session cookie 
 * and x-session-token header directly, so this bridge is primarily for 
 * any legacy code that still reads req.cookies.session.
 */
app.use((req, _res, next) => {
  const headerToken =
    (req.headers["x-session-token"] as string | undefined) ||
    req.get("x-session-token") ||
    undefined;

  if (headerToken && (!req.cookies || !req.cookies.session)) {
    (req as any).cookies = { ...(req as any).cookies, session: String(headerToken) };
  }
  next();
});

/* -------------------- Global authentication middleware -------------------- */
/**
 * Attempt to populate req.user from session cookie or X-Session-Token header.
 * This middleware runs for all requests but doesn't fail if there's no session.
 * Individual routes can use requireAuth to enforce authentication.
 * 
 * Note: This logic is similar to the requireAuth middleware in routes.ts.
 * The duplication is intentional - this middleware is non-blocking (doesn't fail
 * requests without auth), while requireAuth in routes.ts blocks unauthorized requests.
 */
app.use(async (req, _res, next) => {
  try {
    let userSession: any = null;

    const sessionCookie = (req as any).cookies?.user_session;
    if (sessionCookie) {
      try { 
        userSession = JSON.parse(sessionCookie); 
      } catch (e) {
        // Ignore invalid JSON in session cookie
      }
    }

    if (!userSession) {
      const header = req.headers["x-session-token"];
      if (header) {
        try { 
          userSession = JSON.parse(header as string); 
        } catch (e) {
          // Ignore invalid JSON in X-Session-Token header
        }
      }
    }

    if (userSession) {
      const user = await storage.getUser(userSession.id);
      if (user && user.status !== "inactive") {
        (req as any).user = {
          id: user.id,
          username: user.username,
          role: user.role,
          location: user.location,
          fullName: user.fullName,
        };
      }
    }
  } catch (err) {
    console.error("Error populating req.user:", err);
    // Don't fail the request, just continue without user
  }
  
  next();
});

/* ----------------------------- API logger ----------------------------- */
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;

  const originalResJson = res.json.bind(res);
  (res as any).json = (bodyJson: any, ...args: any[]) => {
    capturedJsonResponse = bodyJson;
    return originalResJson(bodyJson, ...args);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        try {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        } catch {
          // ignore stringify failures
        }
      }
      if (logLine.length > 120) logLine = logLine.slice(0, 119) + "…";
      log(logLine);
    }
  });

  next();
});

/* ------------------------------ bootstrap ------------------------------ */

(async () => {
  await seedData();
  await registerRoutes(app);

  // Claim Reconciliation routes
  log("Registering claim reconciliation router at /api/claim-reconciliation");
  app.use("/api/claim-reconciliation", claimReconciliationRouter);
  log("Claim reconciliation router registered successfully");

  // Error handler (after routes)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    // still log the stack to server logs
    if (err?.stack) console.error(err.stack);
  });

  if (!isProd) {
    // Dev: attach Vite if available for the client app
    try {
      const { setupVite } = await import("./vite");
      await setupVite(app, createServer());
    } catch {
      log("Vite not available, running API-only mode");
    }
  } else {
    // Prod: API only
    app.get("*", (_req, res) => {
      res.status(404).json({ error: "API endpoint not found" });
    });
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  const server = createServer(app);
  server.listen(
    { port, host: "0.0.0.0", reusePort: true },
    () => log(`serving on port ${port}`)
  );
})();
