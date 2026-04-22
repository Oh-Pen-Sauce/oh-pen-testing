import Link from "next/link";
import { listCatalog } from "../../../lib/playbooks";
import { safeLoadConfig } from "../../../lib/repo";
import { PageHeader } from "../../../components/trattoria/page-header";
import { TestsCatalogClient } from "./tests-client";

export const dynamic = "force-dynamic";

export default async function TestsSettingsPage() {
  const [catalog, config] = await Promise.all([
    listCatalog(),
    safeLoadConfig(),
  ]);
  const disabled = config?.scans.disabled_playbooks ?? [];

  return (
    <div>
      <PageHeader
        kicker="06 — La Cucina · Tests"
        title={<>Tests catalog</>}
        sub={
          <>
            Every playbook Oh Pen Testing runs. Toggle one off if you
            don&rsquo;t want it to fire on this project.{" "}
            <Link
              href="/settings"
              className="underline"
              style={{ color: "var(--sauce)" }}
            >
              Back to settings
            </Link>
          </>
        }
      />
      <TestsCatalogClient catalog={catalog} initiallyDisabled={disabled} />
    </div>
  );
}
