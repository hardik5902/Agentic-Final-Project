import { useParams } from "react-router-dom";
import PortalShell from "../components/PortalShell";
import { useGenerateMemo, useMemo as useMemoQuery } from "../hooks/useAnalysis";

export default function Memo() {
  const { id } = useParams();
  const { data, isLoading, error } = useMemoQuery(id);
  const generateMemo = useGenerateMemo(id);

  return (
    <PortalShell
      title="Decision memo"
      eyebrow="Turn scoring results into a sourcing recommendation and keep the generated memo ready for download or final award."
    >
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void generateMemo.mutateAsync()}
          className="rounded-full bg-amber-300 px-5 py-3 text-sm font-medium text-slate-950"
        >
          Generate memo
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
        <div className="h-96 animate-pulse rounded-[24px] border border-white/10 bg-white/5" />
      ) : error ? (
        <div className="rounded-[24px] border border-rose-300/20 bg-rose-400/10 p-6 text-rose-100">
          Unable to load the memo yet.
        </div>
      ) : (
        <section className="rounded-[24px] border border-white/10 bg-slate-950/60 p-6 shadow-xl">
          <div className="rounded-[20px] border border-white/10 bg-slate-900/70 p-5">
            <pre className="whitespace-pre-wrap text-sm leading-7 text-slate-200">
              {data?.memo_text ??
                "Generate the memo once scoring is complete. The final recommendation will appear here."}
            </pre>
          </div>
          <button
            type="button"
            className="mt-6 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 text-sm text-cyan-100"
          >
            Award to recommended supplier
          </button>
        </section>
      )}
    </PortalShell>
  );
}
