export default function FlagBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full border border-rose-300/20 bg-rose-400/10 px-3 py-1 text-xs text-rose-100">
      {label}
    </span>
  );
}
