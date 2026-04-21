import type { Issue } from "./models/issue.js";
import type { ScanRun } from "./models/scan.js";
import type { Severity } from "./config/schema.js";

/**
 * Minimal SARIF 2.1.0 emitter. Spec:
 *   https://docs.oasis-open.org/sarif/sarif/v2.1.0/os/sarif-v2.1.0-os.html
 * GitHub Code Scanning consumes this format directly; SARIF output also
 * feeds Snyk's viewer, Sonatype, and most AppSec dashboards.
 *
 * We emit one SARIF `runs[]` entry per scan. Each issue becomes a
 * `results[]` entry. Playbook IDs become `rules[]` (deduplicated by id).
 */

export interface SarifLog {
  $schema: string;
  version: "2.1.0";
  runs: SarifRun[];
}

interface SarifRun {
  tool: {
    driver: {
      name: string;
      version: string;
      informationUri: string;
      rules: SarifRule[];
    };
  };
  invocations: Array<{
    executionSuccessful: boolean;
    startTimeUtc?: string;
    endTimeUtc?: string;
  }>;
  results: SarifResult[];
}

interface SarifRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  fullDescription?: { text: string };
  defaultConfiguration?: { level: SarifLevel };
  properties?: { tags?: string[] };
}

interface SarifResult {
  ruleId: string;
  level: SarifLevel;
  message: { text: string };
  locations: Array<{
    physicalLocation: {
      artifactLocation: { uri: string };
      region: {
        startLine: number;
        endLine?: number;
        startColumn?: number;
        snippet?: { text: string };
      };
    };
  }>;
  properties?: {
    severity?: Severity;
    issueId?: string;
    status?: string;
    owaspCategory?: string;
    cwe?: string[];
    aiModel?: string;
    aiConfidence?: "low" | "medium" | "high";
  };
}

type SarifLevel = "none" | "note" | "warning" | "error";

export const TOOL_DRIVER_NAME = "Oh Pen Testing";
export const TOOL_INFO_URI = "https://github.com/Oh-Pen-Sauce/oh-pen-testing";

export interface BuildSarifInput {
  issues: Issue[];
  scan: ScanRun;
  toolVersion: string;
}

export function buildSarifLog(input: BuildSarifInput): SarifLog {
  const { issues, scan, toolVersion } = input;
  const rulesById = new Map<string, SarifRule>();

  for (const issue of issues) {
    const ruleId = issue.evidence.rule_id ?? issue.discovered_by;
    if (rulesById.has(ruleId)) continue;
    rulesById.set(ruleId, {
      id: ruleId,
      name: ruleId,
      shortDescription: {
        text: issue.title.split(" in ")[0] ?? issue.title,
      },
      defaultConfiguration: {
        level: severityToLevel(issue.severity),
      },
      properties: {
        tags: [
          "security",
          ...(issue.owasp_category ? [issue.owasp_category] : []),
          ...issue.cwe,
        ],
      },
    });
  }

  return {
    $schema:
      "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: TOOL_DRIVER_NAME,
            version: toolVersion,
            informationUri: TOOL_INFO_URI,
            rules: Array.from(rulesById.values()),
          },
        },
        invocations: [
          {
            executionSuccessful: scan.status === "completed",
            startTimeUtc: scan.started_at,
            endTimeUtc: scan.ended_at ?? undefined,
          },
        ],
        results: issues.map((issue) => issueToSarifResult(issue)),
      },
    ],
  };
}

function issueToSarifResult(issue: Issue): SarifResult {
  const ruleId = issue.evidence.rule_id ?? issue.discovered_by;
  return {
    ruleId,
    level: severityToLevel(issue.severity),
    message: { text: issue.evidence.analysis },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: issue.location.file },
          region: {
            startLine: issue.location.line_range[0],
            endLine: issue.location.line_range[1],
            startColumn: issue.evidence.match_position?.column
              ? issue.evidence.match_position.column + 1
              : undefined,
            snippet: { text: issue.evidence.code_snippet },
          },
        },
      },
    ],
    properties: {
      severity: issue.severity,
      issueId: issue.id,
      status: issue.status,
      owaspCategory: issue.owasp_category,
      cwe: issue.cwe,
      aiModel: issue.evidence.ai_model,
      aiConfidence: issue.evidence.ai_confidence,
    },
  };
}

function severityToLevel(severity: Severity): SarifLevel {
  switch (severity) {
    case "critical":
    case "high":
      return "error";
    case "medium":
      return "warning";
    case "low":
      return "note";
    case "info":
      return "none";
    default:
      return "none";
  }
}
