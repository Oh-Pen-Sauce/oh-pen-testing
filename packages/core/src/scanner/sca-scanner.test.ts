import { describe, it, expect } from "vitest";
import { parseOsvScannerJson } from "./sca-scanner.js";

// Trimmed but realistic osv-scanner `--format json` output: one Go and
// one npm vulnerability, exercising the GHSA-severity and CVSS-group
// severity paths plus the fix-available detection.
const SAMPLE = JSON.stringify({
  results: [
    {
      source: { path: "/repo/go.mod", type: "lockfile" },
      packages: [
        {
          package: {
            name: "github.com/example/pkg",
            version: "1.2.0",
            ecosystem: "Go",
          },
          vulnerabilities: [
            {
              id: "GO-2024-0001",
              summary: "Denial of service in example/pkg",
              database_specific: { severity: "HIGH" },
              affected: [{ ranges: [{ type: "SEMVER" }] }],
            },
          ],
          groups: [{ max_severity: "7.5" }],
        },
      ],
    },
    {
      source: { path: "/repo/package-lock.json", type: "lockfile" },
      packages: [
        {
          package: { name: "left-pad", version: "0.0.1", ecosystem: "npm" },
          vulnerabilities: [
            {
              id: "GHSA-xxxx",
              summary: "Prototype pollution in left-pad",
              affected: [],
            },
          ],
          groups: [{ max_severity: "9.8" }],
        },
      ],
    },
  ],
});

describe("parseOsvScannerJson", () => {
  it("normalises osv-scanner output across ecosystems", () => {
    const findings = parseOsvScannerJson(SAMPLE, "/repo");
    expect(findings).toHaveLength(2);

    const go = findings.find((f) => f.packageName.includes("example"));
    expect(go).toBeDefined();
    expect(go?.source).toBe("osv-scanner");
    expect(go?.severity).toBe("high"); // from database_specific.severity
    expect(go?.vulnerabilityId).toBe("GO-2024-0001");
    expect(go?.installedVersion).toBe("1.2.0");
    expect(go?.fixAvailable).toBe(true); // has a fixed range
    expect(go?.file).toBe("go.mod"); // relative to cwd

    const npm = findings.find((f) => f.packageName === "left-pad");
    expect(npm?.severity).toBe("critical"); // 9.8 CVSS via group max_severity
    expect(npm?.fixAvailable).toBe(false); // no affected ranges
  });

  it("returns [] on non-JSON or empty output", () => {
    expect(parseOsvScannerJson("not json", "/repo")).toEqual([]);
    expect(parseOsvScannerJson(JSON.stringify({ results: [] }), "/repo")).toEqual(
      [],
    );
  });
});
