import { Link } from "react-router-dom";
import PortalShell from "../components/PortalShell";
import StatusBadge from "../components/StatusBadge";
import { formatDate, formatRelativeDays } from "../lib/utils";
import { useRFQList } from "../hooks/useRFQ";

export default function Dashboard() {
  const { data, isLoading, error } = useRFQList();

  return (
    <PortalShell
      title="RFQ command center"
      eyebrow="Track every sourcing event, keep deadlines visible, and jump straight into analysis when responses arrive."
    >
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-300">
            Active events, response progress, and quick actions live here.
          </p>
        </div>
        <Link
          to="/rfq/new"
          className="rounded-full bg-amber-300 px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-amber-200"
        >
          Create RFQ
        </Link>
      </div>
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-56 animate-pulse rounded-[24px] border border-white/10 bg-white/5"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-[24px] border border-rose-300/20 bg-rose-400/10 p-6 text-rose-100">
          Unable to load RFQs right now.
        </div>
      ) : data?.items.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {data.items.map((rfq) => (
            <article
              key={rfq.id}
              className="rounded-[24px] border border-white/10 bg-slate-950/60 p-6 shadow-xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-cyan-200/70">
                    {rfq.category.replace(/_/g, " ")}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">{rfq.title}</h2>
                </div>
                <StatusBadge status={rfq.status} />
              </div>
              <div className="mt-6 grid gap-3 text-sm text-slate-300">
                <div className="rounded-2xl bg-white/5 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Deadline</div>
                  <div className="mt-1 text-white">{formatDate(rfq.deadline)}</div>
                  <div className="mt-1 text-xs text-cyan-200">{formatRelativeDays(rfq.deadline)}</div>
                </div>
                <div className="rounded-2xl bg-white/5 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Responses</div>
                  <div className="mt-1 text-white">
                    {rfq.response_count}/{rfq.invited_count} responded
                  </div>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <Link
                  to={`/rfq/${rfq.id}`}
                  className="rounded-full bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/15"
                >
                  View
                </Link>
                <Link
                  to={`/rfq/${rfq.id}/analysis`}
                  className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:text-white"
                >
                  Analyze
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-[28px] border border-dashed border-white/15 bg-slate-950/50 px-8 py-16 text-center">
          <h2 className="text-2xl font-semibold text-white">No RFQs yet</h2>
          <p className="mt-3 text-sm text-slate-300">
            Start your first sourcing event and QuoteFlow will help you shape the brief.
          </p>
          <Link
            to="/rfq/new"
            className="mt-6 inline-flex rounded-full bg-amber-300 px-5 py-3 text-sm font-medium text-slate-950"
          >
            Create your first RFQ
          </Link>
        </div>
      )}
    </PortalShell>
  );
}
