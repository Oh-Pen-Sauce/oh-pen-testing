"use client";

import { useState, useTransition } from "react";
import { resetEverythingAction, type ResetOptions } from "./actions";

/**
 * Beta-testing affordance: wipe Oh Pen Testing's state so the user
 * can re-run the whole setup flow. We'll likely remove this before
 * v1.0 ships publicly — real users shouldn't need this button,
 * CLI flags (`opt init --force`) are the right surface.
 *
 * Four checkboxes so testers can keep some state between runs
 * (e.g. "wipe config but keep my PAT" shaves time off iteration).
 */

export function ResetDangerZone() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<
    | null
    | { kind: "ok"; text: string }
    | { kind: "err"; text: string }
  >(null);

  // Defaults: nuke config + history, preserve secrets + projects.
  // This is the most common "test the wizard again" loop — the
  // user doesn't need to repaste their PAT every time.
  const [resetConfig, setResetConfig] = useState(true);
  const [wipeHistory, setWipeHistory] = useState(true);
  const [wipeSecrets, setWipeSecrets] = useState(false);
  const [wipeProjects, setWipeProjects] = useState(false);
  // wipeClones is the heaviest reset — actually deletes the cloned
  // repo directories. Off by default; users opt-in when their
  // clones have picked up dirty git state from prior failed runs.
  // Implies wipeProjects (you can't keep a registry that points at
  // deleted clones), so we force-tick it when this is enabled.
  const [wipeClones, setWipeClones] = useState(false);

  function doReset() {
    const summary: string[] = [];
    if (resetConfig) summary.push("config.yml");
    if (wipeHistory) summary.push("issues + scans + logs + reports");
    if (wipeSecrets) summary.push("ALL saved secrets (API keys, PATs)");
    if (wipeProjects || wipeClones)
      summary.push("managed projects registry");
    if (wipeClones)
      summary.push("EVERY cloned repo under ~/.ohpentesting/projects/");
    if (summary.length === 0) {
      setMessage({ kind: "err", text: "Tick at least one box first." });
      return;
    }
    const ok = confirm(
      `This will wipe:\n\n  - ${summary.join(
        "\n  - ",
      )}\n\nIrreversible. Proceed?`,
    );
    if (!ok) return;

    setMessage(null);
    startTransition(async () => {
      const opts: ResetOptions = {
        resetConfig,
        wipeHistory,
        wipeSecrets,
        // wipeClones implies wipeProjects (registry can't outlive clones).
        wipeProjects: wipeProjects || wipeClones,
        wipeClones,
      };
      const res = await resetEverythingAction(opts);
      if (!res.ok) {
        setMessage({ kind: "err", text: res.detail });
        return;
      }
      // Clear the setup chat's sessionStorage snapshot so the wizard
      // re-bootstraps fresh — otherwise the user sees stale chat
      // turns from a completed setup that no longer has a config.
      try {
        window.sessionStorage.removeItem("oh-pen-testing:setup-chat-v1");
      } catch {
        /* ignore */
      }
      setMessage({ kind: "ok", text: res.detail });
      // Give the flash message a moment to render, then jump to
      // the setup wizard so the tester can start a fresh run.
      setTimeout(() => {
        if (resetConfig) {
          window.location.href = "/setup";
        } else {
          window.location.reload();
        }
      }, 1200);
    });
  }

  return (
    <div className="mt-8">
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: open ? "#FBE4E0" : "var(--cream-soft)",
          border: `2px solid ${open ? "var(--sauce)" : "var(--ink)"}`,
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-3 px-5 py-3.5 text-left"
          style={{ background: "transparent", cursor: "pointer" }}
        >
          <span
            className="text-[18px]"
            aria-hidden
            style={{
              transform: open ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.15s",
            }}
          >
            ▶
          </span>
          <div className="flex-1 min-w-0">
            <div
              className="font-black italic text-[18px]"
              style={{
                fontFamily: "var(--font-display)",
                color: open ? "var(--sauce-dark)" : "var(--ink)",
              }}
            >
              {open ? "☠ Danger zone" : "🧪 Danger zone (beta-only)"}
            </div>
            <div
              className="text-[12px] mt-0.5"
              style={{
                color: open ? "var(--sauce-dark)" : "var(--ink-soft)",
              }}
            >
              Reset Oh Pen Testing state to re-run the setup flow from
              scratch. Temporary — will be removed before v1.0.
            </div>
          </div>
        </button>
        {open && (
          <div
            className="px-5 pb-5"
            style={{ borderTop: "1px dashed rgba(143,30,16,0.3)" }}
          >
            <div
              className="mt-4 mb-4 px-3 py-2.5 rounded-lg text-[12px] leading-snug"
              style={{
                background: "var(--cream)",
                border: "1.5px solid var(--sauce)",
                color: "var(--sauce-dark)",
              }}
            >
              <strong>⚠ Irreversible.</strong> Files are deleted outright,
              no trash. Use for beta-test re-runs only — clicking this on
              a real project means you&rsquo;ll redo setup and lose every
              issue the scanner has flagged.
            </div>

            <div className="flex flex-col gap-2.5 mb-4">
              <ResetCheckbox
                checked={resetConfig}
                onChange={setResetConfig}
                label="Reset config.yml"
                desc="Deletes this project's .ohpentesting/config.yml. You'll see the setup wizard from scratch on the next load."
              />
              <ResetCheckbox
                checked={wipeHistory}
                onChange={setWipeHistory}
                label="Wipe scan history"
                desc="Clears .ohpentesting/issues + scans + logs + reports. Cross-scan dedup starts from empty again."
              />
              <ResetCheckbox
                checked={wipeSecrets}
                onChange={setWipeSecrets}
                label="Wipe secrets (API keys + PATs)"
                desc="Deletes ~/.ohpentesting/secrets.json AND removes keychain entries for every provider. You'll re-enter everything in the wizard."
                danger
              />
              <ResetCheckbox
                checked={wipeProjects}
                onChange={setWipeProjects}
                label="Wipe managed-projects registry"
                desc="Drops ~/.ohpentesting/projects.json. Clones under ~/.ohpentesting/projects/ stay on disk (delete manually if you want)."
                danger
              />
              <ResetCheckbox
                checked={wipeClones}
                onChange={setWipeClones}
                label="Delete cloned project directories"
                desc="rm -rf every clone under ~/.ohpentesting/projects/<owner>/<repo>/. Use this when a clone has dirty git state from prior failed remediation runs (`Your local changes would be overwritten by checkout` errors). After wipe, finish setup and the wizard will re-clone fresh. Implies the registry wipe above."
                danger
              />
            </div>

            {message && (
              <div
                className="mb-3 px-3 py-2 rounded text-[12px]"
                style={{
                  background: message.kind === "ok" ? "#E4F0DF" : "#FBE4E0",
                  border: `1.5px solid ${message.kind === "ok" ? "var(--basil)" : "var(--sauce)"}`,
                  color:
                    message.kind === "ok"
                      ? "var(--basil-dark)"
                      : "var(--sauce-dark)",
                }}
              >
                {message.text}
              </div>
            )}

            <button
              type="button"
              onClick={doReset}
              disabled={pending}
              className="px-4 py-2 text-[13px] font-bold rounded-md disabled:opacity-50"
              style={{
                background: "var(--sauce-dark)",
                color: "var(--cream)",
                border: "2px solid var(--ink)",
                boxShadow: "3px 3px 0 var(--ink)",
                cursor: pending ? "wait" : "pointer",
                fontFamily: "var(--font-mono)",
              }}
            >
              {pending ? "Resetting…" : "🔥 Wipe + restart setup"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ResetCheckbox({
  checked,
  onChange,
  label,
  desc,
  danger,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  desc: string;
  danger?: boolean;
}) {
  return (
    <label
      className="flex items-start gap-3 px-3 py-2.5 rounded cursor-pointer"
      style={{
        background: "var(--cream)",
        border: "1.5px solid var(--ink)",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 shrink-0"
      />
      <div className="min-w-0">
        <div
          className="text-[13px] font-semibold flex items-center gap-2"
          style={{ color: "var(--ink)" }}
        >
          {label}
          {danger && (
            <span
              className="text-[9px] font-bold tracking-[0.15em] uppercase px-1.5 py-[2px] rounded"
              style={{
                background: "var(--sauce)",
                color: "var(--cream)",
                fontFamily: "var(--font-mono)",
              }}
            >
              extra destructive
            </span>
          )}
        </div>
        <div className="text-[11.5px] text-ink-soft mt-1 leading-snug">
          {desc}
        </div>
      </div>
    </label>
  );
}
