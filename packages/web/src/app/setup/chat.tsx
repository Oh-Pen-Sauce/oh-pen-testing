"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type {
  Config,
  AutonomyMode,
  ProviderId,
} from "@oh-pen-testing/shared";
import {
  probeProviderAction,
  saveApiKeyAction,
  saveGitHubTokenAction,
  setAutonomyAction,
  setProviderAction,
  setRepoAction,
  setAuthorisationAckAction,
} from "./actions";

/**
 * Chat-style setup with Marinara.
 *
 * Wraps the same server actions the classic wizard uses — just presents
 * them as a conversation so the first-run experience feels like you're
 * talking to a person, not filling in a form.
 *
 * State machine: PROVIDER → CREDS → GITHUB → AUTONOMY → AUTH → DONE.
 */

type StepId = "provider" | "creds" | "github" | "autonomy" | "auth" | "done";

interface ChatTurn {
  id: string;
  from: "bot" | "user";
  content: React.ReactNode;
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

const AUTONOMY_CHOICES: Array<{
  value: AutonomyMode;
  emoji: string;
  label: string;
  desc: string;
}> = [
  {
    value: "full-yolo",
    emoji: "🔥",
    label: "Full YOLO",
    desc: "Fix everything. Dev/test only.",
  },
  {
    value: "yolo",
    emoji: "🏃",
    label: "YOLO",
    desc: "PRs freely, still pauses on auth.",
  },
  {
    value: "recommended",
    emoji: "👨‍🍳",
    label: "Recommended",
    desc: "Auto-approve low-risk. Pause on critical.",
  },
  {
    value: "careful",
    emoji: "🧐",
    label: "Careful",
    desc: "Every fix needs your approval.",
  },
];

const STEP_ORDER: StepId[] = ["provider", "creds", "github", "autonomy", "auth"];
const STEP_LABELS: Record<StepId, string> = {
  provider: "AI provider",
  creds: "Credentials",
  github: "GitHub",
  autonomy: "Autonomy",
  auth: "Authorisation",
  done: "Done",
};

export function SetupChat({ initial }: { initial: Config | null }) {
  const [step, setStep] = useState<StepId>(() =>
    initial?.scope?.authorisation_acknowledged ? "done" : "provider",
  );
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [chosenProvider, setChosenProvider] = useState<ProviderId>(
    initial?.ai.primary_provider ?? "claude-code-cli",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  // Seed the opening bubble once.
  useEffect(() => {
    if (turns.length === 0) {
      addBot(
        <>
          Ciao, <em>chef</em>! 🍅 I&rsquo;m <strong>Marinara</strong>. I&rsquo;ll
          get you set up in about 4 minutes. First: which AI is gonna do the
          thinking?
        </>,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addBot(content: React.ReactNode) {
    setTurns((t) => [
      ...t,
      { id: `bot-${Date.now()}-${Math.random()}`, from: "bot", content },
    ]);
  }
  function addUser(content: React.ReactNode) {
    setTurns((t) => [
      ...t,
      { id: `user-${Date.now()}-${Math.random()}`, from: "user", content },
    ]);
  }

  async function pickProvider(p: (typeof PROVIDER_CHOICES)[number]) {
    setBusy(true);
    setError(null);
    try {
      setChosenProvider(p.value);
      addUser(
        <>
          <strong>{p.label}</strong>
          <div className="text-[11px] opacity-80 mt-0.5">{p.tag}</div>
        </>,
      );
      await setProviderAction(p.value);
      const probe = await probeProviderAction(p.value);
      addBot(
        probe.ok ? (
          <>
            Bellissimo.{" "}
            <span style={{ color: "var(--basil)", fontWeight: 700 }}>
              ✓ {probe.detail}
            </span>
          </>
        ) : (
          <>
            Hmm — <em>{probe.detail}</em>. We can continue and come back to
            this later if you like.
          </>
        ),
      );
      if (p.needsKey) {
        setStep("creds");
        addBot(
          <>
            Drop your API key in and I&rsquo;ll stash it in your OS keychain —
            never in a file.
          </>,
        );
      } else {
        setStep("github");
        addBot(
          <>
            Now — which <em>repo</em> am I cooking for? Paste an{" "}
            <code>owner/name</code> and a GitHub PAT so I can open PRs.
          </>,
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveApiKey(secret: string) {
    setBusy(true);
    setError(null);
    try {
      await saveApiKeyAction(chosenProvider, secret);
      addUser(
        <code
          className="text-[12px]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {maskKey(secret)}
        </code>,
      );
      addBot(
        <>
          Got it — saved to keychain.{" "}
          <span style={{ color: "var(--basil)", fontWeight: 700 }}>🔐 safe</span>.
          Now which <em>repo</em>? Paste an <code>owner/name</code> and a
          GitHub PAT.
        </>,
      );
      setStep("github");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveGitHub(repo: string, token: string) {
    setBusy(true);
    setError(null);
    try {
      await setRepoAction(repo);
      await saveGitHubTokenAction(token);
      addUser(
        <div className="text-[12px]">
          <div className="mb-1">
            <span
              className="opacity-80 block text-[10px] uppercase tracking-wider"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              repo
            </span>
            <code style={{ fontFamily: "var(--font-mono)" }}>{repo}</code>
          </div>
          <div>
            <span
              className="opacity-80 block text-[10px] uppercase tracking-wider"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              token
            </span>
            <code style={{ fontFamily: "var(--font-mono)" }}>
              {maskKey(token)}
            </code>
          </div>
        </div>,
      );
      addBot(<>Token lives in your OS keychain, not in any file. 🔐</>);
      addBot(
        <>
          Last bit: how brave are you feeling? I won&rsquo;t open a PR for
          anything risky without your say-so.
        </>,
      );
      setStep("autonomy");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function pickAutonomy(choice: (typeof AUTONOMY_CHOICES)[number]) {
    setBusy(true);
    setError(null);
    try {
      await setAutonomyAction(choice.value);
      addUser(
        <>
          <strong>
            {choice.emoji} {choice.label}
          </strong>
          <div className="text-[11px] opacity-80 mt-0.5">{choice.desc}</div>
        </>,
      );
      const reactions: Record<AutonomyMode, React.ReactNode> = {
        "full-yolo": (
          <>
            Hot take. I&rsquo;ll fix everything without asking. Make sure
            you&rsquo;re not pointing me at prod 🔥
          </>
        ),
        yolo: (
          <>
            Quick service. I&rsquo;ll open PRs freely but still pause on
            auth / secrets / migrations / big diffs.
          </>
        ),
        recommended: (
          <>
            Solid pick. Small stuff auto-lands, critical / auth / 200+ line
            diffs come to you for taste-testing.
          </>
        ),
        careful: (
          <>
            Noted — I&rsquo;ll check with you on every fix. Slower but
            nothing lands unannounced.
          </>
        ),
      };
      addBot(reactions[choice.value]);
      setStep("auth");
      addBot(
        <>
          One last thing — I need you to confirm you&rsquo;re{" "}
          <strong>authorised</strong> to test this codebase. Type your name to
          acknowledge, or skip if you&rsquo;re not ready yet.
        </>,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function ackAuth(name: string) {
    setBusy(true);
    setError(null);
    try {
      await setAuthorisationAckAction(true, name);
      addUser(<>Authorised by <strong>{name}</strong></>);
      addBot(
        <>
          <strong>Setup complete!</strong> 🎉 Wanna run your first scan?
        </>,
      );
      setStep("done");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Determine the current step for the recipe sidebar
  const currentIdx = STEP_ORDER.indexOf(step);
  const doneIdx = step === "done" ? STEP_ORDER.length : currentIdx;

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
        {/* chat header */}
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
                style={{ background: "#8bd17c" }}
              />
              {busy ? "typing…" : "online"} · step{" "}
              {Math.min(currentIdx + 1, STEP_ORDER.length)} of {STEP_ORDER.length}
            </div>
          </div>
          <div className="ml-auto flex gap-1">
            {STEP_ORDER.map((_, i) => (
              <div
                key={i}
                className="w-[26px] h-1 rounded"
                style={{
                  background:
                    i <= doneIdx
                      ? "var(--sauce-soft)"
                      : "rgba(244,233,212,0.3)",
                }}
              />
            ))}
          </div>
        </div>

        {/* chat body */}
        <div
          className="p-5 flex-1 overflow-y-auto"
          style={{
            maxHeight: 560,
            background: `repeating-linear-gradient(0deg, var(--cream-soft), var(--cream-soft) 28px, var(--cream) 28px, var(--cream) 29px)`,
          }}
        >
          {turns.map((t) => (
            <Bubble key={t.id} from={t.from}>
              {t.content}
            </Bubble>
          ))}

          {/* Input forms rendered inline at the tail of the chat */}
          {step === "provider" && (
            <UserFormBubble>
              <div className="mb-2 text-[10px] font-bold tracking-[0.1em] uppercase text-ink-soft">
                Pick one
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PROVIDER_CHOICES.map((p) => (
                  <button
                    key={p.value}
                    disabled={busy}
                    onClick={() => pickProvider(p)}
                    className="text-left p-2.5 rounded-md transition-transform hover:-translate-y-px disabled:opacity-50"
                    style={{
                      background: "var(--cream-soft)",
                      border: "1.5px solid var(--ink)",
                    }}
                  >
                    <div className="text-[12px] font-bold text-ink">
                      {p.label}
                    </div>
                    <div className="text-[10px] text-ink-soft mt-0.5 leading-tight">
                      {p.tag}
                    </div>
                  </button>
                ))}
              </div>
            </UserFormBubble>
          )}

          {step === "creds" && (
            <CredsForm disabled={busy} onSubmit={saveApiKey} />
          )}

          {step === "github" && (
            <GitHubForm disabled={busy} onSubmit={saveGitHub} />
          )}

          {step === "autonomy" && (
            <UserFormBubble>
              <div className="grid grid-cols-2 gap-2">
                {AUTONOMY_CHOICES.map((a) => (
                  <button
                    key={a.value}
                    disabled={busy}
                    onClick={() => pickAutonomy(a)}
                    className="text-left p-2.5 rounded-md transition-transform hover:-translate-y-px disabled:opacity-50"
                    style={{
                      background:
                        a.value === "recommended"
                          ? "var(--sauce)"
                          : "var(--cream-soft)",
                      color:
                        a.value === "recommended"
                          ? "var(--cream)"
                          : "var(--ink)",
                      border: "1.5px solid var(--ink)",
                    }}
                  >
                    <div className="text-[12px] font-bold">
                      {a.emoji} {a.label}
                    </div>
                    <div
                      className="text-[10px] opacity-85 mt-0.5 leading-tight"
                      style={{
                        color:
                          a.value === "recommended"
                            ? "var(--cream)"
                            : "var(--ink-soft)",
                      }}
                    >
                      {a.desc}
                    </div>
                  </button>
                ))}
              </div>
            </UserFormBubble>
          )}

          {step === "auth" && <AuthForm disabled={busy} onSubmit={ackAuth} />}

          {step === "done" && (
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

        {/* composer (decorative — chat is choice-driven) */}
        <div
          className="px-3.5 py-3 flex gap-2"
          style={{
            borderTop: "2px solid var(--ink)",
            background: "var(--cream)",
          }}
        >
          <div
            className="flex-1 px-3.5 py-2.5 rounded-full text-[13px] italic text-ink-soft"
            style={{
              background: "var(--cream-soft)",
              border: "1.5px solid var(--ink)",
            }}
          >
            Pick a choice above — Marinara is listening.
          </div>
        </div>
      </div>

      {/* Sidebar — recipe progress + why chat + form escape hatch */}
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
            const isDone = i < currentIdx || step === "done";
            const isCurrent = i === currentIdx && step !== "done";
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
            Why chat?
          </div>
          <p className="m-0 text-[12.5px] leading-snug opacity-90">
            A setup wizard pretending to be a form is still a form. Marinara
            asks one thing at a time and saves as you go.
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
    </div>
  );
}

function Bubble({
  from,
  children,
}: {
  from: "bot" | "user";
  children: React.ReactNode;
}) {
  if (from === "bot") {
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
        <div
          className="px-3.5 py-2.5 text-[14px] leading-snug max-w-[85%]"
          style={{
            background: "var(--cream)",
            border: "2px solid var(--ink)",
            borderRadius: "14px 14px 14px 2px",
            color: "var(--ink)",
          }}
        >
          {children}
        </div>
      </div>
    );
  }
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

function CredsForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (secret: string) => void;
}) {
  const [v, setV] = useState("");
  return (
    <UserFormBubble>
      <FieldLabel>API key</FieldLabel>
      <input
        type="password"
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="sk-…"
        className="w-full px-3 py-2 text-[13px] rounded-md outline-none"
        style={{
          background: "var(--cream-soft)",
          border: "1.5px solid var(--ink)",
          fontFamily: "var(--font-mono)",
        }}
      />
      <button
        disabled={disabled || v.length < 10}
        onClick={() => onSubmit(v)}
        className="mt-2.5 px-3.5 py-[7px] text-[12px] font-bold rounded-md disabled:opacity-40"
        style={{
          background: "var(--sauce)",
          color: "var(--cream)",
          border: "2px solid var(--ink)",
        }}
      >
        Save to keychain →
      </button>
    </UserFormBubble>
  );
}

function GitHubForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (repo: string, token: string) => void;
}) {
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const valid = /^[\w.-]+\/[\w.-]+$/.test(repo) && token.length > 10;
  return (
    <UserFormBubble>
      <FieldLabel>Repo</FieldLabel>
      <input
        type="text"
        value={repo}
        onChange={(e) => setRepo(e.target.value)}
        placeholder="owner/name"
        className="w-full px-3 py-2 text-[13px] rounded-md outline-none mb-2.5"
        style={{
          background: "var(--cream-soft)",
          border: "1.5px solid var(--ink)",
          fontFamily: "var(--font-mono)",
        }}
      />
      <FieldLabel>GitHub PAT</FieldLabel>
      <input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="ghp_…"
        className="w-full px-3 py-2 text-[13px] rounded-md outline-none"
        style={{
          background: "var(--cream-soft)",
          border: "1.5px solid var(--ink)",
          fontFamily: "var(--font-mono)",
        }}
      />
      <button
        disabled={disabled || !valid}
        onClick={() => onSubmit(repo, token)}
        className="mt-2.5 px-3.5 py-[7px] text-[12px] font-bold rounded-md disabled:opacity-40"
        style={{
          background: "var(--sauce)",
          color: "var(--cream)",
          border: "2px solid var(--ink)",
        }}
      >
        Save & continue →
      </button>
    </UserFormBubble>
  );
}

function AuthForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState("");
  return (
    <UserFormBubble>
      <FieldLabel>Your name</FieldLabel>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Sam Chen"
        className="w-full px-3 py-2 text-[13px] rounded-md outline-none"
        style={{
          background: "var(--cream-soft)",
          border: "1.5px solid var(--ink)",
        }}
      />
      <div className="text-[10px] text-ink-soft mt-1.5 leading-snug">
        I acknowledge I&rsquo;m authorised to run security tests against this
        codebase.
      </div>
      <button
        disabled={disabled || name.trim().length < 2}
        onClick={() => onSubmit(name.trim())}
        className="mt-2.5 px-3.5 py-[7px] text-[12px] font-bold rounded-md disabled:opacity-40"
        style={{
          background: "var(--basil)",
          color: "var(--cream)",
          border: "2px solid var(--ink)",
        }}
      >
        Acknowledge →
      </button>
    </UserFormBubble>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="block text-[10px] font-bold tracking-[0.1em] uppercase mb-1"
      style={{
        color: "var(--ink-soft)",
        fontFamily: "var(--font-mono)",
      }}
    >
      {children}
    </label>
  );
}

function maskKey(s: string): string {
  if (s.length <= 10) return "•".repeat(s.length);
  return `${s.slice(0, 4)}${"•".repeat(Math.min(20, s.length - 8))}${s.slice(-4)}`;
}
