import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { seedData } from "./seed-data";

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
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// trust proxy (Render/Netlify)
app.set("trust proxy", 1);

// Allowed web origins for CORS (comma-separated). Example:
// WEB_ORIGINS="https://finance.bahrelghazalclinic.com,https://your-preview-site.netlify.app"
const RAW_ORIGINS = (process.env.WEB_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
const isProd = app.get("env") === "production";

/* --------------------------------- CORS --------------------------------- */
/**
 * We allow credentials so cookies can flow when they work,
 * and we also allow the fallback X-Session-Token header.
 */
app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined;

  // Decide if we should reflect the origin
  let allowThisOrigin = false;
  if (!origin) {
    allowThisOrigin = false;
  } else if (!isProd) {
    // in dev we reflect any origin to simplify local development
    allowThisOrigin = true;
  } else if (RAW_ORIGINS.length > 0) {
    allowThisOrigin = RAW_ORIGINS.includes(origin);
  } else {
    // in prod with no explicit list, only allow same-origin (no CORS)
    allowThisOrigin = false;
  }

  if (allowThisOrigin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, X-Session-Token"
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, DELETE, OPTIONS"
    );
  }

  if (req.method === "OPTIONS") {
    // Preflight
    return res.sendStatus(204);
  }

  next();
});

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
 * If a client sends X-Session-Token (used by Safari/Incognito fallback),
 * make it available as if it were the "session" cookie so downstream
 * auth code that reads req.cookies.session continues to work unchanged.
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
  const { claimReconciliationRouter } = await import("./src/routes/claimReconciliation");
  app.use("/api/claim-reconciliation", claimReconciliationRouter);

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
