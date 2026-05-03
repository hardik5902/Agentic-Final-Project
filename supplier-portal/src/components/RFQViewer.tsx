import { useRef } from "react";
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
<title>${title} - RFQ</title>
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
  pre{white-space:pre-wrap;background:#f8fafc;padding:12px;border-radius:10px}
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
          <DocumentPreview document={document} />
        </div>
      ) : null}
    </section>
  );
}

function DocumentPreview({ document }: { document: string }) {
  const blocks = document.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        if (block.startsWith("### ")) {
          return (
            <h3 key={index} className="text-sm font-semibold text-slate-800">
              {block.slice(4)}
            </h3>
          );
        }
        if (block.startsWith("## ")) {
          return (
            <h2 key={index} className="border-b border-slate-200 pb-1 text-base font-semibold text-sky-700">
              {block.slice(3)}
            </h2>
          );
        }
        if (block.startsWith("# ")) {
          return (
            <h1 key={index} className="text-xl font-bold text-slate-900">
              {block.slice(2)}
            </h1>
          );
        }

        const lines = block.split("\n").map((line) => line.trimEnd());
        if (lines.every((line) => line.startsWith("- ") || line.startsWith("* "))) {
          return (
            <ul key={index} className="ml-5 list-disc space-y-1">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>{line.slice(2)}</li>
              ))}
            </ul>
          );
        }

        if (lines.every((line) => /^\d+\.\s/.test(line))) {
          return (
            <ol key={index} className="ml-5 list-decimal space-y-1">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>{line.replace(/^\d+\.\s/, "")}</li>
              ))}
            </ol>
          );
        }

        if (lines.every((line) => line.startsWith("|") || /^[-:|\s]+$/.test(line))) {
          return (
            <pre key={index} className="overflow-x-auto rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {block}
            </pre>
          );
        }

        return (
          <div key={index} className="space-y-2">
            {lines.map((line, lineIndex) => (
              <p key={lineIndex} className="text-slate-700">
                {line}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}
