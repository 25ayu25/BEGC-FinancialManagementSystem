import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function useTransactions(filters?: {
  startDate?: Date;
  endDate?: Date;
  departmentId?: string;
  type?: string;
  limit?: number;
}) {
  const queryParams = new URLSearchParams();
  if (filters?.startDate) queryParams.set('startDate', filters.startDate.toISOString());
  if (filters?.endDate) queryParams.set('endDate', filters.endDate.toISOString());
  if (filters?.departmentId) queryParams.set('departmentId', filters.departmentId);
  if (filters?.type) queryParams.set('type', filters.type);
  if (filters?.limit) queryParams.set('limit', filters.limit.toString());

  const queryString = queryParams.toString();
  const queryKey = queryString 
    ? ["/api/transactions", queryString]
    : ["/api/transactions"];

  return useQuery({
    queryKey,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/transactions", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
  });
}
