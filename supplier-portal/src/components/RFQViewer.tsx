import { formatDeadline } from "../lib/utils";

export default function RFQViewer({
  title,
  buyerCompany,
  deadline,
  document,
  collapsed,
  onToggle,
}: {
  title: string;
  buyerCompany: string;
  deadline: string;
  document: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="rounded-[24px] border border-slate-900/10 bg-white/80 shadow-lg">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-sky-700">RFQ document</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {buyerCompany} • Due {formatDeadline(deadline)}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
          {collapsed ? "Expand" : "Collapse"}
        </span>
      </button>
      {!collapsed ? (
        <div className="border-t border-slate-900/10 px-5 py-5">
          <pre className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{document}</pre>
        </div>
      ) : null}
    </section>
  );
}
