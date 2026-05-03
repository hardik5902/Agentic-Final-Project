import { Link, Navigate } from "react-router-dom";
import PortalFrame from "../components/PortalFrame";
import { getRememberedPortalToken } from "../lib/session";

export default function Home() {
  const rememberedToken = getRememberedPortalToken();

  if (rememberedToken) {
    return <Navigate to={`/${rememberedToken}`} replace />;
  }

  return (
    <PortalFrame
      title="Supplier portal"
      subtitle="Use your invitation email to enter the portal, review all RFQs you've received, and come back to update submitted responses before deadlines."
    >
      <section className="rounded-[28px] border border-slate-900/10 bg-white/90 p-8 shadow-xl">
        <h2 className="text-2xl font-semibold text-slate-950">Open your invitation link</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Each invitation email now opens your supplier inbox. From there, you can see all current RFQs from that buyer, start pending responses, and revisit submitted responses while the RFQ is still open.
        </p>
        <Link
          to="/invalid"
          className="mt-6 inline-flex rounded-full border border-slate-200 px-5 py-3 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          I need a fresh link
        </Link>
      </section>
    </PortalFrame>
  );
}
