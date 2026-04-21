import { safeLoadConfig } from "../../lib/repo";
import { SetupWizard } from "./wizard";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const config = await safeLoadConfig();
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold mb-2">Setup wizard</h1>
      <p className="text-slate-600 mb-6">
        Walk through 5 steps to connect your AI, your repo, and your preferences.
      </p>
      <SetupWizard initial={config} />
    </div>
  );
}
