"use client";

import { useEffect, useRef, useState } from "react";
import type { ProgressEvent } from "../../lib/active-scan";

/**
 * Live event log shown during a running scan or auto-remediation.
 *
 * Reads ProgressEvent[] off the active-scan singleton (server polls
 * already populate this — no extra fetch). Each event is a
 * pre-formatted human-readable line with a level (info/warn/error)
 * and a category tag for the colour stripe down the left edge.
 *
 * Default-collapsed so the running card stays compact; expand to
 * see the full log streaming. Auto-scrolls to the bottom on new
 * events while expanded so the latest activity is always visible.
 */
export function ProgressLog({
  events,
  /** Whether the underlying run is still active — drives auto-scroll behaviour. */
  live,
  /**
   * Default open state. We default to closed for "completed/failed"
   * (where users mostly want the summary) and open for "running/
   * remediating" (so they have something to watch).
   */
  defaultOpen,
}: {
  events: ProgressEvent[];
  live: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll on new events while live + open. We don't auto-
  // scroll once the run has stopped — letting the user freeze the
  // view at whatever point they were reading.
  useEffect(() => {
    if (!open || !live) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [events.length, open, live]);

  if (events.length === 0 && !live) return null;

  const errorCount = events.filter((e) => e.level === "error").length;
  const warnCount = events.filter((e) => e.level === "warn").length;

  return (
    <div
      className="rounded-[10px] mb-4"
      style={{
        background: "var(--cream)",
        border: "1.5px solid var(--ink)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-[12px] cursor-pointer"
        style={{
          background: "transparent",
          color: "var(--ink)",
          textAlign: "left",
        }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-block",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.12s",
          }}
        >
          ▶
        </span>
        <span
          className="font-bold tracking-[0.1em] uppercase text-[10px]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }}
        >
          Progress log
        </span>
        <span
          className="text-[11px]"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--ink-soft)",
          }}
        >
          {events.length} event{events.length === 1 ? "" : "s"}
          {errorCount > 0 && (
            <span
              className="ml-1.5 px-1.5 py-[1px] rounded text-[9px] font-bold"
              style={{
                background: "#FBE4E0",
                color: "var(--sauce-dark)",
                border: "1px solid var(--sauce)",
              }}
            >
              {errorCount} error{errorCount === 1 ? "" : "s"}
            </span>
          )}
          {warnCount > 0 && (
            <span
              className="ml-1.5 px-1.5 py-[1px] rounded text-[9px] font-bold"
              style={{
                background: "var(--parmesan)",
                color: "var(--ink)",
                border: "1px solid var(--ink)",
              }}
            >
              {warnCount} warning{warnCount === 1 ? "" : "s"}
            </span>
          )}
        </span>
        {live && (
          <span
            className="ml-auto text-[9px] font-bold tracking-[0.1em] uppercase flex items-center gap-1"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--sauce)",
            }}
          >
            <span
              className="inline-block w-[6px] h-[6px] rounded-full animate-pulse"
              style={{ background: "var(--sauce)" }}
              aria-hidden
            />
            live
          </span>
        )}
      </button>

      {open && (
        <div
          ref={scrollRef}
          className="overflow-y-auto"
          style={{
            background: "var(--ink)",
            color: "var(--cream)",
            borderTop: "1.5px solid var(--ink)",
            maxHeight: "320px",
            fontFamily: "var(--font-mono)",
            fontSize: "11.5px",
            lineHeight: 1.55,
          }}
        >
          {events.length === 0 ? (
            <div
              className="px-3 py-2 opacity-60"
              style={{ color: "var(--cream)" }}
            >
              waiting for the first event…
            </div>
          ) : (
            events.map((e, i) => <LogLine key={i} event={e} />)
          )}
        </div>
      )}
    </div>
  );
}

function LogLine({ event }: { event: ProgressEvent }) {
  const stripe =
    event.level === "error"
      ? "#C8321E"
      : event.level === "warn"
        ? "#D4A017"
        : "transparent";
  const fg =
    event.level === "error"
      ? "#FBC0B6"
      : event.level === "warn"
        ? "#F7E1A0"
        : "var(--cream)";
  return (
    <div
      className="flex gap-2 px-3 py-[2px]"
      style={{
        borderLeft: `3px solid ${stripe}`,
        color: fg,
      }}
    >
      <span
        className="opacity-50 select-none shrink-0"
        style={{ minWidth: "5.5em" }}
      >
        {formatTime(event.ts)}
      </span>
      <span className="break-words" style={{ flex: 1, minWidth: 0 }}>
        {event.message}
      </span>
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}
