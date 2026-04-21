import type { Issue } from "./models/issue.js";
import type { ScanRun } from "./models/scan.js";

/**
 * Share card — an SVG image summarising a scan result, suitable for
 * Twitter/X / LinkedIn / Mastodon social preview, or for embedding
 * in a README badge.
 *
 * 1200×630 is the standard social-preview aspect ratio.
 *
 * No telemetry assumptions here — this runs purely locally and is
 * written to disk by `opt share`. The user decides whether to post it.
 */

export interface ShareCardInput {
  projectName: string;
  scan: ScanRun;
  issues: Issue[];
  linesScanned: number;
  filesScanned: number;
  toolVersion: string;
  /** Base URL for the "Try it yourself" CTA. Defaults to the OSS website. */
  websiteUrl?: string;
}

export function buildShareCardSvg(input: ShareCardInput): string {
  const website = input.websiteUrl ?? "oh-pen-sauce.com";
  const total = input.issues.length;
  const verified = input.issues.filter((i) => i.status === "verified").length;
  const critical = input.issues.filter((i) => i.severity === "critical").length;
  const high = input.issues.filter((i) => i.severity === "high").length;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E1B4B"/>
      <stop offset="100%" stop-color="#312E81"/>
    </linearGradient>
    <linearGradient id="tomato" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#DC2626"/>
      <stop offset="100%" stop-color="#B91C1C"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Logo + wordmark -->
  <g transform="translate(80, 70)">
    <circle cx="25" cy="25" r="25" fill="url(#tomato)"/>
    <text x="25" y="35" font-family="Helvetica,Arial,sans-serif" font-size="32" fill="white" text-anchor="middle">🛡</text>
    <text x="72" y="34" font-family="Helvetica,Arial,sans-serif" font-size="28" font-weight="700" fill="white">Oh Pen Testing</text>
  </g>

  <!-- Headline -->
  <text x="80" y="230" font-family="Helvetica,Arial,sans-serif" font-size="54" font-weight="800" fill="white">${escapeXml(input.projectName)}</text>
  <text x="80" y="280" font-family="Helvetica,Arial,sans-serif" font-size="28" font-weight="400" fill="#C7D2FE">security scan results</text>

  <!-- Stats grid -->
  <g transform="translate(80, 340)">
    ${statBox(0, 0, formatNumber(input.linesScanned), "lines analysed", "#60A5FA")}
    ${statBox(270, 0, formatNumber(total), "issues found", "#F59E0B")}
    ${statBox(540, 0, formatNumber(verified), "verified fixed", "#34D399")}
    ${statBox(810, 0, formatNumber(critical + high), "critical + high", "#F87171")}
  </g>

  <!-- Footer -->
  <text x="80" y="580" font-family="Helvetica,Arial,sans-serif" font-size="22" fill="#E0E7FF">🍅 Free · Open source · Local · Your AI, your code, your terms</text>
  <text x="1120" y="580" font-family="Helvetica,Arial,sans-serif" font-size="22" fill="#C7D2FE" text-anchor="end">${escapeXml(website)}</text>
</svg>`;
}

function statBox(
  x: number,
  y: number,
  value: string,
  label: string,
  accent: string,
): string {
  return `
    <g transform="translate(${x}, ${y})">
      <rect x="0" y="0" width="250" height="180" rx="16" fill="rgba(255,255,255,0.06)" stroke="${accent}" stroke-opacity="0.35"/>
      <text x="25" y="75" font-family="Helvetica,Arial,sans-serif" font-size="64" font-weight="800" fill="white">${escapeXml(value)}</text>
      <text x="25" y="130" font-family="Helvetica,Arial,sans-serif" font-size="22" fill="${accent}">${escapeXml(label)}</text>
    </g>
  `.trim();
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 10_000) return Math.round(n / 1000) + "k";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Renders the share card as a ready-to-post text snippet (for pasting
 * into a tweet, LinkedIn post, etc). Not a share card per se, but
 * complements the SVG image.
 */
export function buildShareCardText(input: ShareCardInput): string {
  const total = input.issues.length;
  const verified = input.issues.filter((i) => i.status === "verified").length;
  const critical = input.issues.filter((i) => i.severity === "critical").length;
  const website = input.websiteUrl ?? "https://oh-pen-sauce.com";
  const projectLine = input.projectName
    ? ` on ${input.projectName}`
    : "";
  return `Just ran a security scan${projectLine} with Oh Pen Testing 🛡️

📏 ${formatNumber(input.linesScanned)} lines analysed
🔎 ${total} issue${total === 1 ? "" : "s"} found${critical > 0 ? ` (${critical} critical)` : ""}
✅ ${verified} fixed and verified

It's free, open source, and runs entirely on my machine with my own AI — no code leaves the laptop.

Try it yourself: ${website}
#oss #appsec #devtools`;
}
