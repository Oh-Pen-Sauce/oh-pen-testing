import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { safeLoadConfig } from "../lib/repo";

export const metadata: Metadata = {
  title: "Oh Pen Testing",
  description: "Local pen-testing suite — your code, your AI, your terms.",
};

const NAV = [
  { href: "/", label: "Home" },
  { href: "/board", label: "Board" },
  { href: "/scans", label: "Scans" },
  { href: "/settings", label: "Settings" },
  { href: "/setup", label: "Setup" },
];

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const config = await safeLoadConfig();
  const projectName = config?.project.name ?? "Oh Pen Testing";
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <div className="flex min-h-screen">
          <aside className="w-56 border-r border-slate-200 bg-white">
            <div className="px-5 py-4 border-b border-slate-200">
              <div className="text-xl">🛡️</div>
              <div className="font-bold text-sm mt-1">Oh Pen Testing</div>
              <div className="text-xs text-slate-500 truncate" title={projectName}>
                {projectName}
              </div>
            </div>
            <nav className="py-3">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="block px-5 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="flex-1 overflow-x-hidden">
            <div className="max-w-6xl mx-auto px-8 py-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
