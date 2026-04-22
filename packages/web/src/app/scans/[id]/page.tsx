import Link from "next/link";
import { notFound } from "next/navigation";
import { getScan } from "../../../lib/repo";
import { PageHeader } from "../../../components/trattoria/page-header";

export const dynamic = "force-dynamic";

export default async function ScanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scan = await getScan(id);
  if (!scan) notFound();
  return (
    <div>
      <div className="mb-4">
        <Link
          href="/scans"
          className="text-sm underline text-ink-soft"
        >
          ← Back to scans
        </Link>
      </div>
      <PageHeader
        kicker="05 — Il Registro"
        title={scan.id}
        sub={`Status: ${scan.status} · Provider: ${scan.provider}`}
      />
      <div
        className="rounded-xl p-5"
        style={{
          background: "var(--cream-soft)",
          border: "2px solid var(--ink)",
        }}
      >
        <dl className="space-y-0 text-[13px]">
          <Field label="Started" value={scan.started_at} />
          <Field label="Ended" value={scan.ended_at ?? "—"} />
          <Field label="Provider" value={scan.provider} />
          <Field label="Playbooks run" value={scan.playbooks_run.toString()} />
          <Field
            label="Playbooks skipped"
            value={scan.playbooks_skipped.toString()}
          />
          <Field label="Issues found" value={scan.issues_found.toString()} />
          <Field label="AI calls" value={scan.ai_calls.toString()} />
          <Field label="Tokens spent" value={scan.tokens_spent.toString()} />
          <Field
            label="Cost (USD)"
            value={scan.cost_usd ? `$${scan.cost_usd.toFixed(2)}` : "—"}
            last
          />
        </dl>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className="grid gap-4 py-2.5"
      style={{
        gridTemplateColumns: "220px 1fr",
        borderBottom: last ? "none" : "1px dashed rgba(34,26,20,0.18)",
      }}
    >
      <dt
        className="text-[10px] font-bold tracking-[0.1em] uppercase text-ink-soft"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {label}
      </dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}
