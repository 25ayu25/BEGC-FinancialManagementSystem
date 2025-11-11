import type { Express, Request, Response } from "express";
import { Database } from "sqlite3";
import path from "path";

/**
 * Robust monthly insurance totals that work across slightly different schemas.
 *
 * Insurance row detection (any is enough):
 *  - insurance_provider IS NOT NULL
 *  - is_insurance = 1
 *  - type = 'insurance'
 *
 * USD value detection (first non-null wins):
 *  - amount_usd
 *  - insurance_usd
 *  - CASE WHEN currency='USD' THEN amount ELSE 0 END
 */

function openDb(): Database {
  // Adjust if your DB lives elsewhere; this matches your project defaults.
  const dbPath = process.env.DB_PATH || path.join(process.cwd(), "server", "storage.db");
  return new Database(dbPath);
}

function firstOfMonthUTC(y: number, m: number) {
  return new Date(Date.UTC(y, m - 1, 1));
}
function nextMonthUTC(y: number, m: number) {
  return new Date(Date.UTC(y, m, 1));
}
function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function monthsBetween(start: Date, end: Date) {
  const out: Array<{ y: number; m: number }> = [];
  const s = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const e = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  for (
    let d = s;
    d < e;
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
  ) {
    out.push({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 });
  }
  return out;
}

function monthLabel(y: number, m: number) {
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "short" });
}

export function registerInsuranceMonthly(app: Express) {
  app.get("/api/insurance/monthly", async (req: Request, res: Response) => {
    try {
      // inputs: range (current-month | last-month | last-3-months | year | custom)
      const range = String(req.query.range || "current-month");
      const year = parseInt(String(req.query.year || new Date().getUTCFullYear()));
      const month = parseInt(String(req.query.month || new Date().getUTCMonth() + 1));

      let start: Date;
      let end: Date;

      if (range === "year") {
        start = new Date(Date.UTC(year, 0, 1));
        end = new Date(Date.UTC(year + 1, 0, 1)); // First day of next year
      } else if (range === "last-3-months") {
        const now = new Date();
        const endD = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)); // First day of next month
        start = new Date(Date.UTC(endD.getUTCFullYear(), endD.getUTCMonth() - 3, 1));
        end = endD;
      } else if (range === "last-month") {
        const now = new Date();
        const lm = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
        start = lm;
        end = new Date(Date.UTC(lm.getUTCFullYear(), lm.getUTCMonth() + 1, 1)); // First day of month after last month
      } else if (range === "current-month") {
        start = firstOfMonthUTC(year, month);
        end = nextMonthUTC(year, month); // First day of next month
      } else {
        // custom
        const sd = String(req.query.startDate);
        const ed = String(req.query.endDate);
        start = new Date(sd);
        end = new Date(ed);
      }

      const db = openDb();

      // Group by ym using tolerant USD + insurance filters.
      const SQL = `
        SELECT
          strftime('%Y-%m', date) AS ym,
          SUM(
            COALESCE(
              amount_usd,
              insurance_usd,
              CASE WHEN currency = 'USD' THEN amount ELSE 0 END
            )
          ) AS usd
        FROM transactions
        WHERE date >= ? AND date < ?
          AND (
            insurance_provider IS NOT NULL
            OR (typeof is_insurance != 'null' AND is_insurance = 1)
            OR (typeof type != 'null' AND lower(type) = 'insurance')
          )
        GROUP BY ym
        ORDER BY ym
      `;

      // We aggregate across the full span (start -> end of last month in range).
      const allMonths = monthsBetween(start, end);
      const sISO = isoDate(firstOfMonthUTC(allMonths[0].y, allMonths[0].m));
      const eISO = isoDate(nextMonthUTC(allMonths[allMonths.length - 1].y, allMonths[allMonths.length - 1].m));

      const raw: Record<string, number> = await new Promise((resolve) => {
        const out: Record<string, number> = {};
        db.all(SQL, [sISO, eISO], (err: any, rows: Array<{ ym: string; usd: number }>) => {
          if (err) {
            // If the table/columns don’t exist, return empty result gracefully.
            console.error("insurance-monthly SQL error:", err?.message || err);
            resolve({});
            return;
          }
          for (const r of rows || []) {
            out[r.ym] = Number(r.usd || 0);
          }
          resolve(out);
        });
      });

      db.close();

      // Normalize into full month list with zeros for missing months
      const data = allMonths.map(({ y, m }) => {
        const ym = `${y}-${String(m).padStart(2, "0")}`;
        const usd = Math.round(Number(raw[ym] || 0));
        return { month: monthLabel(y, m), year: y, usd };
      });

      res.json({ data });
    } catch (e: any) {
      console.error("monthly insurance error", e);
      res.status(200).json({ data: [] }); // never break the page
    }
  });
}
