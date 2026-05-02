import { Criterion } from "../types";
import { percentFromWeight } from "../lib/utils";

const defaultCriteria: Criterion[] = [
  { name: "proposed_approach", label: "Approach Quality", weight: 0.3, type: "buyer_rated" },
  { name: "price", label: "Total Price", weight: 0.25, type: "calculated" },
  { name: "portfolio", label: "Portfolio", weight: 0.25, type: "buyer_rated" },
  { name: "timeline", label: "Timeline", weight: 0.1, type: "calculated" },
  { name: "team_experience", label: "Team", weight: 0.1, type: "buyer_rated" },
];

export function getDefaultCriteria() {
  return defaultCriteria;
}

export default function CriteriaBuilder({
  criteria,
  onChange,
}: {
  criteria: Criterion[];
  onChange: (next: Criterion[]) => void;
}) {
  const total = criteria.reduce((sum, item) => sum + item.weight, 0);

  return (
    <section className="rounded-[24px] border border-white/10 bg-slate-950/60 p-6 shadow-xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-200/70">
            Evaluation criteria
          </p>
          <h3 className="mt-2 text-lg font-semibold text-white">
            Buyer-rated and calculated scoring
          </h3>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs ${Math.round(total * 100) === 100 ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
          Total {Math.round(total * 100)}%
        </span>
      </div>
      <div className="mt-5 space-y-3">
        {criteria.map((criterion, index) => (
          <div
            key={criterion.name}
            className="grid gap-3 rounded-[18px] border border-white/10 bg-white/5 p-4 md:grid-cols-[1.6fr,1fr,0.7fr]"
          >
            <div>
              <p className="font-medium text-white">{criterion.label}</p>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                {criterion.type.replace("_", " ")}
              </p>
            </div>
            <input
              type="range"
              min="5"
              max={Math.round(criterion.weight * 100) + (100 - Math.round(total * 100)) + Math.round(criterion.weight * 100) > 95 ? 95 : 95}
              value={Math.round(criterion.weight * 100)}
              onChange={(event) => {
                const newPct = Number(event.target.value);
                const oldPct = Math.round(criterion.weight * 100);
                const delta = newPct - oldPct;
                const others = criteria.filter((_, i) => i !== index);
                const othersTotal = others.reduce((s, c) => s + Math.round(c.weight * 100), 0);

                const next = criteria.map((c, i) => {
                  if (i === index) return { ...c, weight: newPct / 100 };
                  if (othersTotal === 0) return c;
                  const share = Math.round(c.weight * 100) / othersTotal;
                  const adjusted = Math.max(5, Math.round(c.weight * 100) - Math.round(delta * share));
                  return { ...c, weight: adjusted / 100 };
                });

                // Fix rounding so total is exactly 100
                const newTotal = next.reduce((s, c) => s + Math.round(c.weight * 100), 0);
                const diff = 100 - newTotal;
                if (diff !== 0) {
                  const fixIdx = next.findIndex((_, i) => i !== index);
                  if (fixIdx !== -1) {
                    next[fixIdx] = {
                      ...next[fixIdx],
                      weight: Math.max(5, Math.round(next[fixIdx].weight * 100) + diff) / 100,
                    };
                  }
                }
                onChange(next);
              }}
            />
            <div className="text-right text-sm text-slate-200">
              {percentFromWeight(criterion.weight)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
