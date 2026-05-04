import { Link } from "react-router-dom";

const categories = [
  "IT Consulting",
  "Marketing Agencies",
  "SaaS Tools",
  "Supply Chain",
  "HR Consulting",
];

const stats = [
  { value: "5 min", label: "Average time to publish an RFQ" },
  { value: "100%", label: "Automated supplier scoring" },
  { value: "3 steps", label: "From brief to decision memo" },
  { value: "0", label: "Spreadsheets required" },
];

const benefits = [
  "AI writes the RFQ for you",
  "Structured supplier responses",
  "Automatic compliance checks",
  "Weighted scoring engine",
  "Board-ready decision memo",
  "PDF export in one click",
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-slate-800" style={{ fontFamily: "'Segoe UI', sans-serif" }}>

      {/* ── Nav ── */}
      <header className="border-b border-slate-100 bg-white sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <p className="text-sm font-bold uppercase tracking-[0.35em] text-amber-500">
            QuoteFlow
          </p>
          <nav className="hidden items-center gap-8 md:flex text-sm text-slate-600">
            <a href="#how-it-works" className="hover:text-slate-900 transition">How it works</a>
            <a href="#features" className="hover:text-slate-900 transition">Features</a>
            <a href="#why" className="hover:text-slate-900 transition">Why QuoteFlow</a>
          </nav>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm text-slate-600 hover:text-slate-900 transition">
              Sign in
            </Link>
            <Link
              to="/register"
              className="rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-400 transition"
            >
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="bg-slate-900 py-24 text-center px-6">
        <p className="text-xs uppercase tracking-[0.35em] text-amber-400 mb-5">
          AI-native procurement platform
        </p>
        <h1 className="text-5xl font-bold leading-[1.15] text-white mx-auto max-w-3xl">
          Source smarter. Decide faster.
        </h1>
        <p className="mt-5 text-lg text-slate-400 max-w-xl mx-auto leading-8">
          QuoteFlow turns your sourcing requirements into structured RFQs, scores every
          supplier response automatically, and delivers a decision memo your team can act on.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            to="/register"
            className="rounded-full bg-amber-500 px-8 py-3.5 text-sm font-semibold text-white hover:bg-amber-400 transition"
          >
            Start for free
          </Link>
          <Link
            to="/login"
            className="rounded-full border border-white/20 px-8 py-3.5 text-sm text-slate-300 hover:border-white/40 hover:text-white transition"
          >
            Sign in
          </Link>
        </div>

        {/* Category tags */}
        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {categories.map((cat) => (
            <span
              key={cat}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-slate-400"
            >
              {cat}
            </span>
          ))}
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="border-y border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-6xl grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100">
          {stats.map((s) => (
            <div key={s.value} className="px-8 py-8 text-center">
              <p className="text-3xl font-bold text-amber-500">{s.value}</p>
              <p className="mt-1.5 text-xs text-slate-500 leading-5">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Value prop ── */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">

          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-amber-500 mb-4">
              Built for procurement teams
            </p>
            <h2 className="text-3xl font-bold text-slate-900 leading-snug">
              Win better deals for your organisation
            </h2>
            <p className="mt-4 text-slate-500 leading-7">
              From the moment you describe your requirement to the moment a supplier is
              selected, QuoteFlow handles the process — so your team can focus on the decision,
              not the paperwork.
            </p>
            <ul className="mt-8 space-y-3">
              {benefits.map((b) => (
                <li key={b} className="flex items-center gap-3 text-sm text-slate-700">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 text-[10px] font-bold">
                    ✓
                  </span>
                  {b}
                </li>
              ))}
            </ul>
            <Link
              to="/register"
              className="mt-10 inline-block rounded-full bg-amber-500 px-8 py-3 text-sm font-semibold text-white hover:bg-amber-400 transition"
            >
              Register now
            </Link>
          </div>

          {/* Right — visual panel */}
          <div className="rounded-2xl bg-slate-900 p-8 text-sm">
            <p className="text-xs uppercase tracking-[0.25em] text-amber-400 mb-6">
              Live RFQ overview
            </p>
            {[
              { name: "Hardik Gupta", score: "87.4", status: "Qualifying", color: "text-emerald-400" },
              { name: "Shweta Tripathi", score: "74.1", status: "Qualifying", color: "text-emerald-400" },
              { name: "Raj Mehta", score: "—", status: "Eliminated", color: "text-rose-400" },
            ].map((r) => (
              <div
                key={r.name}
                className="flex items-center justify-between border-b border-white/[0.07] py-3 last:border-0"
              >
                <div>
                  <p className="text-white font-medium">{r.name}</p>
                  <p className={`text-xs mt-0.5 ${r.color}`}>{r.status}</p>
                </div>
                <p className="text-2xl font-semibold text-white">{r.score}</p>
              </div>
            ))}
            <div className="mt-6 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-amber-400">Recommendation</p>
              <p className="mt-1 text-white font-semibold">Preferred supplier — Hardik Gupta</p>
              <p className="mt-0.5 text-xs text-slate-400">Best price · Fastest timeline</p>
            </div>
          </div>

        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="bg-slate-50 py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-500 mb-4 text-center">
            Simple by design
          </p>
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-16">
            Three steps to a sourcing decision
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Describe",
                body: "Tell QuoteFlow what you need. The AI asks the right questions and produces a complete, structured RFQ — no templates to fill.",
                cta: "Start an RFQ →",
              },
              {
                step: "02",
                title: "Invite & Collect",
                body: "Select suppliers from your list. They respond through a guided portal. All data comes back structured and ready to compare.",
                cta: "See how →",
              },
              {
                step: "03",
                title: "Decide",
                body: "Scores, compliance flags, and a ranked decision memo are generated automatically. Share with your committee and move forward.",
                cta: "See the memo →",
              },
            ].map((item) => (
              <div key={item.step} className="bg-white rounded-2xl p-8 border border-slate-100">
                <p className="text-4xl font-bold text-amber-100">{item.step}</p>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{item.title}</h3>
                <p className="mt-3 text-sm text-slate-500 leading-7">{item.body}</p>
                <Link
                  to="/register"
                  className="mt-6 inline-block text-sm font-semibold text-amber-500 hover:text-amber-400 transition"
                >
                  {item.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonial ── */}
      <section id="why" className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="text-3xl font-semibold text-slate-800 leading-snug">
          "We cut our RFQ process from two weeks to a single afternoon.
          The scoring memo alone saved hours of committee time."
        </p>
        <p className="mt-6 text-sm text-slate-500">
          — Procurement Lead, Financial Services firm
        </p>
      </section>

      {/* ── Bottom CTA band ── */}
      <section className="bg-slate-900 py-20 px-6 text-center">
        <h2 className="text-3xl font-bold text-white">
          Ready to run your first RFQ?
        </h2>
        <p className="mt-4 text-slate-400 text-sm max-w-md mx-auto">
          No setup, no onboarding call. Create an account and have a supplier shortlist
          ready before your next meeting.
        </p>
        <Link
          to="/register"
          className="mt-8 inline-block rounded-full bg-amber-500 px-10 py-3.5 text-sm font-semibold text-white hover:bg-amber-400 transition"
        >
          Create free account
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-10 grid grid-cols-2 gap-8 md:grid-cols-4 text-sm">
          <div>
            <p className="font-bold uppercase tracking-[0.35em] text-amber-500 text-xs mb-4">
              QuoteFlow
            </p>
            <p className="text-slate-500 text-xs leading-6">
              AI-native procurement platform for modern sourcing teams.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-700 mb-4 text-xs uppercase tracking-wide">Product</p>
            <ul className="space-y-2.5 text-xs text-slate-500">
              <li><a href="#features" className="hover:text-slate-800 transition">Features</a></li>
              <li><a href="#how-it-works" className="hover:text-slate-800 transition">How it works</a></li>
              <li><Link to="/register" className="hover:text-slate-800 transition">Get started</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-slate-700 mb-4 text-xs uppercase tracking-wide">Categories</p>
            <ul className="space-y-2.5 text-xs text-slate-500">
              {categories.slice(0, 4).map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-slate-700 mb-4 text-xs uppercase tracking-wide">Account</p>
            <ul className="space-y-2.5 text-xs text-slate-500">
              <li><Link to="/login" className="hover:text-slate-800 transition">Sign in</Link></li>
              <li><Link to="/register" className="hover:text-slate-800 transition">Register</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-100 px-6 py-4 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} QuoteFlow. All rights reserved.
        </div>
      </footer>

    </div>
  );
}
