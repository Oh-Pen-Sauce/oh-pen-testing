"use client";

import { useState, useTransition } from "react";
import type {
  ManagedProject,
  ProjectRegistry,
} from "@oh-pen-testing/shared";
import {
  addProjectAction,
  refreshProjectAction,
  removeProjectAction,
  switchActiveProjectAction,
} from "./actions";
import { Btn } from "../../components/trattoria/button";

/**
 * Interactive projects manager.
 *
 * Three actions per project (active + others):
 *   - Switch (make active)
 *   - Refresh (git pull the clone)
 *   - Remove (drop from registry; optionally also delete clone)
 *
 * Plus a single "Add project" form at the top. Add takes a slug
 * (owner/name) and optionally a local path — if the user already
 * has the repo checked out somewhere, we register that path
 * instead of cloning fresh.
 */

export function ProjectsClient({
  initialRegistry,
}: {
  initialRegistry: ProjectRegistry;
}) {
  const [registry, setRegistry] = useState(initialRegistry);
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<
    { kind: "ok" | "err"; message: string } | null
  >(null);
  const [showForm, setShowForm] = useState(
    initialRegistry.projects.length === 0,
  );
  const [slug, setSlug] = useState("");
  const [existingPath, setExistingPath] = useState("");

  function showFlash(kind: "ok" | "err", message: string) {
    setFlash({ kind, message });
    setTimeout(() => setFlash(null), 5000);
  }

  // No local fetch — after mutations we reload the page so every
  // server-rendered surface (banner, sidebar, other pages) picks up
  // the new active project. Uses `setRegistry` anyway to keep the
  // ProjectRegistry type import non-orphaned at the boundary.
  void setRegistry;

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!slug.trim()) return;
    startTransition(async () => {
      const res = await addProjectAction({
        slug: slug.trim(),
        existingLocalPath: existingPath.trim() || undefined,
        setActive: true,
      });
      if (res.ok) {
        showFlash("ok", res.detail);
        setSlug("");
        setExistingPath("");
        setShowForm(false);
        window.location.reload();
      } else {
        showFlash("err", res.detail);
      }
    });
  }

  function handleSwitch(id: string) {
    startTransition(async () => {
      const res = await switchActiveProjectAction(id);
      if (res.ok) {
        showFlash("ok", res.detail);
        window.location.reload();
      } else {
        showFlash("err", res.detail);
      }
    });
  }

  function handleRemove(project: ManagedProject) {
    const deleteClone = confirm(
      `Delete ${project.id} from the registry?\n\nClick OK to also delete the clone at:\n  ${project.localPath}\n\nClick Cancel to keep the clone on disk (you can re-add it later).`,
    );
    startTransition(async () => {
      const res = await removeProjectAction({
        id: project.id,
        deleteClone,
      });
      if (res.ok) {
        showFlash("ok", res.detail);
        window.location.reload();
      } else {
        showFlash("err", res.detail);
      }
    });
  }

  function handleRefresh(project: ManagedProject) {
    startTransition(async () => {
      const res = await refreshProjectAction(project.id);
      if (res.ok) {
        showFlash("ok", res.detail);
        // Refresh only touches `lastFetchedAt` — a reload updates
        // the timestamp in the card.
        window.location.reload();
      } else {
        showFlash("err", res.detail);
      }
    });
  }

  const activeId = registry.activeProjectId;

  return (
    <div>
      {flash && (
        <div
          className="mb-4 px-3.5 py-2.5 rounded-md text-[13px]"
          style={{
            background:
              flash.kind === "ok" ? "#E4F0DF" : "#FBE4E0",
            border: `1.5px solid ${flash.kind === "ok" ? "var(--basil)" : "var(--sauce)"}`,
            color:
              flash.kind === "ok"
                ? "var(--basil-dark)"
                : "var(--sauce-dark)",
          }}
        >
          {flash.message}
        </div>
      )}

      {/* Add-project form */}
      <div
        className="rounded-xl mb-6 overflow-hidden"
        style={{
          background: "var(--cream-soft)",
          border: "2px solid var(--ink)",
          boxShadow:
            registry.projects.length === 0
              ? "6px 6px 0 var(--sauce)"
              : undefined,
        }}
      >
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-left"
          style={{ background: "transparent", cursor: "pointer" }}
        >
          <div>
            <div
              className="text-[10px] font-bold tracking-[0.2em] uppercase"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--sauce)",
              }}
            >
              {registry.projects.length === 0
                ? "▶ Start here"
                : "+ Add another project"}
            </div>
            <div
              className="font-black italic text-[20px] text-ink mt-0.5"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Add a GitHub project
            </div>
          </div>
          <span
            className="text-[18px]"
            style={{
              transform: showForm ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.15s",
            }}
          >
            ▶
          </span>
        </button>
        {showForm && (
          <form
            onSubmit={handleAdd}
            className="px-5 pb-5"
            style={{
              borderTop: "1px dashed rgba(34,26,20,0.2)",
            }}
          >
            <div className="mt-4 mb-3">
              <Label>GitHub slug</Label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="owner/name (e.g. snrefertech/fourfivesixle)"
                className="w-full px-3 py-2.5 text-[13px] rounded-md outline-none"
                style={{
                  background: "var(--cream)",
                  border: "1.5px solid var(--ink)",
                  color: "var(--ink)",
                  fontFamily: "var(--font-mono)",
                }}
                required
                pattern="^[\w.\-]+/[\w.\-]+$"
              />
              <Hint>
                I&rsquo;ll clone this under{" "}
                <code>~/.ohpentesting/projects/{slug || "owner/name"}/</code>{" "}
                using your GitHub PAT (saved in setup). Private repos need a
                PAT with Contents: read + Pull requests: read/write.
              </Hint>
            </div>
            <details className="mb-3">
              <summary
                className="cursor-pointer text-[12px] underline"
                style={{ color: "var(--sauce)" }}
              >
                Or use an existing clone on disk →
              </summary>
              <div className="mt-3">
                <Label>Existing local path (optional)</Label>
                <input
                  type="text"
                  value={existingPath}
                  onChange={(e) => setExistingPath(e.target.value)}
                  placeholder="/Users/you/code/my-project"
                  className="w-full px-3 py-2.5 text-[13px] rounded-md outline-none"
                  style={{
                    background: "var(--cream)",
                    border: "1.5px solid var(--ink)",
                    color: "var(--ink)",
                    fontFamily: "var(--font-mono)",
                  }}
                />
                <Hint>
                  Leave blank to let me clone fresh. Fill in if you already
                  have this project checked out and want to use that copy —
                  I&rsquo;ll register the path as-is without cloning anything.
                </Hint>
              </div>
            </details>
            <Btn type="submit" disabled={pending || !slug.trim()} icon="⬇">
              {pending
                ? "Working…"
                : existingPath.trim()
                  ? "Register existing clone"
                  : "Clone + register"}
            </Btn>
          </form>
        )}
      </div>

      {/* Project list */}
      {registry.projects.length === 0 ? (
        <div
          className="rounded-xl py-12 px-6 text-center italic"
          style={{
            background: "var(--cream-soft)",
            border: "2px dashed var(--ink)",
            color: "var(--ink-soft)",
          }}
        >
          No projects yet. Add one above to get started.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {registry.projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              isActive={p.id === activeId}
              pending={pending}
              onSwitch={() => handleSwitch(p.id)}
              onRemove={() => handleRemove(p)}
              onRefresh={() => handleRefresh(p)}
            />
          ))}
          {activeId && (
            <button
              type="button"
              onClick={() => handleSwitch(null as unknown as string)}
              disabled={pending}
              className="text-[11px] underline mt-2 self-start"
              style={{
                color: "var(--ink-soft)",
                fontFamily: "var(--font-mono)",
                background: "transparent",
              }}
              title="Stop using any managed project. Scanner falls back to OHPEN_CWD / cwd."
            >
              Clear active project (fall back to launch directory)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  isActive,
  pending,
  onSwitch,
  onRemove,
  onRefresh,
}: {
  project: ManagedProject;
  isActive: boolean;
  pending: boolean;
  onSwitch: () => void;
  onRemove: () => void;
  onRefresh: () => void;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: isActive ? "var(--parmesan)" : "var(--cream-soft)",
        border: `2px solid var(--ink)`,
        boxShadow: isActive ? "4px 4px 0 var(--basil)" : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {isActive && (
              <span
                className="text-[9px] font-bold tracking-[0.15em] uppercase px-2 py-[2px] rounded"
                style={{
                  background: "var(--basil)",
                  color: "var(--cream)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                ● ACTIVE
              </span>
            )}
            <span
              className="font-black italic text-[20px] text-ink"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {project.id}
            </span>
          </div>
          <div
            className="text-[11.5px] text-ink-soft break-all"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {project.localPath}
          </div>
          <div
            className="text-[11px] text-ink-soft mt-1"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            added {formatDate(project.addedAt)} ·{" "}
            {project.lastFetchedAt
              ? `refreshed ${formatDate(project.lastFetchedAt)}`
              : "never refreshed"}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {!isActive && (
            <button
              type="button"
              onClick={onSwitch}
              disabled={pending}
              className="px-3 py-1.5 text-[12px] font-semibold rounded-md disabled:opacity-50"
              style={{
                background: "var(--sauce)",
                color: "var(--cream)",
                border: "1.5px solid var(--ink)",
                fontFamily: "var(--font-mono)",
              }}
            >
              Make active
            </button>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={pending}
            className="px-3 py-1.5 text-[12px] font-semibold rounded-md disabled:opacity-50"
            style={{
              background: "var(--cream)",
              color: "var(--ink)",
              border: "1.5px solid var(--ink)",
              fontFamily: "var(--font-mono)",
            }}
            title="git pull the clone to pick up the latest commits on main"
          >
            ↻ Refresh
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={pending}
            className="px-3 py-1.5 text-[12px] font-semibold rounded-md disabled:opacity-50"
            style={{
              background: "transparent",
              color: "var(--sauce-dark)",
              border: "1.5px solid var(--sauce)",
              fontFamily: "var(--font-mono)",
            }}
          >
            🗑 Remove
          </button>
        </div>
      </div>
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
    <div className="mt-1.5 text-[11.5px] text-ink-soft leading-snug">
      {children}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
