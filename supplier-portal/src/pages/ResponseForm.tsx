import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PortalFrame from "../components/PortalFrame";
import FormField from "../components/FormField";
import QuestionBox from "../components/QuestionBox";
import RFQViewer from "../components/RFQViewer";
import api from "../lib/api";
import { rememberPortalToken } from "../lib/session";
import { requiredRemaining } from "../lib/utils";
import { FormFieldDefinition, SubmitResponseResult, SupplierPortalPayload } from "../types";

export default function ResponseForm() {
  const { portalToken, inviteToken } = useParams();
  const navigate = useNavigate();
  const [payload, setPayload] = useState<SupplierPortalPayload | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [asking, setAsking] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  useEffect(() => {
    if (!portalToken || !inviteToken) {
      navigate("/invalid", { replace: true });
      return;
    }

    rememberPortalToken(portalToken);

    async function load() {
      try {
        const { data } = await api.get<SupplierPortalPayload>(`/api/response/${inviteToken}`);
        setPayload(data);
        if (data.already_submitted && data.submitted_data) {
          setValues(mergeWithDefaults(data.form_fields, data.submitted_data));
        } else {
          setValues(buildInitialValues(data.form_fields));
        }
      } catch {
        navigate("/invalid", { replace: true });
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [inviteToken, navigate, portalToken]);

  const remaining = useMemo(
    () => requiredRemaining(payload?.form_fields ?? [], values),
    [payload?.form_fields, values],
  );

  const rfqClosed = payload?.rfq_status === "closed" || payload?.rfq_status === "awarded";

  const handleFieldChange = (fieldId: string, value: unknown) => {
    setValues((current) => ({ ...current, [fieldId]: value }));
  };

  const handleSubmit = async () => {
    if (!payload || !inviteToken) return;
    if (requiredRemaining(payload.form_fields, values) > 0) {
      setError("Please complete all required fields before submitting.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const responseData = serializeValues(values);
      const { data } = await api.post<SubmitResponseResult>(
        `/api/response/${inviteToken}`,
        {
          data: responseData,
          attachment_gcs_paths: [],
        },
      );
      navigate("/confirmation", {
        state: {
          summary: buildConfirmationSummary(payload.form_fields, responseData),
          message: data.message,
          portalToken,
        },
      });
    } catch {
      setError("Submission failed. Review the form and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!payload || !inviteToken) return;
    if (requiredRemaining(payload.form_fields, values) > 0) {
      setError("Please complete all required fields before updating.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setUpdateSuccess(false);

    try {
      const responseData = serializeValues(values);
      await api.put<SubmitResponseResult>(`/api/response/${inviteToken}`, {
        data: responseData,
        attachment_gcs_paths: [],
      });
      setUpdateSuccess(true);
    } catch {
      setError("Update failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!question.trim() || !inviteToken) return;
    setAsking(true);
    try {
      await api.post(`/api/response/${inviteToken}/question`, {
        question,
      });
      setQuestion("");
    } catch {
      setError("Unable to send your question right now.");
    } finally {
      setAsking(false);
    }
  };

  if (loading) {
    return (
      <PortalFrame
        title="Loading supplier response form"
        subtitle="Please wait while we validate your invitation."
      >
        <div className="h-80 animate-pulse rounded-[28px] border border-slate-200 bg-white/70" />
      </PortalFrame>
    );
  }

  if (!payload || !portalToken) return null;

  return (
    <PortalFrame
      title={payload.rfq.title}
      subtitle={
        payload.already_submitted
          ? rfqClosed
            ? "This RFQ is now closed. Your submitted response is shown below for reference."
            : "Your response has been submitted. You can review and update it below until the RFQ closes."
          : "Review the request, complete the required fields, and submit your proposal in one session."
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <RFQViewer
          title={payload.rfq.title}
          buyerCompany={payload.rfq.buyer_company ?? "Buyer"}
          deadline={payload.rfq.deadline ?? ""}
          document={payload.rfq.rfq_document}
          collapsed={collapsed}
          onToggle={() => setCollapsed((current) => !current)}
        />

        <section className="rounded-[24px] border border-slate-900/10 bg-white/80 p-5 shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-sky-700">Answer form</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">
                {payload.already_submitted ? "Your response" : "Complete your response"}
              </h2>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link
                to={`/${portalToken}`}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Back to inbox
              </Link>
              {!payload.already_submitted ? (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800">
                  {remaining} required fields remaining
                </span>
              ) : null}
              {rfqClosed ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                  Closed
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-5 space-y-5">
            {payload.form_fields.map((field) => (
              <FormField
                key={field.field_id}
                field={field}
                value={values[field.field_id]}
                onChange={(value) => handleFieldChange(field.field_id, value)}
                disabled={rfqClosed}
              />
            ))}
          </div>

          <div className="mt-6 space-y-3">
            {updateSuccess ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Response updated successfully.
              </div>
            ) : null}
            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            {payload.already_submitted ? (
              rfqClosed ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                  <p className="text-sm font-semibold text-slate-700">RFQ is closed</p>
                  <p className="mt-1 text-xs text-slate-500">
                    No further changes can be made. The buyer will be in touch if shortlisted.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleUpdate()}
                  disabled={submitting}
                  className="w-full rounded-full bg-sky-700 px-5 py-4 text-sm font-medium text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {submitting ? "Updating response..." : "Update response"}
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting || remaining > 0}
                className="w-full rounded-full bg-slate-950 px-5 py-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {submitting ? "Submitting response..." : "Submit response"}
              </button>
            )}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="rounded-[24px] border border-slate-900/10 bg-white/80 p-5 shadow-lg">
          <p className="text-xs uppercase tracking-[0.25em] text-sky-700">Buyer clarifications</p>
          <div className="mt-4 space-y-3">
            {payload.answered_questions.length ? (
              payload.answered_questions.map((item) => (
                <article key={`${item.question}-${item.answered_at}`} className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="font-medium text-slate-900">{item.question}</p>
                  <p className="mt-2 text-sm text-slate-600">{item.answer}</p>
                </article>
              ))
            ) : (
              <p className="text-sm text-slate-500">No clarifications have been posted yet.</p>
            )}
          </div>
        </section>

        <div className="space-y-4">
          <QuestionBox
            value={question}
            onChange={setQuestion}
            onSubmit={() => void handleAskQuestion()}
            pending={asking}
          />

          {payload.my_questions.length > 0 ? (
            <section className="rounded-[24px] border border-slate-900/10 bg-white/80 p-5 shadow-lg">
              <p className="text-xs uppercase tracking-[0.25em] text-sky-700">My questions</p>
              <p className="mt-1 text-xs text-slate-500">Visible only to you and the buyer.</p>
              <div className="mt-4 space-y-3">
                {payload.my_questions.map((item) => (
                  <article key={`${item.question}-${item.asked_at}`} className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="font-medium text-slate-900">{item.question}</p>
                    {item.answer ? (
                      <p className="mt-2 text-sm text-slate-600">{item.answer}</p>
                    ) : (
                      <p className="mt-2 text-xs text-amber-600">Awaiting buyer reply…</p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </PortalFrame>
  );
}

function buildInitialValues(fields: FormFieldDefinition[]) {
  return Object.fromEntries(
    fields.map((field) => [
      field.field_id,
      field.type === "url_list" ? [""] : field.type === "file_upload" ? [] : "",
    ]),
  );
}

function mergeWithDefaults(
  fields: FormFieldDefinition[],
  submitted: Record<string, unknown>,
) {
  const defaults = buildInitialValues(fields);
  return Object.fromEntries(
    fields.map((field) => [
      field.field_id,
      submitted[field.field_id] !== undefined ? submitted[field.field_id] : defaults[field.field_id],
    ]),
  );
}

function serializeValues(values: Record<string, unknown>) {
  const nextEntries = Object.entries(values).map(([key, value]) => {
    if (Array.isArray(value) && value.every((item) => item instanceof File)) {
      return [key, (value as File[]).map((file) => file.name)];
    }
    if (Array.isArray(value)) {
      return [key, value.filter(Boolean)];
    }
    return [key, value];
  });

  return Object.fromEntries(nextEntries);
}

function buildConfirmationSummary(
  fields: FormFieldDefinition[],
  values: Record<string, unknown>,
) {
  const preferredKeys = ["total_price", "timeline_value", "payment_terms"];
  const summaryEntries = preferredKeys
    .map((fieldId) => {
      const field = fields.find((item) => item.field_id === fieldId);
      if (!field || values[field.field_id] === undefined || values[field.field_id] === "") {
        return null;
      }
      return [field.label, values[field.field_id]] as const;
    })
    .filter((entry): entry is readonly [string, unknown] => entry !== null);

  return Object.fromEntries(summaryEntries);
}
