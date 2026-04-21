import Link from "next/link";
import { notFound } from "next/navigation";
import { getScan } from "../../../lib/repo";

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
        <Link href="/scans" className="text-sm text-slate-500 hover:underline">
          ← Back to scans
        </Link>
      </div>
      <h1 className="text-3xl font-bold mb-2">{scan.id}</h1>
      <p className="text-slate-600 mb-6">Status: {scan.status}</p>
      <dl className="space-y-2 text-sm">
        <Field label="Started" value={scan.started_at} />
        <Field label="Ended" value={scan.ended_at ?? "—"} />
        <Field label="Provider" value={scan.provider} />
        <Field label="Playbooks run" value={scan.playbooks_run.toString()} />
        <Field label="Playbooks skipped" value={scan.playbooks_skipped.toString()} />
        <Field label="Issues found" value={scan.issues_found.toString()} />
        <Field label="AI calls" value={scan.ai_calls.toString()} />
        <Field label="Tokens spent" value={scan.tokens_spent.toString()} />
        <Field
          label="Cost (USD)"
          value={scan.cost_usd ? `$${scan.cost_usd.toFixed(2)}` : "—"}
        />
      </dl>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[200px_1fr] gap-4 border-b border-slate-100 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}
