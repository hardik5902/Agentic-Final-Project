import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import { AnalysisResult, MemoResponse } from "../types";

export function useAnalysisResults(rfqId?: string) {
  return useQuery({
    queryKey: ["analysis-results", rfqId],
    enabled: Boolean(rfqId),
    queryFn: async () => {
      const { data } = await api.get<AnalysisResult>(`/api/analysis/${rfqId}/results`);
      return data;
    },
  });
}

export function useNormalize(rfqId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/api/analysis/${rfqId}/normalize`);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["analysis-results", rfqId] });
    },
  });
}

export function useRateAnalysis(rfqId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ratings: Record<string, Record<string, number>>) => {
      const { data } = await api.post(`/api/analysis/${rfqId}/rate`, { ratings });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["analysis-results", rfqId] });
    },
  });
}

export function useScoreAnalysis(rfqId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/api/analysis/${rfqId}/score`);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["analysis-results", rfqId] });
    },
  });
}

export function useMemo(rfqId?: string) {
  return useQuery({
    queryKey: ["memo", rfqId],
    enabled: Boolean(rfqId),
    queryFn: async () => {
      const { data } = await api.get<MemoResponse>(`/api/analysis/${rfqId}/memo`);
      return data;
    },
  });
}

export function useGenerateMemo(rfqId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/api/analysis/${rfqId}/memo`);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["memo", rfqId] });
    },
  });
}
