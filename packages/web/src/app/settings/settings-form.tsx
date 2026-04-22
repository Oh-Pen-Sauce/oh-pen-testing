"use client";

import { useState, useTransition } from "react";
import type { Config, AutonomyMode, ProviderId } from "@oh-pen-testing/shared";
import { saveSettingsAction } from "./actions";
import { Btn } from "../../components/trattoria/button";

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
    desc: "Fix everything. No gates. Dev/test only.",
  },
  {
    value: "yolo",
    emoji: "🏃",
    label: "YOLO",
    desc: "PRs freely, still pauses on auth / secrets / schema / large diff.",
  },
  {
    value: "recommended",
    emoji: "👨‍🍳",
    label: "Recommended",
    desc: "Auto-approve low-risk. Pause on critical & trigger-matched.",
  },
  {
    value: "careful",
    emoji: "🧐",
    label: "Careful",
    desc: "Every fix needs your approval.",
  },
];

export function SettingsForm({ initial }: { initial: Config }) {
  const [autonomy, setAutonomy] = useState<AutonomyMode>(
    initial.agents.autonomy,
  );
  const [parallelism, setParallelism] = useState(initial.agents.parallelism);
  const [provider, setProvider] = useState<ProviderId>(
    initial.ai.primary_provider,
  );
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
    >
      <div className="grid md:grid-cols-2 gap-5">
        <Card title="Autonomy" icon="🎛️">
          <div className="mb-3">
            <Label>Autonomy mode</Label>
            <div className="grid grid-cols-2 gap-2">
              {AUTONOMY_CHOICES.map((c) => (
                <button
                  type="button"
                  key={c.value}
                  onClick={() => setAutonomy(c.value)}
                  className="text-left p-2.5 rounded-md transition-transform hover:-translate-y-px"
                  style={{
                    background:
                      autonomy === c.value
                        ? "var(--sauce)"
                        : "var(--cream)",
                    color:
                      autonomy === c.value
                        ? "var(--cream)"
                        : "var(--ink)",
                    border: "1.5px solid var(--ink)",
                    boxShadow:
                      autonomy === c.value
                        ? "2px 2px 0 var(--ink)"
                        : "none",
                  }}
                >
                  <div className="text-[12px] font-bold">
                    {c.emoji} {c.label}
                  </div>
                  <div
                    className="text-[10px] opacity-85 mt-0.5 leading-snug"
                    style={{
                      color:
                        autonomy === c.value
                          ? "var(--cream)"
                          : "var(--ink-soft)",
                    }}
                  >
                    {c.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <Field
            label="Agent parallelism"
            value={parallelism}
            onChange={(v) => setParallelism(Number(v))}
            type="number"
            min={1}
            max={16}
          />
        </Card>

        <Card title="AI provider" icon="🤖">
          <SelectField
            label="Provider"
            value={provider}
            onChange={(v) => setProvider(v as ProviderId)}
            options={[
              { value: "claude-api", label: "Claude API" },
              { value: "claude-max", label: "Claude (Max plan)" },
              { value: "claude-code-cli", label: "Claude Code CLI" },
              { value: "openai", label: "OpenAI" },
              { value: "openrouter", label: "OpenRouter" },
              { value: "ollama", label: "Ollama (local)" },
            ]}
          />
          <Field
            label="Model"
            value={model}
            onChange={setModel}
            mono
          />
          <Field
            label="Budget USD (API providers)"
            value={budget}
            onChange={(v) => setBudget(Number(v))}
            type="number"
            step={0.5}
            mono
          />
        </Card>
      </div>

      <div className="flex justify-between items-center mt-6">
        <div
          className="text-[12px] text-ink-soft"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {saved ? (
            <>
              <span style={{ color: "var(--basil)" }}>●</span> Saved ✓
            </>
          ) : pending ? (
            <>● saving…</>
          ) : (
            "● unsaved changes will prompt on save"
          )}
        </div>
        <div className="flex gap-2">
          <Btn
            type="button"
            variant="ghost"
            icon="↺"
            onClick={() => window.location.reload()}
          >
            Revert
          </Btn>
          <Btn type="submit" icon="💾" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Btn>
        </div>
      </div>
    </form>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl p-[22px] shadow-sauce"
      style={{
        background: "var(--cream-soft)",
        border: "2px solid var(--ink)",
      }}
    >
      <div
        className="flex items-center gap-2.5 mb-4 pb-3"
        style={{ borderBottom: "1px dashed rgba(34,26,20,0.25)" }}
      >
        <span className="text-[20px]" aria-hidden>
          {icon}
        </span>
        <h3
          className="m-0 font-black italic text-[22px] text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </h3>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="block text-[10px] font-bold tracking-[0.1em] uppercase mb-1.5"
      style={{
        color: "var(--ink-soft)",
        fontFamily: "var(--font-mono)",
      }}
    >
      {children}
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  mono,
  min,
  max,
  step,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: "text" | "number";
  mono?: boolean;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        step={step}
        className="w-full px-3 py-2.5 text-[13px] rounded-md outline-none"
        style={{
          background: "var(--cream)",
          border: "1.5px solid var(--ink)",
          fontFamily: mono ? "var(--font-mono)" : "var(--font-body)",
          color: "var(--ink)",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderWidth = "2px";
          e.currentTarget.style.borderColor = "var(--sauce)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderWidth = "1.5px";
          e.currentTarget.style.borderColor = "var(--ink)";
        }}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 text-[13px] rounded-md outline-none"
        style={{
          background: "var(--cream)",
          border: "1.5px solid var(--ink)",
          fontFamily: "var(--font-body)",
          color: "var(--ink)",
          appearance: "none",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
