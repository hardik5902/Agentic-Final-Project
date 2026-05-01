import { Link, NavLink, useLocation } from "react-router-dom";
import { clearToken } from "../lib/auth";
import { cn } from "../lib/utils";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/rfq/new", label: "New RFQ" },
  { to: "/suppliers", label: "Suppliers" },
];

export default function PortalShell({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  const location = useLocation();

  return (
    <div className="min-h-screen px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/60 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-6 px-6 py-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-amber-300/80">
                QuoteFlow Buyer Portal
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-white">{title}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">{eyebrow}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    cn(
                      "rounded-full px-4 py-2 text-sm transition",
                      isActive ||
                        (link.to !== "/" && location.pathname.startsWith(link.to))
                        ? "bg-amber-300 text-slate-950"
                        : "bg-white/5 text-slate-200 hover:bg-white/10",
                    )
                  }
                >
                  {link.label}
                </NavLink>
              ))}
              <Link
                to="/login"
                onClick={() => clearToken()}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-white/20 hover:text-white"
              >
                Sign out
              </Link>
            </div>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
