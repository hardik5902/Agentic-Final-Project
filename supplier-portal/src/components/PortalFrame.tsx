export default function PortalFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen px-4 py-6 md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 rounded-[28px] border border-slate-900/10 bg-white/80 px-6 py-6 shadow-xl backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-amber-600">QuoteFlow Supplier</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">{subtitle}</p>
        </header>
        {children}
      </div>
    </div>
  );
}
