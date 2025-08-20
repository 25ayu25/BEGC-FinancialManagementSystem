// client/src/lib/supabaseQueries.ts
import { supabase } from "./supabase";

// ===== Types used by the UI =====
export type Currency = "SSP" | "USD";
export type TxType = "income" | "expense";

export type NewTransaction = {
  type: TxType;
  // the form usually provides ONE "amount" plus a "currency"
  amount?: number | string;
  currency?: Currency;

  // some forms may already provide split amounts – we support both
  amount_ssp?: number | string | null;
  amount_usd?: number | string | null;

  description: string;
  department_id?: string | null;
  insurance_provider_id?: string | null;
  patient_name?: string | null;
  receipt_number?: string | null;
  payment_method: "cash" | "card" | "check" | "insurance" | "bank_transfer";
  created_by?: string | null;
};

export type UpdateTransaction = Partial<NewTransaction>;

// ---------- helpers ----------
const toNum = (v: unknown) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return isFinite(n) ? n : 0;
};

/**
 * Ensure both amount_ssp and amount_usd are populated consistently,
 * regardless of what the form sent.
 */
function buildAmounts(input: NewTransaction) {
  let ssp = toNum(input.amount_ssp);
  let usd = toNum(input.amount_usd);

  // if split amounts were not provided, map single amount+currency
  if (ssp === 0 && usd === 0 && input.amount !== undefined) {
    const amt = toNum(input.amount);
    if ((input.currency || "SSP") === "USD") usd = amt;
    else ssp = amt; // default SSP
  }

  return { amount_ssp: ssp, amount_usd: usd };
}

/** Normalize rows we read back (fallback to legacy amount/currency) */
function normalizeRow<T extends Record<string, any>>(t: T) {
  const ssp = t.amount_ssp ?? (t.currency === "SSP" ? toNum(t.amount) : 0);
  const usd = t.amount_usd ?? (t.currency === "USD" ? toNum(t.amount) : 0);
  return { ...t, amount_ssp: toNum(ssp), amount_usd: toNum(usd) };
}

// ---------- Transactions ----------
export const supabaseTransactions = {
  async getAll() {
    const { data, error } = await supabase
      .from("transactions")
      .select(`*, departments (name), insurance_providers (name)`)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []).map(normalizeRow);
  },

  async create(tx: NewTransaction) {
    const amounts = buildAmounts(tx);

    const payload = {
      type: tx.type,
      description: tx.description,
      department_id: tx.department_id ?? null,
      insurance_provider_id: tx.insurance_provider_id ?? null,
      patient_name: tx.patient_name ?? null,
      receipt_number: tx.receipt_number ?? null,
      payment_method: tx.payment_method,
      currency: tx.currency ?? "SSP",
      created_by: tx.created_by ?? null,
      // write BOTH columns consistently
      amount_ssp: amounts.amount_ssp,
      amount_usd: amounts.amount_usd,
      // keep legacy fields if they exist – harmless, ignored by UI
      amount: tx.amount ?? null,
    };

    const { data, error } = await supabase
      .from("transactions")
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return normalizeRow(data);
  },

  async update(id: string, updates: UpdateTransaction) {
    const amounts = buildAmounts(updates);

    const payload = {
      ...updates,
      amount_ssp: amounts.amount_ssp,
      amount_usd: amounts.amount_usd,
    };

    const { data, error } = await supabase
      .from("transactions")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return normalizeRow(data);
  },

  async delete(id: string) {
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};

// ---------- Reference data ----------
export const supabaseDepartments = {
  async getAll() {
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
};

export const supabaseInsurance = {
  async getAll() {
    const { data, error } = await supabase
      .from("insurance_providers")
      .select("*")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
};

// ---------- Dashboard helpers ----------
export const supabaseDashboard = {
  async getMonthlyData(year: number, month: number) {
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const end =
      month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .gte("created_at", start)
      .lt("created_at", end);

    if (error) throw new Error(error.message);
    const rows = (data ?? []).map(normalizeRow);

    const totalIncome = rows
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + toNum(t.amount_ssp), 0);

    const totalExpense = rows
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + toNum(t.amount_ssp), 0);

    const insuranceRevenue = rows
      .filter((t) => t.type === "income" && t.insurance_provider_id)
      .reduce((s, t) => s + toNum(t.amount_usd), 0);

    const providers = new Set(
      rows
        .filter((t) => t.insurance_provider_id)
        .map((t) => t.insurance_provider_id),
    ).size;

    return {
      totals: {
        totalIncome: totalIncome.toFixed(2),
        totalExpense: totalExpense.toFixed(2),
        netIncome: (totalIncome - totalExpense).toFixed(2),
        insuranceRevenue: insuranceRevenue.toFixed(2),
        insuranceProviders: providers,
        transactionCount: rows.length,
      },
      transactions: rows,
    };
  },

  async getIncomeTrends(year: number, month: number) {
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const end =
      month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    const { data, error } = await supabase
      .from("transactions")
      .select("created_at, amount_ssp, amount, currency, type, amount_usd")
      .gte("created_at", start)
      .lt("created_at", end)
      .eq("type", "income");

    if (error) throw new Error(error.message);
    const rows = (data ?? []).map(normalizeRow);

    const daily: Record<string, number> = {};
    rows.forEach((t) => {
      const d = new Date(t.created_at).getDate();
      const key = `${new Date(start).toLocaleString("en", { month: "short" })} ${d}`;
      daily[key] = (daily[key] || 0) + toNum(t.amount_ssp);
    });

    return Object.entries(daily).map(([date, income]) => ({
      date,
      income,
      income_usd: income / 1300,
    }));
  },
};
