import { loadProjectRegistry } from "@oh-pen-testing/shared";
import { PageHeader } from "../../components/trattoria/page-header";
import { ProjectsClient } from "./projects-client";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const registry = await loadProjectRegistry();
  return (
    <div>
      <PageHeader
        kicker="08 — I Cantieri"
        title={<>Projects</>}
        sub={
          <>
            Manage the GitHub repos Oh Pen Testing knows about. Adding
            a project clones it locally under{" "}
            <code
              className="px-1.5 py-0.5 rounded"
              style={{ background: "var(--parmesan)" }}
            >
              ~/.ohpentesting/projects/
            </code>{" "}
            using your GitHub PAT. One project is <strong>active</strong> at
            a time — that&rsquo;s what scans read from.
          </>
        }
      />
      <ProjectsClient initialRegistry={registry} />
    </div>
  );
}
