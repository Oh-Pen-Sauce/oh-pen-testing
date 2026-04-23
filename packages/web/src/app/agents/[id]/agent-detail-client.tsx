"use client";

import { useState, useTransition } from "react";
import type { AgentId, AgentProfile } from "@oh-pen-testing/shared";
import type { AgentMeta } from "../../../components/trattoria/agents";
import {
  addAgentSkillAction,
  deleteAgentSkillAction,
  revertAgentMemoryAction,
  revertAgentPlaybooksAction,
  saveAgentMemoryAction,
  saveAgentPlaybooksAction,
} from "../actions";
import { Btn } from "../../../components/trattoria/button";

/**
 * Agent detail page — three panels:
 *
 *   1. Memory — persona + confirmation heuristics. View + edit.
 *      Edits land in .ohpentesting/agents/<id>/memory.md, falling
 *      back to the bundled asset when no override exists.
 *
 *   2. Assigned playbooks — which scanner rules this agent owns.
 *      Editable as a newline-separated list; any AI reading the
 *      agent bundle + scanner can route findings accordingly.
 *
 *   3. Custom skills — user-authored markdown files the agent
 *      references at runtime. Create, edit, delete — everything
 *      project-local under .ohpentesting/agents/<id>/skills/.
 *
 * Every editable section carries a clear "source" chip — bundled
 * (read-only default) vs project (overridden). Revert any override
 * to go back to defaults.
 */

export function AgentDetailClient({
  profile,
  meta,
}: {
  profile: AgentProfile;
  meta: AgentMeta;
}) {
  return (
    <div className="flex flex-col gap-6">
      <MemoryPanel id={profile.id} profile={profile} meta={meta} />
      <PlaybooksPanel id={profile.id} profile={profile} />
      <SkillsPanel id={profile.id} profile={profile} />
    </div>
  );
}

// ─── memory ──────────────────────────────────────────────────────

function MemoryPanel({
  id,
  profile,
  meta,
}: {
  id: AgentId;
  profile: AgentProfile;
  meta: AgentMeta;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(profile.memory);
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  function save() {
    setFlash(null);
    startTransition(async () => {
      const res = await saveAgentMemoryAction(id, value);
      if (res.ok) {
        setEditing(false);
        setFlash({ kind: "ok", text: res.detail });
        setTimeout(() => window.location.reload(), 700);
      } else {
        setFlash({ kind: "err", text: res.detail });
      }
    });
  }

  function revert() {
    if (
      !confirm(
        `Revert ${meta.name}'s memory to the bundled default? Your project override will be deleted.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await revertAgentMemoryAction(id);
      if (res.ok) {
        setFlash({ kind: "ok", text: res.detail });
        setTimeout(() => window.location.reload(), 700);
      } else {
        setFlash({ kind: "err", text: res.detail });
      }
    });
  }

  return (
    <Section
      title="Memory"
      source={profile.memorySource}
      sourcePath={profile.memoryPath}
      actions={
        editing ? (
          <>
            <Btn
              variant="ghost"
              icon="✕"
              onClick={() => {
                setEditing(false);
                setValue(profile.memory);
              }}
            >
              Cancel
            </Btn>
            <Btn icon="✓" disabled={pending} onClick={save}>
              {pending ? "Saving…" : "Save override"}
            </Btn>
          </>
        ) : (
          <>
            {profile.memorySource === "project" && (
              <Btn variant="ghost" icon="↺" onClick={revert}>
                Revert to bundled
              </Btn>
            )}
            <Btn icon="✎" onClick={() => setEditing(true)}>
              Edit
            </Btn>
          </>
        )
      }
    >
      {flash && <Flash kind={flash.kind} text={flash.text} />}
      {editing ? (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={20}
          className="w-full p-3 text-[12.5px] rounded-md outline-none"
          style={{
            background: "var(--cream)",
            border: "1.5px solid var(--ink)",
            color: "var(--ink)",
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
          }}
        />
      ) : (
        <pre
          className="text-[12.5px] leading-relaxed whitespace-pre-wrap break-words m-0 p-0"
          style={{
            color: "var(--ink)",
            fontFamily: "var(--font-body)",
            background: "transparent",
          }}
        >
          {profile.memory}
        </pre>
      )}
    </Section>
  );
}

// ─── playbooks ───────────────────────────────────────────────────

function PlaybooksPanel({
  id,
  profile,
}: {
  id: AgentId;
  profile: AgentProfile;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(profile.playbooks.join("\n"));
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  function save() {
    setFlash(null);
    const list = raw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    startTransition(async () => {
      const res = await saveAgentPlaybooksAction(id, list);
      if (res.ok) {
        setEditing(false);
        setFlash({ kind: "ok", text: res.detail });
        setTimeout(() => window.location.reload(), 700);
      } else {
        setFlash({ kind: "err", text: res.detail });
      }
    });
  }

  function revert() {
    if (
      !confirm(
        "Revert playbook assignment to the bundled default? Your project override will be deleted.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await revertAgentPlaybooksAction(id);
      if (res.ok) {
        setFlash({ kind: "ok", text: res.detail });
        setTimeout(() => window.location.reload(), 700);
      } else {
        setFlash({ kind: "err", text: res.detail });
      }
    });
  }

  return (
    <Section
      title="Assigned playbooks"
      source={profile.playbooksSource}
      sourcePath={
        profile.playbooksSource === "project"
          ? `${profile.projectDir}/playbooks.yml`
          : `${profile.bundledDir}/playbooks.yml`
      }
      actions={
        editing ? (
          <>
            <Btn
              variant="ghost"
              icon="✕"
              onClick={() => {
                setEditing(false);
                setRaw(profile.playbooks.join("\n"));
              }}
            >
              Cancel
            </Btn>
            <Btn icon="✓" disabled={pending} onClick={save}>
              {pending ? "Saving…" : "Save"}
            </Btn>
          </>
        ) : (
          <>
            {profile.playbooksSource === "project" && (
              <Btn variant="ghost" icon="↺" onClick={revert}>
                Revert to bundled
              </Btn>
            )}
            <Btn icon="✎" onClick={() => setEditing(true)}>
              Edit
            </Btn>
          </>
        )
      }
    >
      {flash && <Flash kind={flash.kind} text={flash.text} />}
      {editing ? (
        <>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={12}
            className="w-full p-3 text-[12.5px] rounded-md outline-none"
            style={{
              background: "var(--cream)",
              border: "1.5px solid var(--ink)",
              color: "var(--ink)",
              fontFamily: "var(--font-mono)",
            }}
            placeholder="One playbook id per line, e.g.&#10;owasp/a03-injection/sql-injection-raw"
          />
          <div
            className="text-[11px] text-ink-soft mt-2"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            One id per line. IDs look like{" "}
            <code>{"<category>/<playbook>"}</code> —{" "}
            <a
              href="/playbooks"
              className="underline"
              style={{ color: "var(--sauce)" }}
            >
              browse the full catalog
            </a>{" "}
            for exact ids.
          </div>
        </>
      ) : profile.playbooks.length === 0 ? (
        <div className="text-[13px] italic text-ink-soft">
          No playbooks assigned.
        </div>
      ) : (
        <ul
          className="flex flex-col gap-1"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {profile.playbooks.map((pb) => (
            <li key={pb}>
              <a
                href={`/playbooks/${encodeURIComponent(pb)}`}
                className="text-[12.5px] underline"
                style={{ color: "var(--ink)" }}
              >
                {pb}
              </a>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// ─── custom skills ───────────────────────────────────────────────

function SkillsPanel({
  id,
  profile,
}: {
  id: AgentId;
  profile: AgentProfile;
}) {
  const [creating, setCreating] = useState(false);
  const [newId, setNewId] = useState("");
  const [newBody, setNewBody] = useState(
    "# Skill name\n\nDescribe what this skill tells the agent to do.\n",
  );
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  function createSkill() {
    setFlash(null);
    if (!newId.trim()) {
      setFlash({ kind: "err", text: "Skill id required." });
      return;
    }
    startTransition(async () => {
      const res = await addAgentSkillAction(id, newId.trim(), newBody);
      if (res.ok) {
        setCreating(false);
        setNewId("");
        setNewBody(
          "# Skill name\n\nDescribe what this skill tells the agent to do.\n",
        );
        setFlash({ kind: "ok", text: res.detail });
        setTimeout(() => window.location.reload(), 700);
      } else {
        setFlash({ kind: "err", text: res.detail });
      }
    });
  }

  function removeSkill(skillId: string) {
    if (!confirm(`Delete custom skill ${skillId}?`)) return;
    startTransition(async () => {
      const res = await deleteAgentSkillAction(id, skillId);
      if (res.ok) {
        setFlash({ kind: "ok", text: res.detail });
        setTimeout(() => window.location.reload(), 700);
      } else {
        setFlash({ kind: "err", text: res.detail });
      }
    });
  }

  return (
    <Section
      title="Custom skills"
      source={profile.customSkills.length > 0 ? "project" : "bundled"}
      sourcePath={`${profile.projectDir}/skills/`}
      actions={
        !creating && (
          <Btn icon="+" onClick={() => setCreating(true)}>
            New skill
          </Btn>
        )
      }
    >
      {flash && <Flash kind={flash.kind} text={flash.text} />}

      {creating && (
        <div
          className="rounded-md p-3 mb-4"
          style={{
            background: "var(--cream)",
            border: "1.5px dashed var(--ink)",
          }}
        >
          <div className="mb-3">
            <Label>Skill id</Label>
            <input
              type="text"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              placeholder="e.g. detect-hardcoded-stripe-keys"
              className="w-full px-3 py-2 text-[13px] rounded-md outline-none"
              style={{
                background: "var(--cream-soft)",
                border: "1.5px solid var(--ink)",
                color: "var(--ink)",
                fontFamily: "var(--font-mono)",
              }}
            />
            <Hint>
              Letters, digits, hyphens. Saved as{" "}
              <code>{"<id>"}.md</code> in{" "}
              <code>.ohpentesting/agents/{id}/skills/</code>.
            </Hint>
          </div>
          <div className="mb-3">
            <Label>Skill body (markdown)</Label>
            <textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              rows={12}
              className="w-full p-3 text-[12.5px] rounded-md outline-none"
              style={{
                background: "var(--cream-soft)",
                border: "1.5px solid var(--ink)",
                color: "var(--ink)",
                fontFamily: "var(--font-mono)",
              }}
            />
          </div>
          <div className="flex gap-2">
            <Btn
              variant="ghost"
              icon="✕"
              onClick={() => setCreating(false)}
              disabled={pending}
            >
              Cancel
            </Btn>
            <Btn icon="✓" disabled={pending} onClick={createSkill}>
              {pending ? "Saving…" : "Create skill"}
            </Btn>
          </div>
        </div>
      )}

      {profile.customSkills.length === 0 && !creating ? (
        <div className="text-[13px] italic text-ink-soft">
          No custom skills yet — click{" "}
          <strong>+ New skill</strong> to author one.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {profile.customSkills.map((skill) => (
            <SkillCard
              key={skill.id}
              agentId={id}
              skill={skill}
              onDelete={() => removeSkill(skill.id)}
            />
          ))}
        </div>
      )}
    </Section>
  );
}

function SkillCard({
  agentId,
  skill,
  onDelete,
}: {
  agentId: AgentId;
  skill: { id: string; filename: string; body: string; custom: boolean };
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-md"
      style={{
        background: "var(--cream)",
        border: "1.5px solid var(--ink)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
        style={{ background: "transparent", cursor: "pointer" }}
      >
        <span
          className="text-[12px]"
          aria-hidden
          style={{
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
          }}
        >
          ▶
        </span>
        <code
          className="text-[13px] font-semibold text-ink flex-1"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {skill.id}
        </code>
        <span
          className="text-[10px] font-bold tracking-[0.1em] uppercase px-2 py-[2px] rounded"
          style={{
            background: "var(--sauce)",
            color: "var(--cream)",
            fontFamily: "var(--font-mono)",
          }}
        >
          project
        </span>
      </button>
      {open && (
        <div
          className="px-3 pb-3"
          style={{ borderTop: "1px dashed rgba(34,26,20,0.2)" }}
        >
          <pre
            className="text-[12px] leading-relaxed whitespace-pre-wrap break-words m-0 pt-3"
            style={{
              color: "var(--ink)",
              fontFamily: "var(--font-body)",
              background: "transparent",
            }}
          >
            {skill.body}
          </pre>
          <div className="mt-3 flex items-center gap-2">
            <code
              className="text-[10.5px] text-ink-soft"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {`.ohpentesting/agents/${agentId}/skills/${skill.filename}`}
            </code>
            <button
              type="button"
              onClick={onDelete}
              className="ml-auto text-[11px] font-semibold px-2.5 py-1 rounded-md"
              style={{
                background: "transparent",
                color: "var(--sauce-dark)",
                border: "1.5px solid var(--sauce)",
                fontFamily: "var(--font-mono)",
              }}
            >
              🗑 Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── shared bits ─────────────────────────────────────────────────

function Section({
  title,
  source,
  sourcePath,
  actions,
  children,
}: {
  title: string;
  source: "bundled" | "project";
  sourcePath: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-xl p-5"
      style={{
        background: "var(--cream-soft)",
        border: "2px solid var(--ink)",
      }}
    >
      <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
        <div className="min-w-0">
          <h3
            className="font-black italic text-[22px] text-ink m-0"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {title}
          </h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span
              className="text-[9px] font-bold tracking-[0.15em] uppercase px-1.5 py-[2px] rounded"
              style={{
                background:
                  source === "project" ? "var(--sauce)" : "var(--parmesan)",
                color: source === "project" ? "var(--cream)" : "var(--ink)",
                border: "1px solid var(--ink)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {source === "project" ? "project override" : "bundled default"}
            </span>
            <code
              className="text-[10.5px] text-ink-soft"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {sourcePath}
            </code>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">{actions}</div>
      </div>
      {children}
    </section>
  );
}

function Flash({
  kind,
  text,
}: {
  kind: "ok" | "err";
  text: string;
}) {
  return (
    <div
      className="mb-3 px-3 py-2 rounded text-[12px]"
      style={{
        background: kind === "ok" ? "#E4F0DF" : "#FBE4E0",
        border: `1.5px solid ${kind === "ok" ? "var(--basil)" : "var(--sauce)"}`,
        color: kind === "ok" ? "var(--basil-dark)" : "var(--sauce-dark)",
      }}
    >
      {text}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="block text-[10px] font-bold tracking-[0.1em] uppercase mb-1.5"
      style={{ color: "var(--ink-soft)", fontFamily: "var(--font-mono)" }}
    >
      {children}
    </label>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mt-1.5 text-[11.5px] text-ink-soft leading-snug"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {children}
    </div>
  );
}
