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
        <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">
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
              max="60"
              value={Math.round(criterion.weight * 100)}
              onChange={(event) => {
                const next = [...criteria];
                next[index] = {
                  ...criterion,
                  weight: Number(event.target.value) / 100,
                };
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
