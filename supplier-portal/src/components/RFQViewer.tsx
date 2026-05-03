import { useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
  const contentRef = useRef<HTMLDivElement>(null);

  const handleDownloadPdf = () => {
    const content = contentRef.current;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html>
<head>
<title>${title} — RFQ</title>
<style>
  body{font-family:Georgia,serif;max-width:780px;margin:0 auto;padding:48px 64px;color:#1e293b;line-height:1.7}
  .hdr{border-bottom:2px solid #0369a1;padding-bottom:12px;margin-bottom:32px}
  .hdr h1{font-size:1.5rem;font-weight:700;margin:0 0 4px}
  .hdr p{color:#64748b;font-size:.9rem;margin:0}
  h1{font-size:1.4rem;font-weight:700}
  h2{font-size:1.05rem;font-weight:600;color:#0369a1;border-bottom:1px solid #e2e8f0;padding-bottom:3px;margin-top:28px}
  h3{font-size:.95rem;font-weight:600;margin-top:18px}
  p{margin-bottom:10px}
  ul,ol{padding-left:20px;margin-bottom:10px}
  li{margin-bottom:3px}
  table{border-collapse:collapse;width:100%;margin-bottom:16px}
  td,th{border:1px solid #e2e8f0;padding:8px 12px;text-align:left}
  th{background:#f0f9ff;font-weight:600}
  tr:nth-child(even){background:#f8fafc}
  strong{font-weight:600}
  @media print{@page{margin:1in}}
</style>
</head>
<body>
<div class="hdr"><h1>${title}</h1><p>${buyerCompany} &bull; Due ${formatDeadline(deadline)}</p></div>
${content ? content.innerHTML : ""}
<script>window.print();<\/script>
</body>
</html>`);
    win.document.close();
  };

  return (
    <section className="rounded-[24px] border border-slate-900/10 bg-white/80 shadow-lg">
      <div className="flex w-full items-center justify-between gap-4 px-5 py-4">
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 text-left"
        >
          <p className="text-xs uppercase tracking-[0.25em] text-sky-700">RFQ document</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {buyerCompany} • Due {formatDeadline(deadline)}
          </p>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs text-sky-700 transition hover:bg-sky-100"
          >
            Download PDF
          </button>
          <button
            type="button"
            onClick={onToggle}
            className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
          >
            {collapsed ? "Expand" : "Collapse"}
          </button>
        </div>
      </div>
      {!collapsed ? (
        <div ref={contentRef} className="border-t border-slate-900/10 px-6 py-6 text-sm leading-7 text-slate-700">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="mb-4 text-xl font-bold text-slate-900">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="mb-3 mt-6 text-base font-semibold text-sky-700 border-b border-slate-200 pb-1">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="mb-2 mt-4 text-sm font-semibold text-slate-800">{children}</h3>
              ),
              p: ({ children }) => (
                <p className="mb-3 text-slate-700">{children}</p>
              ),
              ul: ({ children }) => (
                <ul className="mb-3 ml-5 list-disc space-y-1 text-slate-700">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="mb-3 ml-5 list-decimal space-y-1 text-slate-700">{children}</ol>
              ),
              li: ({ children }) => <li className="text-slate-700">{children}</li>,
              strong: ({ children }) => (
                <strong className="font-semibold text-slate-900">{children}</strong>
              ),
              em: ({ children }) => <em className="text-slate-500">{children}</em>,
              hr: () => <hr className="my-5 border-slate-200" />,
              table: ({ children }) => (
                <div className="mb-4 overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full border-collapse text-sm">{children}</table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="bg-sky-50">{children}</thead>
              ),
              th: ({ children }) => (
                <th className="border-b border-slate-200 px-4 py-2 text-left font-semibold text-slate-800">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border-b border-slate-100 px-4 py-2 text-slate-700">{children}</td>
              ),
              tr: ({ children }) => (
                <tr className="even:bg-slate-50">{children}</tr>
              ),
            }}
          >
            {document}
          </ReactMarkdown>
        </div>
      ) : null}
    </section>
  );
}
