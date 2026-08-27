import type { StageId } from "../types";

// Per the System Correction & Recalibration v1.1: the pipeline operates
// through three connected layers plus the human gate. Layer 1 is the
// internal reasoning engine (evidence analysis) — useful, but never the
// principal client output. Layer 2 is the Master Client Brand Direction &
// Strategy built FROM Layer 1. Layer 3 is its senior-leadership expression.
// All three represent the same reasoning at different depths.
export type StageLayer = 1 | 2 | 3 | "gate";

export const LAYER_LABEL: Record<StageLayer, string> = {
  1: "Layer 1 — Internal Evidence & Analysis Dossier",
  2: "Layer 2 — Master Client Brand Direction & Strategy",
  3: "Layer 3 — Executive Brand Direction Summary",
  gate: "MGS Human Review Gate",
};

export interface StageMeta {
  id: StageId;
  name: string;
  layer: StageLayer;
  // The canonical MGS AI Analysis Pipeline v1.0 steps this app-stage
  // executes. Several canonical steps are batched into one LLM call for
  // practicality; the sequence and discipline (independent analysis before
  // any reconciliation, findings before direction, direction before
  // pillars, audits before writing, writing before assembly, assembly
  // before review) is never reordered.
  canonicalSteps: string[];
  description: string;
  requiresLLM: boolean;
  dependsOn: StageId[];
}

export const STAGES: StageMeta[] = [
  {
    id: "ingest",
    name: "Ingest",
    layer: 1,
    canonicalSteps: ["1. INGEST"],
    description: "Read all uploaded evidence. No interpretation, no strategy.",
    requiresLLM: false,
    dependsOn: [],
  },
  {
    id: "extract",
    name: "Extract & Classify Evidence",
    layer: 1,
    canonicalSteps: ["2. EXTRACT", "3. CLASSIFY"],
    description:
      "Extract important evidence separately from each source, retaining source attribution, and classify each item as Fact / Leadership Intent / Internal Perception / External Observation.",
    requiresLLM: true,
    dependsOn: ["ingest"],
  },
  {
    id: "independent_analysis",
    name: "Independent Source Analysis",
    layer: 1,
    canonicalSteps: ["4. INDEPENDENT ANALYSIS"],
    description:
      "Analyse Company Context, Leadership, Employees and External evidence independently. No reconciliation, no strategy, no positioning at this stage.",
    requiresLLM: true,
    dependsOn: ["extract"],
  },
  {
    id: "cross_analysis",
    name: "Cross-Analysis",
    layer: 1,
    canonicalSteps: [
      "5. THEME EXTRACTION",
      "6. CROSS-ANALYSIS (agreements / contradictions / perception gaps / hidden strengths / unsupported ambitions / underused evidence)",
      "7. CURRENT vs DESIRED ANALYSIS",
      "8. PRIORITISE (Critical / Important / Supporting / Not Strategic)",
    ],
    description:
      "Compare the independent analyses against one another to surface themes, agreements, contradictions, perception gaps, hidden strengths, unsupported ambitions and underused evidence.",
    requiresLLM: true,
    dependsOn: ["independent_analysis"],
  },
  {
    id: "strategic_findings",
    name: "Strategic Diagnosis",
    layer: 2,
    canonicalSteps: [
      "9. STRATEGIC FINDINGS",
      "10. CENTRAL DIAGNOSIS",
      "11. PERCEPTION MOVEMENT (FROM → TO)",
    ],
    description:
      "Identify the smallest number of major strategic findings (approx. 3–6) required to explain the situation, then the central diagnosis and perception movement.",
    requiresLLM: true,
    dependsOn: ["cross_analysis"],
  },
  {
    id: "strategic_direction",
    name: "Strategic Direction",
    layer: 2,
    canonicalSteps: [
      "12. STRATEGIC DIRECTION (North Star / Strategic Priorities / 12-Month Perception Goal / Build-Protect-Reduce)",
    ],
    description: "Develop the North Star, strategic priorities, 12-month perception goal and Build/Protect/Reduce.",
    requiresLLM: true,
    dependsOn: ["strategic_findings"],
  },
  {
    id: "strategic_pillars",
    name: "Strategic Pillars",
    layer: 2,
    canonicalSteps: ["13. STRATEGIC PILLARS"],
    description: "Develop strategic pillars only where the evidence supports them.",
    requiresLLM: true,
    dependsOn: ["strategic_direction"],
  },
  {
    id: "roadmap",
    name: "12-Month Roadmap",
    layer: 2,
    canonicalSteps: ["14. ROADMAP (Align / Execute / Improve)"],
    description: "Translate the strategy into Align, Execute and Improve.",
    requiresLLM: true,
    dependsOn: ["strategic_pillars"],
  },
  {
    id: "quality_audit",
    name: "Quality Control Audits",
    layer: 1,
    canonicalSteps: [
      "15. EVIDENCE AUDIT",
      "16. CONTRADICTION AUDIT",
      "17. GENERICNESS AUDIT",
      "18. REFERENCE CONTAMINATION AUDIT",
    ],
    description:
      "Audit every material claim against evidence, confirm contradictions have not silently disappeared, check for generic conclusions, and check for contamination from any reference case (e.g. PDMS).",
    requiresLLM: true,
    dependsOn: ["roadmap"],
  },
  {
    id: "master_strategy",
    name: "Master Client Strategy",
    layer: 2,
    canonicalSteps: ["19. WRITING PASS", "20. MASTER STRATEGY"],
    description:
      "Apply the MGS Writing Standard and assemble the full Master Client Strategy document (Output A).",
    requiresLLM: true,
    dependsOn: ["quality_audit"],
  },
  {
    id: "executive_brand_direction",
    name: "Executive Brand Direction",
    layer: 3,
    canonicalSteps: ["21. EXECUTIVE BRAND DIRECTION"],
    description:
      "Distil the Master Strategy into the senior-leadership Executive Brand Direction (Output B). Generated only after the Master Strategy exists.",
    requiresLLM: true,
    dependsOn: ["master_strategy"],
  },
  {
    id: "human_review",
    name: "MGS Human Review Gate",
    layer: "gate",
    canonicalSteps: ["22. HUMAN REVIEW"],
    description:
      "Nothing is final until MGS reviews it. Status is set to AWAITING MGS HUMAN REVIEW.",
    requiresLLM: false,
    dependsOn: ["executive_brand_direction"],
  },
];

export const STAGE_ORDER: StageId[] = STAGES.map((s) => s.id);

export function getStageMeta(id: StageId): StageMeta {
  const meta = STAGES.find((s) => s.id === id);
  if (!meta) throw new Error(`Unknown stage: ${id}`);
  return meta;
}

export function nextStage(completed: StageId[]): StageMeta | null {
  for (const meta of STAGES) {
    if (completed.includes(meta.id)) continue;
    const depsOk = meta.dependsOn.every((d) => completed.includes(d));
    if (depsOk) return meta;
  }
  return null;
}
