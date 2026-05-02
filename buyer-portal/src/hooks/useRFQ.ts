import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import {
  AnswerQuestionPayload,
  ApproveRFQPayload,
  MessageResponse,
  RFQDetailRecord,
  RFQListResponse,
  StartRFQResponse,
} from "../types";

export function useRFQList() {
  return useQuery({
    queryKey: ["rfq-list"],
    queryFn: async () => {
      const { data } = await api.get<RFQListResponse>("/api/rfq/list");
      return data;
    },
  });
}

export function useRFQDetail(rfqId?: string) {
  return useQuery({
    queryKey: ["rfq-detail", rfqId],
    enabled: Boolean(rfqId),
    queryFn: async () => {
      const { data } = await api.get<RFQDetailRecord>(`/api/rfq/${rfqId}`);
      return data;
    },
  });
}

export function useStartRFQ() {
  return useMutation({
    mutationFn: async (description: string) => {
      const { data } = await api.post<StartRFQResponse>("/api/rfq/start", {
        description,
      });
      return data;
    },
  });
}

export function useSendRFQMessage(rfqId?: string) {
  return useMutation({
    mutationFn: async (message: string) => {
      const { data } = await api.post<MessageResponse>(`/api/rfq/${rfqId}/message`, {
        message,
      });
      return data;
    },
  });
}

export function useApproveRFQ(rfqId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ApproveRFQPayload) => {
      const { data } = await api.post(`/api/rfq/${rfqId}/approve`, payload);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rfq-list"] });
      void queryClient.invalidateQueries({ queryKey: ["rfq-detail", rfqId] });
    },
  });
}

export function useCloseRFQ(rfqId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data } = await api.put(`/api/rfq/${rfqId}/close`);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rfq-list"] });
      void queryClient.invalidateQueries({ queryKey: ["rfq-detail", rfqId] });
    },
  });
}

export function useAnswerSupplierQuestion(rfqId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      questionId,
      payload,
    }: {
      questionId: string;
      payload: AnswerQuestionPayload;
    }) => {
      const { data } = await api.post(
        `/api/rfq/${rfqId}/questions/${questionId}/answer`,
        payload,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rfq-detail", rfqId] });
    },
  });
}
