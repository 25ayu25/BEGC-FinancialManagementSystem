import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import {
  insertTransactionSchema,
  insertReceiptSchema,
  insertPatientVolumeSchema,
} from "@shared/schema";
import { ObjectStorageService } from "./objectStorage";
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function parseYMD(dateStr?: string | null): Date | undefined {
  if (!dateStr) return undefined;
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(dateStr);
  if (m) {
    const [y, mo, d] = dateStr.split("-").map((n) => parseInt(n, 10));
    return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? undefined : d;
}

function addDaysUTC(d: Date, days: number) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days, 0, 0, 0, 0));
}

function toNumberLoose(v: unknown): number {
  // Accept "80,000", " 200.50 ", 200, etc.
  const n = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : NaN;
}

function norm(s?: string | null) {
  return (s ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/* ------------------------------ CORS -------------------------------- */

const RAW_ALLOWED =
  (process.env.ALLOWED_ORIGINS || process.env.WEB_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const ALLOWED_EXACT = new Set<string>([
  ...RAW_ALLOWED,
  // Local dev
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

// Allow common hosters (exact domain still preferred via env var)
const ALLOWED_SUFFIXES = [".netlify.app", ".vercel.app", ".onrender.com"];

function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return false;
  if (ALLOWED_EXACT.has(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    return ALLOWED_SUFFIXES.some((sfx) => host.endsWith(sfx));
  } catch {
    return false;
  }
}

function applyCors(req: Request, res: Response) {
  const origin = req.headers.origin as string | undefined;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  // Echo requested headers if present (robust to casing / future additions)
  const requested = (req.headers["access-control-request-headers"] as string | undefined)?.trim();
  res.setHeader(
    "Access-Control-Allow-Headers",
    requested || "Content-Type, Authorization, X-Requested-With, X-Session-Token"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
}

/* Extend Express Request to include user */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        role: string;
        location: string;
        fullName: string;
      };
    }
  }
}

export async function registerRoutes(app: Express): Promise<void> {
  // Make secure cookies work behind a proxy (Render/Netlify)
  app.set("trust proxy", 1);

  // Global CORS + preflight (before any auth middleware)
  app.use((req, res, next) => {
    applyCors(req, res);
    if (req.method === "OPTIONS") {
      // Preflight: respond quickly, cache briefly
      res.setHeader("Access-Control-Max-Age", "600");
      return res.status(204).end();
    }
    next();
  });

  /* --------------------------------------------------------------- */
  /* Health                                                          */
  /* --------------------------------------------------------------- */
  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "Bahr El Ghazal Clinic API",
      timestamp: new Date().toISOString(),
    });
  });

  /* --------------------------------------------------------------- */
  /* Auth middleware (cookie + Safari header fallback)               */
  /* --------------------------------------------------------------- */
  const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
      let userSession: any = null;

      const sessionCookie = req.cookies?.user_session;
      if (sessionCookie) {
        try {
          userSession = JSON.parse(sessionCookie);
        } catch {}
      }

      if (!userSession) {
        const header = req.headers["x-session-token"];
        if (header) {
          try {
            userSession = JSON.parse(header as string);
          } catch {}
        }
      }

      if (!userSession) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const user = await storage.getUser(userSession.id);
      if (!user || user.status === "inactive") {
        res.clearCookie("user_session");
        return res.status(401).json({ error: "Session invalid" });
      }

      req.user = {
        id: user.id,
        username: user.username,
        role: user.role,
        location: user.location,
        fullName: user.fullName,
      };

      next();
    } catch (err) {
      console.error("Auth middleware error:", err);
      res.status(500).json({ error: "Authentication error" });
    }
  };

  /* --------------------------------------------------------------- */
  /* Auth routes                                                     */
  /* --------------------------------------------------------------- */
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      const user = await storage.getUserByUsername(username.toLowerCase());
      if (!user || user.password !== password) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      if (user.status === "inactive") {
        return res.status(401).json({ error: "Account is deactivated" });
      }

      await storage.updateUser(user.id, { lastLogin: new Date() });

      const userSession = {
        id: user.id,
        username: user.username,
        role: user.role,
        location: user.location,
        fullName: user.fullName,
      };

      const isProd = process.env.NODE_ENV === "production";
      res.cookie("user_session", JSON.stringify(userSession), {
        httpOnly: true,
        secure: isProd,
        sameSite: "none",
        path: "/",
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      });

      res.json(userSession);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", (_req, res) => {
    const isProd = process.env.NODE_ENV === "production";
    res.clearCookie("user_session", { httpOnly: true, secure: isProd, sameSite: "none", path: "/" });
    res.clearCookie("session");
    res.json({ success: true, message: "Logged out successfully" });
  });

  app.get("/api/auth/user", async (req, res) => {
    try {
      const tryResolve = async (raw: string) => {
        const session = JSON.parse(raw);
        const user = await storage.getUser(session.id);
        if (user && user.status !== "inactive") {
          return {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            location: user.location,
            fullName: user.fullName,
            defaultCurrency: user.defaultCurrency,
            emailNotifications: user.emailNotifications,
            reportAlerts: user.reportAlerts,
          };
        }
        return null;
      };

      if (req.cookies?.user_session) {
        try {
          const u = await tryResolve(req.cookies.user_session);
          if (u) return res.json(u);
        } catch {}
      }
      const header = req.headers["x-session-token"];
      if (header) {
        try {
          const u = await tryResolve(header as string);
          if (u) return res.json(u);
        } catch {}
      }
      res.status(401).json({ error: "Authentication required" });
    } catch (error) {
      console.error("Auth check error:", error);
      res.status(500).json({ error: "Authentication error" });
    }
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current password and new password are required" });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters long" });
      }

      const me = await storage.getUser(req.user!.id);
      if (!me) return res.status(404).json({ error: "User not found" });
      if (me.password !== currentPassword) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      const updatedUser = await storage.updateUser(req.user!.id, { password: newPassword });
      if (!updatedUser) return res.status(500).json({ error: "Failed to update password" });

      res.json({ success: true, message: "Password updated successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  /* --------------------------------------------------------------- */
  /* User Management                                                 */
  /* --------------------------------------------------------------- */
  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      if (req.user!.role !== "admin") return res.status(403).json({ error: "Access denied" });
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.patch("/api/users/:id", requireAuth, async (req, res) => {
    try {
      if (req.user!.role !== "admin") return res.status(403).json({ error: "Access denied" });
      const { id } = req.params;
      const updates = { ...req.body };
      delete (updates as any).id;
      delete (updates as any).password;
      const updatedUser = await storage.updateUser(id, updates);
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error updating user:", error);
      if (error.code === "23505") {
        if (error.constraint === "users_username_key") {
          return res.status(400).json({ error: `Username "${req.body.username}" already exists.` });
        } else if (error.constraint === "users_email_key") {
          return res.status(400).json({ error: `Email "${req.body.email}" is already registered.` });
        }
      }
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.patch("/api/users/:id/reset-password", requireAuth, async (req, res) => {
    try {
      if (req.user?.role !== "admin") return res.status(403).json({ error: "Access denied" });
      const userId = req.params.id;
      const { newPassword } = req.body;
      if (!newPassword) return res.status(400).json({ error: "New password is required" });
      if (newPassword.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

      const existing = await storage.getUser(userId);
      if (!existing) return res.status(404).json({ error: "User not found" });

      const updatedUser = await storage.updateUser(userId, { password: newPassword });
      if (!updatedUser) return res.status(500).json({ error: "Failed to update password" });

      res.json({ success: true, message: "Password reset successfully" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  app.post("/api/users", requireAuth, async (req, res) => {
    try {
      if (req.user!.role !== "admin") return res.status(403).json({ error: "Access denied" });

      const { username, email, fullName, role, password, permissions } = req.body;
      const location = "clinic";
      if (!username || !email || !fullName || !role) {
        return res.status(400).json({ error: "Missing required fields: username, email, fullName, role" });
      }

      const userData = {
        username,
        email,
        fullName: fullName || "",
        role,
        location,
        password: password || "defaultPassword123",
        permissions: JSON.stringify(permissions || []),
        status: "active" as const,
      };

      const user = await storage.createUser(userData);
      res.status(201).json(user);
    } catch (error: any) {
      console.error("Error creating user:", error);
      if (error.code === "23505") {
        if (error.constraint === "users_username_key") {
          return res.status(400).json({ error: `Username "${req.body.username}" already exists.` });
        } else if (error.constraint === "users_email_key") {
          return res.status(400).json({ error: `Email "${req.body.email}" is already registered.` });
        }
      }
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.delete("/api/users/:id", requireAuth, async (req, res) => {
    try {
      if (req.user!.role !== "admin") return res.status(403).json({ error: "Access denied" });

      const { id } = req.params;
      if (id === req.user!.id) return res.status(400).json({ error: "Cannot delete your own account" });

      await storage.deleteUser(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  /* --------------------------------------------------------------- */
  /* Departments & Providers                                         */
  /* --------------------------------------------------------------- */
  app.get("/api/departments", requireAuth, async (_req, res) => {
    try {
      const departments = await storage.getDepartments();
      res.json(departments);
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({ error: "Failed to fetch departments" });
    }
  });

  app.get("/api/insurance-providers", requireAuth, async (_req, res) => {
    try {
      const providers = await storage.getInsuranceProviders();
      res.json(providers);
    } catch (error) {
      console.error("Error fetching insurance providers:", error);
      res.status(500).json({ error: "Failed to fetch insurance providers" });
    }
  });

  /* --------------------------------------------------------------- */
  /* Transactions                                                     */
  /* --------------------------------------------------------------- */
  app.get("/api/transactions", requireAuth, async (req, res) => {
    try {
      const page = parseInt((req.query.page as string) || "1", 10);
      const limit = parseInt((req.query.limit as string) || (req.query.pageSize as string) || "50", 10);
      const offset = (page - 1) * limit;

      const startDate = parseYMD(req.query.startDate as string);
      const endDate = parseYMD(req.query.endDate as string);

      const filters: any = { limit, offset };
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      if (req.query.departmentId) filters.departmentId = String(req.query.departmentId);
      if (req.query.insuranceProviderId) filters.insuranceProviderId = String(req.query.insuranceProviderId);
      if (req.query.currency) filters.currency = String(req.query.currency).toUpperCase();
      if (req.query.type) filters.type = String(req.query.type).toLowerCase();
      if (req.query.searchQuery) filters.searchQuery = String(req.query.searchQuery);

      const result = await storage.getTransactionsPaginated(filters);
      res.json(result);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  app.post("/api/transactions", requireAuth, async (req, res) => {
    try {
      const syncStatus = "synced";
      const bodyWithDate = {
        ...req.body,
        date: req.body.date ? new Date(req.body.date) : new Date(),
        createdBy: (req as any).user.id,
        insuranceProviderId:
          req.body.insuranceProviderId === "no-insurance" ? null : req.body.insuranceProviderId,
        syncStatus,
      };

      const validated = insertTransactionSchema.parse(bodyWithDate);
      const transaction = await storage.createTransaction(validated);
      res.status(201).json(transaction);
    } catch (error) {
      console.error("Error creating transaction:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create transaction" });
      }
    }
  });

  /* ---------------- NEW: Daily Bulk Income ----------------------- */
  // Accept department *or* provider rows; IDs *or* names; sanitize amounts.
  app.post("/api/transactions/bulk-income", requireAuth, async (req, res) => {
    try {
      // Accept a variety of shapes for robustness
      const RowSchema = z.object({
        // Either departmentId (uuid) or departmentName (string)
        departmentId: z.string().min(1).optional(),
        departmentName: z.string().optional(),
        // Either insuranceProviderId (uuid) or providerName (string)
        insuranceProviderId: z.string().nullable().optional(),
        providerName: z.string().optional(),
        // Free-form amount; we sanitize later
        amount: z.any(),
        description: z.string().optional(),
      });

      const BulkSchema = z.object({
        date: z.string().optional(),
        currency: z.enum(["SSP", "USD"]).default("SSP"),
        defaultInsuranceProviderId: z.string().nullable().optional(),
        notes: z.string().optional(),
        rows: z.array(RowSchema).min(1, "rows must contain at least one item"),
      });

      const payload = BulkSchema.parse(req.body);

      const dateObj = payload.date ? parseYMD(payload.date) : new Date();
      if (!dateObj) return res.status(400).json({ error: "Invalid date format" });

      // Build lookup maps once per request (id and normalized name → id)
      const [departments, providers] = await Promise.all([
        storage.getDepartments(),
        storage.getInsuranceProviders(),
      ]);

      const deptMap = new Map<string, string>();
      for (const d of departments || []) {
        if (!d?.id) continue;
        deptMap.set(d.id, d.id);
        deptMap.set(norm(d.name), d.id);
      }

      const provMap = new Map<string, string>();
      for (const p of providers || []) {
        if (!p?.id) continue;
        provMap.set(p.id, p.id);
        provMap.set(norm(p.name), p.id);
      }

      function resolveDepartment(ref?: string) {
        const key = norm(ref);
        return deptMap.get(ref || "") || deptMap.get(key);
      }

      function resolveProvider(ref?: string | null) {
        const key = norm(ref || "");
        if (!ref || key === "" || key === "no-insurance" || key === "cash") return null;
        return provMap.get(ref) || provMap.get(key) || null;
      }

      const createdBy = req.user!.id;
      const syncStatus = "synced";

      const created: any[] = [];
      const errors: any[] = [];

      for (let i = 0; i < payload.rows.length; i++) {
        const r = payload.rows[i];

        const amountNum = toNumberLoose(r.amount);
        if (!Number.isFinite(amountNum) || amountNum <= 0) {
          errors.push({ index: i, error: "Invalid amount" });
          continue;
        }

        // Prefer explicit fields; fall back to name lookups
        const departmentId = resolveDepartment(r.departmentId || r.departmentName);
        // Provider precedence: explicit, default, then name resolution
        const chosenProvider =
          r.insuranceProviderId !== undefined
            ? r.insuranceProviderId
            : payload.defaultInsuranceProviderId ?? r.providerName;
        const insuranceProviderId = resolveProvider(chosenProvider);

        // Require at least one identifier
        if (!departmentId && insuranceProviderId === null) {
          errors.push({
            index: i,
            error: "Provide either a valid department or a valid insurance provider",
          });
          continue;
        }

        const txCandidate = {
          type: "income" as const,
          date: dateObj,
          departmentId: departmentId || undefined,
          amount: amountNum,
          currency: payload.currency,
          description: r.description || payload.notes || "Daily income",
          createdBy,
          insuranceProviderId, // null = cash/no-insurance
          syncStatus,
        };

        try {
          const validated = insertTransactionSchema.parse(txCandidate);
          const tx = await storage.createTransaction(validated);
          created.push(tx);
        } catch (e: any) {
          errors.push({ index: i, error: e?.errors || e?.message || "Validation error" });
        }
      }

      if (created.length === 0) {
        return res.status(400).json({ error: "No valid rows to create", details: errors });
      }

      res.status(201).json({ created: created.length, errors, transactions: created });
    } catch (error) {
      console.error("Error in bulk-income:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create bulk income transactions" });
    }
  });

  /* ---------------- NEW: Bulk Expenses ---------------------------- */
  app.post("/api/transactions/bulk-expense", requireAuth, async (req, res) => {
    try {
      const RowSchema = z.object({
        expenseCategory: z.string().min(1, "expenseCategory required"),
        amount: z.any(), // allow "250,000" etc.; convert below
        description: z.string().optional(),
      });

      const BulkSchema = z.object({
        date: z.string().optional(), // YYYY-MM-DD (optional)
        currency: z.enum(["SSP", "USD"]).default("SSP"),
        notes: z.string().optional(),
        rows: z.array(RowSchema).min(1, "rows must contain at least one item"),
      });

      const payload = BulkSchema.parse(req.body);

      const dateObj = payload.date ? parseYMD(payload.date) : new Date();
      if (!dateObj) return res.status(400).json({ error: "Invalid date format" });

      const createdBy = req.user!.id;
      const syncStatus = "synced";

      const created: any[] = [];
      const errors: any[] = [];

      for (let i = 0; i < payload.rows.length; i++) {
        const r = payload.rows[i];

        const amountNum = toNumberLoose(r.amount);
        if (!Number.isFinite(amountNum) || amountNum <= 0) {
          errors.push({ index: i, error: "Invalid amount" });
          continue;
        }

        const txCandidate = {
          type: "expense" as const,
          date: dateObj,
          amount: amountNum,
          currency: payload.currency,
          expenseCategory: r.expenseCategory,
          description: r.description || payload.notes || "Expense",
          createdBy,
          syncStatus,
        };

        try {
          const validated = insertTransactionSchema.parse(txCandidate);
          const tx = await storage.createTransaction(validated);
          created.push(tx);
        } catch (e: any) {
          errors.push({ index: i, error: e?.errors || e?.message || "Validation error" });
        }
      }

      if (created.length === 0) {
        return res.status(400).json({ error: "No valid rows to create", details: errors });
      }

      res.status(201).json({ created: created.length, errors, transactions: created });
    } catch (error) {
      console.error("Error in bulk-expense:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create bulk expenses" });
    }
  });

  app.put("/api/transactions/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updates: any = {
        ...req.body,
        date: req.body.date ? new Date(req.body.date) : undefined,
        insuranceProviderId:
          req.body.insuranceProviderId === "no-insurance" ? null : req.body.insuranceProviderId,
      };
      Object.keys(updates).forEach((k) => updates[k] === undefined && delete updates[k]);

      const transaction = await storage.updateTransaction(id, updates);
      if (!transaction) return res.status(404).json({ error: "Transaction not found" });
      res.json(transaction);
    } catch (error) {
      console.error("Error updating transaction:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update transaction" });
      }
    }
  });

  app.delete("/api/transactions/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTransaction(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting transaction:", error);
      res.status(500).json({ error: "Failed to delete transaction" });
    }
  });

  /* Drill-down endpoint used by chart click */
  // GET /api/transactions/detailed?date=YYYY-MM-DD&currency=SSP|USD&type=income
  // or /api/transactions/detailed?from=YYYY-MM-DD&to=YYYY-MM-DD&currency=...&type=...
  app.get("/api/transactions/detailed", requireAuth, async (req, res) => {
    try {
      const { date, from, to } = req.query as any;
      const currency = req.query.currency ? String(req.query.currency).toUpperCase() : undefined;
      const type = req.query.type ? String(req.query.type).toLowerCase() : undefined;
      const departmentId = req.query.departmentId ? String(req.query.departmentId) : undefined;
      const insuranceProviderId = req.query.insuranceProviderId
        ? String(req.query.insuranceProviderId)
        : undefined;

      let start: Date | undefined;
      let endExclusive: Date | undefined;

      if (date) {
        const d = parseYMD(String(date));
        if (!d) return res.status(400).json({ error: "Invalid date" });
        start = d;
        endExclusive = addDaysUTC(d, 1); // [date, date+1)
      } else if (from && to) {
        const f = parseYMD(String(from));
        const t = parseYMD(String(to));
        if (!f || !t) return res.status(400).json({ error: "Invalid from/to" });
        start = f;
        endExclusive = t; // [from, to)
      } else {
        return res.status(400).json({ error: "Provide 'date' or 'from'&'to' (YYYY-MM-DD)" });
      }

      const rows = await storage.getTransactionsBetween(start!, endExclusive!, {
        currency,
        type,
        departmentId,
        insuranceProviderId,
        limit: 2000,
      });

      res.json({ count: rows.length, transactions: rows });
    } catch (error) {
      console.error("Error fetching detailed transactions:", error);
      res.status(500).json({ error: "Failed to fetch detailed transactions" });
    }
  });

  /* --------------------------------------------------------------- */
  /* Dashboard & Trends                                              */
  /* --------------------------------------------------------------- */
  app.get("/api/dashboard", requireAuth, async (req, res) => {
    try {
      const year = Number(req.query.year) || new Date().getUTCFullYear();
      const month = Number(req.query.month) || new Date().getUTCMonth() + 1;
      const range = (req.query.range as string) || "current-month";
      const startDate = (req.query.startDate as string) || undefined;
      const endDate = (req.query.endDate as string) || undefined;

      const data = await storage.getDashboardData({ year, month, range, startDate, endDate });
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      res.json(data);
    } catch (err) {
      console.error("[dashboard-error]", err);
      res.status(500).json({ error: "Failed to load dashboard" });
    }
  });

  app.get("/api/income-trends", requireAuth, async (req, res) => {
    try {
      const days = parseInt((req.query.days as string) || "7");
      const data = await storage.getIncomeTrends(days);
      res.json(data);
    } catch (error) {
      console.error("Error fetching income trends:", error);
      res.status(500).json({ error: "Failed to fetch income trends" });
    }
  });

  app.get("/api/income-trends/:year/:month", requireAuth, async (req, res) => {
    try {
      const year = parseInt(req.params.year, 10);
      const month = parseInt(req.params.month, 10);
      const range = (req.query.range as string) || "current-month";
      const startDateStr = req.query.startDate as string | undefined;
      const endDateStr = req.query.endDate as string | undefined;

      let data;
      if (range === "custom" && startDateStr && endDateStr) {
        const s = parseYMD(startDateStr)!;
        const e = parseYMD(endDateStr)!; // [s, e)
        data = await storage.getIncomeTrendsForDateRange(s, e);
      } else if (range === "last-3-months") {
        const endEx = new Date(); // now
        const start = addDaysUTC(new Date(Date.UTC(endEx.getUTCFullYear(), endEx.getUTCMonth() - 3, 1)), 0);
        data = await storage.getIncomeTrendsForDateRange(start, endEx);
      } else if (range === "year") {
        const s = new Date(Date.UTC(year, 0, 1));
        const e = new Date(Date.UTC(year + 1, 0, 1));
        data = await storage.getIncomeTrendsForDateRange(s, e);
      } else {
        data = await storage.getIncomeTrendsForMonth(year, month);
      }

      res.json(data);
    } catch (error) {
      console.error("Error fetching income trends for month:", error);
      res.status(500).json({ error: "Failed to fetch income trends" });
    }
  });

  app.get("/api/detailed-transactions/:year/:month", requireAuth, async (req, res) => {
    try {
      const year = parseInt(req.params.year, 10);
      const month = parseInt(req.params.month, 10);
      const data = await storage.getDetailedTransactionsForMonth(year, month);
      res.json(data);
    } catch (error) {
      console.error("Error fetching detailed transactions:", error);
      res.status(500).json({ error: "Failed to fetch detailed transactions" });
    }
  });

  /* --------------------------------------------------------------- */
  /* Monthly Reports                                                 */
  /* --------------------------------------------------------------- */
  app.get("/api/reports", requireAuth, async (req, res) => {
    try {
      const { limit } = req.query;
      const reports = await storage.getMonthlyReports(limit ? parseInt(limit as string, 10) : undefined);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ error: "Failed to fetch reports" });
    }
  });

  app.get("/api/reports/:year/:month", requireAuth, async (req, res) => {
    try {
      const year = parseInt(req.params.year, 10);
      const month = parseInt(req.params.month, 10);
      const report = await storage.getMonthlyReport(year, month);
      if (!report) return res.status(404).json({ error: "Report not found" });
      res.json(report);
    } catch (error) {
      console.error("Error fetching report:", error);
      res.status(500).json({ error: "Failed to fetch report" });
    }
  });

  app.post("/api/reports/generate/:year/:month", requireAuth, async (req, res) => {
    try {
      const year = parseInt(req.params.year, 10);
      const month = parseInt(req.params.month, 10);
      const userId = (req as any).user.id;

      const dashboardData = await storage.getDashboardData({ year, month, range: "current-month" });
      const reportData = {
        year,
        month,
        totalIncome: dashboardData.totalIncome,
        totalExpenses: dashboardData.totalExpenses,
        netIncome: dashboardData.netIncome,
        departmentBreakdown: dashboardData.departmentBreakdown,
        insuranceBreakdown: dashboardData.insuranceBreakdown,
        status: "draft" as const,
        pdfPath: `/reports/${year}-${month.toString().padStart(2, "0")}.pdf`,
        generatedBy: userId,
      };

      const report = await storage.createMonthlyReport(reportData);
      res.status(201).json(report);
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  app.delete("/api/reports/:reportId", requireAuth, async (req, res) => {
    try {
      const { reportId } = req.params;
      await storage.deleteMonthlyReport(reportId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting report:", error);
      res.status(500).json({ error: "Failed to delete report" });
    }
  });

  // NOTE: this path overlaps with /api/reports/:year/:month; keep it last
  app.get("/api/reports/:path", requireAuth, async (req, res) => {
    try {
      const path = req.params.path;
      const pathParts = path.replace(".pdf", "").split("-");
      const year = parseInt(pathParts[0], 10);
      const month = parseInt(pathParts[1], 10);

      const dashboardData = await storage.getDashboardData({ year, month, range: "current-month" });
      const report = await storage.getMonthlyReport(year, month);
      if (!report) return res.status(404).json({ error: "Report not found" });

      const reportData = {
        ...report,
        totalIncomeSSP: dashboardData.totalIncomeSSP,
        totalIncomeUSD: dashboardData.totalIncomeUSD,
        totalIncome: dashboardData.totalIncome,
        totalExpenses: dashboardData.totalExpenses,
        netIncome: dashboardData.netIncome,
        departmentBreakdown: dashboardData.departmentBreakdown,
        insuranceBreakdown: dashboardData.insuranceBreakdown,
        expenseBreakdown: dashboardData.expenseBreakdown,
      };

      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const margin = 20;

      // Header
      doc.setFillColor(20, 83, 75);
      doc.rect(0, 0, pageWidth, 60, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("Bahr El Ghazal Clinic — Monthly Financial Report", margin, 25);
      doc.setFontSize(16);
      doc.setFont("helvetica", "normal");
      doc.text("Financial Management System", margin, 40);

      // Title
      doc.setTextColor(0, 0, 0);
      const monthName = new Date(year, month - 1).toLocaleDateString("en-US", { month: "long" });
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(`${monthName} ${year}`, margin, 80);

      const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
      const filename = `Bahr_El_Ghazal_${monthName}_${year}_Report.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error downloading report:", error);
      res.status(500).json({ error: "Failed to download report" });
    }
  });

  /* --------------------------------------------------------------- */
  /* Receipts (GCS)                                                  */
  /* --------------------------------------------------------------- */
  app.post("/api/receipts/upload", requireAuth, async (_req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  app.post("/api/receipts", requireAuth, async (req, res) => {
    try {
      const validatedData = insertReceiptSchema.parse({ ...req.body, uploadedBy: req.user!.id });
      const receipt = await storage.createReceipt(validatedData);
      res.status(201).json(receipt);
    } catch (error) {
      console.error("Error creating receipt:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create receipt" });
      }
    }
  });

  app.get("/receipts/:receiptPath(*)", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(`/objects/${req.params.receiptPath}`);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving receipt:", error);
      res.status(404).json({ error: "Receipt not found" });
    }
  });

  /* --------------------------------------------------------------- */
  /* Patient Volume                                                  */
  /* --------------------------------------------------------------- */
  app.post("/api/patient-volume", requireAuth, async (req, res) => {
    try {
      const validated = insertPatientVolumeSchema.parse({ ...req.body, recordedBy: req.user?.id });
      const volume = await storage.createPatientVolume(validated);
      res.status(201).json(volume);
    } catch (error) {
      console.error("Error creating patient volume:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create patient volume record" });
      }
    }
  });

  app.get("/api/patient-volume/date/:date", requireAuth, async (req, res) => {
    try {
      const date = parseYMD(req.params.date);
      if (!date) return res.status(400).json({ error: "Invalid date format" });
      const departmentId = req.query.departmentId as string | undefined;
      const volumes = await storage.getPatientVolumeByDate(date, departmentId);
      res.json(volumes);
    } catch (error) {
      console.error("Error getting patient volume by date:", error);
      res.status(500).json({ error: "Failed to get patient volume data" });
    }
  });

  app.get("/api/patient-volume/:year/:month", requireAuth, async (req, res) => {
    try {
      const year = parseInt(req.params.year, 10);
      const month = parseInt(req.params.month, 10);
      const volumes = await storage.getPatientVolumeForMonth(year, month);
      res.json(volumes);
    } catch (error) {
      console.error("Error getting patient volume for month:", error);
      res.status(500).json({ error: "Failed to get patient volume data" });
    }
  });

  app.get("/api/patient-volume/period/:year/:month", requireAuth, async (req, res) => {
    try {
      const year = parseInt(req.params.year, 10);
      const month = parseInt(req.params.month, 10);
      const range = (req.query.range as string) || "current-month";

      let volumes: any[] = [];
      switch (range) {
        case "current-month":
        case "last-month": {
          volumes = await storage.getPatientVolumeForMonth(year, month);
          break;
        }
        case "last-3-months": {
          const months: any[] = [];
          for (let i = 0; i < 3; i++) {
            const d = new Date(year, month - 1 - i);
            const mv = await storage.getPatientVolumeForMonth(d.getFullYear(), d.getMonth() + 1);
            months.push(...mv);
          }
          volumes = months;
          break;
        }
        case "year": {
          const all: any[] = [];
          for (let m = 1; m <= 12; m++) {
            const mv = await storage.getPatientVolumeForMonth(year, m);
            all.push(...mv);
          }
          volumes = all;
          break;
        }
        case "custom": {
          const s = parseYMD(req.query.startDate as string) || new Date(Date.UTC(year, month - 1, 1));
          const e = parseYMD(req.query.endDate as string) || new Date(Date.UTC(year, month, 1));
          volumes = await storage.getPatientVolumeByDateRange(s, e);
          break;
        }
        default: {
          volumes = await storage.getPatientVolumeForMonth(year, month);
        }
      }

      res.json(volumes);
    } catch (error) {
      console.error("Error getting patient volume for period:", error);
      res.status(500).json({ error: "Failed to get patient volume data" });
    }
  });

  app.put("/api/patient-volume/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await storage.updatePatientVolume(id, req.body);
      if (!updated) return res.status(404).json({ error: "Patient volume record not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating patient volume:", error);
      res.status(500).json({ error: "Failed to update patient volume record" });
    }
  });

  app.delete("/api/patient-volume/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deletePatientVolume(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting patient volume:", error);
      res.status(500).json({ error: "Failed to delete patient volume record" });
    }
  });
}
