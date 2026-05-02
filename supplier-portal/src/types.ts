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
    deadline: string;
    buyer_company: string;
    requirements: Record<string, unknown>;
  };
  form_fields: FormFieldDefinition[];
  answered_questions: Array<{
    question: string;
    answer: string;
    answered_at: string;
  }>;
  already_submitted: boolean;
}

export interface SubmitResponseResult {
  status: string;
  message: string;
}
