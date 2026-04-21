import { safeLoadConfig } from "../../lib/repo";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const config = await safeLoadConfig();
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Settings</h1>
      <p className="text-slate-600 mb-6">
        Edits persist to <code className="text-xs">.ohpentesting/config.yml</code>.
      </p>
      {config ? (
        <SettingsForm initial={config} />
      ) : (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          No config found. Run the setup wizard first.
        </div>
      )}
    </div>
  );
}
