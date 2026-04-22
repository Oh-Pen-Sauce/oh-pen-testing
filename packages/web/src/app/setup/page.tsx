import Link from "next/link";
import { safeLoadConfig } from "../../lib/repo";
import { SetupWizard } from "./wizard";
import { SetupChat } from "./chat";
import { PageHeader } from "../../components/trattoria/page-header";
import { BtnLink } from "../../components/trattoria/button";

export const dynamic = "force-dynamic";

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ form?: string }>;
}) {
  const [config, params] = await Promise.all([
    safeLoadConfig(),
    searchParams,
  ]);
  const showForm = params.form === "1";

  if (showForm) {
    return (
      <div>
        <PageHeader
          kicker="07 — Il Benvenuto (form view)"
          title={<>Setup wizard</>}
          sub="Classic 6-step form — the chat with Marinara is also available."
          actions={
            <BtnLink href="/setup" variant="ghost" icon="🍅">
              Back to Marinara
            </BtnLink>
          }
        />
        <div className="max-w-2xl">
          <SetupWizard initial={config} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        kicker="07 — Il Benvenuto"
        title={<>Setup wizard</>}
        sub="A little back-and-forth with Marinara. Re-run any time — your answers persist to config.yml."
        actions={
          <Link
            href="/setup?form=1"
            className="text-[12px] underline self-end text-ink-soft"
          >
            Switch to form view →
          </Link>
        }
      />
      <SetupChat initial={config} />
    </div>
  );
}
