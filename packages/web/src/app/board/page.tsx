import { listIssues } from "../../lib/repo";
import { BoardClient } from "./board-client";
import { BOARD_COLUMNS } from "./columns";
import { PageHeader } from "../../components/trattoria/page-header";
import { Btn } from "../../components/trattoria/button";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const issues = await listIssues();
  const grouped = BOARD_COLUMNS.map((col) => ({
    ...col,
    issues: issues.filter((i) => i.status === col.status),
  }));
  return (
    <div>
      <PageHeader
        kicker="02 — La Lavagna"
        title={<>Board</>}
        sub={`${issues.length} issue${
          issues.length === 1 ? "" : "s"
        } across ${grouped.length} stations. Click any card to inspect or promote.`}
        actions={<Btn variant="ghost" icon="🔽">Filter</Btn>}
      />
      <BoardClient columns={grouped} />
    </div>
  );
}
