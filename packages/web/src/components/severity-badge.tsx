import type { Severity } from "@oh-pen-testing/shared";

export function SeverityBadge({ severity }: { severity: Severity }) {
  const map: Record<Severity, string> = {
    critical: "bg-red-100 text-red-800 border-red-200",
    high: "bg-orange-100 text-orange-800 border-orange-200",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    low: "bg-blue-100 text-blue-800 border-blue-200",
    info: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return (
    <span
      className={`inline-block text-xs px-1.5 py-0.5 rounded border ${map[severity]}`}
    >
      {severity}
    </span>
  );
}
