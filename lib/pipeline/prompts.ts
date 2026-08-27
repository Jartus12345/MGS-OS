import type { Project, Source } from "../types";
import {
  SYSTEM_IDENTITY,
  RESEARCH_PROTOCOL,
  CROSS_ANALYSIS_METHOD,
  EVIDENCE_RULES,
  WRITING_STANDARD,
  FRAMEWORK,
  OUTPUT_SPEC,
  WEIGHTING_AND_LAYERS,
} from "../methodology";

export interface PromptPair {
  system: string;
  user: string;
}

function sourceBlock(s: Source): string {
  const header = [
    `SOURCE ID: ${s.id}`,
    `SOURCE TYPE: ${s.type}`,
    `LABEL: ${s.label}`,
    s.producedBy ? `PRODUCED BY: ${s.producedBy}` : null,
    s.purpose ? `PURPOSE: ${s.purpose}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return `${header}\n---\n${s.rawText}\n---`;
}

// ---------------------------------------------------------------------------
// STAGE: extract — per source, extract + classify evidence.
// ---------------------------------------------------------------------------
export function buildExtractPrompt(source: Source): PromptPair {
  const system = `${SYSTEM_IDENTITY}\n\n${RESEARCH_PROTOCOL}\n\n${EVIDENCE_RULES}\n\nTASK: STAGE 2/3 — EXTRACT & CLASSIFY.\nRead the single source below. Extract the important evidence items it contains. Do NOT reconcile against any other source (you have not been given any other source). Do NOT develop strategy. Classify each extracted item's evidence type strictly according to what THIS source type can legitimately establish (see the Research Analysis Protocol above). Preserve the organisation's own wording for direct claims so later stages can tell self-description from fact.\n\nRespond with ONLY a JSON object, no prose outside the JSON, matching exactly this shape:\n{\n  "sourceId": string,\n  "sourceSummary": string, // 2-4 sentences: what this source is and what it can legitimately establish\n  "evidenceItems": [\n    { "item": string, "evidenceType": "fact"|"leadership_intent"|"internal_perception"|"external_observation", "quoteOrParaphrase": string, "confidence": "strong"|"moderate"|"emerging"|"unsupported" }\n  ]\n}`;

  const user = `Here is the source to extract and classify:\n\n${sourceBlock(source)}`;
  return { system, user };
}

// ---------------------------------------------------------------------------
// STAGE: independent_analysis
// ---------------------------------------------------------------------------
export function buildIndependentAnalysisPrompt(project: Project): PromptPair {
  const extract = project.stages.extract?.output as
    | { bySource: Record<string, unknown> }
    | undefined;

  const evidenceDump = JSON.stringify(extract?.bySource ?? {}, null, 2);

  const system = `${SYSTEM_IDENTITY}\n\n${RESEARCH_PROTOCOL}\n\n${EVIDENCE_RULES}\n\nTASK: STAGE 4 — INDEPENDENT ANALYSIS.\nUsing the classified evidence below (grouped by source), produce FOUR independent analyses. Each analysis must draw ONLY on evidence whose sourceType matches that perspective:\n- companyContextAnalysis: from sourceType "company_context" evidence only — what does the organisation currently say it is?\n- leadershipAnalysis: from sourceType "leadership_discovery" evidence only — where does leadership want the organisation to go?\n- employeeAnalysis: from sourceType "employee_survey" evidence only — what appears to exist internally? Note where themes recur across multiple individuals/departments — repetition strengthens a finding.\n- externalAnalysis: from sourceType "digital_credibility_scorecard" evidence only — what can an outsider with no internal knowledge currently see and understand?\n\nDo NOT reconcile the four perspectives against each other. Do NOT develop strategy, positioning or a North Star. Do NOT decide which source is "correct". Preserve disagreement for the next stage.\n\nIf a perspective has no matching evidence, say so explicitly rather than inventing content — treat it as an Evidence Gap.\n\nRespond with ONLY a JSON object matching exactly this shape:\n{\n  "companyContextAnalysis": { "summary": string, "keyPoints": string[], "evidenceGaps": string[] },\n  "leadershipAnalysis": { "summary": string, "commercialObjectives": string[], "desiredPerception": string[], "priorityAudiences": string[], "keyPoints": string[], "evidenceGaps": string[] },\n  "employeeAnalysis": { "summary": string, "recurringStrengths": string[], "recurringTensions": string[], "keyPoints": string[], "evidenceGaps": string[] },\n  "externalAnalysis": { "summary": string, "credibilityObservations": string[], "keyPoints": string[], "evidenceGaps": string[] }\n}`;

  const user = `Classified evidence by source (each entry is the output of the extract/classify stage for one source):\n\n${evidenceDump}`;
  return { system, user };
}

// ---------------------------------------------------------------------------
// STAGE: cross_analysis
// ---------------------------------------------------------------------------
export function buildCrossAnalysisPrompt(project: Project): PromptPair {
  const independent = project.stages.independent_analysis?.output;

  const system = `${SYSTEM_IDENTITY}\n\n${CROSS_ANALYSIS_METHOD}\n\n${WEIGHTING_AND_LAYERS}\n\n${EVIDENCE_RULES}\n\nTASK: STAGES 5-9 — CROSS-ANALYSIS.\nYou are now given all four independent analyses together for the first time. Follow the Cross-Analysis Methodology stages in order: theme extraction, agreements, contradictions, perception gaps, hidden strengths, unsupported ambitions, underused evidence, current-vs-desired, and strategic significance classification.\n\nDo not force patterns that are not in the evidence. Preserve contradictions rather than resolving them quietly.\n\nFor significanceClassification, score each candidate insight against the four tests in the Evidence Weighting component above (evidence strength, commercial significance, perception significance, MGS relevance) — record all four scores, not just an overall label. Remember leadership's Strategic Business Discovery establishes the commercial destination; employee and external evidence qualify, challenge or corroborate that destination — they do not get to replace it just because a theme recurs often. An insight that is only strongly evidenced (frequent in one source) but scores low on commercial and perception significance is "supporting" at most, not "critical".\n\nRespond with ONLY a JSON object matching exactly this shape:\n{\n  "themeMatrix": [ { "theme": string, "companyContext": string, "leadership": string, "employees": string, "external": string } ],\n  "agreements": [ { "description": string, "sources": string[], "strategicallyUseful": boolean, "reasoning": string } ],\n  "contradictions": [ { "description": string, "companyContextSays": string, "leadershipSays": string, "employeesSay": string, "externalSays": string, "whyItMatters": string, "resolvedByOtherEvidence": boolean, "resolution": string, "becomeAlignmentQuestion": boolean } ],\n  "perceptionGaps": [ { "description": string, "whatExistsOrIsDesired": string, "whatIsCurrentlyVisible": string, "supportingEvidence": string, "whyItMatters": string, "strategicImplication": string } ],\n  "hiddenStrengths": [ { "description": string, "evidence": string, "commerciallyRelevant": "yes"|"no"|"needs_testing", "reasoning": string } ],\n  "unsupportedAmbitions": [ { "ambition": string, "leadershipEvidence": string, "supportingEvidenceElsewhere": string, "strategicImplication": string } ],\n  "underusedEvidence": [ { "evidence": string, "currentVisibility": string, "opportunity": string } ],\n  "currentVsDesired": [ { "theme": string, "current": string, "desired": string, "substance": string, "gap": string, "strategicImplication": string } ],\n  "significanceClassification": [ { "insight": string, "evidenceStrength": "strong"|"moderate"|"emerging"|"unsupported", "commercialSignificance": "high"|"medium"|"low", "perceptionSignificance": "high"|"medium"|"low", "mgsRelevance": "high"|"medium"|"low", "classification": "critical"|"important"|"supporting"|"not_strategic", "reasoning": string } ]\n}`;

  const user = `Four independent source analyses (company context, leadership, employees, external):\n\n${JSON.stringify(independent, null, 2)}`;
  return { system, user };
}

// ---------------------------------------------------------------------------
// STAGE: strategic_findings
// ---------------------------------------------------------------------------
export function buildStrategicFindingsPrompt(project: Project): PromptPair {
  const crossAnalysis = project.stages.cross_analysis?.output;

  const system = `${SYSTEM_IDENTITY}\n\n${FRAMEWORK}\n\n${WEIGHTING_AND_LAYERS}\n\n${EVIDENCE_RULES}\n\nTASK: STAGES 9-11 — STRATEGIC FINDINGS, CENTRAL DIAGNOSIS, PERCEPTION MOVEMENT.\nFrom the complete cross-analysis, identify the SMALLEST number of major strategic findings required to explain the organisation's strategic situation — normally 3 to 6. Actively resist producing a long list. Each finding must follow: Finding → Evidence → Interpretation → Strategic Significance → Implication.\n\nWeigh candidates using the four tests (evidence strength, commercial significance, perception significance, MGS relevance) from the Evidence Weighting component above, not evidence frequency alone. The organising logic of your findings, current position, desired position and central perception gap MUST be anchored in leadership's stated commercial direction (Strategic Business Discovery) — that is where the organisation is trying to go. Employee and external evidence should be used to corroborate, qualify, challenge or add texture to that direction, and any one of them may surface a real risk or a genuine hidden strength worth a finding of its own — but none of them should displace leadership's commercial direction as the organising idea simply because it recurred often in that one source. A single vivid internal event (e.g. a difficult organisational change) is real evidence and must not be hidden, but state it proportionately against the wider commercial evidence rather than building the whole diagnosis around it.\n\nThen produce a Central Strategic Diagnosis (current position, desired position, central perception gap, strategic opportunity) and a Central Perception Movement expressed as FROM → TO. The FROM → TO is an internal strategy mechanism, not client-facing copy — describe movement without unnecessarily insulting the client's current position.\n\nWhere evidence significantly conflicts, is missing, or a leadership ambition is unsupported such that a confident finding cannot responsibly be made, add an entry to strategicJudgementRequired instead of forcing a finding. Do not use this as an excuse to avoid a reasonable strategic interpretation — analyse and judge; only escalate what genuinely requires MGS or the client to decide.\n\nRespond with ONLY a JSON object matching exactly this shape:\n{\n  "findings": [ { "finding": string, "evidence": string, "interpretation": string, "strategicSignificance": string, "implication": string } ],\n  "currentPosition": string,\n  "desiredPosition": string,\n  "centralPerceptionGap": string,\n  "strategicOpportunity": string,\n  "perceptionMovement": { "from": string, "to": string },\n  "evidenceGaps": [ { "unknown": string, "whyItMatters": string, "whatWouldResolveIt": string } ],\n  "alignmentQuestions": string[],\n  "strategicJudgementRequired": [ { "issue": string, "relevantEvidence": string, "plausibleInterpretations": string[], "decisionNeeded": string } ]\n}`;

  const user = `Cross-analysis output:\n\n${JSON.stringify(crossAnalysis, null, 2)}`;
  return { system, user };
}

// ---------------------------------------------------------------------------
// STAGE: strategic_direction
// ---------------------------------------------------------------------------
export function buildStrategicDirectionPrompt(project: Project): PromptPair {
  const findings = project.stages.strategic_findings?.output;

  const system = `${SYSTEM_IDENTITY}\n\n${FRAMEWORK}\n\n${WEIGHTING_AND_LAYERS}\n\n${EVIDENCE_RULES}\n\nTASK: STAGE 12 — STRATEGIC DIRECTION.\nDevelop the Strategic North Star: an internal strategic statement (NOT automatically a tagline, slogan, strapline, website headline or campaign line) expressing the strategic movement required + the future position + what commercially matters. The North Star must be built primarily from leadership's stated commercial destination in the strategic findings — it is where the organisation is trying to go commercially, expressed with the discipline the evidence supports, not a rebrand of whatever theme was most frequently mentioned in employee or external research. Then develop 3-5 Strategic Priorities that are unique to this client — never reuse generic priorities, and make sure each priority earns its place via the four-test weighting (evidence, commercial significance, perception significance, MGS relevance), not evidence volume alone. Then the 12-Month Perception Goal (meaningful movement in 12 months, not full completion) and Build / Protect / Reduce (what should become materially stronger; what existing equity/strengths/personality must not be lost; what should become less prominent).\n\nEvery element must trace back to the strategic findings and central diagnosis you have been given. If evidence does not support a confident recommendation on any element, say so and flag it rather than inventing one.\n\nRespond with ONLY a JSON object matching exactly this shape:\n{\n  "northStar": string,\n  "northStarRationale": string,\n  "strategicPriorities": [ { "priority": string, "rationale": string, "evidenceBasis": string } ],\n  "twelveMonthPerceptionGoal": string,\n  "build": string[],\n  "protect": string[],\n  "reduce": string[]\n}`;

  const user = `Strategic findings and central diagnosis:\n\n${JSON.stringify(findings, null, 2)}`;
  return { system, user };
}

// ---------------------------------------------------------------------------
// STAGE: strategic_pillars
// ---------------------------------------------------------------------------
export function buildStrategicPillarsPrompt(project: Project): PromptPair {
  const direction = project.stages.strategic_direction?.output;
  const findings = project.stages.strategic_findings?.output;

  const system = `${SYSTEM_IDENTITY}\n\n${FRAMEWORK}\n\n${WEIGHTING_AND_LAYERS}\n\n${EVIDENCE_RULES}\n\nTASK: STAGE 13 — STRATEGIC PILLARS.\nOnly now that the desired direction is established, define Strategic Pillars — broader brand and communications territories the organisation needs to consistently demonstrate (NOT automatically social content pillars). There is no fixed number; the evidence determines them. Each pillar needs: Purpose, Desired Perception, Evidence (genuine organisational substance that allows credible claims), Demonstration (how it could be shown — people, client evidence, case studies, website, thought leadership, social, communications, events, partnerships, PR, leadership, photography, campaigns), and Boundaries (what to avoid).\n\nEvery pillar must be traceable to evidence already established — do not introduce a pillar the organisation cannot yet credibly support without noting that as a boundary/evidence-gap.\n\nRespond with ONLY a JSON object matching exactly this shape:\n{\n  "pillars": [ { "name": string, "purpose": string, "desiredPerception": string, "evidence": string, "demonstration": string[], "boundaries": string[] } ]\n}`;

  const user = `Strategic direction:\n\n${JSON.stringify(direction, null, 2)}\n\nStrategic findings:\n\n${JSON.stringify(findings, null, 2)}`;
  return { system, user };
}

// ---------------------------------------------------------------------------
// STAGE: roadmap
// ---------------------------------------------------------------------------
export function buildRoadmapPrompt(project: Project): PromptPair {
  const pillars = project.stages.strategic_pillars?.output;
  const direction = project.stages.strategic_direction?.output;

  const system = `${SYSTEM_IDENTITY}\n\n${FRAMEWORK}\n\n${EVIDENCE_RULES}\n\nTASK: STAGE 14 — 12-MONTH STRATEGIC ROADMAP.\nTranslate the strategy into ALIGN (what foundations need to change or be developed before execution — only what the evidence requires, e.g. positioning, messaging, tone of voice, visual identity, guidelines, architecture, website, LinkedIn, employee brand, leadership profiles, photography, company description, service presentation, evidence library), EXECUTE (how the desired position should then be demonstrated consistently — company communications, thought leadership, case studies, campaigns, employee advocacy, events, partnerships, PR, website/social content), and IMPROVE (how MGS should assess whether perception is actually moving — repeat Digital Credibility Scorecard, employee research, stakeholder research, client feedback, commercial indicators, enquiry quality, service mix, expert visibility, authority indicators, digital performance, communications metrics). Do not reduce strategic success to likes, reach, followers or impressions.\n\nRespond with ONLY a JSON object matching exactly this shape:\n{\n  "align": [ { "action": string, "rationale": string } ],\n  "execute": [ { "action": string, "rationale": string } ],\n  "improve": [ { "method": string, "rationale": string } ]\n}`;

  const user = `Strategic pillars:\n\n${JSON.stringify(pillars, null, 2)}\n\nStrategic direction:\n\n${JSON.stringify(direction, null, 2)}`;
  return { system, user };
}

// ---------------------------------------------------------------------------
// STAGE: quality_audit
// ---------------------------------------------------------------------------
export function buildQualityAuditPrompt(
  project: Project,
  referenceCaseSummaries: { clientName: string; output: unknown }[]
): PromptPair {
  const everything = {
    independentAnalysis: project.stages.independent_analysis?.output,
    crossAnalysis: project.stages.cross_analysis?.output,
    strategicFindings: project.stages.strategic_findings?.output,
    strategicDirection: project.stages.strategic_direction?.output,
    strategicPillars: project.stages.strategic_pillars?.output,
    roadmap: project.stages.roadmap?.output,
  };

  const referenceBlock =
    referenceCaseSummaries.length > 0
      ? `\n\nThe following project(s) are marked as MGS reference cases (e.g. PDMS) used only to demonstrate the expected STANDARD of work (depth, reasoning, evidence discipline, restraint, writing quality) — never as a source of answers for this client. Check whether any concept, phrase, positioning idea, strategic priority or recommendation in THIS client's strategy has entered because it existed in a reference case rather than because THIS client's own evidence supports it:\n\n${JSON.stringify(
          referenceCaseSummaries,
          null,
          2
        )}`
      : "\n\nNo reference case is currently attached to this system, so the reference contamination audit should report that there is nothing to check against — do not fabricate a comparison.";

  const system = `${SYSTEM_IDENTITY}\n\n${WEIGHTING_AND_LAYERS}\n\n${EVIDENCE_RULES}\n\nTASK: STAGES 15-18 — QUALITY CONTROL AUDITS.\nRun five audits against the complete strategic reasoning below:\n1. EVIDENCE AUDIT — for every material strategic claim, ask "what evidence allows MGS to say this?" Flag any claim that is insufficiently supported, and state whether it should be qualified, removed, or flagged.\n2. CONTRADICTION AUDIT — check whether contradictions identified during cross-analysis have disappeared from the findings/direction without being consciously resolved. If so, say which ones and whether they need restoring.\n3. GENERICNESS AUDIT — ask "could this reasonably have been written for another company simply by changing the name?" Identify any generic section and explain what evidence-specific content should replace it.\n4. REFERENCE CONTAMINATION AUDIT — as described below.\n5. WEIGHTING AUDIT — check whether the central diagnosis, North Star or top strategic priorities are being driven by something that is only frequently-mentioned in one evidence source (usually the Employee Survey) rather than by leadership's stated commercial direction, tested against the four weighting tests (evidence strength, commercial significance, perception significance, MGS relevance). Also check the reverse: has a genuinely significant risk or contradiction (e.g. something raised repeatedly and substantively by employees) been dropped entirely rather than proportionately reflected? Flag any finding that is over- or under-weighted relative to what the four tests support.${referenceBlock}\n\nRespond with ONLY a JSON object matching exactly this shape:\n{\n  "evidenceAudit": { "pass": boolean, "issues": [ { "claim": string, "concern": string, "recommendation": "qualify"|"remove"|"flag" } ] },\n  "contradictionAudit": { "pass": boolean, "issues": [ { "contradiction": string, "concern": string } ] },\n  "genericnessAudit": { "pass": boolean, "issues": [ { "section": string, "concern": string, "suggestedFix": string } ] },\n  "referenceContaminationAudit": { "pass": boolean, "issues": [ { "concept": string, "concern": string } ] },\n  "weightingAudit": { "pass": boolean, "issues": [ { "item": string, "concern": string, "recommendation": "reweight_down"|"reweight_up"|"remove"|"restore" } ] }\n}`;

  const user = `Complete strategic reasoning to audit:\n\n${JSON.stringify(everything, null, 2)}`;
  return { system, user };
}

// ---------------------------------------------------------------------------
// STAGE: master_strategy
// ---------------------------------------------------------------------------
export function buildMasterStrategyPrompt(project: Project): PromptPair {
  const everything = {
    clientName: project.clientName,
    independentAnalysis: project.stages.independent_analysis?.output,
    crossAnalysis: project.stages.cross_analysis?.output,
    strategicFindings: project.stages.strategic_findings?.output,
    strategicDirection: project.stages.strategic_direction?.output,
    strategicPillars: project.stages.strategic_pillars?.output,
    roadmap: project.stages.roadmap?.output,
    qualityAudit: project.stages.quality_audit?.output,
  };

  const system = `${SYSTEM_IDENTITY}\n\n${FRAMEWORK}\n\n${OUTPUT_SPEC}\n\n${WEIGHTING_AND_LAYERS}\n\n${WRITING_STANDARD}\n\n${EVIDENCE_RULES}\n\nTASK: STAGES 19-20 — WRITING PASS + MASTER CLIENT STRATEGY (LAYER 2).\nAssemble the full MGS Master Client Strategy (Output A / Layer 2) for ${project.clientName} in well-formatted Markdown, following the MGS Client Strategy Framework section order exactly: 1. Executive Overview (write this last in your own process, but place it first in the document), 2. The Business Today, 3. What We Discovered (Leadership / Employee / External perspectives + Cross-Analysis), 4. Strategic Diagnosis, 5. Strategic Direction, 6. Desired Position, 7. Strategic Pillars, 8. 12-Month Strategic Roadmap.\n\nThis document is Layer 2 — the strategic source of truth built FROM the Layer 1 analysis you were given, not a rendering of Layer 1 itself. Section 3.4 (Cross-Analysis) should present the strategically relevant agreements, contradictions, perception gaps, hidden strengths, unsupported ambitions and underused evidence — do NOT dump the full Layer 1 evidence register, theme matrix or every minor observation. Write as professional strategic analysis: do not label claims FACT / LEADERSHIP INTENT / INTERNAL PERCEPTION / EXTERNAL OBSERVATION or STRONG/MODERATE/EMERGING evidence in the prose — that discipline should show through the writing's restraint and specificity, not through visible tags. Do not litter the document with "MGS Strategic Judgement Required" or "Evidence Gap" callouts unless the issue genuinely needs a client or MGS decision that cannot be reasonably resolved here; where you can make a sound strategic judgement from the evidence, make it, and note only genuinely open items.\n\nApply the MGS Writing Standard throughout. There is no fixed length — depth follows evidence; do not pad.\n\nRespond with ONLY a JSON object matching exactly this shape:\n{\n  "markdown": string\n}`;

  const user = `Complete strategic reasoning to assemble into the Master Client Strategy:\n\n${JSON.stringify(everything, null, 2)}`;
  return { system, user };
}

// ---------------------------------------------------------------------------
// STAGE: executive_brand_direction
// ---------------------------------------------------------------------------
export function buildExecutiveBrandDirectionPrompt(project: Project): PromptPair {
  const masterStrategy = project.stages.master_strategy?.output as
    | { markdown: string }
    | undefined;

  const system = `${SYSTEM_IDENTITY}\n\n${OUTPUT_SPEC}\n\n${WEIGHTING_AND_LAYERS}\n\n${WRITING_STANDARD}\n\n${EVIDENCE_RULES}\n\nTASK: STAGE 21 — CLIENT EXECUTIVE BRAND DIRECTION (LAYER 3).\nDistil the Master Client Strategy below into the Executive Brand Direction (Output B / Layer 3) for ${project.clientName} — approximately 5-8 sections, for senior leadership approval: 1. Purpose & Context, 2. Where the Organisation Is Today, 3. What the Discovery Tells Us, 4. Where the Organisation Needs to Go, 5. The 12-Month Direction, 6. How We Get There, 7. Approval & Next Steps. This must be a genuine executive synthesis retaining the most important strategic substance — not a truncation of the Master Strategy or a simple copy-paste of sections, and not a re-exposure of Layer 1 analysis. No major conclusion should appear here that is not already in the Master Strategy. Keep execution detail high-level in section 6 — leadership is approving a direction, not reviewing a project plan. Close section 7 by stating plainly what leadership is being asked to approve and what that approval unlocks next.\n\nRespond with ONLY a JSON object matching exactly this shape:\n{\n  "markdown": string\n}`;

  const user = `Master Client Strategy to distil:\n\n${masterStrategy?.markdown ?? ""}`;
  return { system, user };
}
