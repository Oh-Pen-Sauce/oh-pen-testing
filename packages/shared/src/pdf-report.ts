import type { Issue } from "./models/issue.js";
import type { ScanRun } from "./models/scan.js";
import type { Severity } from "./config/schema.js";

/**
 * PDF pen-test report generator.
 *
 * Produces a consultancy-grade deliverable: cover page, executive summary
 * with findings-by-severity bar chart, methodology, per-issue detail with
 * scanner output + AI analysis split, verification status, residual risks,
 * signature page.
 *
 * Implementation uses pdfkit (pure JS, no Chromium dependency) so the CLI
 * can generate a PDF without shelling out to a browser.
 */

export interface BuildPdfReportInput {
  issues: Issue[];
  scan: ScanRun | null;
  toolVersion: string;
  projectName: string;
  repoCommitSha?: string;
  generatedAt?: Date;
}

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];
const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "#B91C1C",
  high: "#EA580C",
  medium: "#CA8A04",
  low: "#2563EB",
  info: "#475569",
};

export async function buildPdfReport(
  input: BuildPdfReportInput,
): Promise<Uint8Array> {
  // Dynamic import so consumers who don't use PDF output don't pay the
  // pdfkit bundle cost.
  const PDFDocument = (await import("pdfkit")).default;

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 60, bottom: 60, left: 60, right: 60 },
    info: {
      Title: `Oh Pen Testing Report — ${input.projectName}`,
      Author: `Oh Pen Testing v${input.toolVersion}`,
      Subject: "Security assessment",
      Producer: "Oh Pen Testing",
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const doneP = new Promise<void>((resolve, reject) => {
    doc.on("end", () => resolve());
    doc.on("error", (err) => reject(err));
  });

  renderCover(doc, input);
  renderExecutiveSummary(doc, input);
  renderMethodology(doc, input);
  renderFindings(doc, input);
  renderResidualRisks(doc, input);
  renderSignature(doc, input);

  doc.end();
  await doneP;
  return Buffer.concat(chunks);
}

type PDFDoc = InstanceType<Awaited<ReturnType<typeof importPdfKit>>>;
async function importPdfKit() {
  const mod = await import("pdfkit");
  return mod.default;
}

function renderCover(doc: PDFDoc, input: BuildPdfReportInput): void {
  const now = input.generatedAt ?? new Date();
  doc.fontSize(10).fillColor("#64748B").text("Oh Pen Testing", { align: "right" });
  doc.moveDown(6);
  doc
    .fontSize(32)
    .fillColor("#0F172A")
    .text("Security Assessment Report", { align: "left" });
  doc.moveDown(0.5);
  doc
    .fontSize(18)
    .fillColor("#334155")
    .text(input.projectName, { align: "left" });
  doc.moveDown(2);

  doc.fontSize(10).fillColor("#475569");
  doc.text(`Generated: ${now.toISOString()}`);
  if (input.scan?.id) doc.text(`Scan ID: ${input.scan.id}`);
  if (input.repoCommitSha) doc.text(`Commit: ${input.repoCommitSha}`);
  doc.text(`Tool version: Oh Pen Testing v${input.toolVersion}`);

  doc.moveDown(4);
  doc
    .fontSize(8)
    .fillColor("#94A3B8")
    .text(
      "This report was produced by automated scanning with AI-assisted confirmation. Every finding includes the raw scanner output (machine-verifiable) alongside AI analysis (advisory). See the Methodology section for details.",
      { align: "left" },
    );

  doc.addPage();
}

function renderExecutiveSummary(doc: PDFDoc, input: BuildPdfReportInput): void {
  const counts: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  const verifiedCounts: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const i of input.issues) {
    counts[i.severity] = (counts[i.severity] ?? 0) + 1;
    if (i.status === "verified") {
      verifiedCounts[i.severity] = (verifiedCounts[i.severity] ?? 0) + 1;
    }
  }

  sectionHeading(doc, "Executive Summary");

  const total = input.issues.length;
  const verified = input.issues.filter((i) => i.status === "verified").length;
  const open = total - verified;
  doc
    .fontSize(11)
    .fillColor("#0F172A")
    .text(
      `This scan produced ${total} finding${total === 1 ? "" : "s"} across ${input.scan?.playbooks_run ?? 0} playbook${input.scan?.playbooks_run === 1 ? "" : "s"}. ${verified} finding${verified === 1 ? "" : "s"} ${verified === 1 ? "has" : "have"} been verified as remediated; ${open} remain${open === 1 ? "s" : ""} open.`,
      { align: "left" },
    );

  doc.moveDown(1.5);

  // Severity bar chart
  const chartLeft = doc.x;
  const chartTop = doc.y;
  const maxCount = Math.max(1, ...Object.values(counts));
  const barMaxWidth = 280;
  const barHeight = 16;
  const rowGap = 28;

  for (let i = 0; i < SEVERITY_ORDER.length; i += 1) {
    const sev = SEVERITY_ORDER[i]!;
    const count = counts[sev] ?? 0;
    const verifiedCount = verifiedCounts[sev] ?? 0;
    const y = chartTop + i * rowGap;
    doc
      .fontSize(10)
      .fillColor("#0F172A")
      .text(cap(sev), chartLeft, y, { width: 60, continued: false });
    const barWidth = (count / maxCount) * barMaxWidth;
    const color = SEVERITY_COLORS[sev] ?? "#475569";
    doc
      .fillColor(color)
      .roundedRect(chartLeft + 72, y, Math.max(2, barWidth), barHeight, 2)
      .fill();
    doc
      .fontSize(10)
      .fillColor("#0F172A")
      .text(
        `${count}${verifiedCount > 0 ? ` (${verifiedCount} verified)` : ""}`,
        chartLeft + 72 + Math.max(2, barWidth) + 8,
        y,
        { width: 120 },
      );
  }
  doc.y = chartTop + SEVERITY_ORDER.length * rowGap + 10;

  doc.moveDown(1);
  doc
    .fontSize(10)
    .fillColor("#475569")
    .text(
      "Severity is assigned by AI confirmation per finding, with the underlying playbook's default severity as the baseline. See individual findings for AI confidence and reasoning.",
    );

  doc.addPage();
}

function renderMethodology(doc: PDFDoc, input: BuildPdfReportInput): void {
  sectionHeading(doc, "Methodology");
  doc
    .fontSize(11)
    .fillColor("#0F172A")
    .text(
      "The assessment was conducted using Oh Pen Testing v" +
        input.toolVersion +
        ", an open-source AI-assisted security scanner. The engine operates in two passes:",
      { align: "left" },
    );
  doc.moveDown(0.5);
  doc
    .list(
      [
        "Deterministic pattern matching — regex rules per playbook run across all source files, producing candidate findings with exact line + column positions.",
        "AI confirmation — each candidate is independently evaluated by the configured LLM with a constrained JSON-schema response. The AI assigns final severity and filters obvious false positives.",
      ],
      { bulletRadius: 2 },
    );
  doc.moveDown(0.5);

  doc
    .fontSize(11)
    .fillColor("#0F172A")
    .text(
      "AI output is advisory. Every finding ships with the raw scanner output the AI was reasoning about — this is the authoritative artefact for reproduction.",
      { align: "left" },
    );
  doc.moveDown(1);

  doc.fontSize(12).fillColor("#0F172A").text("Standards bundled");
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor("#334155");
  doc.list(
    [
      "OWASP Top 10 2021 — all ten categories",
      "OWASP WSTG — core subset",
      "CWE Top 25 — critical subset",
      "Secrets detection — TruffleHog-compatible ruleset",
      "SCA — npm audit, pip-audit, bundler-audit",
    ],
    { bulletRadius: 2 },
  );

  doc.moveDown(1);
  if (input.scan) {
    doc.fontSize(12).fillColor("#0F172A").text("This scan");
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#334155");
    doc.text(`Provider: ${input.scan.provider}`);
    doc.text(`Playbooks run: ${input.scan.playbooks_run}`);
    doc.text(`Playbooks skipped: ${input.scan.playbooks_skipped}`);
    doc.text(`AI calls: ${input.scan.ai_calls}`);
    doc.text(`Started: ${input.scan.started_at}`);
    doc.text(`Ended: ${input.scan.ended_at ?? "—"}`);
  }

  doc.addPage();
}

function renderFindings(doc: PDFDoc, input: BuildPdfReportInput): void {
  sectionHeading(doc, "Findings");

  if (input.issues.length === 0) {
    doc
      .fontSize(11)
      .fillColor("#0F172A")
      .text(
        "No findings. The scanned codebase passed every enabled playbook cleanly at this scan.",
      );
    doc.addPage();
    return;
  }

  const sorted = [...input.issues].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity),
  );

  for (let i = 0; i < sorted.length; i += 1) {
    const issue = sorted[i]!;
    if (i > 0) doc.moveDown(1.2);

    // Per-finding heading
    doc
      .fontSize(13)
      .fillColor("#0F172A")
      .text(`${issue.id} — ${issue.title}`, { align: "left" });
    doc.moveDown(0.2);

    // Chip row: severity, OWASP, CWEs, status
    const chips: Array<[string, string]> = [
      [cap(issue.severity), SEVERITY_COLORS[issue.severity] ?? "#475569"],
    ];
    if (issue.owasp_category)
      chips.push([issue.owasp_category, "#475569"]);
    for (const c of issue.cwe) chips.push([c, "#475569"]);
    chips.push([
      `Status: ${issue.status}`,
      issue.status === "verified" ? "#16A34A" : "#64748B",
    ]);
    renderChips(doc, chips);
    doc.moveDown(0.5);

    // Location
    doc
      .fontSize(10)
      .fillColor("#475569")
      .text(
        `Location: ${issue.location.file}:${issue.location.line_range[0]}${
          issue.location.line_range[1] !== issue.location.line_range[0]
            ? `-${issue.location.line_range[1]}`
            : ""
        }`,
      );
    if (issue.evidence.rule_id) {
      doc.text(`Rule: ${issue.evidence.rule_id}`);
    }
    if (issue.linked_pr) {
      doc.text(`PR: ${issue.linked_pr}`);
    }
    if (issue.verification.verified_at) {
      doc.text(`Verified at: ${issue.verification.verified_at}`);
    }
    doc.moveDown(0.5);

    // Scanner output (monospace, indented)
    doc.fontSize(10).fillColor("#0F172A").text("Scanner output:");
    doc.moveDown(0.2);
    doc
      .fontSize(9)
      .fillColor("#1E293B")
      .font("Courier")
      .text(
        issue.evidence.code_snippet.split("\n").slice(0, 12).join("\n"),
        { indent: 12 },
      );
    doc.font("Helvetica");
    doc.moveDown(0.5);

    // AI analysis
    doc.fontSize(10).fillColor("#0F172A").text("AI analysis:");
    doc.moveDown(0.2);
    doc
      .fontSize(10)
      .fillColor("#334155")
      .text(issue.evidence.analysis, { indent: 12, align: "left" });
    if (
      issue.evidence.ai_reasoning &&
      issue.evidence.ai_reasoning !== issue.evidence.analysis
    ) {
      doc.moveDown(0.3);
      doc
        .fontSize(9)
        .fillColor("#64748B")
        .text(`Reasoning: ${issue.evidence.ai_reasoning}`, {
          indent: 12,
          align: "left",
        });
    }
    if (issue.evidence.ai_model) {
      doc.moveDown(0.2);
      doc
        .fontSize(8)
        .fillColor("#94A3B8")
        .text(
          `Model: ${issue.evidence.ai_model}${issue.evidence.ai_confidence ? ` · confidence: ${issue.evidence.ai_confidence}` : ""}`,
          { indent: 12 },
        );
    }

    // Page break every ~3 findings to keep layout readable
    if ((i + 1) % 3 === 0 && i < sorted.length - 1) doc.addPage();
  }
  doc.addPage();
}

function renderResidualRisks(
  doc: PDFDoc,
  input: BuildPdfReportInput,
): void {
  sectionHeading(doc, "Residual Risks");
  const open = input.issues.filter(
    (i) => i.status !== "verified" && i.status !== "wont_fix" && i.status !== "done",
  );
  const wontFix = input.issues.filter((i) => i.status === "wont_fix");
  const bySeverity = (list: Issue[], s: Severity) =>
    list.filter((i) => i.severity === s).length;

  doc.fontSize(11).fillColor("#0F172A");
  doc.text(
    `${open.length} finding${open.length === 1 ? "" : "s"} remain open at the time of this report:`,
  );
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor("#334155");
  for (const s of SEVERITY_ORDER) {
    const n = bySeverity(open, s);
    if (n > 0) doc.text(`  ${cap(s)}: ${n}`);
  }

  if (wontFix.length > 0) {
    doc.moveDown(1);
    doc.fontSize(11).fillColor("#0F172A").text("Explicitly accepted risks (won't fix):");
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#334155");
    for (const w of wontFix) {
      doc.text(`  ${w.id} · ${cap(w.severity)} · ${w.title}`);
    }
  }

  doc.moveDown(1);
  doc
    .fontSize(10)
    .fillColor("#475569")
    .text(
      "Finding absence is not proof of absence of vulnerability. This scan covers the 22 OWASP Top 10 2021 playbooks bundled with Oh Pen Testing v" +
        input.toolVersion +
        "; it does not replace manual penetration testing, threat modelling, or red-team engagement.",
    );

  doc.addPage();
}

function renderSignature(doc: PDFDoc, input: BuildPdfReportInput): void {
  sectionHeading(doc, "Signature");
  const now = input.generatedAt ?? new Date();
  doc.fontSize(10).fillColor("#334155");
  doc.text(`Tool: Oh Pen Testing v${input.toolVersion}`);
  doc.text(`Generated: ${now.toISOString()}`);
  if (input.scan?.id) doc.text(`Scan ID: ${input.scan.id}`);
  if (input.repoCommitSha) doc.text(`Repo commit: ${input.repoCommitSha}`);
  doc.text(`Project: ${input.projectName}`);
  doc.text(`Report format version: 1`);

  doc.moveDown(2);
  doc
    .fontSize(8)
    .fillColor("#94A3B8")
    .text(
      "This report is reproducible: running Oh Pen Testing v" +
        input.toolVersion +
        " at the same commit with the same config.yml should produce substantively the same findings. AI confirmation text may vary between runs.",
    );
}

function sectionHeading(doc: PDFDoc, title: string): void {
  doc
    .fontSize(18)
    .fillColor("#0F172A")
    .text(title, { align: "left" });
  doc.moveDown(0.2);
  doc
    .strokeColor("#CBD5E1")
    .lineWidth(1)
    .moveTo(doc.x, doc.y)
    .lineTo(doc.x + 480, doc.y)
    .stroke();
  doc.moveDown(0.5);
}

function renderChips(doc: PDFDoc, chips: Array<[string, string]>): void {
  const startY = doc.y;
  const startX = doc.x;
  let x = startX;
  const padY = 4;
  const padX = 8;
  const gap = 6;
  for (const [label, color] of chips) {
    doc.fontSize(9);
    const labelWidth = doc.widthOfString(label);
    const chipWidth = labelWidth + padX * 2;
    const chipHeight = doc.currentLineHeight() + padY * 2;
    if (x + chipWidth > 540) {
      x = startX;
      doc.y += chipHeight + 4;
    }
    doc
      .roundedRect(x, doc.y, chipWidth, chipHeight, 4)
      .fillAndStroke(color, color);
    doc.fillColor("#FFFFFF").text(label, x + padX, doc.y + padY, {
      width: labelWidth,
      lineBreak: false,
    });
    x += chipWidth + gap;
  }
  doc.y = startY + doc.currentLineHeight() + padY * 2 + 4;
  doc.x = startX;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function severityRank(s: Severity): number {
  const rank: Record<Severity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };
  return rank[s];
}
