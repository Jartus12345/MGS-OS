import type { Project, StageId, StageRecord } from "../types";
import { getStageMeta } from "./stages";
import { runStagePrompt } from "../anthropic";
import { listReferenceCases } from "../store";
import {
  buildExtractPrompt,
  buildIndependentAnalysisPrompt,
  buildCrossAnalysisPrompt,
  buildStrategicFindingsPrompt,
  buildStrategicDirectionPrompt,
  buildStrategicPillarsPrompt,
  buildRoadmapPrompt,
  buildQualityAuditPrompt,
  buildMasterStrategyPrompt,
  buildExecutiveBrandDirectionPrompt,
} from "./prompts";

export class StageDependencyError extends Error {}

function assertDependenciesComplete(project: Project, stageId: StageId) {
  const meta = getStageMeta(stageId);
  for (const dep of meta.dependsOn) {
    if (project.stages[dep]?.status !== "complete") {
      throw new StageDependencyError(
        `Cannot run "${meta.name}" — dependency "${getStageMeta(dep).name}" has not completed.`
      );
    }
  }
}

/**
 * Executes one pipeline stage against the project's current state and
 * returns the updated stage record. Does not persist — caller saves.
 */
export async function runStage(project: Project, stageId: StageId): Promise<StageRecord> {
  assertDependenciesComplete(project, stageId);

  const startedAt = new Date().toISOString();

  try {
    if (stageId === "ingest") {
      if (project.sources.length === 0) {
        throw new Error("No sources have been uploaded yet.");
      }
      return {
        stageId,
        status: "complete",
        output: { sourceCount: project.sources.length },
        startedAt,
        completedAt: new Date().toISOString(),
      };
    }

    if (stageId === "human_review") {
      return {
        stageId,
        status: "complete",
        output: { status: "AWAITING MGS HUMAN REVIEW" },
        startedAt,
        completedAt: new Date().toISOString(),
      };
    }

    if (stageId === "extract") {
      const bySource: Record<string, unknown> = {};
      let usage = { input_tokens: 0, output_tokens: 0 };
      let model = "";
      for (const source of project.sources) {
        const { system, user } = buildExtractPrompt(source);
        const result = await runStagePrompt({ system, user, maxTokens: 8000 });
        bySource[source.id] = result.json;
        usage = {
          input_tokens: usage.input_tokens + result.usage.input_tokens,
          output_tokens: usage.output_tokens + result.usage.output_tokens,
        };
        model = result.model;
      }
      return {
        stageId,
        status: "complete",
        output: { bySource },
        model,
        usage,
        startedAt,
        completedAt: new Date().toISOString(),
      };
    }

    // All remaining LLM stages follow the same shape: build a prompt from
    // project state, call Claude once, store the parsed JSON output.
    const promptBuilders: Partial<
      Record<StageId, (p: Project) => { system: string; user: string }>
    > = {
      independent_analysis: buildIndependentAnalysisPrompt,
      cross_analysis: buildCrossAnalysisPrompt,
      strategic_findings: buildStrategicFindingsPrompt,
      strategic_direction: buildStrategicDirectionPrompt,
      strategic_pillars: buildStrategicPillarsPrompt,
      roadmap: buildRoadmapPrompt,
      master_strategy: buildMasterStrategyPrompt,
      executive_brand_direction: buildExecutiveBrandDirectionPrompt,
    };

    if (stageId === "quality_audit") {
      const referenceCases = await listReferenceCases(project.id);
      const referenceCaseSummaries = referenceCases
        .filter((p) => p.stages.master_strategy?.status === "complete")
        .map((p) => ({ clientName: p.clientName, output: p.stages.master_strategy?.output }));
      const { system, user } = buildQualityAuditPrompt(project, referenceCaseSummaries);
      const result = await runStagePrompt({ system, user, maxTokens: 16000 });
      return {
        stageId,
        status: "complete",
        output: result.json,
        rawResponse: result.rawText,
        model: result.model,
        usage: result.usage,
        startedAt,
        completedAt: new Date().toISOString(),
      };
    }

    const builder = promptBuilders[stageId];
    if (!builder) throw new Error(`No prompt builder registered for stage "${stageId}".`);

    const { system, user } = builder(project);
    const maxTokens =
      stageId === "master_strategy" || stageId === "executive_brand_direction" ? 64000 : 16000;
    const result = await runStagePrompt({ system, user, maxTokens });

    return {
      stageId,
      status: "complete",
      output: result.json,
      rawResponse: result.rawText,
      model: result.model,
      usage: result.usage,
      startedAt,
      completedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      stageId,
      status: "error",
      error: err instanceof Error ? err.message : String(err),
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }
}
