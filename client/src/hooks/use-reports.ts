import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/queryClient";

const PATH = {
  list: (y: number, m: number) => `/api/reports?year=${y}&month=${m}`,
  generate: `/api/reports/generate`,
  del: (id: string) => `/api/reports/${id}`,
  pdf: (id: string) => `/api/reports/${id}/pdf`,
};

export type MonthlyReport = {
  id: string;
  year: number;
  month: number;
  status: "draft" | "approved" | "locked";
  createdAt: string;
  updatedAt: string;
  netIncomeSSP?: number;
  totalIncomeSSP?: number;
  totalExpensesSSP?: number;
  totalInsuranceUSD?: number;
};

export function useReports(year: number, month: number) {
  const qc = useQueryClient();

  const listQuery = useQuery({
    queryKey: ["reports", year, month],
    queryFn: async () => {
      const { data } = await api.get(PATH.list(year, month));
      return Array.isArray(data) ? data : data?.reports ?? [];
    },
    enabled: Number.isFinite(year) && month >= 1 && month <= 12,
  });

  const generate = useMutation({
    mutationFn: async (vars?: { year?: number; month?: number }) => {
      const y = vars?.year ?? year;
      const m = vars?.month ?? month;
      const { data } = await api.post(PATH.generate, { year: y, month: m });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports", year, month] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(PATH.del(id));
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports", year, month] }),
  });

  const downloadPdf = async (id: string) => {
    const res = await api.get(PATH.pdf(id), {
      responseType: "blob",
      headers: { Accept: "application/pdf" },
    });
    return URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  };

  return {
    listQuery,
    generate: generate.mutateAsync,
    isGenerating: generate.isPending,
    remove: remove.mutateAsync,
    isRemoving: remove.isPending,
    downloadPdf,
  };
}
