import { NextRequest, NextResponse } from "next/server";
import { getProject, saveProject } from "@/lib/store";
import { runStage } from "@/lib/pipeline/run";
import type { StageId } from "@/lib/types";
import { STAGE_ORDER } from "@/lib/pipeline/stages";

// Master Strategy / Executive Brand Direction generations can run long.
export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; stageId: string }> }
) {
  const { id, stageId } = await params;

  if (!STAGE_ORDER.includes(stageId as StageId)) {
    return NextResponse.json({ error: `Unknown stage: ${stageId}` }, { status: 400 });
  }

  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  project.stages[stageId as StageId] = { stageId: stageId as StageId, status: "running" };
  await saveProject(project);

  const record = await runStage(project, stageId as StageId);
  project.stages[stageId as StageId] = record;

  if (stageId === "human_review" && record.status === "complete") {
    project.review.status = "awaiting_review";
  }

  await saveProject(project);

  return NextResponse.json({ project, stage: record });
}
