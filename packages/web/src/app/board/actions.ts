"use server";

import { revalidatePath } from "next/cache";
import type { IssueStatus } from "@oh-pen-testing/shared";
import { getIssue, updateIssue } from "../../lib/repo";

export async function changeIssueStatusAction(
  id: string,
  status: IssueStatus,
): Promise<void> {
  const issue = await getIssue(id);
  if (!issue) throw new Error(`Issue ${id} not found`);
  issue.status = status;
  await updateIssue(issue);
  revalidatePath("/board");
  revalidatePath(`/issue/${id}`);
}
