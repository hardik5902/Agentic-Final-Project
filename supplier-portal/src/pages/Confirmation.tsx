import { Link, useLocation } from "react-router-dom";
import PortalFrame from "../components/PortalFrame";
import { getRememberedPortalToken } from "../lib/session";

export default function Confirmation() {
  const location = useLocation();
  const state = location.state as { summary?: Record<string, unknown>; portalToken?: string } | null;
  const rememberedToken = getRememberedPortalToken();
  const portalHref = state?.portalToken
    ? `/${state.portalToken}`
    : rememberedToken
      ? `/${rememberedToken}`
      : "/";

  return (
    <PortalFrame
      title="Response submitted"
      subtitle="Your proposal has been delivered to the buyer. You can return to your supplier inbox at any time."
    >
      <section className="rounded-[28px] border border-emerald-200 bg-white/90 p-8 shadow-xl">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
          OK
        </div>
        <h2 className="mt-4 text-2xl font-semibold text-slate-950">Thank you</h2>
        <p className="mt-2 text-sm text-slate-600">
          The buyer has your response and any uploaded materials.
        </p>
        {state?.summary ? (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {Object.entries(state.summary).map(([key, value]) => (
              <div key={key} className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  {key.replace(/_/g, " ")}
                </p>
                <p className="mt-1 text-sm text-slate-900">{String(value)}</p>
              </div>
            ))}
          </div>
        ) : null}
        <Link to={portalHref} className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm text-white">
          Return to inbox
        </Link>
      </section>
    </PortalFrame>
  );
}
