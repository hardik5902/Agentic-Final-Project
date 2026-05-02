import { Supplier, SupplierSuggestion } from "../types";

export default function SupplierTable({
  suppliers,
  selectedIds,
  onToggle,
  suggestions,
}: {
  suppliers: Supplier[];
  selectedIds?: string[];
  onToggle?: (supplierId: string) => void;
  suggestions?: SupplierSuggestion[];
}) {
  const suggestionMap = new Map(
    (suggestions ?? []).map((s) => [s.supplier_id, s]),
  );
  const hasSuggestions = suggestionMap.size > 0;

  // Sort: recommended batch-1 first, then batch-2, then unranked
  const sorted = hasSuggestions
    ? [...suppliers].sort((a, b) => {
        const sa = suggestionMap.get(a.id);
        const sb = suggestionMap.get(b.id);
        const scoreA = sa?.fit_score ?? -1;
        const scoreB = sb?.fit_score ?? -1;
        return scoreB - scoreA;
      })
    : suppliers;

  return (
    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/60 shadow-xl">
      <table className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-200">
        <thead className="bg-white/5 text-xs uppercase tracking-[0.25em] text-slate-400">
          <tr>
            {onToggle ? <th className="px-5 py-4">Pick</th> : null}
            <th className="px-5 py-4">Supplier</th>
            <th className="px-5 py-4">Categories</th>
            <th className="px-5 py-4">Response rate</th>
            {hasSuggestions ? <th className="px-5 py-4">AI fit</th> : null}
            <th className="px-5 py-4">Last used</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {sorted.map((supplier) => {
            const checked = selectedIds?.includes(supplier.id) ?? false;
            const suggestion = suggestionMap.get(supplier.id);
            return (
              <tr key={supplier.id} className={`hover:bg-white/5 ${suggestion?.recommended ? "bg-cyan-900/10" : ""}`}>
                {onToggle ? (
                  <td className="px-5 py-4">
                    <input
                      checked={checked}
                      onChange={() => onToggle(supplier.id)}
                      type="checkbox"
                      className="h-4 w-4 rounded border-white/20 bg-slate-900"
                    />
                  </td>
                ) : null}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="font-medium text-white">{supplier.name}</div>
                      <div className="text-xs text-slate-400">{supplier.email}</div>
                    </div>
                    {suggestion?.batch === 1 && suggestion.recommended ? (
                      <span className="rounded-full bg-cyan-400/15 px-2 py-0.5 text-xs font-medium text-cyan-300">
                        Batch 1
                      </span>
                    ) : suggestion?.batch === 2 ? (
                      <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-xs text-slate-400">
                        Batch 2
                      </span>
                    ) : null}
                  </div>
                  {suggestion?.fit_reasoning ? (
                    <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
                      {suggestion.fit_reasoning}
                    </p>
                  ) : null}
                </td>
                <td className="px-5 py-4">{supplier.categories.join(", ") || "None"}</td>
                <td className="px-5 py-4">
                  {Math.round((supplier.response_rate ?? 0) * 100)}%
                </td>
                {hasSuggestions ? (
                  <td className="px-5 py-4">
                    {suggestion ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                          <div
                            className={`h-full rounded-full ${
                              suggestion.fit_score >= 0.7
                                ? "bg-cyan-400"
                                : suggestion.fit_score >= 0.4
                                ? "bg-amber-400"
                                : "bg-slate-500"
                            }`}
                            style={{ width: `${Math.round(suggestion.fit_score * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-300">
                          {Math.round(suggestion.fit_score * 100)}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                ) : null}
                <td className="px-5 py-4 text-slate-400">
                  {supplier.last_responded_at
                    ? new Date(supplier.last_responded_at).toLocaleDateString()
                    : "New supplier"}
                </td>
              </tr>
            );
          })}
          {!suppliers.length && (
            <tr>
              <td
                colSpan={onToggle ? (hasSuggestions ? 6 : 5) : hasSuggestions ? 5 : 4}
                className="px-5 py-10 text-center text-sm text-slate-400"
              >
                No suppliers yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
