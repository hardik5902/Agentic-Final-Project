import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function RFQPreview({
  title,
  document,
  isGenerating = false,
}: {
  title: string;
  document: string | null;
  isGenerating?: boolean;
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
      <div className="mt-5 min-h-[360px] rounded-[20px] border border-white/10 bg-slate-900/80 p-6">
        {isGenerating ? (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4 text-slate-400">
            <svg className="h-8 w-8 animate-spin text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm">Generating your RFQ document…</p>
          </div>
        ) : document ? (
          <div className="rfq-prose text-sm leading-7 text-slate-200">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="mb-4 text-xl font-bold text-white">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="mb-3 mt-6 text-base font-semibold text-cyan-300">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="mb-2 mt-4 text-sm font-semibold text-slate-200">{children}</h3>
                ),
                p: ({ children }) => (
                  <p className="mb-3 text-slate-300">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="mb-3 ml-4 list-disc space-y-1 text-slate-300">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="mb-3 ml-4 list-decimal space-y-1 text-slate-300">{children}</ol>
                ),
                li: ({ children }) => <li className="text-slate-300">{children}</li>,
                strong: ({ children }) => (
                  <strong className="font-semibold text-white">{children}</strong>
                ),
                em: ({ children }) => (
                  <em className="text-slate-400">{children}</em>
                ),
                hr: () => <hr className="my-5 border-white/10" />,
                table: ({ children }) => (
                  <div className="mb-4 overflow-x-auto">
                    <table className="w-full border-collapse text-sm">{children}</table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="bg-slate-800/60">{children}</thead>
                ),
                th: ({ children }) => (
                  <th className="border border-white/10 px-4 py-2 text-left font-semibold text-slate-200">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border border-white/10 px-4 py-2 text-slate-300">{children}</td>
                ),
                tr: ({ children }) => (
                  <tr className="even:bg-slate-800/30">{children}</tr>
                ),
              }}
            >
              {document}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="flex h-full min-h-[300px] items-center justify-center rounded-[16px] border border-dashed border-white/10 text-sm text-slate-400">
            The RFQ preview appears here once the intake conversation is complete.
          </div>
        )}
      </div>

    </section>
  );
}
