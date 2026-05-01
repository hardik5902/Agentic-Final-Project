import { Link, useParams } from "react-router-dom";
import PortalShell from "../components/PortalShell";
import StatusBadge from "../components/StatusBadge";
import { useCloseRFQ, useRFQDetail } from "../hooks/useRFQ";
import { formatDate, formatRelativeDays, percentFromWeight } from "../lib/utils";

export default function RFQDetail() {
  const { id } = useParams();
  const { data, isLoading, error } = useRFQDetail(id);
  const closeRFQ = useCloseRFQ(id);

  return (
    <PortalShell
      title="RFQ detail"
      eyebrow="Review the final RFQ, keep an eye on invitation statuses, and move into scoring when supplier responses are in."
    >
      {isLoading ? (
        <div className="h-96 animate-pulse rounded-[24px] border border-white/10 bg-white/5" />
      ) : error || !data ? (
        <div className="rounded-[24px] border border-rose-300/20 bg-rose-400/10 p-6 text-rose-100">
          Unable to load this RFQ.
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
          <section className="rounded-[24px] border border-white/10 bg-slate-950/60 p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-cyan-200/70">
                  {data.category.replace(/_/g, " ")}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{data.title}</h2>
              </div>
              <StatusBadge status={data.status} />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-slate-300">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Deadline</div>
                <div className="mt-1 text-white">{formatDate(data.deadline)}</div>
                <div className="mt-1 text-xs text-cyan-200">
                  {formatRelativeDays(data.deadline)}
                </div>
              </div>
              <div className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-slate-300">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Responses</div>
                <div className="mt-1 text-white">{data.response_count}</div>
              </div>
              <div className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-slate-300">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Criteria</div>
                <div className="mt-1 text-white">{data.criteria.length} weighted factors</div>
              </div>
            </div>
            <pre className="mt-6 whitespace-pre-wrap rounded-[20px] border border-white/10 bg-slate-900/70 p-5 text-sm leading-7 text-slate-200">
              {data.rfq_document}
            </pre>
          </section>

          <div className="space-y-6">
            <section className="rounded-[24px] border border-white/10 bg-slate-950/60 p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Invitations</h3>
                <Link
                  to={`/rfq/${data.id}/analysis`}
                  className="rounded-full bg-amber-300 px-4 py-2 text-sm font-medium text-slate-950"
                >
                  Analyze responses
                </Link>
              </div>
              <div className="mt-5 space-y-3">
                {data.invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="rounded-[18px] border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">{invitation.supplier_name}</p>
                        <p className="text-xs text-slate-400">{invitation.supplier_email}</p>
                      </div>
                      <StatusBadge status={invitation.status} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[24px] border border-white/10 bg-slate-950/60 p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-white">Evaluation weights</h3>
              <div className="mt-5 space-y-3">
                {data.criteria.map((criterion) => (
                  <div key={criterion.name} className="rounded-2xl bg-white/5 px-4 py-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-white">{criterion.label}</span>
                      <span className="text-slate-400">
                        {percentFromWeight(criterion.weight)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {data.status === "active" ? (
                <button
                  type="button"
                  onClick={() => void closeRFQ.mutateAsync()}
                  className="mt-5 rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 hover:border-white/20 hover:text-white"
                >
                  Close RFQ
                </button>
              ) : null}
            </section>

            <section className="rounded-[24px] border border-white/10 bg-slate-950/60 p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-white">Supplier Q&A</h3>
              <div className="mt-5 space-y-3">
                {data.questions.map((item) => (
                  <div key={item.id} className="rounded-2xl bg-white/5 px-4 py-3 text-sm">
                    <p className="font-medium text-white">{item.question}</p>
                    <p className="mt-2 text-slate-300">{item.answer ?? "Awaiting answer"}</p>
                  </div>
                ))}
                {!data.questions.length ? (
                  <p className="text-sm text-slate-400">No supplier questions yet.</p>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
