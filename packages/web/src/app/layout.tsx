import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oh Pen Testing",
  description: "Local pen-testing suite — your code, your AI, your terms.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900">{children}</body>
    </html>
  );
}
