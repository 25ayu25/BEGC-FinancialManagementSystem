import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/queryClient";

/**
 * All report endpoints live under /api/reports on your server.
 * We keep the paths here so the page stays clean.
 */
const PATH = {
  list: (y: number, m: number) => `/api/reports?year=${y}&month=${m}`, // GET
  generate: `/api/reports/generate`,                                    // POST {year,month}
  del: (id: string) => `/api/reports/${id}`,                            // DELETE
  pdf: (id: string) => `/api/reports/${id}/pdf`,                        // GET (blob)
};

export type MonthlyReport = {
  id: string;
  year: number;
  month: number; // 1-12
  status: "draft" | "approved" | "locked";
  createdAt: string;
  updatedAt: string;
  // Optional server extras
  netIncomeSSP?: number;
  totalIncomeSSP?: number;
  totalExpensesSSP?: number;
  totalInsuranceUSD?: number;
};

export function useReports(year: number, month: number) {
  const qc = useQueryClient();

  // ----- List reports -----
  const listQuery = useQuery({
    queryKey: ["reports", year, month],
    queryFn: async (): Promise<MonthlyReport[]> => {
      // always hit /api version
      const { data } = await api.get(PATH.list(year, month));
      // server may return {reports: []} or the array directly
      return Array.isArray(data) ? data : data?.reports ?? [];
    },
    enabled: Number.isFinite(year) && Number.isFinite(month) && month >= 1 && month <= 12,
  });

  // ----- Generate report -----
  const generateMutation = useMutation({
    mutationFn: async (vars?: { year?: number; month?: number }) => {
      const y = vars?.year ?? year;
      const m = vars?.month ?? month;
      const { data } = await api.post(PATH.generate, { year: y, month: m });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports", year, month] });
    },
  });

  // ----- Delete report -----
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(PATH.del(id));
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports", year, month] });
    },
  });

  // ----- Download PDF (returns a Blob URL) -----
  const downloadPdf = async (id: string) => {
    const res = await api.get(PATH.pdf(id), {
      responseType: "blob",
      headers: { Accept: "application/pdf" },
    });
    const blob = new Blob([res.data], { type: "application/pdf" });
    return URL.createObjectURL(blob);
  };

  return {
    listQuery,
    generate: generateMutation.mutateAsync,
    isGenerating: generateMutation.isPending,
    remove: deleteMutation.mutateAsync,
    isRemoving: deleteMutation.isPending,
    downloadPdf,
  };
}
