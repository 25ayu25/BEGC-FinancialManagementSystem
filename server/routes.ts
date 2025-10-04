// server/routes.ts
import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import {
  insertTransactionSchema,
  insertReceiptSchema,
  insertPatientVolumeSchema,
} from "@shared/schema";
import { ObjectStorageService } from "./objectStorage";
import { z } from "zod";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

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
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days, 0, 0, 0, 0)
  );
}

function toNumberLoose(v: unknown): number {
  const n = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : NaN;
}

function isUUIDLike(s?: string | null): boolean {
  if (!s) return false;
  return /^[0-9a-fA-F-]{20,}$/.test(s);
}

function normKey(s?: string | null) {
  return String(s ?? "").trim().toLowerCase();
}

/* ------------------------------ CORS -------------------------------- */

const RAW_ALLOWED = (process.env.ALLOWED_ORIGINS || process.env.WEB_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ALLOWED_EXACT = new Set<string>([
  ...RAW_ALLOWED,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

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

function applyCors(_req: Request, res: Response) {
  const origin = _req.headers.origin as string | undefined;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, X-Session-Token, x-session-token"
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

/* ------------------------------ Report helpers ------------------------------ */

const MONTHS = [
  "january","february","march","april","may","june",
  "july","august","september","october","november","december"
];

function parseReportPathToYearMonth(path: string): { year: number; month: number } | null {
  // numeric: 2025-09.pdf   or /reports/2025-09.pdf
  const m1 = path.match(/(^|\/)(\d{4})-(\d{2})\.pdf$/i);
  if (m1) {
    const year = +m1[2];
    const month = +m1[3];
    if (year >= 2000 && month >= 1 && month <= 12) return { year, month };
  }
  // friendly: _September_2025_
  const m2 = path.match(
    /_(January|February|March|April|May|June|July|August|September|October|November|December)_(\d{4})_/i
  );
  if (m2) {
    const idx = MONTHS.indexOf(m2[1].toLowerCase());
    const year = +m2[2];
    if (idx >= 0 && year >= 2000) return { year, month: idx + 1 };
  }
  return null;
}

function monthLabel(year: number, month: number) {
  const name = MONTHS[month - 1][0].toUpperCase() + MONTHS[month - 1].slice(1);
  return `${name} ${year}`;
}

function toPairs(rec: any): Array<[string, number]> {
  if (!rec) return [];
  if (Array.isArray(rec)) {
    return rec.map((r: any) => {
      if (Array.isArray(r) && r.length >= 2) return [String(r[0]), Number(r[1] ?? 0)];
      if (typeof r === "object") {
        const k = r.name ?? r.department ?? r.provider ?? r.key ?? "";
        const v = Number(r.amount ?? r.value ?? 0);
        return [String(k), v];
      }
      return [String(r), 0];
    });
  }
  return Object.entries(rec).map(([k, v]) => [String(k), Number(v as number)]);
}

/* ------------------------------ Register Routes ------------------------------ */

export async function registerRoutes(app: Express): Promise<void> {
  app.set("trust proxy", 1);

  app.use((req, res, next) => {
    applyCors(req, res);
    if (req.method === "OPTIONS") {
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
  /* Auth middleware                                                 */
  /* --------------------------------------------------------------- */
  const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
      let userSession: any = null;

      const sessionCookie = (req as any).cookies?.user_session;
      if (sessionCookie) {
        try { userSession = JSON.parse(sessionCookie); } catch {}
      }

      if (!userSession) {
        const header = req.headers["x-session-token"];
        if (header) {
          try { userSession = JSON.parse(header as string); } catch {}
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

      const user = await storage.getUserByUsername(String(username).toLowerCase());
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
        maxAge: 1000 * 60 * 60 * 24 * 30,
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

      const cookieRaw = (req as any).cookies?.user_session;
      if (cookieRaw) {
        try {
          const u = await tryResolve(cookieRaw);
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
      if (String(newPassword).length < 8) {
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
      if (String(newPassword).length < 8)
        return res.status(400).json({ error: "Password must be at least 8 characters" });

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
        return res
          .status(400)
          .json({ error: "Missing required fields: username, email, fullName, role" });
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
      const limit = parseInt(
        (req.query.limit as string) || (req.query.pageSize as string) || "50",
        10
      );
      const offset = (page - 1) * limit;

      const startDate = parseYMD(req.query.startDate as string);
      const endDate = parseYMD(req.query.endDate as string);

      const filters: any = { limit, offset };
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      if (req.query.departmentId) filters.departmentId = String(req.query.departmentId);
      if (req.query.insuranceProviderId)
        filters.insuranceProviderId = String(req.query.insuranceProviderId);
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
        createdBy: req.user!.id,
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
  app.post("/api/transactions/bulk-income", requireAuth, async (req, res) => {
    try {
      const RowSchema = z.object({
        departmentId: z.string().optional(),
        departmentName: z.string().optional(),
        amount: z.any(),
        description: z.string().optional(),
        insuranceProviderId: z.string().nullable().optional(),
        providerName: z.string().optional(),
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

      const [departments, providers] = await Promise.all([
        storage.getDepartments(),
        storage.getInsuranceProviders(),
      ]);

      const deptById = new Map<string, any>(departments.map((d: any) => [d.id, d]));
      const deptByName = new Map<string, any>(departments.map((d: any) => [normKey(d.name), d]));

      const provById = new Map<string, any>(providers.map((p: any) => [p.id, p]));
      const provByName = new Map<string, any>(providers.map((p: any) => [normKey(p.name), p]));

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

        // Resolve department
        let deptId: string | undefined;
        if (r.departmentId) {
          if (isUUIDLike(r.departmentId) && deptById.has(r.departmentId)) {
            deptId = r.departmentId;
          } else {
            const d = deptByName.get(normKey(r.departmentId));
            if (d) deptId = d.id;
          }
        }
        if (!deptId && r.departmentName) {
          const d = deptByName.get(normKey(r.departmentName));
          if (d) deptId = d.id;
        }

        // Resolve provider
        let chosenProvider =
          r.insuranceProviderId !== undefined
            ? r.insuranceProviderId
            : payload.defaultInsuranceProviderId ?? null;

        if (!chosenProvider && r.providerName) {
          const p = provByName.get(normKey(r.providerName));
          if (p) chosenProvider = p.id;
        }

        let providerId: string | null = null;
        if (chosenProvider === "no-insurance" || chosenProvider === null) {
          providerId = null;
        } else if (typeof chosenProvider === "string") {
          if (isUUIDLike(chosenProvider) && provById.has(chosenProvider)) {
            providerId = chosenProvider;
          } else {
            const p = provByName.get(normKey(chosenProvider));
            if (p) providerId = p.id;
          }
        }

        // Valid if dept row (with cash/no-insurance) OR provider-only row
        if (!deptId && providerId === null) {
          errors.push({
            index: i,
            error:
              "Provide a valid department (for cash/no-insurance) or a valid insurance provider.",
          });
          continue;
        }

        const txCandidate = {
          type: "income" as const,
          date: dateObj,
          departmentId: deptId,
          amount: amountNum,
          currency: payload.currency,
          description: r.description || payload.notes || "Daily income",
          createdBy,
          insuranceProviderId: providerId,
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
        amount: z.any(),
        description: z.string().optional(),
      });

      const BulkSchema = z.object({
        date: z.string().optional(),
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
        endExclusive = addDaysUTC(d, 1);
      } else if (from && to) {
        const f = parseYMD(String(from));
        const t = parseYMD(String(to));
        if (!f || !t) return res.status(400).json({ error: "Invalid from/to" });
        start = f;
        endExclusive = t;
      } else {
        return res
          .status(400)
          .json({ error: "Provide 'date' or 'from'&'to' (YYYY-MM-DD)" });
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
  /* Insurance Management                                            */
  /* --------------------------------------------------------------- */

  // Zod request schemas
  const ClaimCreate = z.object({
    providerId: z.string().min(1),
    periodYear: z.number().int(),
    periodMonth: z.number().int().min(1).max(12),
    periodStart: z.string().min(8), // "YYYY-MM-DD" or ISO
    periodEnd: z.string().min(8),
    currency: z.enum(["USD", "SSP"]).default("USD"),
    claimedAmount: z.number().nonnegative(),
    status: z.enum(["submitted","partially_paid","paid","rejected","written_off"]).optional(),
    notes: z.string().optional(),
  });

  const ClaimPatch = z.object({
    claimedAmount: z.number().nonnegative().optional(),
    status: z.enum(["submitted","partially_paid","paid","rejected","written_off"]).optional(),
    notes: z.string().optional(),
  });

  const PaymentCreate = z.object({
    providerId: z.string().min(1),
    claimId: z.string().min(1).optional(),  // can credit a specific claim or leave null
    paymentDate: z.string().min(8),          // "YYYY-MM-DD" or ISO
    amount: z.number().positive(),
    currency: z.enum(["USD","SSP"]).default("USD"),
    reference: z.string().optional(),
    notes: z.string().optional(),
  });

  /** Create a monthly claim (does not touch revenue) */
  app.post("/api/insurance-claims", requireAuth, async (req, res, next) => {
    try {
      const input = ClaimCreate.parse(req.body);
      const row = await storage.createInsuranceClaim({
        ...input,
        createdBy: req.user?.id ?? null,
      });
      res.json(row);
    } catch (err) { next(err); }
  });

  /** List claims (?providerId=&year=&month=&status=) */
  app.get("/api/insurance-claims", requireAuth, async (req, res, next) => {
    try {
      const rows = await storage.listInsuranceClaims({
        providerId: req.query.providerId as string | undefined,
        year: req.query.year ? Number(req.query.year) : undefined,
        month: req.query.month ? Number(req.query.month) : undefined,
        status: req.query.status as string | undefined,
      });
      res.json(rows);
    } catch (err) { next(err); }
  });

  /** Get one claim */
  app.get("/api/insurance-claims/:id", requireAuth, async (req, res, next) => {
    try {
      const row = await storage.getInsuranceClaim(req.params.id);
      if (!row) return res.status(404).json({ error: "Not found" });
      res.json(row);
    } catch (err) { next(err); }
  });

  /** Update claim amount/status/notes */
  app.patch("/api/insurance-claims/:id", requireAuth, async (req, res, next) => {
    try {
      const patch = ClaimPatch.parse(req.body);
      const row = await storage.updateInsuranceClaim(req.params.id, patch);
      if (!row) return res.status(404).json({ error: "Not found" });
      res.json(row);
    } catch (err) { next(err); }
  });

  /** Record a payment (collections). Not mirrored to transactions. */
  app.post("/api/insurance-payments", requireAuth, async (req, res, next) => {
    try {
      const input = PaymentCreate.parse(req.body);
      const row = await storage.createInsurancePayment({
        ...input,
        createdBy: req.user?.id ?? null,
      });
      res.json(row);
    } catch (err) { next(err); }
  });

  /** Provider + per-claim balances */
  app.get("/api/insurance-balances", requireAuth, async (req, res, next) => {
    try {
      const data = await storage.getInsuranceBalances({
        providerId: req.query.providerId as string | undefined,
      });
      res.json(data);
    } catch (err) { next(err); }
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

  app.get("/api/income-trends", requireAuth, async (_req, res) => {
    try {
      const days = parseInt((_req.query.days as string) || "7");
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
        const e = parseYMD(endDateStr)!;
        data = await storage.getIncomeTrendsForDateRange(s, e);
      } else if (range === "last-3-months") {
        const endEx = new Date();
        const start = addDaysUTC(
          new Date(Date.UTC(endEx.getUTCFullYear(), endEx.getUTCMonth() - 3, 1)),
          0
        );
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
      const reports = await storage.getMonthlyReports(
        limit ? parseInt(limit as string, 10) : undefined
      );
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
      const userId = req.user!.id;

      const dashboardData = await storage.getDashboardData({
        year,
        month,
        range: "current-month",
      });
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

  // Deletes — multiple shapes supported
  app.delete("/api/reports/:year/:month", requireAuth, async (req, res) => {
    try {
      const year = parseInt(req.params.year, 10);
      const month = parseInt(req.params.month, 10);
      const report = await storage.getMonthlyReport(year, month);
      if (!report) return res.status(404).json({ error: "Report not found" });
      await storage.deleteMonthlyReport(report.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting report (year/month):", error);
      res.status(500).json({ error: "Failed to delete report" });
    }
  });

  app.delete("/api/reports/by-date/:year/:month", requireAuth, async (req, res) => {
    try {
      const year = parseInt(req.params.year, 10);
      const month = parseInt(req.params.month, 10);
      const report = await storage.getMonthlyReport(year, month);
      if (!report) return res.status(404).json({ error: "Report not found" });
      await storage.deleteMonthlyReport(report.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting report by date:", error);
      res.status(500).json({ error: "Failed to delete report" });
    }
  });

  app.delete("/api/reports/by-path/:path(*)", requireAuth, async (req, res) => {
    try {
      const parsed = parseReportPathToYearMonth(req.params.path);
      if (!parsed) return res.status(400).json({ error: "Unrecognized report path" });
      const report = await storage.getMonthlyReport(parsed.year, parsed.month);
      if (!report) return res.status(404).json({ error: "Report not found" });
      await storage.deleteMonthlyReport(report.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting report by path:", error);
      res.status(500).json({ error: "Failed to delete report" });
    }
  });

  app.delete("/api/reports/:reportId", requireAuth, async (req, res) => {
    try {
      await storage.deleteMonthlyReport(req.params.reportId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting report by id:", error);
      res.status(500).json({ error: "Failed to delete report" });
    }
  });

  // NOTE: keep last (single-segment path) — PDF render
  app.get("/api/reports/:path", requireAuth, async (req, res) => {
    try {
      const rawPath = req.params.path;
      const parsed = parseReportPathToYearMonth(rawPath);
      if (!parsed) {
        return res.status(400).json({
          error:
            "Unrecognized report path. Use /api/reports/YYYY-MM.pdf or a friendly Month_YYYY name.",
        });
      }
      const { year, month } = parsed;

      // Must exist in DB
      const report = await storage.getMonthlyReport(year, month);
      if (!report) return res.status(404).json({ error: "Report not found" });

      // Aggregates
      const dashboardData = await storage.getDashboardData({
        year,
        month,
        range: "current-month",
      });

      // Lookups for pretty names
      const [departments, providers] = await Promise.all([
        storage.getDepartments(),
        storage.getInsuranceProviders(),
      ]);
      const deptMap = new Map(departments.map((d: any) => [d.id, d.name]));
      const provMap = new Map(providers.map((p: any) => [p.id, p.name]));

      // ---------- number / label utils ----------
      const toNumber = (x: any) => {
        const n = Number(String(x ?? "").replace(/,/g, "").trim());
        return Number.isFinite(n) ? n : 0;
      };
      const fmt0 = (x: any) =>
        toNumber(x).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

      const titleCase = (s: string) =>
        (s || "")
          .toLowerCase()
          .split(/[\s_-]+/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");

      const normalizePairs = (pairsRaw: Array<[string, number]>, idToName?: Map<string, string>) =>
        pairsRaw
          .map(([k, v]) => [idToName?.get(k) || k, toNumber(v)] as [string, number])
          .filter(([, v]) => v !== 0);

      // Professionalize labels (known mappings; otherwise Title Case)
      const proLabel = (raw: string): string => {
        const s = String(raw || "");
        const map: Array<[RegExp, string]> = [
          [/^lab tech\b.*payments?$/i, "Laboratory Staff Compensation"],
          [/^laboratory tech(nician)?\b.*(pay|payroll|comp)/i, "Laboratory Staff Compensation"],
          [/^radiographer\b.*(pay|payroll|comp|payments?)$/i, "Radiology Staff Compensation"],
          [/^doctor\b.*payments?$/i, "Physicians Compensation"],
          [/^physicians?\b.*(fees|comp)/i, "Physicians Compensation"],
          [/^drugs?\b.*purchased$/i, "Pharmaceutical Purchases"],
          [/^lab\b.*reagents?$/i, "Laboratory Reagents"],
          [/^landlord$/i, "Facility Rent"],
          [/^staff\b.*salaries?$/i, "Administrative Salaries"],
          [/^equipment$/i, "Medical Equipment"],
          [/^x-?ray$/i, "Radiology (X-ray)"],
          [/^pharmacy$/i, "Pharmacy Sales"],
          [/^consultation$/i, "Consultation Fees"],
          [/^laboratory$/i, "Laboratory Services"],
        ];
        for (const [re, nice] of map) if (re.test(s)) return nice;
        return titleCase(s);
      };

      const proPairs = (pairs: Array<[string, number]>) =>
        pairs.map(([name, val]) => [proLabel(name), val] as [string, number]);

      // ---------- SORT: highest -> lowest with alpha tie-break ----------
      const sortPairsDesc = (pairs: Array<[string, number]>) =>
        pairs
          .slice()
          .sort((a, b) => (b[1] - a[1]) || String(a[0]).localeCompare(String(b[0])));

      const deptPairs = sortPairsDesc(
        proPairs(
          normalizePairs(
            Array.isArray(dashboardData?.departmentBreakdown)
              ? dashboardData?.departmentBreakdown
              : toPairs(dashboardData?.departmentBreakdown || {}),
            deptMap
          )
        )
      );
      const insPairs = sortPairsDesc(
        proPairs(
          normalizePairs(
            Array.isArray(dashboardData?.insuranceBreakdown)
              ? dashboardData?.insuranceBreakdown
              : toPairs(dashboardData?.insuranceBreakdown || {}),
            provMap
          )
        )
      );
      const expPairs = sortPairsDesc(
        proPairs(
          normalizePairs(
            Array.isArray(dashboardData?.expenseBreakdown)
              ? dashboardData?.expenseBreakdown
              : toPairs(dashboardData?.expenseBreakdown || {})
          )
        )
      );

      const totalIncome = toNumber(dashboardData?.totalIncome);
      const totalExpenses = toNumber(dashboardData?.totalExpenses);
      const netIncome = toNumber(dashboardData?.netIncome ?? totalIncome - totalExpenses);

      // ---------- PDF ----------
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", compress: true });

      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const M = 48;

      // Colors / type
      const brandNavy = { r: 17, g: 24, b: 39 }; // dark navy
      const textPrimary = { r: 17, g: 24, b: 39 };
      const textMuted = { r: 100, g: 116, b: 139 };

      // Try load logo (optional)
      const tryLoadLogoBase64 = (): { data: string; fmt: "PNG" | "JPEG" } | null => {
        const cand = [
          process.env.REPORT_LOGO_PATH || "",
          "client/src/assets/clinic-logo.jpeg",
          "client/src/assets/clinic-logo.jpg",
          "client/src/assets/clinic-logo.png",
        ].filter(Boolean);

        for (const p of cand) {
          const abs = p.startsWith("/") ? p : join(process.cwd(), p);
          if (existsSync(abs)) {
            const buf = readFileSync(abs);
            const b64 = buf.toString("base64");
            const ext = abs.toLowerCase().endsWith(".png") ? "PNG" : "JPEG";
            return { data: `data:image/${ext.toLowerCase()};base64,${b64}`, fmt: ext as any };
          }
        }
        return null;
      };

      // Header (premium)
      const headerH = 84;
      doc.setFillColor(brandNavy.r, brandNavy.g, brandNavy.b);
      doc.rect(0, 0, pageW, headerH, "F");

      const logo = tryLoadLogoBase64();
      const logoH = 36;
      if (logo) {
        const logoW = logoH * 1.2;
        doc.addImage(logo.data, logo.fmt, M, 24, logoW, logoH);
      }

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      const titleX = logo ? M + 1.2 * logoH + 12 : M;
      doc.text("Bahr El Ghazal Clinic", titleX, 34);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.text("Monthly Financial Report", titleX, 54);

      // Period
      doc.setTextColor(textPrimary.r, textPrimary.g, textPrimary.b);
      doc.setFont("helvetica", "bold"); doc.setFontSize(16);
      doc.text(monthLabel(year, month), M, headerH + 36);

      // KPI cards (auto-fit)
      const fitFontSize = (text: string, maxWidth: number, maxSize: number, minSize = 14) => {
        let size = maxSize;
        doc.setFontSize(size);
        while (size > minSize && doc.getTextWidth(text) > maxWidth) {
          size -= 1; doc.setFontSize(size);
        }
        return size;
      };
      const drawCard = (x: number, y: number, w: number, h: number, label: string, value: string) => {
        const PADX = 16, PADY = 16;
        doc.setDrawColor(234);
        doc.setFillColor(249, 250, 251);
        doc.roundedRect(x, y, w, h, 10, 10, "FD");
        doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
        doc.setFont("helvetica", "bold"); doc.setFontSize(10);
        doc.text(label.toUpperCase(), x + PADX, y + PADY + 2);
        const maxTextWidth = w - PADX * 2;
        const size = fitFontSize(value, maxTextWidth, 24, 16);
        doc.setFont("helvetica", "bold"); doc.setFontSize(size);
        doc.setTextColor(textPrimary.r, textPrimary.g, textPrimary.b);
        doc.text(value, x + PADX, y + PADY + 28);
      };
      const cardsTop = headerH + 52, cardH = 68, gap = 14;
      const cardW = (pageW - M * 2 - gap * 2) / 3;
      drawCard(M + 0 * (cardW + gap), cardsTop, cardW, cardH, "Total Revenue",  `SSP ${fmt0(totalIncome)}`);
      drawCard(M + 1 * (cardW + gap), cardsTop, cardW, cardH, "Total Expenses", `SSP ${fmt0(totalExpenses)}`);
      drawCard(M + 2 * (cardW + gap), cardsTop, cardW, cardH, "Net Income",     `SSP ${fmt0(netIncome)}`);

      // Tables
      let y = cardsTop + cardH + 28;

      const ensurePage = (need = 160) => {
        if (y + need > pageH - 48) {
          doc.addPage(); y = 64;
          doc.setFont("helvetica", "bold"); doc.setFontSize(12);
          doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
          doc.text(monthLabel(year, month), M, y - 22);
          doc.setTextColor(textPrimary.r, textPrimary.g, textPrimary.b);
        }
      };

      const sectionTitle = (label: string) => {
        doc.setFont("helvetica", "bold"); doc.setFontSize(13);
        doc.text(label, M, y);
        y += 10;
        doc.setDrawColor(230); doc.line(M, y, pageW - M, y);
        y += 14;
      };

      type Row = [string, number];

      const drawTable = (
        title: string,
        rowsIn: Row[],
        currencyLabel = "SSP",
        targetTotal?: number
      ) => {
        // Copy to avoid side effects
        let rows = rowsIn.slice();

        if (!rows.length && !targetTotal) return;

        ensurePage(180);
        sectionTitle(title);

        const col1X = M, col2X = pageW - M;
        const headerH = 28, rowH = 24;

        // Optional balancing to match KPI totals — appended LAST (won't be sorted)
        const currentSum = rows.reduce((s, [, v]) => s + v, 0);
        if (typeof targetTotal === "number" && Number.isFinite(targetTotal)) {
          const diff = Math.round(targetTotal - currentSum);
          if (Math.abs(diff) >= 1) {
            rows.push(["Other / Adjustments", diff]);
          }
        }

        // Header
        doc.setFillColor(243, 244, 246);
        doc.rect(M, y, pageW - 2 * M, headerH, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(11);
        doc.setTextColor(55, 65, 81);
        doc.text("Line Item", col1X + 10, y + 18);
        doc.text(`Amount (${currencyLabel})`, col2X - 10, y + 18, { align: "right" });
        y += headerH;

        // Body
        doc.setFont("helvetica", "normal"); doc.setFontSize(11);
        let zebra = false;

        rows.forEach(([name, val], idx) => {
          ensurePage(rowH + 6);
          if (zebra) {
            doc.setFillColor(250, 250, 250);
            doc.rect(M, y, pageW - 2 * M, rowH, "F");
          }
          zebra = !zebra;

          doc.setTextColor(31, 41, 55);
          doc.text(String(name), col1X + 10, y + 15);

          doc.setFont("helvetica", "bold");
          doc.setTextColor(17, 24, 39);
          doc.text(fmt0(val), col2X - 10, y + 15, { align: "right" });
          doc.setFont("helvetica", "normal");
          y += rowH;
        });

        // Subtotal and spacing
        const finalTotal = rows.reduce((s, [, v]) => s + v, 0);
        doc.setDrawColor(230); doc.line(M, y, pageW - M, y);
        y += 8;
        doc.setFont("helvetica", "bold"); doc.setFontSize(11);
        doc.text("Total", col1X + 10, y + 16);
        doc.text(fmt0(finalTotal), col2X - 10, y + 16, { align: "right" });
        y += rowH + 18;       // clear gap so next section never collides
        ensurePage(24);
      };

      // >>> Sorted tables (highest -> lowest)
      drawTable("Revenue by Department (SSP)",  deptPairs, "SSP");
      drawTable("Insurance Payers (USD)",       insPairs,  "USD");
      drawTable("Operating Expenses",           expPairs,  "SSP", totalExpenses); // exact parity

      // Footer
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal"); doc.setFontSize(9);
        doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
        doc.text(`Page ${i} of ${totalPages}`, pageW - M, pageH - 20, { align: "right" });
      }

      const monthName = new Date(year, month - 1).toLocaleDateString("en-US", { month: "long" });
      const filename = `Bahr_El_Ghazal_${monthName}_${year}_Report.pdf`;
      const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", String(pdfBuffer.length));
      return res.status(200).send(pdfBuffer);
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
      const validatedData = insertReceiptSchema.parse({
        ...req.body,
        uploadedBy: req.user!.id,
      });
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
      const objectFile = await objectStorageService.getObjectEntityFile(
        `/objects/${req.params.receiptPath}`
      );
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
      const validated = insertPatientVolumeSchema.parse({
        ...req.body,
        recordedBy: req.user?.id,
      });
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
            const mv = await storage.getPatientVolumeForMonth(
              d.getFullYear(),
              d.getMonth() + 1
            );
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
          const s =
            parseYMD(req.query.startDate as string) ||
            new Date(Date.UTC(year, month - 1, 1));
          const e =
            parseYMD(req.query.endDate as string) ||
            new Date(Date.UTC(year, month, 1));
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

  app.delete("/api/patient-volume/:id", requireAuth, async (_req, res) => {
    try {
      const { id } = _req.params;
      await storage.deletePatientVolume(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting patient volume:", error);
      res.status(500).json({ error: "Failed to delete patient volume record" });
    }
  });
}
