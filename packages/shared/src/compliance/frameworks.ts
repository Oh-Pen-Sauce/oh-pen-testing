/**
 * Compliance framework mapping — v1 scaffold.
 *
 * Each framework has a list of controls; each control points at the
 * playbook ids / CWEs / OWASP refs that give *evidence* for (or against)
 * that control. This is a scaffold — it's a starting point that teams
 * can extend for their own ISMS, not a certified mapping.
 */

export type FrameworkId = "soc2" | "iso27001" | "pci-dss" | "hipaa" | "owasp-asvs";

export interface ComplianceControl {
  id: string;
  title: string;
  summary: string;
  /** Playbook ids whose findings are evidence for this control. */
  playbookIds?: string[];
  /** CWE ids whose findings are evidence for this control. */
  cwes?: string[];
  /** OWASP references (Top-10 category, ASVS chapter, etc.). */
  owaspRefs?: string[];
}

export interface ComplianceFramework {
  id: FrameworkId;
  name: string;
  version: string;
  url: string;
  controls: ComplianceControl[];
}

/** SOC 2 Trust Services Criteria (Common Criteria subset). */
const SOC2: ComplianceFramework = {
  id: "soc2",
  name: "SOC 2 — Trust Services Criteria (v2017 / AICPA)",
  version: "2017",
  url: "https://www.aicpa-cima.com/resources/landing/soc-trust-services-criteria",
  controls: [
    {
      id: "CC6.1",
      title: "Logical and physical access controls",
      summary:
        "The entity implements logical access security software, infrastructure, and architectures over protected information assets to protect them from security events to meet the entity's objectives.",
      playbookIds: ["owasp-top-10/a01-broken-access-control"],
      cwes: ["CWE-284", "CWE-285", "CWE-639", "CWE-862"],
      owaspRefs: ["A01:2021"],
    },
    {
      id: "CC6.6",
      title: "Logical access security — data in transit",
      summary: "Protect information during transmission.",
      playbookIds: ["wstg/clickjacking-no-frame-options", "dynamic/security-headers"],
      cwes: ["CWE-319"],
    },
    {
      id: "CC6.7",
      title: "Restriction of access by authentication",
      summary: "Authenticate users and restrict access based on identity.",
      playbookIds: [
        "owasp-top-10/a07-identification-failures",
        "wstg/jwt-weak-secret",
        "dynamic/no-rate-limit-login",
      ],
      cwes: ["CWE-287", "CWE-798", "CWE-307"],
      owaspRefs: ["A07:2021"],
    },
    {
      id: "CC7.1",
      title: "System monitoring",
      summary:
        "Detection of security events — logging, monitoring, and alerting.",
      playbookIds: ["owasp-top-10/a09-logging-failures"],
      owaspRefs: ["A09:2021"],
    },
    {
      id: "CC8.1",
      title: "Change management",
      summary: "Authorise, design, test and approve changes.",
      playbookIds: ["sca/npm-audit", "sca/pip-audit"],
    },
  ],
};

/** ISO/IEC 27001:2022 — subset of Annex A controls. */
const ISO27001: ComplianceFramework = {
  id: "iso27001",
  name: "ISO/IEC 27001 Annex A (2022)",
  version: "2022",
  url: "https://www.iso.org/standard/27001",
  controls: [
    {
      id: "A.8.9",
      title: "Configuration management",
      summary:
        "Configurations, including security configurations, shall be established, documented, implemented, monitored and reviewed.",
      playbookIds: [
        "iac/terraform-public-s3",
        "iac/k8s-no-resource-limits",
        "iac/dockerfile-root-user",
      ],
    },
    {
      id: "A.8.24",
      title: "Use of cryptography",
      summary: "Rules for effective use of cryptography shall be defined.",
      playbookIds: ["owasp-top-10/a02-cryptographic-failures"],
      cwes: ["CWE-327", "CWE-326"],
      owaspRefs: ["A02:2021"],
    },
    {
      id: "A.8.25",
      title: "Secure development lifecycle",
      summary:
        "Rules for secure development of software and systems shall be established and applied.",
      playbookIds: [
        "owasp-top-10/a03-injection",
        "owasp-top-10/a08-software-data-integrity",
        "cwe-top-25/sql-injection",
      ],
      owaspRefs: ["A03:2021", "A08:2021"],
    },
    {
      id: "A.8.28",
      title: "Secure coding",
      summary:
        "Secure coding principles shall be applied to software development.",
      playbookIds: [
        "cwe-top-25/path-traversal",
        "cwe-top-25/unrestricted-upload",
        "cwe-top-25/open-redirect",
      ],
    },
  ],
};

/** PCI-DSS v4.0 — subset of Requirement 6 (Develop & Maintain Secure Systems). */
const PCI_DSS: ComplianceFramework = {
  id: "pci-dss",
  name: "PCI-DSS v4.0 — Requirement 6",
  version: "4.0",
  url: "https://www.pcisecuritystandards.org/document_library/",
  controls: [
    {
      id: "6.2.4",
      title: "Bespoke / custom software developed securely",
      summary:
        "Software is developed in accordance with secure coding practices that address common software vulnerabilities.",
      playbookIds: [
        "owasp-top-10/a03-injection",
        "cwe-top-25/sql-injection",
        "cwe-top-25/path-traversal",
      ],
    },
    {
      id: "6.3.1",
      title: "Known vulnerabilities in components",
      summary:
        "Security vulnerabilities are identified and managed for bespoke and custom software, and for third-party software components.",
      playbookIds: ["sca/npm-audit", "sca/pip-audit", "sca/bundler-audit"],
    },
    {
      id: "6.3.3",
      title: "Authentication bypass / brute-force protection",
      summary:
        "All system components are protected from known vulnerabilities; authentication enforces account lockout.",
      playbookIds: [
        "dynamic/no-rate-limit-login",
        "owasp-top-10/a07-identification-failures",
      ],
      cwes: ["CWE-307"],
    },
    {
      id: "6.4.1",
      title: "Session management",
      summary: "Applications use secure session handling.",
      playbookIds: ["wstg/jwt-weak-secret"],
      cwes: ["CWE-798", "CWE-384"],
    },
  ],
};

/** HIPAA Security Rule — technical safeguards, 45 CFR § 164.312. */
const HIPAA: ComplianceFramework = {
  id: "hipaa",
  name: "HIPAA Security Rule — Technical Safeguards (45 CFR § 164.312)",
  version: "2013",
  url: "https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html",
  controls: [
    {
      id: "164.312(a)(1)",
      title: "Access control",
      summary:
        "Implement technical policies and procedures for electronic information systems that maintain ePHI to allow access only to authorised persons.",
      playbookIds: ["owasp-top-10/a01-broken-access-control"],
      cwes: ["CWE-284", "CWE-285", "CWE-862"],
    },
    {
      id: "164.312(a)(2)(iv)",
      title: "Encryption and decryption",
      summary: "Mechanism to encrypt and decrypt ePHI.",
      playbookIds: ["owasp-top-10/a02-cryptographic-failures"],
      cwes: ["CWE-327", "CWE-326"],
    },
    {
      id: "164.312(b)",
      title: "Audit controls",
      summary:
        "Implement hardware, software, and procedural mechanisms that record and examine activity in information systems that contain or use ePHI.",
      playbookIds: ["owasp-top-10/a09-logging-failures"],
    },
    {
      id: "164.312(e)(1)",
      title: "Transmission security",
      summary:
        "Implement technical security measures to guard against unauthorised access to ePHI that is being transmitted over an electronic communications network.",
      playbookIds: ["dynamic/security-headers"],
      cwes: ["CWE-319"],
    },
  ],
};

/** OWASP ASVS v4.0.3 — Level 2 sample. */
const OWASP_ASVS: ComplianceFramework = {
  id: "owasp-asvs",
  name: "OWASP Application Security Verification Standard v4.0.3",
  version: "4.0.3",
  url: "https://owasp.org/www-project-application-security-verification-standard/",
  controls: [
    {
      id: "V2.1.1",
      title: "Password strength — verify length ≥ 12",
      summary:
        "Verify that passwords of at least 12 characters in length are required.",
      playbookIds: ["owasp-top-10/a07-identification-failures"],
      owaspRefs: ["ASVS V2.1"],
    },
    {
      id: "V5.1.3",
      title: "Input validation",
      summary: "Verify that all input is validated.",
      playbookIds: [
        "owasp-top-10/a03-injection",
        "cwe-top-25/sql-injection",
        "cwe-top-25/path-traversal",
      ],
      owaspRefs: ["ASVS V5"],
    },
    {
      id: "V7.1.1",
      title: "Log content — don't log secrets",
      summary:
        "Verify that the application does not log credentials or payment details.",
      playbookIds: ["secrets/hardcoded-secrets-scanner"],
      cwes: ["CWE-532"],
    },
  ],
};

export const FRAMEWORKS: Record<FrameworkId, ComplianceFramework> = {
  soc2: SOC2,
  iso27001: ISO27001,
  "pci-dss": PCI_DSS,
  hipaa: HIPAA,
  "owasp-asvs": OWASP_ASVS,
};
