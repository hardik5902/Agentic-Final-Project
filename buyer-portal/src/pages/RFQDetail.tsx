import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import PortalShell from "../components/PortalShell";
import StatusBadge from "../components/StatusBadge";
import { useAnswerSupplierQuestion, useCloseRFQ, useRFQDetail } from "../hooks/useRFQ";
import { formatDate, formatRelativeDays, percentFromWeight } from "../lib/utils";

export default function RFQDetail() {
  const { id } = useParams();
  const { data, isLoading, error } = useRFQDetail(id);
  const closeRFQ = useCloseRFQ(id);
  const answerQuestion = useAnswerSupplierQuestion(id);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});

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
            <div className="mt-6 rounded-[20px] border border-white/10 bg-slate-900/70 p-5 text-sm leading-7 text-slate-200">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => <h1 className="mb-4 text-xl font-bold text-white">{children}</h1>,
                  h2: ({ children }) => <h2 className="mb-3 mt-6 text-base font-semibold text-cyan-300">{children}</h2>,
                  h3: ({ children }) => <h3 className="mb-2 mt-4 text-sm font-semibold text-slate-200">{children}</h3>,
                  p: ({ children }) => <p className="mb-3 text-slate-300">{children}</p>,
                  ul: ({ children }) => <ul className="mb-3 ml-4 list-disc space-y-1 text-slate-300">{children}</ul>,
                  ol: ({ children }) => <ol className="mb-3 ml-4 list-decimal space-y-1 text-slate-300">{children}</ol>,
                  li: ({ children }) => <li className="text-slate-300">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                  em: ({ children }) => <em className="text-slate-400">{children}</em>,
                  hr: () => <hr className="my-5 border-white/10" />,
                  table: ({ children }) => <div className="mb-4 overflow-x-auto"><table className="w-full border-collapse text-sm">{children}</table></div>,
                  thead: ({ children }) => <thead className="bg-slate-800/60">{children}</thead>,
                  th: ({ children }) => <th className="border border-white/10 px-4 py-2 text-left font-semibold text-slate-200">{children}</th>,
                  td: ({ children }) => <td className="border border-white/10 px-4 py-2 text-slate-300">{children}</td>,
                  tr: ({ children }) => <tr className="even:bg-slate-800/30">{children}</tr>,
                }}
              >
                {data.rfq_document ?? ""}
              </ReactMarkdown>
            </div>
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
                    {item.answer ? (
                      <p className="mt-2 text-slate-300">{item.answer}</p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        <p className="text-slate-400">Awaiting answer</p>
                        <textarea
                          value={draftAnswers[item.id] ?? ""}
                          onChange={(event) =>
                            setDraftAnswers((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                          rows={3}
                          placeholder="Write the clarification answer to share with all invited suppliers"
                          className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/70"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            void answerQuestion.mutateAsync({
                              questionId: item.id,
                              payload: { answer: draftAnswers[item.id] ?? "" },
                            }).then(() =>
                              setDraftAnswers((current) => ({
                                ...current,
                                [item.id]: "",
                              }))
                            )
                          }
                          disabled={answerQuestion.isPending || !(draftAnswers[item.id] ?? "").trim()}
                          className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Share answer
                        </button>
                      </div>
                    )}
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
