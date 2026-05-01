export default function RFQPreview({
  title,
  document,
}: {
  title: string;
  document: string | null;
}) {
  return (
    <section className="rounded-[24px] border border-white/10 bg-slate-950/60 p-6 shadow-xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-200/70">
            Generated document
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">{title}</h2>
        </div>
      </div>
      <div className="mt-5 min-h-[360px] rounded-[20px] border border-white/10 bg-slate-900/80 p-5">
        {document ? (
          <pre className="whitespace-pre-wrap text-sm leading-7 text-slate-200">
            {document}
          </pre>
        ) : (
          <div className="flex h-full min-h-[300px] items-center justify-center rounded-[16px] border border-dashed border-white/10 text-sm text-slate-400">
            The RFQ preview appears here once the intake conversation is complete.
          </div>
        )}
      </div>
    </section>
  );
}
