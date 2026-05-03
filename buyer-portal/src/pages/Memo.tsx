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

function EvaluationSection({ evaluations }: { evaluations: ResponseEvaluation[] }) {
  if (!evaluations.length) return null;

  return (
    <section className="mb-6 rounded-[24px] border border-violet-400/20 bg-violet-900/10 p-6 shadow-xl">
      <h2 className="text-xl font-semibold text-white">AI response analysis</h2>
      <p className="mt-1 text-xs text-violet-300/70">
        Ambiguities, missing evidence, and clarification questions identified by the evaluation agent.
      </p>
      <div className="mt-5 space-y-5">
        {evaluations.map((ev) => (
          <article
            key={ev.supplier_name}
            className="rounded-[20px] border border-violet-400/15 bg-slate-950/60 p-5"
          >
            <h3 className="text-base font-semibold text-white">{ev.supplier_name}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">{ev.evaluation_summary}</p>

            {ev.compliance_failures.length > 0 ? (
              <div className="mt-4">
                <p className="text-xs uppercase tracking-[0.2em] text-rose-400">
                  Compliance failures
                </p>
                <ul className="mt-2 space-y-1">
                  {ev.compliance_failures.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-rose-200">
                      <span className="mt-1 shrink-0 text-rose-400">x</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {ev.ambiguous_fields.length > 0 || ev.missing_evidence.length > 0 ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {ev.ambiguous_fields.length > 0 ? (
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-400">
                      Ambiguous fields
                    </p>
                    <ul className="mt-2 space-y-1">
                      {ev.ambiguous_fields.map((item, i) => (
                        <li key={i} className="text-sm text-slate-300">- {item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {ev.missing_evidence.length > 0 ? (
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-400">
                      Missing evidence
                    </p>
                    <ul className="mt-2 space-y-1">
                      {ev.missing_evidence.map((item, i) => (
                        <li key={i} className="text-sm text-slate-300">- {item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            {ev.strategic_concerns.length > 0 ? (
              <div className="mt-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Strategic concerns
                </p>
                <ul className="mt-2 space-y-1">
                  {ev.strategic_concerns.map((item, i) => (
                    <li key={i} className="text-sm text-slate-400">- {item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {ev.clarification_questions.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-violet-400/15 bg-violet-900/20 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-violet-300">
                  Clarification questions to send back
                </p>
                <ol className="mt-2 space-y-2">
                  {ev.clarification_questions.map((q, i) => (
                    <li key={i} className="text-sm text-violet-100">
                      {i + 1}. {q}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export default function Memo() {
  const { id } = useParams();
  const { data, isLoading, error } = useMemoQuery(id);
  const generateMemo = useGenerateMemo(id);
  const evaluate = useEvaluateResponses(id);
  const [evaluations, setEvaluations] = useState<ResponseEvaluation[]>([]);

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

  return (
    <PortalShell
      title="Decision memo"
      eyebrow="AI-generated sourcing summary for C-level review."
    >
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

      <EvaluationSection evaluations={evaluations} />

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-[20px] border border-white/10 bg-white/5"
            />
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
        <div className="space-y-4">
          <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-6 py-5">
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

          {sections["executive summary"] ? (
            <div className="rounded-[20px] border border-emerald-300/20 bg-emerald-400/5 px-6 py-5">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-300">
                Executive Summary
              </p>
              <p className="text-sm leading-7 text-slate-200">
                {sections["executive summary"].replace(/\*/g, "")}
              </p>
            </div>
          ) : null}

          {sections.recommendation ? (
            <div className="flex items-start gap-4 rounded-[20px] border border-cyan-300/20 bg-cyan-400/5 px-6 py-5">
              <div className="mt-0.5 shrink-0 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-semibold text-cyan-200">
                RECOMMENDED
              </div>
              {recommendedSupplier ? (
                <div>
                  <p className="text-xl font-bold text-white">{recommendedSupplier}</p>
                  <MdBody text={sections.recommendation.replace(/\*\*[^*]+\*\*\s*/m, "")} />
                </div>
              ) : (
                <MdBody text={sections.recommendation} />
              )}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            {sections["supplier evaluation"] ? (
              <SectionCard title="Supplier Evaluation" accent="cyan">
                <MdBody text={sections["supplier evaluation"]} />
              </SectionCard>
            ) : null}
            {sections["eliminated suppliers"] ? (
              <SectionCard title="Eliminated Suppliers" accent="rose">
                <MdBody text={sections["eliminated suppliers"]} />
              </SectionCard>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {sections["risk considerations"] ? (
              <SectionCard title="Risk Considerations" accent="amber">
                <MdBody text={sections["risk considerations"]} />
              </SectionCard>
            ) : null}
            {sections["recommended next steps"] ? (
              <SectionCard title="Recommended Next Steps" accent="emerald">
                <MdBody text={sections["recommended next steps"]} />
              </SectionCard>
            ) : null}
          </div>

          {recommendedSupplier ? (
            <div className="rounded-[20px] border border-emerald-300/20 bg-emerald-400/5 px-6 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-300">
                Preferred Supplier
              </p>
              <p className="mt-2 text-base font-semibold text-white">{recommendedSupplier}</p>
            </div>
          ) : null}
        </div>
      )}
    </PortalShell>
  );
}
