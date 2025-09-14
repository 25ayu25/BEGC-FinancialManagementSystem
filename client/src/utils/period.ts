export type Preset =
  | "current-month"
  | "last-month"
  | "last-3-months"
  | "last-12-months"
  | "year"
  | "month-select"
  | "custom";

const toISO = (dt: Date) => dt.toISOString().slice(0, 10); // yyyy-mm-dd

export function computeWindow(
  preset: Preset,
  opts: { year?: number; month?: number; start?: Date; end?: Date } = {}
): { from: string; to: string } {
  const now = new Date();

  if (preset === "current-month") {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: toISO(s), to: toISO(e) };
  }
  if (preset === "last-month") {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const e = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: toISO(s), to: toISO(e) };
  }
  if (preset === "last-3-months") {
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const s = new Date(e.getFullYear(), e.getMonth() - 2, 1);
    return { from: toISO(s), to: toISO(e) };
  }
  if (preset === "last-12-months") {
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const s = new Date(e.getFullYear(), e.getMonth() - 11, 1);
    return { from: toISO(s), to: toISO(e) };
  }
  if (preset === "year") {
    const y = opts.year ?? now.getFullYear();
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
  if (preset === "month-select" && opts.year && opts.month) {
    const s = new Date(opts.year, opts.month - 1, 1);
    const e = new Date(opts.year, opts.month, 0);
    return { from: toISO(s), to: toISO(e) };
  }
  // custom
  const s = opts.start ?? now;
  const e = opts.end ?? now;
  return { from: toISO(s), to: toISO(e) };
}

export function monthPairs(fromISO: string, toISO: string) {
  const start = new Date(fromISO);
  const end = new Date(toISO);
  const out: Array<{ y: number; m: number; label: string }> = [];
  const monthShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  let y = start.getFullYear();
  let m = start.getMonth() + 1;
  const yEnd = end.getFullYear();
  const mEnd = end.getMonth() + 1;

  while (y < yEnd || (y === yEnd && m <= mEnd)) {
    out.push({ y, m, label: monthShort[m - 1] });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}
