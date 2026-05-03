import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PortalFrame from "../components/PortalFrame";
import api from "../lib/api";
import { rememberPortalToken } from "../lib/session";
import { formatDeadline } from "../lib/utils";
import { SupplierPortalInboxItem, SupplierPortalInboxPayload } from "../types";

export default function Dashboard() {
  const { portalToken } = useParams();
  const navigate = useNavigate();
  const [payload, setPayload] = useState<SupplierPortalInboxPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const activeToken = portalToken;
    if (typeof activeToken !== "string" || !activeToken) {
      navigate("/invalid", { replace: true });
      return;
    }
    const resolvedToken: string = activeToken;

    async function load() {
      try {
        const { data } = await api.get<SupplierPortalInboxPayload>(`/api/response/${resolvedToken}/portal`);
        setPayload(data);
        rememberPortalToken(resolvedToken);
      } catch {
        navigate("/invalid", { replace: true });
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [navigate, portalToken]);

  const summary = useMemo(() => {
    const invitations = payload?.invitations ?? [];
    return {
      total: invitations.length,
      awaiting: invitations.filter((item) => !item.already_submitted && !item.is_closed).length,
      submitted: invitations.filter((item) => item.already_submitted).length,
      closed: invitations.filter((item) => item.is_closed).length,
    };
  }, [payload]);

  if (loading) {
    return (
      <PortalFrame
        title="Loading supplier inbox"
        subtitle="Please wait while we gather your RFQs and response history."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-[24px] border border-slate-200 bg-white/70"
            />
          ))}
        </div>
      </PortalFrame>
    );
  }

  if (!payload || !portalToken) return null;

  return (
    <PortalFrame
      title={`Welcome back, ${payload.supplier_name}`}
      subtitle="Your supplier inbox keeps every RFQ in one place so you can start pending forms quickly and revisit submitted responses whenever updates are still allowed."
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total RFQs" value={summary.total} tone="slate" />
        <SummaryCard label="Awaiting response" value={summary.awaiting} tone="amber" />
        <SummaryCard label="Submitted" value={summary.submitted} tone="emerald" />
        <SummaryCard label="Closed" value={summary.closed} tone="sky" />
      </section>

      <section className="mt-6 rounded-[28px] border border-slate-900/10 bg-white/85 p-6 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-sky-700">Supplier inbox</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">All received RFQs</h2>
            <p className="mt-2 text-sm text-slate-600">{payload.supplier_email}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Use any card below to continue a response or reopen a submitted response before the deadline.
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {payload.invitations.map((item) => (
            <InboxCard key={item.invitation_token} item={item} portalToken={portalToken} />
          ))}
        </div>
      </section>
    </PortalFrame>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "amber" | "emerald" | "sky";
}) {
  const toneClasses = {
    slate: "border-slate-200 bg-white/80 text-slate-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    sky: "border-sky-200 bg-sky-50 text-sky-900",
  };

  return (
    <div className={`rounded-[24px] border p-5 shadow-lg ${toneClasses[tone]}`}>
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function InboxCard({
  item,
  portalToken,
}: {
  item: SupplierPortalInboxItem;
  portalToken: string;
}) {
  const actionLabel = item.already_submitted
    ? item.can_edit
      ? "Review or edit response"
      : "View submitted response"
    : item.can_open
      ? "Start response"
      : "Closed";

  return (
    <article className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-sky-700">
            {(item.category ?? "rfq").replace(/_/g, " ")}
          </p>
          <h3 className="mt-2 text-xl font-semibold text-slate-950">
            {item.rfq_title ?? "Untitled RFQ"}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {item.buyer_company ?? "Buyer"} • Due {formatDeadline(item.deadline ?? undefined)}
          </p>
        </div>
        <StatusPills item={item} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <MetaPanel
          label="Portal status"
          value={item.already_submitted ? "Submitted" : item.is_closed ? "Closed" : "Awaiting response"}
        />
        <MetaPanel
          label="Last activity"
          value={formatActivityDate(item.updated_at ?? item.responded_at ?? item.created_at)}
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {item.can_open ? (
          <Link
            to={`/${portalToken}/respond/${item.invitation_token}`}
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            {actionLabel}
          </Link>
        ) : (
          <span className="rounded-full bg-slate-200 px-5 py-3 text-sm font-medium text-slate-500">
            {actionLabel}
          </span>
        )}
      </div>
    </article>
  );
}

function StatusPills({ item }: { item: SupplierPortalInboxItem }) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-700">
        {formatInvitationStatus(item)}
      </span>
      <span
        className={`rounded-full px-3 py-1 text-xs ${
          item.is_closed
            ? "bg-slate-200 text-slate-700"
            : item.can_edit
              ? "bg-emerald-100 text-emerald-800"
              : "bg-amber-100 text-amber-800"
        }`}
      >
        {item.is_closed ? "Closed" : item.can_edit ? "Editable" : "Open"}
      </span>
    </div>
  );
}

function MetaPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-900">{value}</p>
    </div>
  );
}

function formatInvitationStatus(item: SupplierPortalInboxItem) {
  if (item.already_submitted) return "Response submitted";
  if (item.invitation_status === "viewed") return "Viewed";
  return "Invitation received";
}

function formatActivityDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
