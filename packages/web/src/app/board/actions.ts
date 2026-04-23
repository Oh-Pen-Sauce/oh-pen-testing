"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import type { IssueStatus } from "@oh-pen-testing/shared";
import { ohpenPaths } from "@oh-pen-testing/shared";
import { getIssue, updateIssue } from "../../lib/repo";
import { resolveScanTargetPath } from "../../lib/ohpen-cwd";

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

/**
 * Delete an issue from the board. Removes the JSON file at
 * `.ohpentesting/issues/<id>.json` on disk. No soft-delete, no
 * trash — the file is gone. Revalidates the board so the card
 * disappears from the UI.
 *
 * The primary use case is clearing false positives during beta
 * testing, where the dedup guards haven't caught a pattern yet and
 * the user doesn't want the noise. Also useful after re-running a
 * scan and wanting to start from a clean board.
 */
export async function deleteIssueAction(id: string): Promise<void> {
  if (!/^ISSUE-\d+$/.test(id)) {
    throw new Error(`Invalid issue id: ${id}`);
  }
  const cwd = await resolveScanTargetPath();
  const { issues: issuesDir } = ohpenPaths(cwd);
  const filePath = path.join(issuesDir, `${id}.json`);
  try {
    await fs.unlink(filePath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      // Already gone — treat as success so the UI can just remove
      // the stale card without surfacing an error.
      revalidatePath("/board");
      return;
    }
    throw err;
  }
  revalidatePath("/board");
  revalidatePath("/scans");
  revalidatePath("/");
}

/**
 * Bulk-clear every issue. Useful during beta testing when the user
 * wants to re-run a scan from scratch. Returns the number deleted so
 * the UI can show "cleared N issues".
 */
export async function deleteAllIssuesAction(): Promise<{ deleted: number }> {
  const cwd = await resolveScanTargetPath();
  const { issues: issuesDir } = ohpenPaths(cwd);
  let deleted = 0;
  try {
    const files = await fs.readdir(issuesDir);
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        await fs.unlink(path.join(issuesDir, f));
        deleted += 1;
      } catch {
        /* skip */
      }
    }
  } catch {
    /* issuesDir might not exist — deleted stays 0 */
  }
  revalidatePath("/board");
  revalidatePath("/scans");
  revalidatePath("/");
  return { deleted };
}
