import { AnalysisSupplier } from "../types";

export default function ScoreCard({ supplier }: { supplier: AnalysisSupplier }) {
  return (
    <article className="rounded-[24px] border border-white/10 bg-slate-950/60 p-5 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-white">{supplier.supplier_name}</p>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Score breakdown</p>
        </div>
        <div className="rounded-full bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100">
          {supplier.score?.toFixed(1) ?? "Pending"}
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {Object.entries(supplier.score_breakdown ?? {}).map(([key, value]) => (
          <div key={key} className="rounded-2xl bg-white/5 px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="capitalize text-slate-200">{key.replace(/_/g, " ")}</span>
              <span className="text-slate-400">{Math.round(value.weight * 100)}%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-white/10">
              <div
                className="h-2 rounded-full bg-cyan-300"
                style={{ width: `${Math.min(100, value.raw_score)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Weighted contribution {value.weighted_score.toFixed(1)}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}
