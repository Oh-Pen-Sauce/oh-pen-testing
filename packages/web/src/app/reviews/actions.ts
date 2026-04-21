"use server";

import { revalidatePath } from "next/cache";
import { approveGatedIssue } from "@oh-pen-testing/core";
import { getIssue, updateIssue } from "../../lib/repo";
import { getOhpenCwd } from "../../lib/ohpen-cwd";

export async function approveAction(issueId: string): Promise<void> {
  await approveGatedIssue(getOhpenCwd(), issueId, "web-reviewer");
  revalidatePath("/reviews");
  revalidatePath("/board");
  revalidatePath(`/issue/${issueId}`);
}

export async function rejectAction(issueId: string): Promise<void> {
  const issue = await getIssue(issueId);
  if (!issue) throw new Error(`Issue ${issueId} not found`);
  issue.status = "wont_fix";
  issue.comments.push({
    author: "web-reviewer",
    text: "Rejected for automated remediation — marking as won't fix.",
    at: new Date().toISOString(),
  });
  await updateIssue(issue);
  revalidatePath("/reviews");
  revalidatePath("/board");
  revalidatePath(`/issue/${issueId}`);
}
