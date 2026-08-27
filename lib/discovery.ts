import type { Project, SourceType } from "./types";

export interface DiscoveryCompletenessItem {
  type: SourceType;
  label: string;
  complete: boolean;
  count: number;
  limitation: string;
}

const CORE_INPUTS: { type: SourceType; label: string; limitation: string }[] = [
  {
    type: "company_context",
    label: "Company Context",
    limitation:
      "Without company context, MGS cannot establish what the organisation currently says about itself, so claim rules (website claims remain claims) cannot be checked against current self-presentation.",
  },
  {
    type: "leadership_discovery",
    label: "Strategic Business Discovery (Leadership Intent)",
    limitation:
      "Without leadership discovery, the strategy cannot be anchored to a genuine commercial direction — MGS would be guessing at ambition rather than evidencing it.",
  },
  {
    type: "employee_survey",
    label: "Employee Brand Survey (Internal Perception)",
    limitation:
      "The strategy can still assess leadership ambition and external presentation, but MGS will have weaker evidence regarding internal culture, employee perception, and whether leadership's desired positioning is supported by internal organisational reality.",
  },
  {
    type: "digital_credibility_scorecard",
    label: "Digital Credibility Scorecard (External Observation)",
    limitation:
      "Without an independent external assessment, MGS cannot reliably establish what an outsider with no internal knowledge can currently see and understand — perception-gap analysis will rely on weaker or self-reported signals.",
  },
];

export function discoveryCompleteness(project: Project): DiscoveryCompletenessItem[] {
  return CORE_INPUTS.map((input) => {
    const matching = project.sources.filter((s) => s.type === input.type);
    return {
      type: input.type,
      label: input.label,
      complete: matching.length > 0,
      count: matching.length,
      limitation: input.limitation,
    };
  });
}

export function isDiscoveryComplete(project: Project): boolean {
  return discoveryCompleteness(project).every((i) => i.complete);
}
