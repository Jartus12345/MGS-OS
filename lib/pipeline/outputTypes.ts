// Shape of each stage's parsed JSON output. Kept loose (optional fields)
// since the model's JSON is validated only by parsing, not a strict schema.

export interface IndependentAnalysisOutput {
  companyContextAnalysis?: { summary: string; keyPoints: string[]; evidenceGaps: string[] };
  leadershipAnalysis?: {
    summary: string;
    commercialObjectives: string[];
    desiredPerception: string[];
    priorityAudiences: string[];
    keyPoints: string[];
    evidenceGaps: string[];
  };
  employeeAnalysis?: {
    summary: string;
    recurringStrengths: string[];
    recurringTensions: string[];
    keyPoints: string[];
    evidenceGaps: string[];
  };
  externalAnalysis?: { summary: string; credibilityObservations: string[]; keyPoints: string[]; evidenceGaps: string[] };
}

export interface CrossAnalysisOutput {
  themeMatrix?: { theme: string; companyContext: string; leadership: string; employees: string; external: string }[];
  agreements?: { description: string; sources: string[]; strategicallyUseful: boolean; reasoning: string }[];
  contradictions?: {
    description: string;
    companyContextSays: string;
    leadershipSays: string;
    employeesSay: string;
    externalSays: string;
    whyItMatters: string;
    resolvedByOtherEvidence: boolean;
    resolution: string;
    becomeAlignmentQuestion: boolean;
  }[];
  perceptionGaps?: {
    description: string;
    whatExistsOrIsDesired: string;
    whatIsCurrentlyVisible: string;
    supportingEvidence: string;
    whyItMatters: string;
    strategicImplication: string;
  }[];
  hiddenStrengths?: { description: string; evidence: string; commerciallyRelevant: string; reasoning: string }[];
  unsupportedAmbitions?: { ambition: string; leadershipEvidence: string; supportingEvidenceElsewhere: string; strategicImplication: string }[];
  underusedEvidence?: { evidence: string; currentVisibility: string; opportunity: string }[];
  currentVsDesired?: { theme: string; current: string; desired: string; substance: string; gap: string; strategicImplication: string }[];
  significanceClassification?: {
    insight: string;
    evidenceStrength?: string;
    commercialSignificance?: string;
    perceptionSignificance?: string;
    mgsRelevance?: string;
    classification: string;
    reasoning: string;
  }[];
}

export interface StrategicFindingsOutput {
  findings?: { finding: string; evidence: string; interpretation: string; strategicSignificance: string; implication: string }[];
  currentPosition?: string;
  desiredPosition?: string;
  centralPerceptionGap?: string;
  strategicOpportunity?: string;
  perceptionMovement?: { from: string; to: string };
  evidenceGaps?: { unknown: string; whyItMatters: string; whatWouldResolveIt: string }[];
  alignmentQuestions?: string[];
  strategicJudgementRequired?: { issue: string; relevantEvidence: string; plausibleInterpretations: string[]; decisionNeeded: string }[];
}

export interface StrategicDirectionOutput {
  northStar?: string;
  northStarRationale?: string;
  strategicPriorities?: { priority: string; rationale: string; evidenceBasis: string }[];
  twelveMonthPerceptionGoal?: string;
  build?: string[];
  protect?: string[];
  reduce?: string[];
}

export interface StrategicPillarsOutput {
  pillars?: {
    name: string;
    purpose: string;
    desiredPerception: string;
    evidence: string;
    demonstration: string[];
    boundaries: string[];
  }[];
}

export interface RoadmapOutput {
  align?: { action: string; rationale: string }[];
  execute?: { action: string; rationale: string }[];
  improve?: { method: string; rationale: string }[];
}

export interface QualityAuditOutput {
  evidenceAudit?: { pass: boolean; issues: { claim: string; concern: string; recommendation: string }[] };
  contradictionAudit?: { pass: boolean; issues: { contradiction: string; concern: string }[] };
  genericnessAudit?: { pass: boolean; issues: { section: string; concern: string; suggestedFix: string }[] };
  referenceContaminationAudit?: { pass: boolean; issues: { concept: string; concern: string }[] };
  weightingAudit?: { pass: boolean; issues: { item: string; concern: string; recommendation: string }[] };
}

export interface MarkdownOutput {
  markdown?: string;
}
