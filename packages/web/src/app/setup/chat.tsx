"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type {
  Config,
  AutonomyMode,
  ProviderId,
  SetupState,
  Turn,
} from "@oh-pen-testing/shared";
import {
  probeProviderAction,
  setProviderAction,
} from "./actions";
import {
  assistantTurnAction,
  executeAssistantActionAction,
} from "./assistant-actions";
import { InlineTerminal } from "./inline-terminal";
import { renderMiniMarkdown } from "./mini-markdown";

/**
 * Chat-style setup with Marinara.
 *
 * Flow:
 *   1. Provider-picker bubble (scripted, no LLM yet — we need a provider
 *      to run the LLM).
 *   2. Once the provider is connected, the composer goes live and every
 *      subsequent turn routes through assistantTurnAction, which calls
 *      the same AI provider the user just picked with the setup-assistant
 *      bundle (memory + skills) as system prompt.
 *   3. When the AI replies with an `action`, the UI shows a confirm
 *      button for state-changing actions so the user stays in control.
 *
 * The old classic wizard is still reachable via /setup?form=1.
 */

interface ChatTurn {
  id: string;
  from: "bot" | "user";
  content: React.ReactNode;
  /** Attached action the user can confirm (only on bot turns). */
  pendingAction?: {
    id: string;
    input: Record<string, unknown>;
    description: string;
  };
}

const PROVIDER_CHOICES: Array<{
  value: ProviderId;
  label: string;
  tag: string;
  needsKey: boolean;
}> = [
  {
    value: "claude-code-cli",
    label: "Claude Code CLI",
    tag: "uses your local `claude` session — no API cost",
    needsKey: false,
  },
  {
    value: "claude-api",
    label: "Claude API",
    tag: "Anthropic API key",
    needsKey: true,
  },
  {
    value: "openai",
    label: "OpenAI API",
    tag: "OpenAI API key",
    needsKey: true,
  },
  {
    value: "ollama",
    label: "Ollama (local)",
    tag: "offline models on localhost:11434",
    needsKey: false,
  },
];

export function SetupChat({ initial }: { initial: Config | null }) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  // Persistent message log the AI sees — we don't send React nodes to it.
  const [history, setHistory] = useState<Turn[]>([]);
  const [state, setState] = useState<SetupState>(() => ({
    currentStep: initial?.scope?.authorisation_acknowledged
      ? "done"
      : "provider",
    providerId: initial?.ai.primary_provider ?? null,
    providerProbeOk: null,
    repoSet: Boolean(
      initial?.git.repo && initial.git.repo !== "owner/name",
    ),
    tokenSaved: false,
    autonomy: initial?.agents.autonomy ?? null,
    authAcknowledged:
      initial?.scope?.authorisation_acknowledged ?? false,
  }));
  const [busy, setBusy] = useState(false);
  // Which provider the inline-terminal's pre-typed command targets.
  // Defaults to claude-code-cli — the best first-run experience.
  const [terminalProviderId, setTerminalProviderId] = useState<ProviderId>(
    initial?.ai.primary_provider ?? "claude-code-cli",
  );
  const [composerValue, setComposerValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  // React strict-mode mounts effects twice in dev — guard the opener
  // effect so we only seed one welcome bubble (and only one auto-probe
  // round-trip).
  const didBootstrapRef = useRef(false);

  const aiReady =
    state.providerId !== null &&
    state.providerProbeOk === true &&
    state.currentStep !== "done";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  // Seed opener. If the config already has a provider set (via
  // `opt connect` in the terminal, or a previous session), try to pick
  // up where we left off rather than showing the picker again.
  useEffect(() => {
    if (didBootstrapRef.current) return;
    didBootstrapRef.current = true;
    const preselected = initial?.ai.primary_provider;
    if (preselected && !initial?.scope?.authorisation_acknowledged) {
      pushBot(
        <>
          Ciao 🍅 — I see you&rsquo;ve already connected{" "}
          <strong>{preselected}</strong> from the terminal. Let me verify it
          quickly…
        </>,
      );
      (async () => {
        setBusy(true);
        try {
          const probe = await probeProviderAction(preselected);
          if (probe.ok) {
            setState((s) => ({
              ...s,
              providerId: preselected,
              providerProbeOk: true,
              currentStep: preselected.endsWith("-cli") ||
                preselected === "ollama"
                ? "github"
                : "credentials",
            }));
            pushBot(
              <>
                <span style={{ color: "var(--basil)", fontWeight: 700 }}>
                  ✓ connected
                </span>
                . Type what you want to do next — or say &ldquo;detect my
                repo&rdquo; to get rolling.
              </>,
              `Provider ${preselected} probed ok. Ready for next step.`,
            );
            pushSystemNote(
              `User pre-connected ${preselected} via CLI. Probe ok. Drive them toward github/autonomy/auth.`,
            );
          } else {
            pushBot(
              <>
                Hmm — {probe.detail}. Run{" "}
                <code
                  className="px-1 rounded"
                  style={{ background: "var(--parmesan)" }}
                >
                  opt connect
                </code>{" "}
                in your terminal to fix that, or pick a different provider
                below.
              </>,
            );
          }
        } finally {
          setBusy(false);
        }
      })();
    } else {
      pushBot(
        <>
          Ciao, <em>chef</em>! 🍅 I&rsquo;m <strong>Marinara</strong>. For the
          smoothest ride, close this tab and run{" "}
          <code
            className="px-1 rounded"
            style={{ background: "var(--parmesan)" }}
          >
            opt connect
          </code>{" "}
          in your terminal first — it sees your PATH so Claude CLI /
          Ollama / API keys connect cleanly. Or pick one below and I&rsquo;ll
          try from here.
        </>,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pushBot(content: React.ReactNode, asText?: string) {
    setTurns((t) => [
      ...t,
      { id: randomId("bot"), from: "bot", content },
    ]);
    if (asText) {
      setHistory((h) => [...h, { from: "assistant", text: asText }]);
    }
  }
  function pushUser(content: React.ReactNode, asText?: string) {
    setTurns((t) => [
      ...t,
      { id: randomId("user"), from: "user", content },
    ]);
    if (asText) {
      setHistory((h) => [...h, { from: "user", text: asText }]);
    }
  }
  function pushSystemNote(text: string) {
    setHistory((h) => [...h, { from: "system_note", text }]);
  }

  async function pickProvider(p: (typeof PROVIDER_CHOICES)[number]) {
    setBusy(true);
    setError(null);
    try {
      pushUser(
        <>
          <strong>{p.label}</strong>
          <div className="text-[11px] opacity-80 mt-0.5">{p.tag}</div>
        </>,
        `I want to use ${p.label} as the provider.`,
      );
      await setProviderAction(p.value);
      setState((s) => ({
        ...s,
        providerId: p.value,
        providerProbeOk: null,
      }));
      const probe = await probeProviderAction(p.value);
      setState((s) => ({ ...s, providerProbeOk: probe.ok }));
      if (probe.ok) {
        const ack = p.needsKey
          ? `Bellissimo — ${p.label} is ready. Drop your API key and I'll stash it in the keychain.`
          : `Bellissimo — ${p.label} is connected (${probe.detail}). Now let's wire GitHub.`;
        pushBot(
          <>
            Bellissimo — <strong>{p.label}</strong> is{" "}
            <span style={{ color: "var(--basil)", fontWeight: 700 }}>
              ✓ connected
            </span>
            . From here, just type what you want to do — I&rsquo;ve got a
            memory and a set of skills wired up.
          </>,
          ack,
        );
        pushSystemNote(
          `Provider ${p.value} is connected. Current step is '${p.needsKey ? "credentials" : "github"}'. Ask the user for the next thing you need.`,
        );
        // Prime the AI with an opening turn on the new step.
        setState((s) => ({
          ...s,
          currentStep: p.needsKey ? "credentials" : "github",
        }));
        await runAssistantTurn(
          [
            ...history,
            { from: "system_note", text: `Provider ${p.value} connected.` },
          ],
          {
            ...state,
            providerId: p.value,
            providerProbeOk: true,
            currentStep: p.needsKey ? "credentials" : "github",
          },
        );
      } else {
        const isPathIssue = /ENOENT|not found on PATH/i.test(probe.detail);
        pushBot(
          <>
            Hmm — <em>{probe.detail}</em>.{" "}
            {isPathIssue ? (
              <>
                Easiest fix: run{" "}
                <code
                  className="px-1 rounded"
                  style={{ background: "var(--parmesan)" }}
                >
                  opt connect
                </code>{" "}
                in your terminal — it can see your PATH. Then reload this
                page.
              </>
            ) : (
              <>
                Try a different provider below, or check the troubleshooting
                notes for your provider.
              </>
            )}
          </>,
          `Probe failed: ${probe.detail}`,
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sendComposer() {
    const text = composerValue.trim();
    if (!text || busy) return;
    setComposerValue("");
    // Visual masking for anything that looks like a credential the user
    // just pasted — keeps it out of chat-log screenshots. The raw
    // string still goes to the AI so it can route the secret to the
    // right skill (save_github_token / save_api_key); that channel is
    // the user's own provider session and isn't persisted by us.
    const secret = detectSecret(text);
    const display: React.ReactNode = secret
      ? (
          <>
            <span className="opacity-70">{secret.label}: </span>
            <code style={{ fontFamily: "var(--font-mono)" }}>
              {secret.masked}
            </code>
          </>
        )
      : text;
    pushUser(display, text);
    await runAssistantTurn(
      [...history, { from: "user", text }],
      state,
    );
  }

  async function runAssistantTurn(
    conversation: Turn[],
    snapshot: SetupState,
  ) {
    setBusy(true);
    setError(null);
    try {
      const res = await assistantTurnAction({
        conversation,
        state: snapshot,
      });
      setTurns((t) => [
        ...t,
        {
          id: randomId("bot"),
          from: "bot",
          // AI-authored text — render with the mini-markdown parser so
          // **bold**, `code`, [links](url) and newlines come out right.
          content: <>{renderMiniMarkdown(res.say)}</>,
          pendingAction:
            res.action && res.actionValid
              ? {
                  id: res.action.id,
                  input: res.action.input,
                  description: describeAction(res.action.id, res.action.input),
                }
              : undefined,
        },
      ]);
      setHistory((h) => [...h, { from: "assistant", text: res.say }]);
      if (res.actionError) {
        // Only log locally; don't bubble the raw error into the chat.
        // eslint-disable-next-line no-console
        console.warn("assistant action invalid:", res.actionError);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmAction(
    turnId: string,
    action: { id: string; input: Record<string, unknown> },
  ) {
    setBusy(true);
    setError(null);
    try {
      const outcome = await executeAssistantActionAction(
        action.id,
        action.input,
      );
      // Strip the pendingAction so the button disappears.
      setTurns((t) =>
        t.map((x) =>
          x.id === turnId ? { ...x, pendingAction: undefined } : x,
        ),
      );
      if (outcome.stateDelta) {
        setState((s) => ({ ...s, ...outcome.stateDelta }));
      }
      const note = outcome.ok
        ? `Action ${action.id} succeeded: ${outcome.detail ?? "ok"}`
        : `Action ${action.id} failed: ${outcome.detail ?? "error"}`;
      pushSystemNote(note);
      // Let the AI acknowledge the outcome in its own voice.
      await runAssistantTurn(
        [...history, { from: "system_note", text: note }],
        {
          ...state,
          ...(outcome.stateDelta ?? {}),
        },
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 280px" }}>
      {/* Chat column */}
      <div
        className="rounded-[14px] overflow-hidden flex flex-col"
        style={{
          background: "var(--cream-soft)",
          border: "2px solid var(--ink)",
        }}
      >
        <ChatHeader busy={busy} state={state} />

        <div
          className="p-5 flex-1 overflow-y-auto"
          style={{
            maxHeight: 560,
            background: `repeating-linear-gradient(0deg, var(--cream-soft), var(--cream-soft) 28px, var(--cream) 28px, var(--cream) 29px)`,
          }}
        >
          {turns.map((t) =>
            t.from === "bot" ? (
              <BotBubble
                key={t.id}
                content={t.content}
                pendingAction={t.pendingAction}
                onConfirm={(a) => confirmAction(t.id, a)}
                busy={busy}
              />
            ) : (
              <UserBubble key={t.id}>{t.content}</UserBubble>
            ),
          )}

          {/*
            Pre-connect surface. For first-time users we lead with the
            inline terminal — one click runs the same `opt connect` the
            CLI ships, so they don't have to leave the browser. The
            manual picker stays one click away for anyone who wants
            something other than Claude CLI.
          */}
          {state.providerProbeOk !== true && (
            <div className="mb-4">
              <InlineTerminal
                providerId={terminalProviderId}
                label={
                  PROVIDER_CHOICES.find((p) => p.value === terminalProviderId)
                    ?.label ?? terminalProviderId
                }
                onDone={async ({ ok, providerId }) => {
                  if (!ok) return;
                  // Kick the same post-connect path the button picker ran.
                  const probe = await probeProviderAction(providerId);
                  setState((s) => ({
                    ...s,
                    providerId,
                    providerProbeOk: probe.ok,
                    currentStep: probe.ok
                      ? providerNeedsKey(providerId)
                        ? "credentials"
                        : "github"
                      : s.currentStep,
                  }));
                  if (probe.ok) {
                    pushBot(
                      <>
                        <strong>
                          {PROVIDER_CHOICES.find((p) => p.value === providerId)
                            ?.label ?? providerId}
                        </strong>{" "}
                        is{" "}
                        <span
                          style={{
                            color: "var(--basil)",
                            fontWeight: 700,
                          }}
                        >
                          ✓ connected
                        </span>
                        . Next we&rsquo;ll wire GitHub so I can open PRs with
                        my fixes.
                      </>,
                      `Provider ${providerId} connected.`,
                    );
                    pushSystemNote(
                      `User ran inline 'opt connect' for ${providerId}. Probe ok. Now open the GitHub step — explain clearly what we need (repo owner/name + a PAT with repo + pull_requests scopes), why (so I can open PRs), and offer to 'detect my repo' using the detect_repo skill.`,
                    );
                    await runAssistantTurn(
                      [
                        ...history,
                        {
                          from: "system_note",
                          text: `Provider ${providerId} connected. Open the GitHub step.`,
                        },
                      ],
                      {
                        ...state,
                        providerId,
                        providerProbeOk: true,
                        currentStep: providerNeedsKey(providerId)
                          ? "credentials"
                          : "github",
                      },
                    );
                  }
                }}
              />
              <details className="mt-3">
                <summary
                  className="cursor-pointer text-[12px] underline"
                  style={{ color: "var(--sauce)" }}
                >
                  Or pick a different provider →
                </summary>
                <div
                  className="mt-3 p-3.5 rounded-xl"
                  style={{
                    background: "var(--cream-soft)",
                    border: "1.5px solid var(--ink)",
                  }}
                >
                  <div className="grid grid-cols-2 gap-2">
                    {PROVIDER_CHOICES.map((p) => (
                      <button
                        key={p.value}
                        disabled={busy}
                        onClick={() =>
                          p.needsKey
                            ? pickProvider(p)
                            : setTerminalProviderId(p.value)
                        }
                        className="text-left p-2.5 rounded-md transition-transform hover:-translate-y-px disabled:opacity-50"
                        style={{
                          background:
                            terminalProviderId === p.value
                              ? "var(--parmesan)"
                              : "var(--cream)",
                          border: "1.5px solid var(--ink)",
                        }}
                      >
                        <div className="text-[12px] font-bold text-ink">
                          {p.label}
                          {p.needsKey ? (
                            <span
                              className="ml-1.5 text-[9px] font-semibold uppercase tracking-[0.1em]"
                              style={{ color: "var(--sauce-dark)" }}
                            >
                              needs key
                            </span>
                          ) : null}
                        </div>
                        <div className="text-[10px] text-ink-soft mt-0.5 leading-tight">
                          {p.tag}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div
                    className="text-[11px] mt-2.5 text-ink-soft leading-snug"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    Clicking a no-key provider updates the terminal command
                    above. Clicking an API-key provider runs the classic
                    keychain flow.
                  </div>
                </div>
              </details>
            </div>
          )}

          {/* Final CTAs once setup is done */}
          {state.currentStep === "done" && (
            <UserFormBubble>
              <div className="flex flex-wrap gap-2 items-center">
                <Link
                  href="/scans"
                  className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-lg"
                  style={{
                    background: "var(--sauce)",
                    color: "var(--cream)",
                    border: "2px solid var(--ink)",
                    boxShadow: "3px 3px 0 var(--ink)",
                  }}
                >
                  🔎 Run first scan →
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-lg"
                  style={{
                    background: "var(--cream)",
                    color: "var(--ink)",
                    border: "2px solid var(--ink)",
                  }}
                >
                  Go to dashboard
                </Link>
              </div>
            </UserFormBubble>
          )}

          {error && (
            <div
              className="my-2 px-3 py-2 rounded text-[12px]"
              style={{
                background: "#FBE4E0",
                border: "1.5px solid var(--sauce)",
                color: "var(--sauce-dark)",
              }}
            >
              ✖ {error}
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* Composer — active once provider is connected */}
        <div
          className="px-3.5 py-3 flex gap-2"
          style={{
            borderTop: "2px solid var(--ink)",
            background: "var(--cream)",
          }}
        >
          <input
            type="text"
            value={composerValue}
            onChange={(e) => setComposerValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendComposer();
              }
            }}
            placeholder={
              aiReady
                ? "Type anything — e.g. 'detect my repo', 'I'll use Recommended', 'I'm Sam'"
                : "Pick a provider above first…"
            }
            disabled={!aiReady || busy || state.currentStep === "done"}
            className="flex-1 px-3.5 py-2.5 rounded-full text-[13px] outline-none disabled:opacity-60"
            style={{
              background: "var(--cream-soft)",
              border: "1.5px solid var(--ink)",
              color: "var(--ink)",
            }}
          />
          <button
            onClick={sendComposer}
            disabled={
              !aiReady ||
              busy ||
              !composerValue.trim() ||
              state.currentStep === "done"
            }
            className="w-10 h-10 rounded-full font-bold disabled:opacity-40"
            style={{
              background: "var(--sauce)",
              color: "var(--cream)",
              border: "2px solid var(--ink)",
              boxShadow: "2px 2px 0 var(--ink)",
            }}
          >
            ↑
          </button>
        </div>
      </div>

      <SidebarPanels
        state={state}
        bundleInfo={{
          skillsVisible: aiReady,
        }}
      />
    </div>
  );
}

function ChatHeader({
  busy,
  state,
}: {
  busy: boolean;
  state: SetupState;
}) {
  const stepLabels: Record<SetupState["currentStep"], string> = {
    provider: "provider",
    credentials: "credentials",
    github: "github",
    autonomy: "autonomy",
    authorisation: "authorisation",
    done: "done",
  };
  const aiLive = state.providerProbeOk === true;
  return (
    <div
      className="px-5 py-3.5 flex items-center gap-3"
      style={{ background: "var(--ink)", color: "var(--cream)" }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-[20px]"
        style={{
          background: "var(--sauce)",
          border: "2px solid var(--cream)",
        }}
        aria-hidden
      >
        🍅
      </div>
      <div>
        <div
          className="font-black italic text-[16px]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Marinara
        </div>
        <div
          className="text-[10px] opacity-70 flex items-center gap-1.5"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <span
            className="w-[6px] h-[6px] rounded-full"
            style={{ background: aiLive ? "#8bd17c" : "#d1b77c" }}
          />
          {busy ? "typing…" : aiLive ? "smart mode" : "picking a kitchen"} ·{" "}
          {stepLabels[state.currentStep]}
        </div>
      </div>
    </div>
  );
}

function BotBubble({
  content,
  pendingAction,
  onConfirm,
  busy,
}: {
  content: React.ReactNode;
  pendingAction?: ChatTurn["pendingAction"];
  onConfirm: (a: { id: string; input: Record<string, unknown> }) => void;
  busy: boolean;
}) {
  return (
    <div className="flex gap-2.5 mb-3.5 items-start">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-[16px] shrink-0"
        style={{
          background: "var(--sauce)",
          border: "2px solid var(--ink)",
        }}
        aria-hidden
      >
        🍅
      </div>
      <div className="max-w-[85%]">
        <div
          className="px-3.5 py-2.5 text-[14px] leading-snug"
          style={{
            background: "var(--cream)",
            border: "2px solid var(--ink)",
            borderRadius: "14px 14px 14px 2px",
            color: "var(--ink)",
            // Teacher-mode replies can be multi-line numbered lists —
            // preserve whatever vertical layout the markdown renderer
            // emitted.
            wordBreak: "break-word",
          }}
        >
          {content}
        </div>
        {pendingAction && (
          <div
            className="mt-2 px-3 py-2.5 text-[12px] rounded-[10px] flex items-center justify-between gap-3"
            style={{
              background: "var(--parmesan)",
              border: "1.5px solid var(--ink)",
            }}
          >
            <div className="min-w-0">
              <div
                className="text-[9px] font-bold tracking-[0.1em] uppercase text-ink-soft mb-0.5"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Suggested action
              </div>
              <div className="text-ink">{pendingAction.description}</div>
            </div>
            <button
              disabled={busy}
              onClick={() =>
                onConfirm({
                  id: pendingAction.id,
                  input: pendingAction.input,
                })
              }
              className="px-3 py-[6px] text-[11px] font-bold rounded-md disabled:opacity-50 shrink-0"
              style={{
                background: "var(--basil)",
                color: "var(--cream)",
                border: "1.5px solid var(--ink)",
              }}
            >
              Do it →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end mb-3.5">
      <div
        className="px-3.5 py-2.5 text-[14px] leading-snug max-w-[85%]"
        style={{
          background: "var(--sauce)",
          color: "var(--cream)",
          border: "2px solid var(--ink)",
          borderRadius: "14px 14px 2px 14px",
          boxShadow: "2px 2px 0 var(--ink)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function UserFormBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end mb-3.5">
      <div
        className="p-3.5 w-[85%] max-w-[85%]"
        style={{
          background: "var(--cream)",
          border: "2px solid var(--ink)",
          borderRadius: "14px 14px 2px 14px",
          boxShadow: "2px 2px 0 var(--ink)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

const STEP_ORDER: SetupState["currentStep"][] = [
  "provider",
  "credentials",
  "github",
  "autonomy",
  "authorisation",
];
const STEP_LABELS: Record<SetupState["currentStep"], string> = {
  provider: "AI provider",
  credentials: "Credentials",
  github: "GitHub",
  autonomy: "Autonomy",
  authorisation: "Authorisation",
  done: "Done",
};

function SidebarPanels({
  state,
  bundleInfo,
}: {
  state: SetupState;
  bundleInfo: { skillsVisible: boolean };
}) {
  const currentIdx = STEP_ORDER.indexOf(
    state.currentStep === "done" ? "authorisation" : state.currentStep,
  );
  return (
    <div className="flex flex-col gap-3.5">
      <div
        className="rounded-xl p-4"
        style={{
          background: "var(--parmesan)",
          border: "2px solid var(--ink)",
        }}
      >
        <div
          className="font-black italic text-[16px] mb-2.5"
          style={{ fontFamily: "var(--font-display)" }}
        >
          The recipe
        </div>
        {STEP_ORDER.map((s, i) => {
          const isDone =
            state.currentStep === "done" ? true : i < currentIdx;
          const isCurrent =
            state.currentStep !== "done" && i === currentIdx;
          return (
            <div
              key={s}
              className="flex items-center gap-2.5 py-[7px] text-[13px]"
            >
              <div
                className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-bold"
                style={{
                  background: isDone
                    ? "var(--basil)"
                    : isCurrent
                      ? "var(--sauce)"
                      : "var(--cream)",
                  color:
                    isDone || isCurrent
                      ? "var(--cream)"
                      : "var(--ink-soft)",
                  border: "1.5px solid var(--ink)",
                }}
              >
                {isDone ? "✓" : i + 1}
              </div>
              <span
                className={isCurrent ? "font-bold" : "font-medium"}
                style={{
                  color: isCurrent
                    ? "var(--sauce)"
                    : isDone
                      ? "var(--ink-soft)"
                      : "var(--ink)",
                  textDecoration: isDone ? "line-through" : "none",
                }}
              >
                {STEP_LABELS[s]}
              </span>
            </div>
          );
        })}
      </div>

      <div
        className="rounded-xl p-4"
        style={{ background: "var(--ink)", color: "var(--cream)" }}
      >
        <div
          className="text-[10px] tracking-[0.15em] uppercase mb-2"
          style={{
            color: "var(--sauce-soft)",
            fontFamily: "var(--font-mono)",
          }}
        >
          How smart mode works
        </div>
        <p className="m-0 text-[12.5px] leading-snug opacity-90">
          Once your AI is connected I load <strong>memory.md</strong> + 9
          skill files as the system prompt. Any AI you pick — Claude, GPT,
          Ollama — reads the same onboarding guide.{" "}
          {bundleInfo.skillsVisible ? (
            <span style={{ color: "var(--sauce-soft)" }}>
              Bundle loaded ✓
            </span>
          ) : (
            <span style={{ opacity: 0.7 }}>
              Waiting for provider…
            </span>
          )}
        </p>
      </div>

      <div
        className="rounded-xl p-4 text-[12px]"
        style={{
          background: "var(--cream-soft)",
          border: "2px solid var(--ink)",
        }}
      >
        <div
          className="font-black italic text-[15px] mb-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Prefer the old form?
        </div>
        <div className="text-ink-soft mb-2">
          The classic 6-step wizard is still here.
        </div>
        <Link
          href="/setup?form=1"
          className="text-[12px] font-semibold underline"
          style={{ color: "var(--sauce)" }}
        >
          Switch to form view →
        </Link>
      </div>
    </div>
  );
}

function describeAction(
  id: string,
  input: Record<string, unknown>,
): string {
  switch (id) {
    case "probe_provider":
      return `Probe ${input.provider_id} connectivity`;
    case "set_provider":
      return `Switch provider to ${input.provider_id}${
        input.model ? ` (${input.model})` : ""
      }`;
    case "save_api_key":
      return `Save ${input.provider_id} API key to keychain`;
    case "detect_repo":
      return "Read `git remote get-url origin` to detect the repo";
    case "set_repo":
      return `Set git.repo to ${input.repo}`;
    case "save_github_token":
      return "Save GitHub PAT to keychain";
    case "set_autonomy":
      return `Set autonomy to ${input.mode}`;
    case "acknowledge_authorisation":
      return `Acknowledge authorisation as ${input.actor_name}`;
    case "troubleshoot_claude_cli":
      return "Show Claude CLI troubleshooting notes";
    default:
      return id;
  }
}

function randomId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function providerNeedsKey(id: ProviderId): boolean {
  return id === "claude-api" || id === "claude-max" || id === "openai" || id === "openrouter";
}

/**
 * If `text` looks like a credential the user just pasted, return
 * { label, masked } describing what kind it is and a safe visual
 * representation. Returns null otherwise.
 *
 * Recognised shapes:
 *   - GitHub classic PAT:   ghp_[A-Za-z0-9]{36,}
 *   - GitHub fine-grained:  github_pat_[A-Za-z0-9_]+
 *   - Anthropic API key:    sk-ant-[A-Za-z0-9_-]+
 *   - OpenRouter API key:   sk-or-[A-Za-z0-9_-]+
 *   - Generic OpenAI-ish:   sk-[A-Za-z0-9_-]{20,}
 */
function detectSecret(
  text: string,
): { label: string; masked: string } | null {
  const compact = text.trim();
  // Reject if there's whitespace — these are single tokens.
  if (/\s/.test(compact)) return null;

  if (/^github_pat_[A-Za-z0-9_]{20,}$/.test(compact)) {
    return { label: "GitHub PAT", masked: maskSecret(compact) };
  }
  if (/^ghp_[A-Za-z0-9]{30,}$/.test(compact)) {
    return { label: "GitHub PAT", masked: maskSecret(compact) };
  }
  if (/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(compact)) {
    return { label: "Anthropic key", masked: maskSecret(compact) };
  }
  if (/^sk-or-[A-Za-z0-9_-]{20,}$/.test(compact)) {
    return { label: "OpenRouter key", masked: maskSecret(compact) };
  }
  if (/^sk-[A-Za-z0-9_-]{30,}$/.test(compact)) {
    return { label: "API key", masked: maskSecret(compact) };
  }
  return null;
}

function maskSecret(s: string): string {
  if (s.length <= 12) return "•".repeat(s.length);
  return `${s.slice(0, 10)}${"•".repeat(16)}${s.slice(-4)}`;
}
