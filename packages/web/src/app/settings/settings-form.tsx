"use client";

import { useEffect, useState, useTransition } from "react";
import type { Config, AutonomyMode, ProviderId } from "@oh-pen-testing/shared";
// Use the subpath export so this client component doesn't drag in the
// Node-only fs/promises imports from secrets-store.js via the main
// shared bundle. The model-catalog module is pure data + types.
import {
  MODEL_CATALOG,
  defaultModelFor,
} from "@oh-pen-testing/shared/model-catalog";
import { saveSettingsAction, saveRiskyAction } from "./actions";
import { Btn } from "../../components/trattoria/button";

/**
 * Risky test toggles — all off by default. These live behind the
 * "Advanced" collapsible so new users don't accidentally flip on
 * state-mutating probes.
 */
const RISKY_TESTS: Array<{
  id: string;
  label: string;
  risk: "amber" | "red";
  desc: string;
}> = [
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
    desc: "Makes state-mutating requests to your API. Dev / staging only.",
  },
  {
    id: "test_file_upload_malicious",
    label: "Test malicious file uploads",
    risk: "amber",
    desc: "Uploads EICAR + oversized files. May leave artefacts in your storage bucket.",
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
  const [risky, setRisky] = useState<Record<string, boolean>>(
    initial.scans.risky ?? {},
  );
  const [advancedUnlocked, setAdvancedUnlocked] = useState(false);
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
      // Persist risky toggles only if the user has actually unlocked
      // the advanced panel — prevents a default-off form from clobbering
      // a flag someone set via config.yml directly.
      if (advancedUnlocked) {
        await saveRiskyAction(risky);
      }
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
          <ModelPicker
            provider={provider}
            model={model}
            onChange={setModel}
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

      {/* Advanced — risky scan toggles, locked by default */}
      <div className="mt-5">
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: advancedUnlocked
              ? "var(--cream-soft)"
              : "var(--parmesan)",
            border: "2px solid var(--ink)",
          }}
        >
          <button
            type="button"
            onClick={() => setAdvancedUnlocked((v) => !v)}
            className="w-full flex items-center gap-3 px-5 py-3.5 text-left"
            style={{
              background: "transparent",
              cursor: "pointer",
            }}
          >
            <span
              className="text-[18px]"
              aria-hidden
              style={{
                transform: advancedUnlocked
                  ? "rotate(90deg)"
                  : "rotate(0deg)",
                transition: "transform 0.15s",
              }}
            >
              ▶
            </span>
            <div className="flex-1 min-w-0">
              <div
                className="font-black italic text-[18px] text-ink"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {advancedUnlocked ? "Advanced" : "🔒 Advanced"}
              </div>
              <div className="text-[12px] text-ink-soft mt-0.5">
                Risky tests — state-mutating probes. All off by default.
                Only flip these on after you&rsquo;ve read what each one
                does.
              </div>
            </div>
            <span
              className="text-[10px] font-bold tracking-[0.15em] uppercase shrink-0"
              style={{
                color: advancedUnlocked
                  ? "var(--basil)"
                  : "var(--sauce-dark)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {advancedUnlocked ? "unlocked" : "click to unlock"}
            </span>
          </button>

          {advancedUnlocked && (
            <div
              className="px-5 pb-5"
              style={{
                borderTop: "1px dashed rgba(34,26,20,0.25)",
              }}
            >
              <div
                className="mt-4 mb-3 px-3 py-2.5 rounded-lg text-[12px] leading-snug"
                style={{
                  background: "#FBE4E0",
                  border: "1.5px solid var(--sauce)",
                  color: "var(--sauce-dark)",
                }}
              >
                <strong>⚠ Dev / staging only.</strong> These probes make
                real requests — they can send emails, upload files, and
                mutate state. Never point them at production unless you
                have explicit authorisation and rollback.
              </div>
              <div className="flex flex-col gap-2.5">
                {RISKY_TESTS.map((t) => (
                  <RiskyToggle
                    key={t.id}
                    id={t.id}
                    label={t.label}
                    desc={t.desc}
                    risk={t.risk}
                    on={!!risky[t.id]}
                    onChange={(v) =>
                      setRisky({ ...risky, [t.id]: v })
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
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

function RiskyToggle({
  id,
  label,
  desc,
  risk,
  on,
  onChange,
}: {
  id: string;
  label: string;
  desc: string;
  risk: "amber" | "red";
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  const riskColor = risk === "red" ? "var(--sauce)" : "#D4A017";
  return (
    <div
      className="flex items-start gap-3 px-3 py-2.5 rounded-md"
      style={{
        background: "var(--cream)",
        border: "1.5px solid var(--ink)",
      }}
    >
      <button
        type="button"
        onClick={() => onChange(!on)}
        className="w-[38px] h-[22px] rounded-full relative shrink-0 mt-0.5"
        style={{
          background: on ? "var(--basil)" : "#ccc",
          border: "2px solid var(--ink)",
          cursor: "pointer",
        }}
        aria-pressed={on}
        aria-label={`Toggle ${label}`}
      >
        <span
          className="absolute top-[1px] w-[14px] h-[14px] rounded-full transition-all"
          style={{
            left: on ? "18px" : "1px",
            background: "var(--cream)",
            border: "1.5px solid var(--ink)",
          }}
          aria-hidden
        />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold text-ink">{label}</span>
          <span
            className="text-[9px] font-bold tracking-[0.15em] uppercase px-1.5 py-[2px] rounded"
            style={{
              background: riskColor,
              color: "var(--cream)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {risk}
          </span>
          <code
            className="text-[10px] text-ink-soft"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            scans.risky.{id}
          </code>
        </div>
        <div className="text-[11.5px] text-ink-soft mt-1 leading-snug">
          {desc}
        </div>
      </div>
    </div>
  );
}

/**
 * Provider-aware model picker.
 *
 * Shows a native <select> populated from MODEL_CATALOG for the current
 * provider, plus a final "Custom…" option that reveals a free-text
 * input for edge cases (Ollama users running community models, users
 * on OpenRouter slugs we haven't catalogued yet).
 *
 * When the user switches providers, if their current model isn't valid
 * for the new provider we auto-select the new provider's default so
 * they don't end up in a broken state like "provider: openai, model:
 * claude-sonnet-4-6".
 */
function ModelPicker({
  provider,
  model,
  onChange,
}: {
  provider: ProviderId;
  model: string;
  onChange: (m: string) => void;
}) {
  const catalog = MODEL_CATALOG[provider] ?? [];
  const catalogIds = new Set(catalog.map((c) => c.id));
  const isCustom = model.length > 0 && !catalogIds.has(model);
  const [showCustom, setShowCustom] = useState(isCustom);

  // When the provider changes, auto-switch to that provider's default
  // model unless the current model is already valid for the new one.
  useEffect(() => {
    if (catalogIds.has(model)) return;
    if (isCustom) return; // respect an explicit custom entry
    const fallback = defaultModelFor(provider);
    if (fallback && fallback !== model) onChange(fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const current = catalog.find((c) => c.id === model);

  return (
    <div>
      <Label>Model</Label>
      <select
        value={showCustom ? "__custom__" : model}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__custom__") {
            setShowCustom(true);
            return;
          }
          setShowCustom(false);
          onChange(v);
        }}
        className="w-full px-3 py-2 text-[13px] rounded-md outline-none"
        style={{
          background: "var(--cream-soft)",
          border: "1.5px solid var(--ink)",
          color: "var(--ink)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {catalog.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
        <option value="__custom__">Custom — type a model id…</option>
      </select>
      {current?.note && !showCustom && (
        <div
          className="mt-1 text-[11px] text-ink-soft leading-snug"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {current.note}
        </div>
      )}
      {showCustom && (
        <input
          type="text"
          value={model}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. my-custom-finetune:latest"
          className="w-full mt-2 px-3 py-2 text-[13px] rounded-md outline-none"
          style={{
            background: "var(--cream-soft)",
            border: "1.5px solid var(--ink)",
            color: "var(--ink)",
            fontFamily: "var(--font-mono)",
          }}
        />
      )}
    </div>
  );
}
