import type { Express, Request, Response } from "express";
import { Database } from "sqlite3";
import path from "path";

/**
 * This file is intentionally defensive because I don’t know your exact schema.
 * It tries several reasonable column names/filters to compute “insurance USD”
 * and uses whichever one your DB supports (the others will be skipped).
 *
 * If you already know your exact table/column names, you can replace the
 * CANDIDATE_SQL array below with a single, precise query.
 */

// ---- open the same SQLite DB your app already uses ----
function openDb(): Database {
  // adjust to match your current db location if different
  const dbPath = process.env.DB_PATH || path.join(process.cwd(), "server", "storage.db");
  const db = new Database(dbPath);
  return db;
}

// candidates we’ll try in order (first one that runs without “no such column” will be used)
const CANDIDATE_SQL = [
  // 1) Common: transactions table with explicit insurance USD column
  `SELECT COALESCE(SUM(insurance_usd), 0) AS usd
     FROM transactions
    WHERE date >= ? AND date < ?`,

  // 2) If amounts are stored as USD in "amount_usd" and insurance rows are flagged
  `SELECT COALESCE(SUM(amount_usd), 0) AS usd
     FROM transactions
    WHERE is_insurance = 1 AND date >= ? AND date < ?`,

  // 3) If currency in USD and there is a provider set (means it’s insurance)
  `SELECT COALESCE(SUM(amount), 0) AS usd
     FROM transactions
    WHERE currency = 'USD' AND insurance_provider IS NOT NULL
      AND date >= ? AND date < ?`,

  // 4) If type column is used to distinguish insurance
  `SELECT COALESCE(SUM(amount), 0) AS usd
     FROM transactions
    WHERE type = 'insurance' AND currency = 'USD'
      AND date >= ? AND date < ?`,
];

// run first candidate query that works on the DB
function pickQuery(db: Database): Promise<string> {
  return new Promise((resolve) => {
    const tryNext = (i: number) => {
      if (i >= CANDIDATE_SQL.length) return resolve(CANDIDATE_SQL[0]); // fallback
      const sql = CANDIDATE_SQL[i];
      db.get(`SELECT 1 FROM sqlite_master`, [], (err) => {
        // do a quick prepare by running the query with a tiny date window
        db.get(sql, ["1970-01-01", "1970-01-02"], (err2) => {
          if (!err2) return resolve(sql);
          // if it’s a column error, try next candidate
          return tryNext(i + 1);
        });
      });
    };
    tryNext(0);
  });
}

function firstDay(y: number, m: number) {
  return new Date(Date.UTC(y, m - 1, 1));
}
function nextMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 1));
}
function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Build array of {year, month} between two dates inclusive
function monthsBetween(start: Date, end: Date) {
  const list: Array<{ y: number; m: number }> = [];
  const s = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const e = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  for (let d = s; d <= e; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    list.push({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 });
  }
  return list;
}

export function registerInsuranceMonthly(app: Express) {
  app.get("/api/insurance/monthly", async (req: Request, res: Response) => {
    try {
      // inputs: either explicit start/end OR a quick “range” helper
      // range: "current-month" | "last-month" | "last-3-months" | "year" | "custom"
      const range = String(req.query.range || "current-month");
      const year = parseInt(String(req.query.year || new Date().getUTCFullYear()));
      const month = parseInt(String(req.query.month || new Date().getUTCMonth() + 1));

      let start: Date;
      let end: Date;

      if (range === "year") {
        start = new Date(Date.UTC(year, 0, 1));
        end = new Date(Date.UTC(year, 11, 1));
      } else if (range === "last-3-months") {
        const now = new Date();
        const endD = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        start = new Date(Date.UTC(endD.getUTCFullYear(), endD.getUTCMonth() - 2, 1));
        end = endD;
      } else if (range === "last-month") {
        const now = new Date();
        const lm = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
        start = lm;
        end = lm;
      } else if (range === "current-month") {
        start = firstDay(year, month);
        end = firstDay(year, month);
      } else {
        // custom: expect startDate & endDate (yyyy-mm-dd)
        const sd = String(req.query.startDate);
        const ed = String(req.query.endDate);
        start = new Date(sd);
        end = new Date(ed);
      }

      const db = openDb();
      const sql = await pickQuery(db);

      const months = monthsBetween(start, end);
      const rows: Array<{ month: string; year: number; usd: number }> = [];

      const monthName = (y: number, m: number) =>
        new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "short" });

      const run = (s: string, e: string) =>
        new Promise<number>((resolve) => {
          db.get(sql, [s, e], (err: any, row: any) => {
            if (err) return resolve(0);
            resolve(Number(row?.usd || 0));
          });
        });

      for (const { y, m } of months) {
        const sIso = toISO(firstDay(y, m));
        const eIso = toISO(nextMonth(y, m));
        const usd = await run(sIso, eIso);
        rows.push({ month: monthName(y, m), year: y, usd: Math.round(usd) });
      }

      db.close();
      res.json({ data: rows });
    } catch (e: any) {
      console.error("monthly insurance error", e);
      res.status(500).json({ message: "Failed to compute monthly insurance totals" });
    }
  });
}
