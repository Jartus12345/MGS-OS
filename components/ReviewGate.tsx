"use client";

import { useState } from "react";
import type { Project, ReviewAction, ReviewCriterion } from "@/lib/types";
import { REVIEW_CRITERIA } from "@/lib/types";

const CRITERION_LABEL: Record<ReviewCriterion, string> = {
  evidence: "Evidence — can every significant claim be defended?",
  reasoning: "Reasoning — do conclusions logically follow from evidence?",
  contradictions: "Contradictions — properly handled, not silently resolved?",
  specificity: "Specificity — could this have been written for another company?",
  commercial_relevance: "Commercial relevance — supports leadership's real objectives?",
  humanity: "Humanity — sounds like MGS, not generated consultancy copy?",
  restraint: "Restraint — has anything been overstated?",
  usefulness: "Usefulness — can this genuinely guide the next 12 months?",
  client_sensitivity: "Client sensitivity — difficult findings expressed appropriately?",
};

const ACTIONS: { value: ReviewAction; label: string; description: string }[] = [
  { value: "approve_internally", label: "Approve Internally", description: "Ready to move to client presentation / ALIGN." },
  { value: "edit", label: "Edit", description: "MGS will make direct edits before it is client-ready." },
  { value: "return_to_analysis", label: "Return to Analysis", description: "Send back through the pipeline — the analysis itself needs rework." },
  { value: "request_additional_evidence", label: "Request Additional Evidence", description: "A material Evidence Gap needs resolving before this can proceed." },
  { value: "request_client_clarification", label: "Request Client Clarification", description: "An Alignment Question needs answering by the client." },
  { value: "flag_judgement_required", label: "Flag Strategic Judgement Required", description: "A genuine judgement call only MGS can make." },
];

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  awaiting_review: "Awaiting MGS Review",
  changes_requested: "Changes Requested",
  internally_approved: "Internally Approved",
  client_approved: "Client Approved",
};

export default function ReviewGate({
  project,
  onUpdated,
}: {
  project: Project;
  onUpdated: (project: Project) => void;
}) {
  const [checklist, setChecklist] = useState<Partial<Record<ReviewCriterion, boolean>>>({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(action: ReviewAction) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, checklist, notes }),
      });
      const data = await res.json();
      if (res.ok) {
        onUpdated(data.project);
        setNotes("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const outputsReady =
    project.stages.master_strategy?.status === "complete" &&
    project.stages.executive_brand_direction?.status === "complete";

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Status</h3>
          <span className="text-xs uppercase tracking-wide bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded">
            {STATUS_LABEL[project.review.status]}
          </span>
        </div>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">
          Nothing produced by this application becomes final without MGS strategic review. AI does not
          make the final strategic decision — MGS remains responsible for final judgement and client
          approval.
        </p>
        {!outputsReady && (
          <p className="text-sm text-amber-700 dark:text-amber-400 mt-2">
            The Master Strategy and Executive Brand Direction must both be generated (see Outputs tab)
            before a meaningful review can take place.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 space-y-3">
        <h3 className="font-medium">MGS Review Checklist</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {REVIEW_CRITERIA.map((c) => (
            <label key={c} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={checklist[c] ?? false}
                onChange={(e) => setChecklist((prev) => ({ ...prev, [c]: e.target.checked }))}
              />
              <span>{CRITERION_LABEL[c]}</span>
            </label>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Notes
          <textarea
            className="border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1.5 bg-transparent min-h-20"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes to accompany this review decision"
          />
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {ACTIONS.map((a) => (
          <button
            key={a.value}
            disabled={submitting || !outputsReady}
            onClick={() => submit(a.value)}
            className="text-left rounded border border-neutral-300 dark:border-neutral-700 p-3 hover:border-neutral-500 disabled:opacity-40"
          >
            <div className="text-sm font-medium">{a.label}</div>
            <div className="text-xs text-neutral-500">{a.description}</div>
          </button>
        ))}
      </div>

      {project.review.decisions.length > 0 && (
        <div>
          <h3 className="font-medium mb-2">Review History</h3>
          <ul className="space-y-2">
            {[...project.review.decisions].reverse().map((d) => (
              <li key={d.id} className="text-sm border border-neutral-200 dark:border-neutral-800 rounded p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{ACTIONS.find((a) => a.value === d.action)?.label}</span>
                  <span className="text-xs text-neutral-500">{new Date(d.timestamp).toLocaleString()}</span>
                </div>
                {d.notes && <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">{d.notes}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
