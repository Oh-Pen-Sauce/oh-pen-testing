"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { href: "/docs/install", label: "Install" },
  { href: "/docs/setup", label: "Setup" },
  { href: "/docs/first-scan", label: "First Scan" },
  { href: "/docs/agents", label: "Agents" },
  { href: "/docs/reports", label: "Reports" },
];

function DocsNav() {
  const pathname = usePathname() ?? "";
  return (
    <div
      className="flex gap-2 mb-8 flex-wrap p-1 rounded-xl"
      style={{
        background: "var(--cream)",
        border: "2px solid var(--ink)",
        boxShadow: "3px 3px 0 var(--ink)",
      }}
    >
      {SECTIONS.map((s, i) => {
        const active = pathname.startsWith(s.href);
        return (
          <Link
            key={s.href}
            href={s.href}
            className="px-4 py-2 text-[13px] font-bold rounded-lg border-2 transition-all"
            style={{
              fontFamily: "var(--font-mono)",
              background: active ? "var(--sauce)" : "transparent",
              color: active ? "var(--cream)" : "var(--ink)",
              borderColor: active ? "var(--ink)" : "transparent",
              boxShadow: active ? "2px 2px 0 var(--ink)" : undefined,
            }}
          >
            {i + 1}. {s.label}
          </Link>
        );
      })}
    </div>
  );
}

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <DocsNav />
      {children}
    </div>
  );
}
