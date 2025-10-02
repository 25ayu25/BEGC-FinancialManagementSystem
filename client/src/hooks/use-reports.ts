import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function useReports(limit?: number) {
  const queryParams = limit ? `?limit=${limit}` : '';
  return useQuery({
    queryKey: ["/api/reports", queryParams],
  });
}

export function useMonthlyReport(year: number, month: number) {
  return useQuery({
    queryKey: ["/api/reports", year, month],
  });
}

export function useGenerateReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ year, month }: { year: number; month: number }) => {
      return await apiRequest("POST", `/api/reports/${year}/${month}/generate`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
    },
  });
}
