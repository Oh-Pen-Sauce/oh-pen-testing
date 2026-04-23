import Link from "next/link";
import { safeLoadConfig } from "../../lib/repo";
import { SettingsForm } from "./settings-form";
import { ResetDangerZone } from "./reset-danger-zone";
import { PageHeader } from "../../components/trattoria/page-header";
import { BtnLink } from "../../components/trattoria/button";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const config = await safeLoadConfig();
  return (
    <div>
      <PageHeader
        kicker="06 — La Cucina (backstage)"
        title={<>Settings</>}
        sub={
          <>
            Edits persist to{" "}
            <code
              className="px-1.5 py-0.5 rounded"
              style={{ background: "var(--parmesan)" }}
            >
              .ohpentesting/config.yml
            </code>
            .
          </>
        }
        actions={
          <BtnLink href="/settings/tests" variant="ghost" icon="📖">
            Tests catalog
          </BtnLink>
        }
      />
      {config ? (
        <SettingsForm initial={config} />
      ) : (
        <div
          className="rounded-xl px-5 py-4 text-[14px]"
          style={{
            background: "var(--parmesan)",
            border: "2px solid var(--ink)",
          }}
        >
          <strong>No config found.</strong>{" "}
          <Link
            href="/setup"
            className="underline"
            style={{ color: "var(--sauce)" }}
          >
            Run the setup wizard
          </Link>{" "}
          first.
        </div>
      )}
      {/* Beta-only reset affordance — removed before v1.0 public release.
          Lets testers wipe state so they can re-run the whole setup flow
          without hand-editing config files or deleting directories. */}
      <ResetDangerZone />
    </div>
  );
}
