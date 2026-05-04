import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import PortalShell from "../components/PortalShell";
import { useEvaluateResponses, useGenerateMemo, useMemo as useMemoQuery } from "../hooks/useAnalysis";
import { ResponseEvaluation } from "../types";

function parseSections(text: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const parts = text.split(/^##\s+/m);
  for (const part of parts) {
    const nl = part.indexOf("\n");
    if (nl === -1) continue;
    const heading = part.slice(0, nl).trim().toLowerCase();
    const body = part.slice(nl + 1).trim();
    sections[heading] = body;
  }
  return sections;
}

function MdBody({ text }: { text: string }) {
  return (
    <div
      className="prose prose-invert prose-sm max-w-none
      prose-p:my-2 prose-p:leading-7 prose-p:text-slate-300
      prose-li:my-1 prose-li:leading-6 prose-li:text-slate-300
      prose-strong:text-white
      prose-ol:my-2 prose-ul:my-2"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-white/10">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="whitespace-nowrap px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
              {children}
            </th>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-white/[0.06]">{children}</tbody>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 align-top leading-6 text-slate-300">{children}</td>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function extractRecommendation(text: string): string | null {
  const match = text.match(/\*\*([^*]+)\*\*/);
  return match ? match[1] : null;
}

function severityOf(ev: ResponseEvaluation): "critical" | "caution" | "clean" {
  if (ev.compliance_failures.length > 0) return "critical";
  if (ev.ambiguous_fields.length > 0 || ev.missing_evidence.length > 0 || ev.strategic_concerns.length > 0)
    return "caution";
  return "clean";
}

const SEVERITY_STYLE = {
  critical: {
    badge: "bg-rose-400/15 text-rose-300 border border-rose-400/20",
    card: "border-rose-400/20",
    label: "Critical",
  },
  caution: {
    badge: "bg-amber-400/15 text-amber-300 border border-amber-400/20",
    card: "border-amber-400/20",
    label: "Caution",
  },
  clean: {
    badge: "bg-emerald-400/15 text-emerald-300 border border-emerald-400/20",
    card: "border-emerald-400/20",
    label: "Clean",
  },
};

function EvaluationCard({ ev }: { ev: ResponseEvaluation }) {
  const [expanded, setExpanded] = useState(false);
  const sev = severityOf(ev);
  const style = SEVERITY_STYLE[sev];

  const topFlags = [
    ...ev.compliance_failures.slice(0, 1),
    ...ev.ambiguous_fields.slice(0, 1),
    ...ev.missing_evidence.slice(0, 1),
  ].slice(0, 2);

  return (
    <article className={`rounded-[20px] border bg-slate-950/60 ${style.card}`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${style.badge}`}>
            {style.label}
          </span>
          <span className="font-semibold text-white truncate">{ev.supplier_name}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {topFlags.length > 0 && !expanded ? (
            <span className="hidden text-xs text-slate-400 sm:block">
              {topFlags[0].length > 60 ? topFlags[0].slice(0, 60) + "…" : topFlags[0]}
            </span>
          ) : null}
          <span className="text-slate-500 text-sm">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded ? (
        <div className="border-t border-white/[0.06] px-5 pb-5 pt-4 space-y-4">
          <p className="text-sm leading-6 text-slate-300">{ev.evaluation_summary}</p>

          {ev.compliance_failures.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-400">
                Compliance failures
              </p>
              <ul className="mt-2 space-y-1">
                {ev.compliance_failures.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-rose-200">
                    <span className="mt-0.5 shrink-0">✕</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {ev.ambiguous_fields.length > 0 || ev.missing_evidence.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {ev.ambiguous_fields.length > 0 ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-400">
                    Ambiguous fields
                  </p>
                  <ul className="mt-2 space-y-1">
                    {ev.ambiguous_fields.map((item, i) => (
                      <li key={i} className="text-sm text-slate-300">— {item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {ev.missing_evidence.length > 0 ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-400">
                    Missing evidence
                  </p>
                  <ul className="mt-2 space-y-1">
                    {ev.missing_evidence.map((item, i) => (
                      <li key={i} className="text-sm text-slate-300">— {item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {ev.strategic_concerns.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Strategic concerns
              </p>
              <ul className="mt-2 space-y-1">
                {ev.strategic_concerns.map((item, i) => (
                  <li key={i} className="text-sm text-slate-400">— {item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {ev.clarification_questions.length > 0 ? (
            <div className="rounded-2xl border border-violet-400/15 bg-violet-900/20 px-4 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300">
                Clarification questions to send back
              </p>
              <ol className="mt-3 space-y-2">
                {ev.clarification_questions.map((q, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-violet-100">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-violet-400/30 text-[10px] font-bold text-violet-300">
                      {i + 1}
                    </span>
                    {q}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export default function Memo() {
  const { id } = useParams();
  const { data, isLoading, error } = useMemoQuery(id);
  const generateMemo = useGenerateMemo(id);
  const evaluate = useEvaluateResponses(id);
  const [evaluations, setEvaluations] = useState<ResponseEvaluation[]>([]);
  const [memoExpanded, setMemoExpanded] = useState(false);

  const handleEvaluate = async () => {
    const result = await evaluate.mutateAsync();
    setEvaluations(result);
  };

  const sections = useMemo(() => {
    if (!data?.memo_text) return null;
    return parseSections(data.memo_text);
  }, [data?.memo_text]);

  const recommendedSupplier = useMemo(() => {
    if (!sections) return null;
    const rec = sections.recommendation ?? sections["recommendation\r"] ?? "";
    return extractRecommendation(rec);
  }, [sections]);

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const isNoSelection =
    recommendedSupplier?.toUpperCase().includes("NO SELECTION") ||
    recommendedSupplier?.toUpperCase().includes("NO AWARD");

  return (
    <PortalShell
      title="Decision memo"
      eyebrow="AI-generated sourcing summary for review and sign-off."
    >
      {/* Action buttons */}
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void handleEvaluate()}
          disabled={evaluate.isPending}
          className="rounded-full border border-violet-400/30 bg-violet-400/10 px-5 py-3 text-sm text-violet-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {evaluate.isPending ? "Generating analysis..." : "Generate AI analyses"}
        </button>
        <button
          type="button"
          onClick={() => void generateMemo.mutateAsync()}
          disabled={generateMemo.isPending}
          className="rounded-full bg-amber-300 px-5 py-3 text-sm font-medium text-slate-950 disabled:opacity-60"
        >
          {generateMemo.isPending ? "Generating..." : "Generate memo"}
        </button>
        {data?.memo_pdf_signed_url || data?.memo_pdf_url ? (
          <a
            href={data.memo_pdf_signed_url ?? data.memo_pdf_url ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/10 px-5 py-3 text-sm text-slate-200"
          >
            Download PDF
          </a>
        ) : null}
      </div>

      {/* Verdict banner — first thing a CFO sees */}
      {sections?.recommendation ? (
        <div
          className={`mb-6 flex items-center gap-5 rounded-[24px] px-6 py-5 ${
            isNoSelection
              ? "border border-rose-300/20 bg-rose-400/10"
              : "border border-emerald-300/20 bg-emerald-400/10"
          }`}
        >
          <div
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold tracking-wider ${
              isNoSelection
                ? "border border-rose-400/30 bg-rose-400/15 text-rose-200"
                : "border border-emerald-400/30 bg-emerald-400/15 text-emerald-200"
            }`}
          >
            {isNoSelection ? "NO SELECTION" : "RECOMMENDED"}
          </div>
          <div className="min-w-0">
            {recommendedSupplier && !isNoSelection ? (
              <p className="text-xl font-bold text-white">{recommendedSupplier}</p>
            ) : null}
            <p className="mt-0.5 text-sm leading-6 text-slate-300">
              {sections["executive summary"]?.replace(/\*/g, "").split(".")[0] + "."}
            </p>
          </div>
        </div>
      ) : null}

      {/* AI supplier analysis — compact collapsible cards */}
      {evaluations.length > 0 ? (
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-300">
                AI response analysis
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {evaluations.filter((e) => severityOf(e) === "critical").length} critical ·{" "}
                {evaluations.filter((e) => severityOf(e) === "caution").length} caution ·{" "}
                {evaluations.filter((e) => severityOf(e) === "clean").length} clean
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {evaluations.map((ev) => (
              <EvaluationCard key={ev.supplier_name} ev={ev} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Full sourcing memo — collapsed by default */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-[20px] border border-white/10 bg-white/5" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-[24px] border border-rose-300/20 bg-rose-400/10 p-6 text-rose-100">
          Unable to load the memo yet.
        </div>
      ) : !sections ? (
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-10 text-center">
          <p className="text-sm text-slate-400">
            Click <strong className="text-white">Generate memo</strong> once scoring is complete.
          </p>
        </div>
      ) : (
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03]">
          <button
            type="button"
            onClick={() => setMemoExpanded((v) => !v)}
            className="flex w-full items-center justify-between px-6 py-4 text-left"
          >
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-300">
                Full sourcing memo
              </p>
              <p className="mt-0.5 text-sm text-slate-400">
                Supplier evaluation · risk · recommended next steps
              </p>
            </div>
            <span className="text-slate-500">{memoExpanded ? "▲" : "▼"}</span>
          </button>

          {memoExpanded ? (
            <div className="border-t border-white/[0.06] px-6 pb-6 pt-4 space-y-4">
              {/* Memo header */}
              <div className="rounded-[16px] border border-white/10 bg-white/[0.03] px-5 py-4">
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
                  {[
                    { label: "TO", value: "Sourcing Committee" },
                    { label: "FROM", value: "Procurement Analyst" },
                    { label: "DATE", value: today },
                    { label: "SUBJECT", value: "Sourcing Decision" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                        {label}
                      </p>
                      <p className="mt-0.5 text-slate-200">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {sections["supplier evaluation"] ? (
                  <div className="rounded-[16px] border border-white/10 bg-white/[0.03] p-5">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-300">
                      Supplier Evaluation
                    </p>
                    <MdBody text={sections["supplier evaluation"]} />
                  </div>
                ) : null}
                {sections["eliminated suppliers"] ? (
                  <div className="rounded-[16px] border border-rose-300/20 bg-rose-400/5 p-5">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-rose-300">
                      Eliminated Suppliers
                    </p>
                    <MdBody text={sections["eliminated suppliers"]} />
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {sections["risk considerations"] ? (
                  <div className="rounded-[16px] border border-amber-300/20 bg-amber-400/5 p-5">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-300">
                      Risk Considerations
                    </p>
                    <MdBody text={sections["risk considerations"]} />
                  </div>
                ) : null}
                {sections["recommended next steps"] ? (
                  <div className="rounded-[16px] border border-emerald-300/20 bg-emerald-400/5 p-5">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-300">
                      Recommended Next Steps
                    </p>
                    <MdBody text={sections["recommended next steps"]} />
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </PortalShell>
  );
}
