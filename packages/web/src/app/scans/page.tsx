import Link from "next/link";
import { listScans } from "../../lib/repo";
import { PageHeader } from "../../components/trattoria/page-header";
import { Btn } from "../../components/trattoria/button";

export const dynamic = "force-dynamic";

export default async function ScansPage() {
  const scans = await listScans();
  return (
    <div>
      <PageHeader
        kicker="05 — Il Registro"
        title={<>Scans</>}
        sub={`${scans.length} scan run${
          scans.length === 1 ? "" : "s"
        } on record.`}
        actions={
          <>
            <Btn variant="ghost" icon="⟳">
              Refresh
            </Btn>
            <Btn icon="🔎">Run scan</Btn>
          </>
        }
      />

      {scans.length === 0 ? (
        <EmptyState />
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: "var(--cream-soft)",
            border: "2px solid var(--ink)",
          }}
        >
          <div
            className="grid px-4 py-3 text-[10px] font-bold tracking-[0.15em] uppercase"
            style={{
              background: "var(--ink)",
              color: "var(--cream)",
              fontFamily: "var(--font-mono)",
              gridTemplateColumns: "1.4fr 1.2fr 0.8fr 0.8fr 0.8fr 1fr",
            }}
          >
            <div>Scan ID</div>
            <div>Started</div>
            <div>Status</div>
            <div>Playbooks</div>
            <div>Issues</div>
            <div>Provider</div>
          </div>
          {scans.map((s, i) => (
            <Link
              key={s.id}
              href={`/scans/${s.id}`}
              className="grid px-4 py-3.5 text-[13px] hover:bg-parmesan/40 transition-colors"
              style={{
                borderBottom:
                  i < scans.length - 1
                    ? "1px dashed rgba(34,26,20,0.2)"
                    : "none",
                alignItems: "center",
                gridTemplateColumns: "1.4fr 1.2fr 0.8fr 0.8fr 0.8fr 1fr",
              }}
            >
              <code
                className="font-bold text-ink"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {s.id}
              </code>
              <span className="text-ink-soft text-[12px]">
                {formatDateTime(s.started_at)}
              </span>
              <span>
                <StatusBadge status={s.status} />
              </span>
              <span style={{ fontFamily: "var(--font-mono)" }}>
                {s.playbooks_run}
                <span className="text-ink-soft">
                  {" "}
                  /{s.playbooks_skipped}
                </span>
              </span>
              <span
                className="font-bold"
                style={{
                  fontFamily: "var(--font-mono)",
                  color:
                    s.issues_found > 40
                      ? "var(--sauce-dark)"
                      : "var(--ink)",
                }}
              >
                {s.issues_found}
              </span>
              <span
                className="text-ink-soft text-[12px]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {s.provider}
              </span>
            </Link>
          ))}
        </div>
      )}

      <div
        className="mt-6 px-4 py-3.5 rounded-[10px] flex items-center gap-3.5"
        style={{
          background: "var(--parmesan)",
          border: "2px solid var(--ink)",
        }}
      >
        <span className="text-[26px]" aria-hidden>
          🍝
        </span>
        <div className="flex-1 text-[13px]">
          <strong>Tip:</strong> you can run scans from the terminal too —{" "}
          <code
            className="px-1.5 py-0.5 rounded"
            style={{ background: "var(--cream)" }}
          >
            opt scan
          </code>
          {" · "}
          <code
            className="px-1.5 py-0.5 rounded"
            style={{ background: "var(--cream)" }}
          >
            opt scan-dynamic --url https://staging.myapp.local
          </code>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="rounded-xl py-12 px-6 text-center"
      style={{
        background: "var(--cream-soft)",
        border: "2.5px dashed var(--ink)",
      }}
    >
      <div className="text-[32px] mb-2" aria-hidden>
        🍅
      </div>
      <div
        className="font-black italic text-[22px] text-ink mb-2"
        style={{ fontFamily: "var(--font-display)" }}
      >
        No scans yet.
      </div>
      <p className="text-[14px] text-ink-soft max-w-[480px] mx-auto">
        Run{" "}
        <code
          className="px-1.5 py-0.5 rounded"
          style={{ background: "var(--parmesan)" }}
        >
          opt scan
        </code>{" "}
        from the terminal — or let Marinara do it for you.
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    running: { bg: "#D1E7D3", fg: "#2B5A27", label: "SIMMERING" },
    completed: { bg: "#EDEAE3", fg: "#525252", label: "DONE" },
    failed: { bg: "#FBE4E0", fg: "#8F1E10", label: "BURNT" },
    checkpointed: { bg: "#FBF4D9", fg: "#8C6A05", label: "PAUSED" },
  };
  const c =
    map[status] ?? { bg: "#EDEAE3", fg: "#525252", label: status.toUpperCase() };
  return (
    <span
      className="text-[10px] font-bold tracking-[0.1em] px-2 py-[3px] rounded"
      style={{
        background: c.bg,
        color: c.fg,
        border: "1px solid var(--ink)",
        fontFamily: "var(--font-mono)",
      }}
    >
      {c.label}
    </span>
  );
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) {
      return `Today · ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    }
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
