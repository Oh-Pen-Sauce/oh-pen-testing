import Link from "next/link";
import { safeLoadConfig } from "../../lib/repo";
import { SettingsForm } from "./settings-form";
import { PageHeader } from "../../components/trattoria/page-header";

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
    </div>
  );
}
