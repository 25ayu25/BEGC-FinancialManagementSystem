// client/src/lib/supabaseViews.ts
import { supabase } from "./supabase";

/** Totals for the current month from the view v_totals_current_month */
export async function getTotalsCurrentMonth() {
  const { data, error } = await supabase
    .from("v_totals_current_month")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return (
    data ?? {
      total_income: 0,
      total_expense: 0,
      net_income: 0,
      transactions_count: 0,
      month_start: null,
    }
  );
}

/** Department totals from v_dept_totals_current_month */
export async function getDeptTotalsCurrentMonth() {
  const { data, error } = await supabase
    .from("v_dept_totals_current_month")
    .select("department,income,expense")
    .order("income", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Insurance totals from v_insurance_totals_current_month */
export async function getInsuranceTotalsCurrentMonth() {
  const { data, error } = await supabase
    .from("v_insurance_totals_current_month")
    .select("insurance,income")
    .order("income", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
