import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import { Supplier, SupplierListResponse } from "../types";

export function useSuppliers(search?: string) {
  return useQuery({
    queryKey: ["suppliers", search ?? ""],
    queryFn: async () => {
      const { data } = await api.get<SupplierListResponse>("/api/suppliers", {
        params: search ? { search } : undefined,
      });
      return data;
    },
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Partial<Supplier>) => {
      const { data } = await api.post<Supplier>("/api/suppliers", payload);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
  });
}
