export default function QuestionBox({
  value,
  onChange,
  onSubmit,
  pending,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  pending?: boolean;
}) {
  return (
    <section className="rounded-[24px] border border-slate-900/10 bg-white/80 p-5 shadow-lg">
      <p className="text-xs uppercase tracking-[0.25em] text-sky-700">Clarification question</p>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Ask the buyer for clarification if something in the RFQ is unclear."
        className="mt-3 min-h-[110px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-400"
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={pending || !value.trim()}
        className="mt-3 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {pending ? "Sending..." : "Send question"}
      </button>
    </section>
  );
}
