import { cn } from "../lib/utils";

const toneMap: Record<string, string> = {
  draft: "bg-slate-700/70 text-slate-100",
  collecting: "bg-cyan-400/20 text-cyan-100",
  active: "bg-emerald-400/20 text-emerald-100",
  closed: "bg-rose-400/20 text-rose-100",
  awarded: "bg-amber-300/20 text-amber-100",
  invited: "bg-slate-700/70 text-slate-100",
  viewed: "bg-cyan-400/20 text-cyan-100",
  responded: "bg-emerald-400/20 text-emerald-100",
  declined: "bg-orange-400/20 text-orange-100",
  bounced: "bg-rose-400/20 text-rose-100",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-medium capitalize tracking-wide",
        toneMap[status] ?? "bg-white/10 text-slate-100",
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}
