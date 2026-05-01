import PortalFrame from "../components/PortalFrame";

export default function InvalidLink() {
  return (
    <PortalFrame
      title="This link is no longer available"
      subtitle="The invitation may be invalid, expired, or already used for a completed submission."
    >
      <section className="rounded-[28px] border border-rose-200 bg-white/90 p-8 shadow-xl">
        <h2 className="text-2xl font-semibold text-slate-950">Unable to open response form</h2>
        <p className="mt-3 text-sm text-slate-600">
          If you believe this is a mistake, contact the buyer directly and ask for a fresh invitation link.
        </p>
      </section>
    </PortalFrame>
  );
}
