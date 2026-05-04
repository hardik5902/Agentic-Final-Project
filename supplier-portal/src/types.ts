export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "dropdown"
  | "url_list"
  | "file_upload"
  | "boolean";

export interface FormFieldDefinition {
  field_id: string;
  label: string;
  type: FieldType;
  required: boolean;
  hint?: string | null;
  options?: string[];
}

export interface SupplierPortalPayload {
  rfq: {
    title: string;
    rfq_document: string;
    deadline: string | null;
    buyer_company: string | null;
    requirements: Record<string, unknown>;
  };
  form_fields: FormFieldDefinition[];
  answered_questions: Array<{
    question: string;
    answer: string;
    answered_at: string;
  }>;
  my_questions: Array<{
    question: string;
    answer: string | null;
    answered_at: string | null;
    asked_at: string;
  }>;
  already_submitted: boolean;
  rfq_status: string;
  submitted_data: Record<string, unknown> | null;
}

export interface SubmitResponseResult {
  status: string;
  message: string;
}

export interface SupplierPortalInboxItem {
  invitation_token: string;
  rfq_id: string;
  rfq_title: string | null;
  buyer_company: string | null;
  category: string | null;
  deadline: string | null;
  rfq_status: string;
  invitation_status: string;
  already_submitted: boolean;
  is_closed: boolean;
  can_open: boolean;
  can_edit: boolean;
  responded_at?: string | null;
  updated_at?: string | null;
  created_at: string;
}

export interface SupplierPortalInboxPayload {
  supplier_name: string;
  supplier_email: string;
  invitations: SupplierPortalInboxItem[];
}
