import Link from "next/link";
import { listScans } from "../../lib/repo";

export const dynamic = "force-dynamic";

export default async function ScansPage() {
  const scans = await listScans();
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Scans</h1>
      <p className="text-slate-600 mb-6">{scans.length} scan run(s) on record.</p>
      {scans.length === 0 ? (
        <p className="text-sm text-slate-500">
          No scans yet. Run <code>oh-pen-testing scan</code> from the terminal.
        </p>
      ) : (
        <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Started</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Playbooks</th>
              <th className="px-3 py-2">Issues</th>
              <th className="px-3 py-2">Provider</th>
            </tr>
          </thead>
          <tbody>
            {scans.map((s) => (
              <tr
                key={s.id}
                className="border-t border-slate-200 hover:bg-slate-50"
              >
                <td className="px-3 py-2 font-mono">
                  <Link href={`/scans/${s.id}`} className="hover:underline">
                    {s.id}
                  </Link>
                </td>
                <td className="px-3 py-2 text-slate-600">{s.started_at}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={s.status} />
                </td>
                <td className="px-3 py-2">{s.playbooks_run}</td>
                <td className="px-3 py-2">{s.issues_found}</td>
                <td className="px-3 py-2 text-slate-600">{s.provider}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    running: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    checkpointed: "bg-amber-100 text-amber-900",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded ${map[status] ?? "bg-slate-100 text-slate-700"}`}
    >
      {status}
    </span>
  );
}
