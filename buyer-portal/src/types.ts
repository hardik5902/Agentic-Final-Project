export type RFQStatus = "draft" | "collecting" | "active" | "closed" | "awarded";

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  org_id?: string;
  org_name?: string;
  subscription_tier?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user?: User;
}

export interface RFQListItem {
  id: string;
  title: string;
  category: string;
  status: RFQStatus;
  deadline: string | null;
  response_count: number;
  invited_count: number;
  created_at: string;
}

export interface RFQListResponse {
  items: RFQListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface Criterion {
  name: string;
  label: string;
  weight: number;
  type: "buyer_rated" | "calculated";
}

export interface Invitation {
  id: string;
  supplier_id: string;
  supplier_name: string;
  supplier_email: string;
  status: string;
  email_sent_at?: string | null;
  responded_at?: string | null;
}

export interface RFQQuestion {
  id: string;
  question: string;
  answer: string | null;
  asked_at: string;
  answered_at?: string | null;
  is_shared_with_all?: boolean;
}

export interface RFQDetailRecord {
  id: string;
  title: string;
  category: string;
  status: RFQStatus;
  deadline: string | null;
  requirements: Record<string, unknown>;
  criteria: Criterion[];
  rfq_document: string;
  rfq_document_pdf_url?: string | null;
  invitations: Invitation[];
  response_count: number;
  questions: RFQQuestion[];
}

export interface Supplier {
  id: string;
  name: string;
  email: string;
  website?: string | null;
  country?: string | null;
  categories: string[];
  response_rate: number;
  total_invitations?: number;
  total_responses?: number;
  last_responded_at?: string | null;
  notes?: string | null;
}

export interface SupplierListResponse {
  items: Supplier[];
  total: number;
}

export interface StartRFQResponse {
  rfq_id: string;
  question: string;
  status: string;
}

export interface MessageResponse {
  status: string;
  question: string | null;
  rfq_document: string | null;
  contradiction_warning?: string | null;
  category_suggestion?: string | null;
}

export interface SupplierSuggestion {
  supplier_id: string;
  fit_score: number;
  fit_reasoning: string;
  batch: number;
  recommended: boolean;
}

export interface ResponseEvaluation {
  supplier_name: string;
  ambiguous_fields: string[];
  missing_evidence: string[];
  clarification_questions: string[];
  compliance_failures: string[];
  strategic_concerns: string[];
  evaluation_summary: string;
}

export interface AnswerQuestionPayload {
  answer: string;
}

export interface ApproveRFQPayload {
  supplier_ids: string[];
  deadline_days: number;
  criteria: Criterion[];
}

export interface AnalysisSupplier {
  supplier_name: string;
  supplier_id?: string;
  response_id?: string;
  normalized_data?: Record<string, number | string | boolean | null>;
  flags?: string[];
  score?: number | null;
  buyer_ratings?: Record<string, number>;
  score_breakdown?: Record<
    string,
    { raw_score: number; weight: number; weighted_score: number }
  >;
}

export interface AnalysisResult {
  qualifying: AnalysisSupplier[];
  eliminated: Array<{
    supplier_name: string;
    reason?: string;
    elimination_reason?: string;
  }>;
  criteria: Criterion[];
}

export interface AnalysisResponseDetail {
  response_id: string;
  supplier_name: string;
  raw_data: Record<string, unknown>;
  normalized_data: Record<string, unknown>;
  attachment_urls: string[];
  score?: number | null;
  score_breakdown?: Record<
    string,
    { raw_score: number; weight: number; weighted_score: number }
  >;
  flags: Array<string | Record<string, unknown>>;
}

export interface MemoResponse {
  memo_text: string;
  memo_pdf_signed_url?: string | null;
  memo_pdf_url?: string | null;
}
