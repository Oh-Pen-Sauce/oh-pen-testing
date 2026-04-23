"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AGENTS } from "./agents";
import { TinyLogo } from "./tiny-logo";

const NAV: Array<{ href: string; label: string; icon: string }> = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/projects", label: "Projects", icon: "📦" },
  { href: "/board", label: "Board", icon: "🗂️" },
  { href: "/reviews", label: "Reviews", icon: "👀" },
  { href: "/playbooks", label: "Playbooks", icon: "📖" },
  { href: "/scans", label: "Scans", icon: "🔎" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
  { href: "/setup", label: "Setup", icon: "🧑‍🍳" },
];

export function Sidebar({
  projectName,
  version,
}: {
  projectName: string;
  version: string;
}) {
  const pathname = usePathname() ?? "/";
  return (
    <aside
      className="w-[240px] flex flex-col h-screen sticky top-0 overflow-y-auto"
      style={{
        background: "var(--cream-soft)",
        borderRight: "2px solid var(--ink)",
      }}
    >
      {/* brand */}
      <div
        className="px-[18px] pt-[18px] pb-4 flex items-center gap-2.5"
        style={{ borderBottom: "2px solid var(--ink)" }}
      >
        <TinyLogo size={38} />
        <div className="min-w-0">
          <div
            className="font-black italic text-[17px] leading-none text-ink truncate"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Oh Pen <span className="text-sauce">Testing</span>
          </div>
          <div
            className="text-[10px] tracking-[0.1em] uppercase text-ink-soft mt-1 font-semibold truncate"
            title={projectName}
          >
            {version} · {projectName}
          </div>
        </div>
      </div>

      {/* nav */}
      <nav className="p-2.5 flex-1">
        {NAV.map((n) => {
          const active =
            n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-2.5 px-3 py-[9px] text-sm font-medium rounded-lg mb-0.5 transition-all ${
                active
                  ? "bg-sauce text-cream border-2 border-ink shadow-ink"
                  : "text-ink border-2 border-transparent hover:bg-parmesan/40"
              }`}
            >
              <span className="text-[14px]" aria-hidden>
                {n.icon}
              </span>
              <span>{n.label}</span>
              {active ? (
                <span className="ml-auto text-[11px]" aria-hidden>
                  →
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* agent roster */}
      <div
        className="p-3.5"
        style={{ borderTop: "2px dashed var(--ink)" }}
      >
        <div
          className="text-[10px] font-bold tracking-[0.15em] uppercase mb-2.5"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--sauce-dark)",
          }}
        >
          Agent roster
        </div>
        {AGENTS.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-2 px-2 py-[7px] rounded-md mb-1"
            style={{
              background: "var(--cream)",
              border: "1.5px solid var(--ink)",
            }}
          >
            <div
              className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[12px] shrink-0"
              style={{
                background: a.color,
                color: "var(--cream)",
                border: "1.5px solid var(--ink)",
              }}
              aria-hidden
            >
              {a.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold text-ink truncate">
                {a.name}
              </div>
              <div
                className="text-[9.5px] text-ink-soft truncate"
                title={a.tag}
              >
                {a.tag}
              </div>
            </div>
            <span
              className="w-[6px] h-[6px] rounded-full shrink-0"
              style={{ background: a.color }}
              aria-hidden
            />
          </div>
        ))}
      </div>
    </aside>
  );
}
