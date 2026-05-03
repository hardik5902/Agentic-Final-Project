import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import FlagBadge from "../components/FlagBadge";
import PortalShell from "../components/PortalShell";
import ScoreCard from "../components/ScoreCard";
import {
  useAnalysisResults,
  useNormalize,
  useResponseDetail,
  useScoreAnalysis,
} from "../hooks/useAnalysis";

export default function Analysis() {
  const { id } = useParams();
  const { data, isLoading, error } = useAnalysisResults(id);
  const normalize = useNormalize(id);
  const score = useScoreAnalysis(id);
  const [selectedResponseId, setSelectedResponseId] = useState<string | undefined>();
  const responseDetail = useResponseDetail(id, selectedResponseId);

  return (
    <PortalShell
      title="Response analysis"
      eyebrow="Normalize submitted answers, calculate scores, and compare qualifying suppliers side by side."
    >
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void normalize.mutateAsync()}
          className="rounded-full bg-amber-300 px-5 py-3 text-sm font-medium text-slate-950"
        >
          Normalize responses
        </button>
        <button
          type="button"
          onClick={() => void score.mutateAsync()}
          className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 text-sm text-cyan-100"
        >
          Calculate scores
        </button>
        <Link
          to={`/rfq/${id}/memo`}
          className="rounded-full border border-white/10 px-5 py-3 text-sm text-slate-200"
        >
          Open memo
        </Link>
      </div>

      {isLoading ? (
        <div className="h-80 animate-pulse rounded-[24px] border border-white/10 bg-white/5" />
      ) : error || !data ? (
        <div className="rounded-[24px] border border-rose-300/20 bg-rose-400/10 p-6 text-rose-100">
          Unable to load analysis results.
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-[24px] border border-rose-300/20 bg-rose-400/10 p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-white">Eliminated suppliers</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {data.eliminated.length ? (
                data.eliminated.map((supplier) => (
                  <article
                    key={supplier.supplier_name}
                    className="rounded-2xl border border-rose-300/20 bg-slate-950/40 p-4"
                  >
                    <p className="font-medium text-white">{supplier.supplier_name}</p>
                    <p className="mt-2 text-sm text-rose-100">
                      {supplier.reason ?? supplier.elimination_reason}
                    </p>
                  </article>
                ))
              ) : (
                <p className="text-sm text-rose-100/80">No suppliers eliminated so far.</p>
              )}
            </div>
          </section>

          <section className="rounded-[24px] border border-white/10 bg-slate-950/60 p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-white">Qualifying suppliers</h2>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm text-slate-200">
                <thead className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Timeline</th>
                    <th className="px-4 py-3">Flags</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3 text-right">Response</th>
                  </tr>
                </thead>
                <tbody>
                  {data.qualifying.map((supplier) => (
                    <tr
                      key={supplier.response_id ?? supplier.supplier_name}
                      className="border-t border-white/10"
                    >
                      <td className="px-4 py-4 font-medium text-white">{supplier.supplier_name}</td>
                      <td className="px-4 py-4">
                        {supplier.normalized_data?.total_price_usd != null ? (
                          `$${Number(supplier.normalized_data.total_price_usd).toLocaleString()}`
                        ) : (
                          <span className="text-slate-500">Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {supplier.normalized_data?.timeline_weeks != null ? (
                          `${supplier.normalized_data.timeline_weeks} wks`
                        ) : (
                          <span className="text-slate-500">Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          {(supplier.flags ?? []).map((flag, index) => {
                            const label =
                              typeof flag === "string"
                                ? flag
                                : String((flag as Record<string, unknown>).message ?? flag);
                            return <FlagBadge key={`${label}-${index}`} label={label} />;
                          })}
                          {!(supplier.flags ?? []).length ? (
                            <span className="text-slate-400">None</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4">{supplier.score?.toFixed(1) ?? "Pending"}</td>
                      <td className="px-4 py-4 text-right">
                        {supplier.response_id ? (
                          <button
                            type="button"
                            onClick={() => setSelectedResponseId(supplier.response_id)}
                            className="rounded-full border border-white/10 px-3 py-2 text-xs text-slate-200 hover:border-white/20 hover:text-white"
                          >
                            View response
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            {data.qualifying.map((supplier) => (
              <ScoreCard
                key={supplier.response_id ?? supplier.supplier_name}
                supplier={supplier}
              />
            ))}
          </section>

          {selectedResponseId ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6">
              <div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-[24px] border border-white/10 bg-slate-950 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {responseDetail.data?.supplier_name ?? "Supplier response"}
                    </h3>
                    <p className="text-sm text-slate-400">Complete submitted proposal</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedResponseId(undefined)}
                    className="rounded-full border border-white/10 px-3 py-2 text-sm text-slate-200"
                  >
                    Close
                  </button>
                </div>
                <div className="grid max-h-[calc(85vh-73px)] gap-6 overflow-y-auto p-6 lg:grid-cols-2">
                  <section className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                    <h4 className="text-sm font-semibold text-white">Supplier submission</h4>
                    {responseDetail.data ? (
                      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-5 text-sm text-slate-300">
                        <div className="border-b border-white/10 pb-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">
                            Proposal overview
                          </p>
                          <h5 className="mt-2 text-lg font-semibold text-white">
                            {responseDetail.data.supplier_name}
                          </h5>
                          <p className="mt-1 text-sm leading-6 text-slate-400">
                            Submitted commercial, delivery, and qualification details in response to this RFQ.
                          </p>
                        </div>

                        <div className="mt-5 space-y-6">
                          {formatResponseSections(responseDetail.data.raw_data).map((section) => (
                            <div key={section.title}>
                              <h6 className="text-xs uppercase tracking-[0.2em] text-cyan-300">
                                {section.title}
                              </h6>
                              <div className="mt-3 space-y-3">
                                {section.items.map((item) => (
                                  <div key={item.label}>
                                    <p className="text-xs uppercase tracking-[0.15em] text-slate-500">
                                      {item.label}
                                    </p>
                                    <div className="mt-1 text-sm leading-6 text-slate-200">
                                      {renderValue(item.value)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-300">
                        {responseDetail.isLoading ? "Loading..." : "Unable to load response."}
                      </p>
                    )}
                  </section>
                  <section className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                    <h4 className="text-sm font-semibold text-white">Evaluation summary</h4>
                    {responseDetail.data ? (
                      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-5">
                        <div className="grid gap-3 md:grid-cols-2">
                          {Object.entries(responseDetail.data.normalized_data).map(([key, value]) => (
                            <div
                              key={key}
                              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                            >
                              <p className="text-xs uppercase tracking-[0.15em] text-slate-500">
                                {formatLabel(key)}
                              </p>
                              <div className="mt-1 text-sm leading-6 text-slate-200">
                                {renderValue(value)}
                              </div>
                            </div>
                          ))}
                        </div>

                        {responseDetail.data.flags.length ? (
                          <div className="mt-5">
                            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Flags</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {responseDetail.data.flags.map((flag, index) => (
                                <FlagBadge
                                  key={`${
                                    typeof flag === "string" ? flag : JSON.stringify(flag)
                                  }-${index}`}
                                  label={
                                    typeof flag === "string"
                                      ? flag
                                      : String(flag.message ?? "Flag")
                                  }
                                />
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-300">
                        {responseDetail.isLoading ? "Loading..." : "Unable to load response."}
                      </p>
                    )}
                  </section>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </PortalShell>
  );
}

function formatLabel(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderValue(value: unknown) {
  if (Array.isArray(value)) {
    if (!value.length) return <span className="text-slate-400">Not provided</span>;
    return (
      <ul className="list-disc space-y-1 pl-5">
        {value.map((item, index) => (
          <li key={`${String(item)}-${index}`}>{String(item)}</li>
        ))}
      </ul>
    );
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (value === null || value === undefined || value === "") {
    return <span className="text-slate-400">Not provided</span>;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toLocaleString();
  }

  return String(value);
}

function formatResponseSections(rawData: Record<string, unknown>) {
  const sectionMap = [
    {
      title: "Commercial terms",
      keys: ["total_price", "currency", "payment_terms"],
    },
    {
      title: "Delivery plan",
      keys: ["timeline_value", "timeline_unit", "proposed_approach", "team_size", "team_lead_name"],
    },
    {
      title: "Experience and references",
      keys: ["relevant_experience", "portfolio_links", "references_available"],
    },
    {
      title: "Compliance",
      keys: ["nda_willing"],
    },
  ];

  const usedKeys = new Set<string>();
  const sections = sectionMap
    .map((section) => {
      const items = section.keys
        .filter((key) => key in rawData)
        .map((key) => {
          usedKeys.add(key);
          return { label: formatLabel(key), value: rawData[key] };
        });
      return { title: section.title, items };
    })
    .filter((section) => section.items.length);

  const remainingItems = Object.entries(rawData)
    .filter(([key]) => !usedKeys.has(key))
    .map(([key, value]) => ({ label: formatLabel(key), value }));

  if (remainingItems.length) {
    sections.push({ title: "Additional details", items: remainingItems });
  }

  return sections;
}
