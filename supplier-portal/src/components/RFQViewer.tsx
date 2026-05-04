import React, { useRef } from "react";
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

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-slate-800">{part.slice(2, -2)}</strong>
    ) : (
      part
    ),
  );
}

type DocNode =
  | { type: "h1"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

function parseDocument(raw: string): DocNode[] {
  const lines = raw.split("\n");
  const nodes: DocNode[] = [];
  let listBuf: { kind: "ul" | "ol"; items: string[] } | null = null;

  const flushList = () => {
    if (listBuf) {
      nodes.push({ type: listBuf.kind, items: listBuf.items });
      listBuf = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("### ")) {
      flushList();
      nodes.push({ type: "h3", text: line.slice(4).trim() });
      continue;
    }
    if (line.startsWith("## ")) {
      flushList();
      nodes.push({ type: "h2", text: line.slice(3).trim() });
      continue;
    }
    if (line.startsWith("# ")) {
      flushList();
      nodes.push({ type: "h1", text: line.slice(2).trim() });
      continue;
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      if (listBuf?.kind !== "ul") { flushList(); listBuf = { kind: "ul", items: [] }; }
      listBuf.items.push(line.slice(2));
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      if (listBuf?.kind !== "ol") { flushList(); listBuf = { kind: "ol", items: [] }; }
      listBuf.items.push(line.replace(/^\d+\.\s/, ""));
      continue;
    }

    flushList();
    const trimmed = line.trim();
    if (trimmed) {
      nodes.push({ type: "p", text: trimmed });
    }
  }
  flushList();
  return nodes;
}

function DocumentPreview({ document }: { document: string }) {
  const nodes = parseDocument(document);

  return (
    <div className="space-y-3">
      {nodes.map((node, i) => {
        if (node.type === "h1") {
          return (
            <h1 key={i} className="text-base font-semibold text-slate-900">
              {renderInline(node.text)}
            </h1>
          );
        }
        if (node.type === "h2") {
          return (
            <h2 key={i} className="mt-4 border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-widest text-slate-400">
              {renderInline(node.text)}
            </h2>
          );
        }
        if (node.type === "h3") {
          return (
            <h3 key={i} className="text-sm font-medium text-slate-700">
              {renderInline(node.text)}
            </h3>
          );
        }
        if (node.type === "ul") {
          return (
            <ul key={i} className="ml-5 list-disc space-y-1 text-slate-700">
              {node.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        if (node.type === "ol") {
          return (
            <ol key={i} className="ml-5 list-decimal space-y-1 text-slate-700">
              {node.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i} className="text-sm leading-6 text-slate-700">
            {renderInline(node.text)}
          </p>
        );
      })}
    </div>
  );
}
