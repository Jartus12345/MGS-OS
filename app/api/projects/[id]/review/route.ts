import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getProject, saveProject } from "@/lib/store";
import type { ReviewAction, ReviewCriterion, ReviewStatus } from "@/lib/types";
import { REVIEW_CRITERIA } from "@/lib/types";

const STATUS_BY_ACTION: Record<ReviewAction, ReviewStatus> = {
  approve_internally: "internally_approved",
  edit: "changes_requested",
  return_to_analysis: "changes_requested",
  request_additional_evidence: "changes_requested",
  request_client_clarification: "changes_requested",
  flag_judgement_required: "changes_requested",
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const body = await req.json();
  const action = body.action as ReviewAction;
  if (!(action in STATUS_BY_ACTION)) {
    return NextResponse.json({ error: `Invalid review action: ${action}` }, { status: 400 });
  }

  const checklist: Partial<Record<ReviewCriterion, boolean>> = {};
  for (const c of REVIEW_CRITERIA) {
    if (typeof body.checklist?.[c] === "boolean") checklist[c] = body.checklist[c];
  }

  project.review.decisions.push({
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    action,
    notes: typeof body.notes === "string" ? body.notes : undefined,
    checklist,
  });
  project.review.status = STATUS_BY_ACTION[action];

  await saveProject(project);
  return NextResponse.json({ project });
}
