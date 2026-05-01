import { Supplier } from "../types";

export default function SupplierTable({
  suppliers,
  selectedIds,
  onToggle,
}: {
  suppliers: Supplier[];
  selectedIds?: string[];
  onToggle?: (supplierId: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/60 shadow-xl">
      <table className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-200">
        <thead className="bg-white/5 text-xs uppercase tracking-[0.25em] text-slate-400">
          <tr>
            {onToggle ? <th className="px-5 py-4">Pick</th> : null}
            <th className="px-5 py-4">Supplier</th>
            <th className="px-5 py-4">Categories</th>
            <th className="px-5 py-4">Response rate</th>
            <th className="px-5 py-4">Last used</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {suppliers.map((supplier) => {
            const checked = selectedIds?.includes(supplier.id) ?? false;
            return (
              <tr key={supplier.id} className="hover:bg-white/5">
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
                  <div className="font-medium text-white">{supplier.name}</div>
                  <div className="text-xs text-slate-400">{supplier.email}</div>
                </td>
                <td className="px-5 py-4">{supplier.categories.join(", ") || "None"}</td>
                <td className="px-5 py-4">
                  {Math.round((supplier.response_rate ?? 0) * 100)}%
                </td>
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
                colSpan={onToggle ? 5 : 4}
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
