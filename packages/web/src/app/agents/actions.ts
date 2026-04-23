"use server";

import { revalidatePath } from "next/cache";
import {
  deleteAgentSkill,
  loadAgentProfile,
  revertAgentMemory,
  revertAgentPlaybooks,
  writeAgentMemoryOverride,
  writeAgentPlaybooksOverride,
  writeAgentSkill,
  type AgentId,
  type AgentProfile,
} from "@oh-pen-testing/shared";
import { resolveScanTargetPath } from "../../lib/ohpen-cwd";

/**
 * Server-side bridge between the /agents UI and the agents loader
 * in @oh-pen-testing/shared. Every write is scoped to the current
 * scan target (active managed project, else cwd) — overrides live
 * under `.ohpentesting/agents/<id>/` inside that project.
 */

export async function loadAgentAction(id: AgentId): Promise<AgentProfile> {
  const cwd = await resolveScanTargetPath();
  return await loadAgentProfile(cwd, id);
}

export async function saveAgentMemoryAction(
  id: AgentId,
  body: string,
): Promise<{ ok: boolean; detail: string }> {
  try {
    const cwd = await resolveScanTargetPath();
    await writeAgentMemoryOverride(cwd, id, body);
    revalidatePath(`/agents/${id}`);
    return {
      ok: true,
      detail: `Saved memory override to .ohpentesting/agents/${id}/memory.md.`,
    };
  } catch (err) {
    return { ok: false, detail: (err as Error).message };
  }
}

export async function revertAgentMemoryAction(
  id: AgentId,
): Promise<{ ok: boolean; detail: string }> {
  try {
    const cwd = await resolveScanTargetPath();
    await revertAgentMemory(cwd, id);
    revalidatePath(`/agents/${id}`);
    return { ok: true, detail: "Reverted to bundled memory." };
  } catch (err) {
    return { ok: false, detail: (err as Error).message };
  }
}

export async function saveAgentPlaybooksAction(
  id: AgentId,
  playbooks: string[],
): Promise<{ ok: boolean; detail: string }> {
  try {
    const cwd = await resolveScanTargetPath();
    await writeAgentPlaybooksOverride(cwd, id, playbooks);
    revalidatePath(`/agents/${id}`);
    return {
      ok: true,
      detail: `Saved ${playbooks.length} playbook assignment${playbooks.length === 1 ? "" : "s"}.`,
    };
  } catch (err) {
    return { ok: false, detail: (err as Error).message };
  }
}

export async function revertAgentPlaybooksAction(
  id: AgentId,
): Promise<{ ok: boolean; detail: string }> {
  try {
    const cwd = await resolveScanTargetPath();
    await revertAgentPlaybooks(cwd, id);
    revalidatePath(`/agents/${id}`);
    return { ok: true, detail: "Reverted playbook assignment to bundled default." };
  } catch (err) {
    return { ok: false, detail: (err as Error).message };
  }
}

export async function addAgentSkillAction(
  id: AgentId,
  skillId: string,
  body: string,
): Promise<{ ok: boolean; detail: string }> {
  try {
    const cwd = await resolveScanTargetPath();
    const written = await writeAgentSkill(cwd, id, skillId, body);
    revalidatePath(`/agents/${id}`);
    return {
      ok: true,
      detail: `Added custom skill ${written.id} to ${id}.`,
    };
  } catch (err) {
    return { ok: false, detail: (err as Error).message };
  }
}

export async function deleteAgentSkillAction(
  id: AgentId,
  skillId: string,
): Promise<{ ok: boolean; detail: string }> {
  try {
    const cwd = await resolveScanTargetPath();
    await deleteAgentSkill(cwd, id, skillId);
    revalidatePath(`/agents/${id}`);
    return { ok: true, detail: `Deleted skill ${skillId}.` };
  } catch (err) {
    return { ok: false, detail: (err as Error).message };
  }
}
