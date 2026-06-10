import type { WalkedFile } from "./file-walker.js";
import type { RegexRule } from "../playbook-runner/manifest.js";

export interface RegexCandidateHit {
  playbookId: string;
  ruleId: string;
  file: string;
  line: number;
  lineRange: [number, number];
  match: string;
  context: string;
  rule: RegexRule;
}

export interface RegexScanInput {
  playbookId: string;
  rules: RegexRule[];
  files: WalkedFile[];
  contextLines?: number;
  /**
   * Skip regex matching on any file that contains a line longer than
   * this. Defaults to 5000 characters. Pathologically long lines
   * (minified bundles, embedded data blobs) are the main catastrophic-
   * backtracking (ReDoS) vector when matching untrusted source, and
   * they are almost never hand-written code a user wants flagged. The
   * 2MB per-file cap in the file-walker bounds total input size; this
   * bounds per-line width so a hostile minified file in a scanned repo
   * cannot pin a CPU on a single regex.exec.
   */
  maxLineLength?: number;
}

export function runRegexScan(input: RegexScanInput): RegexCandidateHit[] {
  const contextLines = input.contextLines ?? 10;
  const maxLineLength = input.maxLineLength ?? 5000;
  const hits: RegexCandidateHit[] = [];

  const compiledRules = input.rules.map((r) => ({
    rule: r,
    regex: new RegExp(r.pattern, r.flags.includes("g") ? r.flags : `g${r.flags}`),
  }));

  for (const file of input.files) {
    const lines = file.content.split(/\r?\n/);
    // ReDoS guard: skip files with a pathologically long line.
    let longestLine = 0;
    for (const l of lines) {
      if (l.length > longestLine) longestLine = l.length;
    }
    if (longestLine > maxLineLength) continue;
    for (const { rule, regex } of compiledRules) {
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      // eslint-disable-next-line no-cond-assign
      while ((match = regex.exec(file.content)) !== null) {
        const lineNumber = lineNumberAt(file.content, match.index);
        const startLine = Math.max(1, lineNumber - contextLines);
        const endLine = Math.min(lines.length, lineNumber + contextLines);
        const context = lines
          .slice(startLine - 1, endLine)
          .map((l, idx) => `${startLine + idx}: ${l}`)
          .join("\n");
        hits.push({
          playbookId: input.playbookId,
          ruleId: rule.id,
          file: file.relativePath,
          line: lineNumber,
          lineRange: [lineNumber, lineNumber],
          match: match[0],
          context,
          rule,
        });
        // Prevent infinite loop on zero-width matches
        if (match.index === regex.lastIndex) regex.lastIndex += 1;
      }
    }
  }
  return hits;
}

function lineNumberAt(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (content[i] === "\n") line += 1;
  }
  return line;
}
