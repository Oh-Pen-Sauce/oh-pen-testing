import type { IssueStatus } from "@oh-pen-testing/shared";

export const BOARD_COLUMNS: Array<{ status: IssueStatus; label: string }> = [
  { status: "backlog", label: "Backlog" },
  { status: "ready", label: "Ready" },
  { status: "in_progress", label: "In Progress" },
  { status: "in_review", label: "In Review" },
  { status: "done", label: "Done" },
  { status: "wont_fix", label: "Won't Fix" },
];
