"use client";

import { useState } from "react";
import type { ProviderId } from "@oh-pen-testing/shared";
import {
  connectInlineAction,
  type ConnectLine,
} from "./connect-inline-action";

/**
 * A terminal-looking card that runs `opt connect` inline.
 *
 * Why not a real pty: we don't need full interactivity — the action
 * behind this is deterministic (detect, write config, probe). The card
 * just plays back the same lines a real terminal run would print, so
 * first-time users get the "I can see what's happening" reassurance
 * without having to leave the browser.
 *
 * The "Run" button is only active before a run; after a successful run
 * the parent collapses the card and hands off to the chat.
 */

export interface InlineTerminalProps {
  providerId: ProviderId;
  label: string;
  onDone: (result: { ok: boolean; providerId: ProviderId }) => void;
}

export function InlineTerminal({
  providerId,
  label,
  onDone,
}: InlineTerminalProps) {
  const [lines, setLines] = useState<ConnectLine[]>([
    {
      kind: "cmd",
      text: `opt connect --provider ${providerId}`,
    },
    {
      kind: "detail",
      text: "# Click Run to execute — same command as the terminal version.",
    },
  ]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  async function run() {
    setRunning(true);
    setLines((l) => [
      ...l.filter((line) => line.kind !== "detail" || !line.text.startsWith("#")),
      { kind: "info", text: "» running…" },
    ]);
    try {
      const result = await connectInlineAction(providerId);
      // Replace the "» running…" placeholder with the real output.
      setLines([...result.lines]);
      setDone(result.ok);
      onDone({ ok: result.ok, providerId });
    } catch (err) {
      setLines((l) => [
        ...l,
        { kind: "error", text: `✖ ${(err as Error).message}` },
      ]);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "#0f0b08",
        border: "2px solid var(--ink)",
        boxShadow: "3px 3px 0 var(--ink)",
      }}
    >
      {/* Terminal title bar */}
      <div
        className="flex items-center gap-2 px-3.5 py-2 text-[11px]"
        style={{
          background: "var(--ink)",
          color: "var(--cream)",
          borderBottom: "2px solid var(--ink)",
          fontFamily: "var(--font-mono)",
        }}
      >
        <span
          className="w-[10px] h-[10px] rounded-full"
          style={{ background: "#ef6f5c" }}
          aria-hidden
        />
        <span
          className="w-[10px] h-[10px] rounded-full"
          style={{ background: "#f5c342" }}
          aria-hidden
        />
        <span
          className="w-[10px] h-[10px] rounded-full"
          style={{ background: "#8bd17c" }}
          aria-hidden
        />
        <span className="ml-3 opacity-80">
          terminal — {label.toLowerCase().replace(/\s+/g, "-")}
        </span>
        {done ? (
          <span
            className="ml-auto text-[10px] font-bold tracking-[0.15em]"
            style={{ color: "#8bd17c" }}
          >
            DONE ✓
          </span>
        ) : null}
      </div>

      {/* Terminal body */}
      <div
        className="px-4 py-3 text-[12.5px] leading-[1.55] whitespace-pre-wrap"
        style={{
          color: "#e6d9bf",
          fontFamily: "var(--font-mono)",
          minHeight: 90,
          maxHeight: 260,
          overflowY: "auto",
        }}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              color: colorFor(line.kind),
              opacity: line.kind === "detail" ? 0.72 : 1,
            }}
          >
            {line.kind === "cmd" ? (
              <>
                <span style={{ color: "#8bd17c" }}>{"$"}</span>{" "}
                <span style={{ color: "#fbf4e4" }}>{line.text}</span>
              </>
            ) : (
              line.text
            )}
          </div>
        ))}
      </div>

      {/* Run / re-run bar */}
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{
          background: "#1a1410",
          borderTop: "1px solid rgba(230,217,191,0.15)",
        }}
      >
        <button
          disabled={running || done}
          onClick={run}
          className="px-4 py-1.5 text-[12px] font-bold rounded-md disabled:opacity-40"
          style={{
            background: done ? "var(--basil)" : "var(--sauce)",
            color: "var(--cream)",
            border: "1.5px solid rgba(244,233,212,0.4)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {running ? "running…" : done ? "✓ connected" : "▶ Run"}
        </button>
        <span
          className="text-[11px] opacity-60"
          style={{ color: "#e6d9bf", fontFamily: "var(--font-mono)" }}
        >
          {done
            ? "The chat has picked this up — scroll down."
            : running
              ? ""
              : "Runs the same check as the terminal. No shell needed."}
        </span>
      </div>
    </div>
  );
}

function colorFor(kind: ConnectLine["kind"]): string {
  switch (kind) {
    case "cmd":
      return "#fbf4e4";
    case "info":
      return "#f5c342";
    case "ok":
      return "#8bd17c";
    case "error":
      return "#ef6f5c";
    case "detail":
    default:
      return "#e6d9bf";
  }
}
