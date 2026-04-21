"use server";

import { revalidatePath } from "next/cache";
import {
  loadConfig,
  ConfigSchema,
  writeConfig,
  type AutonomyMode,
  type ProviderId,
} from "@oh-pen-testing/shared";
import { getOhpenCwd } from "../../lib/ohpen-cwd";

export interface SettingsPatch {
  autonomy: AutonomyMode;
  parallelism: number;
  provider: ProviderId;
  model: string;
  budgetUsd: number;
}

export async function saveSettingsAction(patch: SettingsPatch): Promise<void> {
  const cwd = getOhpenCwd();
  const current = await loadConfig(cwd);
  current.agents.autonomy = patch.autonomy;
  current.agents.parallelism = patch.parallelism;
  current.ai.primary_provider = patch.provider;
  current.ai.model = patch.model;
  current.ai.rate_limit.budget_usd = patch.budgetUsd;
  const validated = ConfigSchema.parse(current);
  await writeConfig(cwd, validated);
  revalidatePath("/settings");
  revalidatePath("/");
}
