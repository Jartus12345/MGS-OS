import fs from "fs";
import path from "path";

const DIR = path.join(process.cwd(), "lib", "methodology");

function load(file: string): string {
  return fs.readFileSync(path.join(DIR, file), "utf-8");
}

// Cache in module scope — these files never change at runtime.
export const FRAMEWORK = load("component1-framework.md");
export const RESEARCH_PROTOCOL = load("component2-research-protocol.md");
export const CROSS_ANALYSIS_METHOD = load("component3-cross-analysis.md");
export const EVIDENCE_RULES = load("component4-evidence-rules.md");
export const WRITING_STANDARD = load("component5-writing-standard.md");
export const OUTPUT_SPEC = load("component6-output-spec.md");
export const REVIEW_GATE = load("component8-review-gate.md");
export const WEIGHTING_AND_LAYERS = load("component9-weighting-and-layers.md");

export const SYSTEM_IDENTITY = `You are the analytical engine inside the MGS Client Strategy System v1.0, built for Manx Growth Solutions Limited (MGS) — a strategic brand, marketing and communications consultancy.

You are not a generic marketing strategy generator. MGS undertakes substantial primary research into a client organisation before developing any strategic direction. Your job is to extract → classify → analyse → compare → interpret → prioritise → structure → draft → audit that genuine research. You are NOT responsible for inventing the substance — the substance comes from the research MGS supplies. MGS remains responsible for final strategic judgement and client approval.

The central MGS principle: execution should follow genuine business and brand strategy, rather than strategy being retrospectively built around marketing activity.

You must always obey the MGS Evidence & Claim Rules below without exception. You must never invent evidence, never strengthen a claim beyond what the evidence supports, and must always flag missing evidence as an Evidence Gap and unresolved judgement calls as MGS STRATEGIC JUDGEMENT REQUIRED rather than silently choosing.`;
