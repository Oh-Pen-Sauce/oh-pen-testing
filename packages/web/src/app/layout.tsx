import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { safeLoadConfig } from "../lib/repo";
import { Sidebar } from "../components/trattoria/sidebar";

export const metadata: Metadata = {
  title: "Oh Pen Testing",
  description: "Local pen-testing suite — your code, your AI, your terms.",
};

// Self-hosted Google Fonts via next/font — no runtime @import, no layout
// shift. Each one binds a CSS variable so the tokens in globals.css
// (--font-body etc.) resolve to the right face on every surface.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});
const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["700", "900"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const config = await safeLoadConfig();
  const projectName = config?.project.name ?? "unconfigured";
  return (
    <html
      lang="en"
      className={`${inter.variable} ${mono.variable} ${display.variable}`}
    >
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
