"use client";

import { useState } from "react";
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
  setRiskyAction,
  setAuthorisationAckAction,
} from "./actions";

const STEPS = [
  "Provider",
  "Credentials",
  "GitHub",
  "Autonomy",
  "Authorisation",
  "Risky tests",
] as const;

type StepIdx = 0 | 1 | 2 | 3 | 4 | 5;

export function SetupWizard({ initial }: { initial: Config | null }) {
  const [step, setStep] = useState<StepIdx>(0);
  const [provider, setProvider] = useState<ProviderId>(
    initial?.ai.primary_provider ?? "claude-api",
  );
  const [model, setModel] = useState(initial?.ai.model ?? "claude-opus-4-7");
  const [autonomy, setAutonomy] = useState<AutonomyMode>(
    initial?.agents.autonomy ?? "recommended",
  );
  const [authAck, setAuthAck] = useState(
    initial?.scope?.authorisation_acknowledged ?? false,
  );
  const [authActor, setAuthActor] = useState(
    initial?.scope?.authorisation_acknowledged_by ?? "",
  );
  const [risky, setRisky] = useState<Record<string, boolean>>(
    initial?.scans.risky ?? {},
  );

  return (
    <div>
      <nav className="flex gap-2 mb-6">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={`flex-1 text-center text-xs py-2 rounded border ${
              i === step
                ? "bg-blue-600 text-white border-blue-600"
                : i < step
                  ? "bg-green-50 text-green-900 border-green-200"
                  : "bg-white text-slate-500 border-slate-200"
            }`}
          >
            {i + 1}. {s}
          </div>
        ))}
      </nav>

      {step === 0 && (
        <ProviderStep
          provider={provider}
          setProvider={setProvider}
          model={model}
          setModel={setModel}
          onNext={async () => {
            await setProviderAction(provider, model);
            setStep(1);
          }}
        />
      )}
      {step === 1 && (
        <CredentialsStep
          provider={provider}
          onBack={() => setStep(0)}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <GitHubStep onBack={() => setStep(1)} onNext={() => setStep(3)} />
      )}
      {step === 3 && (
        <AutonomyStep
          autonomy={autonomy}
          setAutonomy={setAutonomy}
          onBack={() => setStep(2)}
          onNext={async () => {
            await setAutonomyAction(autonomy);
            setStep(4);
          }}
        />
      )}
      {step === 4 && (
        <AuthorisationStep
          ack={authAck}
          setAck={setAuthAck}
          actor={authActor}
          setActor={setAuthActor}
          onBack={() => setStep(3)}
          onNext={async () => {
            await setAuthorisationAckAction(true, authActor || undefined);
            setStep(5);
          }}
        />
      )}
      {step === 5 && (
        <RiskyStep
          risky={risky}
          setRisky={setRisky}
          onBack={() => setStep(4)}
          onDone={async () => {
            await setRiskyAction(risky);
            window.location.href = "/";
          }}
        />
      )}
    </div>
  );
}

function AuthorisationStep({
  ack,
  setAck,
  actor,
  setActor,
  onBack,
  onNext,
}: {
  ack: boolean;
  setAck: (v: boolean) => void;
  actor: string;
  setActor: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-5">
      <h2 className="font-semibold">Authorisation acknowledgement</h2>
      <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 space-y-3">
        <p>
          <strong>Oh Pen Testing only scans code you are authorised to test.</strong>{" "}
          Running security tests against systems you don't own or have
          permission to test may be illegal in your jurisdiction.
        </p>
        <p>
          By checking the box below you confirm that you have explicit
          authorisation to run security testing against every target configured
          in this installation. This acknowledgement is stored in{" "}
          <code>.ohpentesting/config.yml</code> with a timestamp.
        </p>
      </div>
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
          className="mt-1"
        />
        <span className="text-sm">
          I confirm I have authorisation to run security testing against every
          target configured here.
        </span>
      </label>
      <div>
        <label className="block text-sm font-medium mb-1">
          Your name or email (optional — recorded with the acknowledgement)
        </label>
        <input
          type="text"
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          placeholder="sam@example.com"
          className="block w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex justify-between">
        <button onClick={onBack} className="text-sm px-3 py-2 text-slate-600">
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={!ack}
          className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50"
        >
          Confirm &amp; next →
        </button>
      </div>
    </div>
  );
}

function ProviderStep({
  provider,
  setProvider,
  model,
  setModel,
  onNext,
}: {
  provider: ProviderId;
  setProvider: (p: ProviderId) => void;
  model: string;
  setModel: (m: string) => void;
  onNext: () => void;
}) {
  const [probe, setProbe] = useState<{ ok: boolean; detail: string } | null>(
    null,
  );
  const [probing, setProbing] = useState(false);

  async function handleProbe() {
    setProbing(true);
    const res = await probeProviderAction(provider);
    setProbe(res);
    setProbing(false);
  }

  return (
    <div className="space-y-5">
      <h2 className="font-semibold">Choose an AI provider</h2>
      <div className="space-y-2">
        {[
          {
            id: "claude-api" as const,
            label: "Claude API",
            desc: "Pay-per-token via Anthropic API. Best quality.",
          },
          {
            id: "claude-max" as const,
            label: "Claude (Max plan)",
            desc: "Uses Anthropic API with a 5-hour rolling window cap.",
          },
          {
            id: "claude-code-cli" as const,
            label: "Claude Code CLI",
            desc: "Spawns your local `claude` session. $0 extra on Max.",
          },
          {
            id: "ollama" as const,
            label: "Ollama (local)",
            desc: "Fully offline. Runs on your machine. Default model: kimi-k2.6.",
          },
        ].map((opt) => (
          <label
            key={opt.id}
            className={`block rounded border p-3 cursor-pointer ${
              provider === opt.id
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 hover:border-slate-400"
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="provider"
                value={opt.id}
                checked={provider === opt.id}
                onChange={() => {
                  setProvider(opt.id);
                  if (opt.id === "ollama") setModel("kimi-k2.6");
                  if (opt.id.startsWith("claude")) setModel("claude-opus-4-7");
                  setProbe(null);
                }}
                className="mt-1"
              />
              <div>
                <div className="font-medium">{opt.label}</div>
                <div className="text-xs text-slate-500">{opt.desc}</div>
              </div>
            </div>
          </label>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Model</label>
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="block w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
        />
      </div>

      {(provider === "claude-code-cli" || provider === "ollama") && (
        <div>
          <button
            type="button"
            onClick={handleProbe}
            disabled={probing}
            className="text-sm px-3 py-1 rounded border border-slate-300"
          >
            {probing ? "Probing…" : "Check connection"}
          </button>
          {probe && (
            <div
              className={`mt-2 text-sm rounded p-2 ${
                probe.ok
                  ? "bg-green-50 text-green-900"
                  : "bg-amber-50 text-amber-900"
              }`}
            >
              {probe.ok ? "✓ " : "⚠ "}
              {probe.detail}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onNext}
          className="px-4 py-2 rounded bg-blue-600 text-white text-sm"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function CredentialsStep({
  provider,
  onBack,
  onNext,
}: {
  provider: ProviderId;
  onBack: () => void;
  onNext: () => void;
}) {
  const [secret, setSecret] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const needsKey =
    provider === "claude-api" ||
    provider === "claude-max" ||
    provider === "openai" ||
    provider === "openrouter";

  async function save() {
    setErr(null);
    try {
      await saveApiKeyAction(provider, secret);
      setSaved(true);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="font-semibold">Credentials</h2>
      {!needsKey ? (
        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          {provider === "claude-code-cli"
            ? "Uses your local `claude` CLI session. No API key needed."
            : "Local provider — no credentials needed."}
        </div>
      ) : (
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            API key for {provider}
          </label>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="sk-ant-..."
            className="block w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={!secret || saved}
              className="text-sm px-3 py-1 rounded bg-slate-700 text-white disabled:opacity-50"
            >
              {saved ? "Saved ✓" : "Save to keychain"}
            </button>
            {err && <span className="text-sm text-red-700">{err}</span>}
          </div>
          <p className="text-xs text-slate-500">
            Stored in your OS keychain. Never written to files. You can re-run
            setup any time to rotate.
          </p>
        </div>
      )}
      <div className="flex justify-between">
        <button onClick={onBack} className="text-sm px-3 py-2 text-slate-600">
          ← Back
        </button>
        <button
          onClick={onNext}
          className="px-4 py-2 rounded bg-blue-600 text-white text-sm"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function GitHubStep({
  onBack,
  onNext,
}: {
  onBack: () => void;
  onNext: () => void;
}) {
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [savedToken, setSavedToken] = useState(false);
  const [savedRepo, setSavedRepo] = useState(false);

  async function saveTokenFn() {
    setErr(null);
    try {
      await saveGitHubTokenAction(token);
      setSavedToken(true);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function saveRepoFn() {
    setErr(null);
    try {
      await setRepoAction(repo);
      setSavedRepo(true);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="font-semibold">GitHub</h2>
      <div>
        <label className="block text-sm font-medium">Repository (owner/name)</label>
        <input
          type="text"
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          placeholder="your-org/your-repo"
          className="block w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
        />
        <button
          type="button"
          onClick={saveRepoFn}
          disabled={!repo || savedRepo}
          className="mt-2 text-sm px-3 py-1 rounded bg-slate-700 text-white disabled:opacity-50"
        >
          {savedRepo ? "Saved ✓" : "Save repo"}
        </button>
      </div>
      <div>
        <label className="block text-sm font-medium">
          GitHub PAT (scoped to this repo)
        </label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="ghp_... or github_pat_..."
          className="block w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
        />
        <p className="text-xs text-slate-500 mt-1">
          Fine-grained token with <code>contents:write</code> and{" "}
          <code>pull_requests:write</code>.{" "}
          <a
            href="https://github.com/settings/personal-access-tokens/new"
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:underline"
          >
            Generate →
          </a>
        </p>
        <button
          type="button"
          onClick={saveTokenFn}
          disabled={!token || savedToken}
          className="mt-2 text-sm px-3 py-1 rounded bg-slate-700 text-white disabled:opacity-50"
        >
          {savedToken ? "Saved ✓" : "Save to keychain"}
        </button>
      </div>
      {err && <div className="text-sm text-red-700">{err}</div>}
      <div className="flex justify-between">
        <button onClick={onBack} className="text-sm px-3 py-2 text-slate-600">
          ← Back
        </button>
        <button
          onClick={onNext}
          className="px-4 py-2 rounded bg-blue-600 text-white text-sm"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function AutonomyStep({
  autonomy,
  setAutonomy,
  onBack,
  onNext,
}: {
  autonomy: AutonomyMode;
  setAutonomy: (a: AutonomyMode) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-5">
      <h2 className="font-semibold">Autonomy mode</h2>
      <div className="space-y-2">
        {(
          [
            {
              id: "yolo" as const,
              label: "YOLO",
              desc: "Agents open PRs for everything except explicitly guarded zones.",
            },
            {
              id: "recommended" as const,
              label: "Recommended (default)",
              desc: "Auto-approves low-risk fixes; blocks on auth, secrets, schema, large diffs.",
            },
            {
              id: "careful" as const,
              label: "Careful",
              desc: "Every fix requires your approval before PR.",
            },
          ]
        ).map((opt) => (
          <label
            key={opt.id}
            className={`block rounded border p-3 cursor-pointer ${
              autonomy === opt.id
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 hover:border-slate-400"
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="autonomy"
                value={opt.id}
                checked={autonomy === opt.id}
                onChange={() => setAutonomy(opt.id)}
                className="mt-1"
              />
              <div>
                <div className="font-medium">{opt.label}</div>
                <div className="text-xs text-slate-500">{opt.desc}</div>
              </div>
            </div>
          </label>
        ))}
      </div>
      <div className="flex justify-between">
        <button onClick={onBack} className="text-sm px-3 py-2 text-slate-600">
          ← Back
        </button>
        <button
          onClick={onNext}
          className="px-4 py-2 rounded bg-blue-600 text-white text-sm"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

const RISKY_TESTS = [
  {
    id: "test_reset_password_flow",
    label: "Test reset-password flow",
    risk: "amber",
    desc: "Attempts password-reset enumeration. Sends real emails if your app has SMTP configured.",
  },
  {
    id: "attempt_privilege_escalation",
    label: "Attempt privilege escalation",
    risk: "red",
    desc: "Makes state-mutating requests to your API. Dev/staging only.",
  },
  {
    id: "test_file_upload_malicious",
    label: "Test malicious file uploads",
    risk: "amber",
    desc: "Uploads EICAR + oversized files. May leave artefacts in storage.",
  },
] as const;

function RiskyStep({
  risky,
  setRisky,
  onBack,
  onDone,
}: {
  risky: Record<string, boolean>;
  setRisky: (r: Record<string, boolean>) => void;
  onBack: () => void;
  onDone: () => void;
}) {
  return (
    <div className="space-y-5">
      <h2 className="font-semibold">Risky tests</h2>
      <p className="text-sm text-slate-600">
        All off by default. Toggle individually.
      </p>
      <div className="space-y-2">
        {RISKY_TESTS.map((t) => (
          <div
            key={t.id}
            className="rounded border border-slate-200 p-3"
          >
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!!risky[t.id]}
                onChange={(e) =>
                  setRisky({ ...risky, [t.id]: e.target.checked })
                }
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t.label}</span>
                  <RiskBadge risk={t.risk} />
                </div>
                <div className="text-xs text-slate-500 mt-1">{t.desc}</div>
              </div>
            </label>
          </div>
        ))}
      </div>
      <div className="flex justify-between">
        <button onClick={onBack} className="text-sm px-3 py-2 text-slate-600">
          ← Back
        </button>
        <button
          onClick={onDone}
          className="px-4 py-2 rounded bg-green-600 text-white text-sm"
        >
          Finish setup
        </button>
      </div>
    </div>
  );
}

function RiskBadge({ risk }: { risk: "amber" | "red" | "green" }) {
  const map = {
    green: "bg-green-100 text-green-800 border-green-200",
    amber: "bg-amber-100 text-amber-900 border-amber-200",
    red: "bg-red-100 text-red-800 border-red-200",
  } as const;
  return (
    <span
      className={`text-xs px-1.5 py-0.5 rounded border ${map[risk]}`}
    >
      {risk}
    </span>
  );
}
