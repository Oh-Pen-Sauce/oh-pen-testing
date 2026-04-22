import type { Severity } from "@oh-pen-testing/shared";
import { SEVERITY_STYLE } from "./agents";

export function SeverityPill({
  severity,
  size = "md",
}: {
  severity: Severity;
  size?: "sm" | "md";
}) {
  const c = SEVERITY_STYLE[severity];
  const sizeCls =
    size === "sm"
      ? "px-1.5 py-[2px] text-[9px]"
      : "px-2 py-[3px] text-[10px]";
  return (
    <span
      className={`inline-block font-bold tracking-[0.1em] uppercase rounded-[4px] ${sizeCls}`}
      style={{
        backgroundColor: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        fontFamily: "var(--font-mono)",
      }}
    >
      {severity}
    </span>
  );
}
