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
          <Field
            label="Playbooks run"
            value={
              scan.playbooks_total
                ? `${scan.playbooks_run} of ${scan.playbooks_total}`
                : scan.playbooks_run.toString()
            }
          />
          {scan.playbooks_filtered_by_language !== undefined &&
            scan.playbooks_filtered_by_language > 0 && (
              <Field
                label="Not applicable"
                value={`${scan.playbooks_filtered_by_language} (language filter — playbooks for stacks your project doesn't use, e.g. Python, Docker, Terraform)`}
              />
            )}
          {scan.playbooks_disabled !== undefined &&
            scan.playbooks_disabled > 0 && (
              <Field
                label="Disabled"
                value={`${scan.playbooks_disabled} (you opted these out in Settings → Tests)`}
              />
            )}
          {scan.playbooks_skipped > 0 && (
            <Field
              label="Skipped during run"
              value={`${scan.playbooks_skipped} (started but bailed — bad rules, errored, or no candidates to AI-confirm)`}
            />
          )}
          <Field label="Issues found" value={scan.issues_found.toString()} />
          <Field label="AI calls" value={scan.ai_calls.toString()} />
          <Field label="Tokens spent" value={scan.tokens_spent.toString()} />
          <Field
            label="Cost (USD)"
            value={scan.cost_usd ? `$${scan.cost_usd.toFixed(2)}` : "—"}
            last
          />
        </dl>
        {scan.playbooks_total &&
          scan.playbooks_total > scan.playbooks_run && (
            <div
              className="mt-4 rounded-md p-3 text-[12.5px] leading-snug"
              style={{
                background: "var(--parmesan)",
                border: "1.5px solid var(--ink)",
              }}
            >
              <strong>About coverage:</strong> Oh Pen Testing ships with{" "}
              {scan.playbooks_total} playbooks, but each one declares which
              languages / stacks it applies to. The{" "}
              {scan.playbooks_total - scan.playbooks_run} that didn&rsquo;t
              run on this scan were filtered out at scan-time because their
              targets weren&rsquo;t present in your project (e.g. Python
              syntax patterns on a TypeScript-only codebase, Dockerfile
              checks when there&rsquo;s no Dockerfile). The{" "}
              {scan.playbooks_run} that ran cover everything relevant to
              your stack.
            </div>
          )}
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
