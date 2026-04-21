"use client";

import { useState, useTransition } from "react";
import type { Config, AutonomyMode, ProviderId } from "@oh-pen-testing/shared";
import { saveSettingsAction } from "./actions";

export function SettingsForm({ initial }: { initial: Config }) {
  const [autonomy, setAutonomy] = useState<AutonomyMode>(initial.agents.autonomy);
  const [parallelism, setParallelism] = useState(initial.agents.parallelism);
  const [provider, setProvider] = useState<ProviderId>(initial.ai.primary_provider);
  const [model, setModel] = useState(initial.ai.model);
  const [budget, setBudget] = useState(initial.ai.rate_limit.budget_usd);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function submit() {
    setSaved(false);
    startTransition(async () => {
      await saveSettingsAction({
        autonomy,
        parallelism,
        provider,
        model,
        budgetUsd: budget,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-6 max-w-lg"
    >
      <Field label="Autonomy mode">
        <select
          value={autonomy}
          onChange={(e) => setAutonomy(e.target.value as AutonomyMode)}
          className="block w-full rounded border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="full-yolo">Full YOLO ⚠️ — no triggers, no prompts</option>
          <option value="yolo">YOLO — prompts on triggers only</option>
          <option value="recommended">Recommended — safe defaults</option>
          <option value="careful">Careful — always confirm</option>
        </select>
      </Field>

      <Field label="Agent parallelism">
        <input
          type="number"
          min={1}
          max={16}
          value={parallelism}
          onChange={(e) => setParallelism(Number(e.target.value))}
          className="block w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </Field>

      <Field label="AI provider">
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as ProviderId)}
          className="block w-full rounded border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="claude-api">Claude API</option>
          <option value="claude-max">Claude Max</option>
          <option value="claude-code-cli">Claude Code CLI</option>
          <option value="ollama">Ollama (local)</option>
        </select>
      </Field>

      <Field label="Model">
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="block w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
        />
      </Field>

      <Field label="Budget USD (for API providers)">
        <input
          type="number"
          min={0}
          step={0.5}
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
          className="block w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </Field>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {saved && <span className="text-sm text-green-700">Saved</span>}
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {children}
    </div>
  );
}
