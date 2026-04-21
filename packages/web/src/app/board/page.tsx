import { listIssues } from "../../lib/repo";
import { BoardClient } from "./board-client";
import { BOARD_COLUMNS } from "./columns";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const issues = await listIssues();
  const grouped = BOARD_COLUMNS.map((col) => ({
    ...col,
    issues: issues.filter((i) => i.status === col.status),
  }));
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Board</h1>
      <p className="text-slate-600 mb-6">
        {issues.length} issue{issues.length === 1 ? "" : "s"} · click a card to
        change status or view details.
      </p>
      <BoardClient columns={grouped} />
    </div>
  );
}
