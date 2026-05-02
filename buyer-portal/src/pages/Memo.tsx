import { useMemo } from "react";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import PortalShell from "../components/PortalShell";
import { useGenerateMemo, useMemo as useMemoQuery } from "../hooks/useAnalysis";

// Split memo text into named sections by ## headings
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

function SectionCard({
  title,
  accent,
  children,
}: {
  title: string;
  accent?: "cyan" | "amber" | "rose" | "emerald";
  children: React.ReactNode;
}) {
  const accentMap = {
    cyan: "border-cyan-300/20 text-cyan-300",
    amber: "border-amber-300/20 text-amber-300",
    rose: "border-rose-300/20 text-rose-300",
    emerald: "border-emerald-300/20 text-emerald-300",
  };
  const cls = accentMap[accent ?? "cyan"];
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-6">
      <p className={`mb-4 text-[10px] font-semibold uppercase tracking-[0.25em] ${cls}`}>
        {title}
      </p>
      {children}
    </div>
  );
}

function MdBody({ text }: { text: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none
      prose-p:text-slate-300 prose-p:leading-7 prose-p:my-2
      prose-li:text-slate-300 prose-li:leading-6 prose-li:my-1
      prose-strong:text-white
      prose-ol:my-2 prose-ul:my-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div className="overflow-x-auto mt-2">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-white/10">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="py-2 px-4 text-left text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 whitespace-nowrap">
              {children}
            </th>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-white/[0.06]">{children}</tbody>
          ),
          td: ({ children }) => (
            <td className="py-3 px-4 text-slate-300 align-top leading-6">{children}</td>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

// Extract recommended supplier name from recommendation section
function extractRecommendation(text: string): string | null {
  const match = text.match(/\*\*([^*]+)\*\*/);
  return match ? match[1] : null;
}

export default function Memo() {
  const { id } = useParams();
  const { data, isLoading, error } = useMemoQuery(id);
  const generateMemo = useGenerateMemo(id);

  const sections = useMemo(() => {
    if (!data?.memo_text) return null;
    return parseSections(data.memo_text);
  }, [data?.memo_text]);

  const recommendedSupplier = useMemo(() => {
    if (!sections) return null;
    const rec = sections["recommendation"] ?? sections["recommendation\r"] ?? "";
    return extractRecommendation(rec);
  }, [sections]);

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <PortalShell
      title="Decision memo"
      eyebrow="AI-generated sourcing recommendation for C-level review."
    >
      {/* Actions */}
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void generateMemo.mutateAsync()}
          disabled={generateMemo.isPending}
          className="rounded-full bg-amber-300 px-5 py-3 text-sm font-medium text-slate-950 disabled:opacity-60"
        >
          {generateMemo.isPending ? "Generating…" : "Generate memo"}
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

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-[20px] border border-white/10 bg-white/5" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-[24px] border border-rose-300/20 bg-rose-400/10 p-6 text-rose-100">
          Unable to load the memo yet.
        </div>
      ) : !sections ? (
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-10 text-center">
          <p className="text-slate-400 text-sm">
            Click <strong className="text-white">Generate memo</strong> once scoring is complete.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Memo header */}
          <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-6 py-5">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
              {[
                { label: "TO", value: "Sourcing Committee" },
                { label: "FROM", value: "Procurement Analyst" },
                { label: "DATE", value: today },
                { label: "SUBJECT", value: "Sourcing Decision" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
                  <p className="mt-0.5 text-slate-200">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Executive summary banner */}
          {sections["executive summary"] && (
            <div className="rounded-[20px] border border-emerald-300/20 bg-emerald-400/5 px-6 py-5">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-300">
                Executive Summary
              </p>
              <p className="text-slate-200 leading-7 text-sm">
                {sections["executive summary"].replace(/\*/g, "")}
              </p>
            </div>
          )}

          {/* Recommendation highlight */}
          {sections["recommendation"] && (
            <div className="rounded-[20px] border border-cyan-300/20 bg-cyan-400/5 px-6 py-5 flex items-start gap-4">
              <div className="shrink-0 rounded-full bg-cyan-300/10 px-4 py-2 text-xs font-semibold text-cyan-200 border border-cyan-300/20 mt-0.5">
                RECOMMENDED
              </div>
              {recommendedSupplier && (
                <div>
                  <p className="text-xl font-bold text-white">{recommendedSupplier}</p>
                  <MdBody text={sections["recommendation"].replace(/\*\*[^*]+\*\*\s*/m, "")} />
                </div>
              )}
              {!recommendedSupplier && <MdBody text={sections["recommendation"]} />}
            </div>
          )}

          {/* 2-col row: evaluation + eliminated */}
          <div className="grid gap-4 lg:grid-cols-2">
            {sections["supplier evaluation"] && (
              <SectionCard title="Supplier Evaluation" accent="cyan">
                <MdBody text={sections["supplier evaluation"]} />
              </SectionCard>
            )}
            {sections["eliminated suppliers"] && (
              <SectionCard title="Eliminated Suppliers" accent="rose">
                <MdBody text={sections["eliminated suppliers"]} />
              </SectionCard>
            )}
          </div>

          {/* 2-col row: risks + next steps */}
          <div className="grid gap-4 lg:grid-cols-2">
            {sections["risk considerations"] && (
              <SectionCard title="Risk Considerations" accent="amber">
                <MdBody text={sections["risk considerations"]} />
              </SectionCard>
            )}
            {sections["recommended next steps"] && (
              <SectionCard title="Recommended Next Steps" accent="emerald">
                <MdBody text={sections["recommended next steps"]} />
              </SectionCard>
            )}
          </div>

          {/* Award CTA */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-6 py-3 text-sm font-medium text-emerald-100 hover:bg-emerald-300/20 transition-colors"
            >
              Award to {recommendedSupplier ?? "recommended supplier"}
            </button>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
