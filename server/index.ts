import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { seedData } from "./seed-data";
import { storage } from "./storage";

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

// trust proxy (Render/Netlify/Vercel/Northflank)
app.set("trust proxy", 1);

// Allowed web origins for CORS (comma-separated). Example:
// WEB_ORIGINS="https://finance.bahrelghazalclinic.com,https://your-preview-site.netlify.app"
// Also supports ALLOWED_ORIGINS for backward compatibility
const RAW_ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.WEB_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ORIGIN_SET = new Set(RAW_ORIGINS);
const isProd = app.get("env") === "production";

/* --------------------------------- CORS --------------------------------- */
/**
 * Configure CORS to allow credentials (cookies) and the fallback X-Session-Token header.
 * In production, allow:
 *  - any exact origins listed in WEB_ORIGINS / ALLOWED_ORIGINS
 *  - *.bahrelghazalclinic.com (custom domain + subdomains)
 *  - *.netlify.app (deploy previews)
 *  - begc-financial-management-system*.vercel.app (Vercel prod + previews for this project)
 *
 * In development, allow any origin for local testing.
 */
function isAllowedOrigin(origin?: string) {
  // Allow requests with no origin (curl, server-to-server, mobile apps)
  if (!origin) return true;

  // In development, allow any origin
  if (!isProd) return true;

  // Exact allowlist via env vars
  if (ORIGIN_SET.size > 0 && ORIGIN_SET.has(origin)) return true;

  // Pattern-based allow (safe-ish)
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "https:" && protocol !== "http:") return false;

    // Allow your custom domain + subdomains
    if (hostname === "bahrelghazalclinic.com" || hostname.endsWith(".bahrelghazalclinic.com")) {
      return true;
    }

    // Allow Netlify deploy previews
    if (hostname.endsWith(".netlify.app")) return true;

    // Allow ONLY this Vercel project (prod + preview URLs)
    // Examples:
    // - begc-financial-management-system.vercel.app
    // - begc-financial-management-system-abc123.vercel.app
    // - begc-financial-management-system-git-branch-xyz.vercel.app
    if (/^begc-financial-management-system([-.].+)?\.vercel\.app$/i.test(hostname)) {
      return true;
    }
  } catch {
    // invalid origin string
    return false;
  }

  return false;
}

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowed = isAllowedOrigin(origin);

    if (allowed) return callback(null, true);

    const err: any = new Error("Not allowed by CORS");
    err.status = 403;
    return callback(err, false);
  },
  credentials: true,
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Session-Token",
    "x-session-token",
  ],
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS", "PUT"],
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

// Make sure preflight is handled
app.options("*", cors(corsOptions));

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
app.use(async (req, _res, next) => {
  try {
    let userSession: any = null;

    const sessionCookie = (req as any).cookies?.user_session;
    if (sessionCookie) {
      try {
        userSession = JSON.parse(sessionCookie);
      } catch {
        // ignore
      }
    }

    if (!userSession) {
      const header = req.headers["x-session-token"];
      if (header) {
        try {
          userSession = JSON.parse(header as string);
        } catch {
          // ignore
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
    // don't block
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
          // ignore
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

  // Error handler (after routes)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // include both keys so frontend can read .error reliably
    res.status(status).json({ error: message, message });

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
