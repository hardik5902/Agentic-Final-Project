import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import FlagBadge from "../components/FlagBadge";
import PortalShell from "../components/PortalShell";
import RatingInput from "../components/RatingInput";
import ScoreCard from "../components/ScoreCard";
import { useAnalysisResults, useNormalize, useRateAnalysis, useScoreAnalysis } from "../hooks/useAnalysis";

export default function Analysis() {
  const { id } = useParams();
  const { data, isLoading, error } = useAnalysisResults(id);
  const normalize = useNormalize(id);
  const rate = useRateAnalysis(id);
  const score = useScoreAnalysis(id);
  const [ratings, setRatings] = useState<Record<string, Record<string, number>>>({});

  const buyerRatedCriteria = useMemo(
    () => data?.criteria.filter((item) => item.type === "buyer_rated") ?? [],
    [data],
  );

  const handleSaveRatings = async () => {
    await rate.mutateAsync(ratings);
  };

  return (
    <PortalShell
      title="Response analysis"
      eyebrow="Normalize submitted answers, capture buyer judgment for subjective criteria, and compare qualifying suppliers side by side."
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
          onClick={() => void handleSaveRatings()}
          className="rounded-full border border-white/10 px-5 py-3 text-sm text-slate-200"
        >
          Save ratings
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
                  <article key={supplier.supplier_name} className="rounded-2xl border border-rose-300/20 bg-slate-950/40 p-4">
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
                  </tr>
                </thead>
                <tbody>
                  {data.qualifying.map((supplier) => (
                    <tr key={supplier.response_id ?? supplier.supplier_name} className="border-t border-white/10">
                      <td className="px-4 py-4 font-medium text-white">{supplier.supplier_name}</td>
                      <td className="px-4 py-4">
                        {supplier.normalized_data?.total_price_usd ?? "Pending"}
                      </td>
                      <td className="px-4 py-4">
                        {supplier.normalized_data?.timeline_weeks ?? "Pending"}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          {(supplier.flags ?? []).map((flag) => (
                            <FlagBadge key={flag} label={flag} />
                          ))}
                          {!(supplier.flags ?? []).length ? (
                            <span className="text-slate-400">None</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4">{supplier.score?.toFixed(1) ?? "Pending"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {buyerRatedCriteria.length ? (
            <section className="rounded-[24px] border border-white/10 bg-slate-950/60 p-6 shadow-xl">
              <h2 className="text-xl font-semibold text-white">Buyer-rated criteria</h2>
              <div className="mt-5 space-y-4">
                {data.qualifying.map((supplier) => (
                  <div
                    key={supplier.response_id ?? supplier.supplier_name}
                    className="rounded-[20px] border border-white/10 bg-white/5 p-4"
                  >
                    <p className="font-medium text-white">{supplier.supplier_name}</p>
                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      {buyerRatedCriteria.map((criterion) => (
                        <div key={criterion.name}>
                          <p className="text-sm text-slate-300">{criterion.label}</p>
                          <div className="mt-2">
                            <RatingInput
                              value={ratings[supplier.response_id ?? supplier.supplier_name]?.[criterion.name]}
                              onChange={(value) => {
                                const responseKey =
                                  supplier.response_id ?? supplier.supplier_name;
                                setRatings((current) => ({
                                  ...current,
                                  [responseKey]: {
                                    ...current[responseKey],
                                    [criterion.name]: value,
                                  },
                                }));
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="grid gap-5 lg:grid-cols-2">
            {data.qualifying.map((supplier) => (
              <ScoreCard
                key={supplier.response_id ?? supplier.supplier_name}
                supplier={supplier}
              />
            ))}
          </section>
        </div>
      )}
    </PortalShell>
  );
}
