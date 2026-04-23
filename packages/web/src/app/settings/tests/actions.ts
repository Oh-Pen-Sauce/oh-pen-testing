"use server";

import { revalidatePath } from "next/cache";
import {
  ConfigSchema,
  loadConfig,
  writeConfig,
} from "@oh-pen-testing/shared";
import { resolveScanTargetPath } from "../../../lib/ohpen-cwd";

/**
 * Save the set of disabled playbook ids. The Tests catalog UI calls
 * this with the full list on each toggle — simpler than a
 * per-playbook add/remove action and the array is small (~30 entries
 * at the top end).
 */
export async function saveDisabledPlaybooksAction(
  disabled: string[],
): Promise<void> {
  const cwd = await resolveScanTargetPath();
  const current = await loadConfig(cwd);
  current.scans.disabled_playbooks = Array.from(new Set(disabled)).sort();
  const validated = ConfigSchema.parse(current);
  await writeConfig(cwd, validated);
  revalidatePath("/settings/tests");
  revalidatePath("/scans");
}
