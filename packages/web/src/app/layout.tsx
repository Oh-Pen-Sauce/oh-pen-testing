import type { Metadata } from "next";
import "./globals.css";
import { safeLoadConfig } from "../lib/repo";
import { Sidebar } from "../components/trattoria/sidebar";

export const metadata: Metadata = {
  title: "Oh Pen Testing",
  description: "Local pen-testing suite — your code, your AI, your terms.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const config = await safeLoadConfig();
  const projectName = config?.project.name ?? "unconfigured";
  return (
    <html lang="en">
      <body
        className="min-h-screen trattoria"
        style={{
          background: "var(--cream)",
          color: "var(--ink)",
          fontFamily: "var(--font-body)",
        }}
      >
        <div className="flex min-h-screen">
          <Sidebar projectName={projectName} version="web · v1.0.0" />
          <main className="flex-1 overflow-x-hidden">
            <div className="max-w-[1200px] mx-auto px-10 py-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
