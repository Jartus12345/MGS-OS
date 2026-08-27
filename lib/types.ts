// Core data model for the MGS Client Strategy System.
// Mirrors the eight locked MGS methodology components — see lib/methodology/.

export type SourceType =
  | "company_context"
  | "leadership_discovery"
  | "employee_survey"
  | "digital_credibility_scorecard"
  | "additional";

// Evidence type per MGS Evidence & Claim Rules v1.0
export type EvidenceRole =
  | "fact"
  | "leadership_intent"
  | "internal_perception"
  | "external_observation";

export interface Source {
  id: string;
  type: SourceType;
  label: string;
  fileName?: string;
  rawText: string;
  // Required for "additional" evidence per Part F — who produced it, why, what it can establish.
  producedBy?: string;
  purpose?: string;
  legitimateEvidenceType?: EvidenceRole | "unclassified";
  notes?: string;
  uploadedAt: string;
}

export type StageId =
  | "ingest"
  | "extract"
  | "independent_analysis"
  | "cross_analysis"
  | "strategic_findings"
  | "strategic_direction"
  | "strategic_pillars"
  | "roadmap"
  | "quality_audit"
  | "master_strategy"
  | "executive_brand_direction"
  | "human_review";

export type StageStatus = "pending" | "running" | "complete" | "error";

export interface StageRecord {
  stageId: StageId;
  status: StageStatus;
  output?: unknown;
  rawResponse?: string;
  model?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  usage?: { input_tokens: number; output_tokens: number };
}

export type ReviewStatus =
  | "not_started"
  | "awaiting_review"
  | "changes_requested"
  | "internally_approved"
  | "client_approved";

export type ReviewAction =
  | "approve_internally"
  | "edit"
  | "return_to_analysis"
  | "request_additional_evidence"
  | "request_client_clarification"
  | "flag_judgement_required";

export const REVIEW_CRITERIA = [
  "evidence",
  "reasoning",
  "contradictions",
  "specificity",
  "commercial_relevance",
  "humanity",
  "restraint",
  "usefulness",
  "client_sensitivity",
] as const;
export type ReviewCriterion = (typeof REVIEW_CRITERIA)[number];

export interface ReviewDecision {
  id: string;
  timestamp: string;
  action: ReviewAction;
  notes?: string;
  checklist: Partial<Record<ReviewCriterion, boolean>>;
}

export interface ReviewState {
  status: ReviewStatus;
  decisions: ReviewDecision[];
}

export interface Project {
  id: string;
  clientName: string;
  createdAt: string;
  updatedAt: string;
  // PDMS is the reference case — see Part I/J/K. Marking a project as a
  // reference case makes its content available for the Reference
  // Contamination Audit on OTHER projects, and triggers the PDMS
  // validation posture (learn the method, not the answer) for itself.
  isReferenceCase: boolean;
  sources: Source[];
  stages: Partial<Record<StageId, StageRecord>>;
  review: ReviewState;
}

export interface ProjectSummary {
  id: string;
  clientName: string;
  createdAt: string;
  updatedAt: string;
  isReferenceCase: boolean;
  reviewStatus: ReviewStatus;
  furthestStage: StageId | null;
}
