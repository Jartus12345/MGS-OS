"use client";

import { useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import type { Project } from "@/lib/types";
import { discoveryCompleteness, isDiscoveryComplete } from "@/lib/discovery";
import { StagePanel, JsonBlock } from "@/components/StagePanel";
import SourceLibrary from "@/components/SourceLibrary";
import ReviewGate from "@/components/ReviewGate";
import type {
  IndependentAnalysisOutput,
  CrossAnalysisOutput,
  StrategicFindingsOutput,
  StrategicDirectionOutput,
  StrategicPillarsOutput,
  RoadmapOutput,
  QualityAuditOutput,
  MarkdownOutput,
} from "@/lib/pipeline/outputTypes";

const TABS = [
  "Overview",
  "Source Library",
  "Independent Analysis",
  "Cross-Analysis",
  "Strategic Diagnosis",
  "Strategic Direction",
  "Roadmap",
  "Outputs",
  "Quality Control",
  "MGS Review",
] as const;
type Tab = (typeof TABS)[number];

export default function ProjectDashboard({ initialProject }: { initialProject: Project }) {
  const [project, setProject] = useState(initialProject);
  const [tab, setTab] = useState<Tab>("Overview");
  const [referenceCasePending, setReferenceCasePending] = useState(false);

  async function toggleReferenceCase() {
    setReferenceCasePending(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isReferenceCase: !project.isReferenceCase }),
      });
      const data = await res.json();
      if (res.ok) setProject(data.project);
    } finally {
      setReferenceCasePending(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-xs text-neutral-500 hover:underline">
            ← All projects
          </Link>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            {project.clientName}
            {project.isReferenceCase && (
              <span className="text-[10px] uppercase tracking-wide bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 rounded">
                Reference case
              </span>
            )}
          </h1>
        </div>
        <button
          onClick={toggleReferenceCase}
          disabled={referenceCasePending}
          className="text-xs rounded border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 disabled:opacity-50"
        >
          {project.isReferenceCase ? "Unmark as reference case" : "Mark as MGS reference case"}
        </button>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-neutral-200 dark:border-neutral-800">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm rounded-t border-b-2 -mb-px ${
              tab === t
                ? "border-neutral-900 dark:border-neutral-100 font-medium"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      <div>
        {tab === "Overview" && <OverviewTab project={project} setTab={setTab} />}
        {tab === "Source Library" && <SourceLibrary project={project} onUpdated={setProject} />}
        {tab === "Independent Analysis" && (
          <div className="space-y-4">
            <StagePanel project={project} stageId="extract" onUpdated={setProject}>
              {(r) => <JsonBlock value={r?.output} />}
            </StagePanel>
            <StagePanel project={project} stageId="independent_analysis" onUpdated={setProject}>
              {(r) => <IndependentAnalysisView output={r?.output as IndependentAnalysisOutput} />}
            </StagePanel>
          </div>
        )}
        {tab === "Cross-Analysis" && (
          <StagePanel project={project} stageId="cross_analysis" onUpdated={setProject}>
            {(r) => <CrossAnalysisView output={r?.output as CrossAnalysisOutput} />}
          </StagePanel>
        )}
        {tab === "Strategic Diagnosis" && (
          <StagePanel project={project} stageId="strategic_findings" onUpdated={setProject}>
            {(r) => <StrategicFindingsView output={r?.output as StrategicFindingsOutput} />}
          </StagePanel>
        )}
        {tab === "Strategic Direction" && (
          <div className="space-y-4">
            <StagePanel project={project} stageId="strategic_direction" onUpdated={setProject}>
              {(r) => <StrategicDirectionView output={r?.output as StrategicDirectionOutput} />}
            </StagePanel>
            <StagePanel project={project} stageId="strategic_pillars" onUpdated={setProject}>
              {(r) => <StrategicPillarsView output={r?.output as StrategicPillarsOutput} />}
            </StagePanel>
          </div>
        )}
        {tab === "Roadmap" && (
          <StagePanel project={project} stageId="roadmap" onUpdated={setProject}>
            {(r) => <RoadmapView output={r?.output as RoadmapOutput} />}
          </StagePanel>
        )}
        {tab === "Outputs" && (
          <div className="space-y-4">
            <StagePanel project={project} stageId="master_strategy" onUpdated={setProject}>
              {(r) => <MarkdownView output={r?.output as MarkdownOutput} title="MGS Master Client Strategy" />}
            </StagePanel>
            <StagePanel project={project} stageId="executive_brand_direction" onUpdated={setProject}>
              {(r) => <MarkdownView output={r?.output as MarkdownOutput} title="Client Executive Brand Direction" />}
            </StagePanel>
          </div>
        )}
        {tab === "Quality Control" && (
          <StagePanel project={project} stageId="quality_audit" onUpdated={setProject}>
            {(r) => <QualityAuditView output={r?.output as QualityAuditOutput} />}
          </StagePanel>
        )}
        {tab === "MGS Review" && (
          <div className="space-y-4">
            <StagePanel project={project} stageId="human_review" onUpdated={setProject}>
              {() => null}
            </StagePanel>
            <ReviewGate project={project} onUpdated={setProject} />
          </div>
        )}
      </div>
    </div>
  );
}

function OverviewTab({ project, setTab }: { project: Project; setTab: (t: Tab) => void }) {
  const completeness = discoveryCompleteness(project);
  const complete = isDiscoveryComplete(project);
  const findings = project.stages.strategic_findings?.output as StrategicFindingsOutput | undefined;
  const evidenceGaps = findings?.evidenceGaps ?? [];
  const alignmentQuestions = findings?.alignmentQuestions ?? [];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
          <h3 className="text-sm font-medium text-neutral-500">Discovery Completeness</h3>
          <p className="text-lg font-semibold mt-1">
            {complete ? "Complete" : `${completeness.filter((c) => c.complete).length} / ${completeness.length} inputs`}
          </p>
          <button onClick={() => setTab("Source Library")} className="text-xs text-neutral-500 hover:underline mt-1">
            View Source Library →
          </button>
        </div>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
          <h3 className="text-sm font-medium text-neutral-500">MGS Review Status</h3>
          <p className="text-lg font-semibold mt-1">{project.review.status.replace(/_/g, " ")}</p>
          <button onClick={() => setTab("MGS Review")} className="text-xs text-neutral-500 hover:underline mt-1">
            Go to review gate →
          </button>
        </div>
      </section>

      <section>
        <h3 className="font-medium mb-2">Pipeline Progress</h3>
        <ol className="space-y-1 text-sm">
          {(
            [
              "ingest",
              "extract",
              "independent_analysis",
              "cross_analysis",
              "strategic_findings",
              "strategic_direction",
              "strategic_pillars",
              "roadmap",
              "quality_audit",
              "master_strategy",
              "executive_brand_direction",
              "human_review",
            ] as const
          ).map((id, i) => {
            const status = project.stages[id]?.status ?? "pending";
            return (
              <li key={id} className="flex items-center gap-2">
                <span className="w-5 text-neutral-400">{i + 1}.</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    status === "complete"
                      ? "bg-emerald-500"
                      : status === "error"
                      ? "bg-red-500"
                      : status === "running"
                      ? "bg-amber-500"
                      : "bg-neutral-300 dark:bg-neutral-700"
                  }`}
                />
                <span className={status === "complete" ? "" : "text-neutral-500"}>{id.replace(/_/g, " ")}</span>
              </li>
            );
          })}
        </ol>
      </section>

      {(evidenceGaps.length > 0 || alignmentQuestions.length > 0) && (
        <section className="grid gap-4 sm:grid-cols-2">
          {evidenceGaps.length > 0 && (
            <div className="rounded-lg border border-amber-300 dark:border-amber-800 p-4">
              <h3 className="font-medium mb-2">Evidence Gaps</h3>
              <ul className="text-sm space-y-2">
                {evidenceGaps.map((g, i) => (
                  <li key={i}>
                    <strong>{g.unknown}</strong> — {g.whyItMatters}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {alignmentQuestions.length > 0 && (
            <div className="rounded-lg border border-amber-300 dark:border-amber-800 p-4">
              <h3 className="font-medium mb-2">Outstanding Alignment Questions</h3>
              <ul className="text-sm list-disc list-inside space-y-1">
                {alignmentQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
      <h4 className="font-medium mb-2">{title}</h4>
      {children}
    </div>
  );
}

function IndependentAnalysisView({ output }: { output?: IndependentAnalysisOutput }) {
  if (!output) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card title="Company Context">
        <p className="text-sm mb-2">{output.companyContextAnalysis?.summary}</p>
        <BulletList items={output.companyContextAnalysis?.keyPoints} />
        <GapList items={output.companyContextAnalysis?.evidenceGaps} />
      </Card>
      <Card title="Leadership (Intent)">
        <p className="text-sm mb-2">{output.leadershipAnalysis?.summary}</p>
        <BulletList label="Commercial objectives" items={output.leadershipAnalysis?.commercialObjectives} />
        <BulletList label="Desired perception" items={output.leadershipAnalysis?.desiredPerception} />
        <BulletList label="Priority audiences" items={output.leadershipAnalysis?.priorityAudiences} />
        <GapList items={output.leadershipAnalysis?.evidenceGaps} />
      </Card>
      <Card title="Employees (Internal Perception)">
        <p className="text-sm mb-2">{output.employeeAnalysis?.summary}</p>
        <BulletList label="Recurring strengths" items={output.employeeAnalysis?.recurringStrengths} />
        <BulletList label="Recurring tensions" items={output.employeeAnalysis?.recurringTensions} />
        <GapList items={output.employeeAnalysis?.evidenceGaps} />
      </Card>
      <Card title="External (Observation)">
        <p className="text-sm mb-2">{output.externalAnalysis?.summary}</p>
        <BulletList label="Credibility observations" items={output.externalAnalysis?.credibilityObservations} />
        <GapList items={output.externalAnalysis?.evidenceGaps} />
      </Card>
    </div>
  );
}

function BulletList({ label, items }: { label?: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mb-2">
      {label && <div className="text-xs font-medium text-neutral-500">{label}</div>}
      <ul className="list-disc list-inside text-sm">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

function GapList({ items }: { items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-2 text-xs text-amber-700 dark:text-amber-400">
      <div className="font-medium">Evidence gaps</div>
      <ul className="list-disc list-inside">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} className="text-left border-b border-neutral-300 dark:border-neutral-700 px-2 py-1 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-neutral-100 dark:border-neutral-900 align-top">
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-1.5">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CrossAnalysisView({ output }: { output?: CrossAnalysisOutput }) {
  if (!output) return null;
  return (
    <div className="space-y-4">
      {output.themeMatrix && output.themeMatrix.length > 0 && (
        <Card title="Theme Matrix">
          <Table
            headers={["Theme", "Company Context", "Leadership", "Employees", "External"]}
            rows={output.themeMatrix.map((t) => [t.theme, t.companyContext, t.leadership, t.employees, t.external])}
          />
        </Card>
      )}
      {output.agreements && output.agreements.length > 0 && (
        <Card title="Agreements">
          <ul className="text-sm space-y-2">
            {output.agreements.map((a, i) => (
              <li key={i}>
                <strong>{a.description}</strong> — sources: {a.sources.join(", ")}.{" "}
                {a.strategicallyUseful ? "Strategically useful" : "True but may be generic"}: {a.reasoning}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {output.contradictions && output.contradictions.length > 0 && (
        <Card title="Contradictions (preserved, not resolved away)">
          <ul className="text-sm space-y-3">
            {output.contradictions.map((c, i) => (
              <li key={i} className="border-l-2 border-amber-400 pl-3">
                <div className="font-medium">{c.description}</div>
                <div className="text-xs text-neutral-500 mt-1">
                  Company context: {c.companyContextSays || "—"} · Leadership: {c.leadershipSays || "—"} · Employees:{" "}
                  {c.employeesSay || "—"} · External: {c.externalSays || "—"}
                </div>
                <div className="text-xs mt-1">Why it matters: {c.whyItMatters}</div>
                {c.becomeAlignmentQuestion && (
                  <div className="text-xs text-amber-700 dark:text-amber-400 mt-1">→ Flagged as a client alignment question</div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {output.perceptionGaps && output.perceptionGaps.length > 0 && (
        <Card title="Perception Gaps">
          <ul className="text-sm space-y-2">
            {output.perceptionGaps.map((g, i) => (
              <li key={i}>
                <strong>{g.description}</strong>: {g.whatExistsOrIsDesired} vs. currently visible: {g.whatIsCurrentlyVisible}.{" "}
                {g.strategicImplication}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {output.hiddenStrengths && output.hiddenStrengths.length > 0 && (
        <Card title="Potential Hidden Strengths">
          <ul className="text-sm space-y-1">
            {output.hiddenStrengths.map((h, i) => (
              <li key={i}>
                <strong>{h.description}</strong> ({h.commerciallyRelevant}) — {h.reasoning}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {output.unsupportedAmbitions && output.unsupportedAmbitions.length > 0 && (
        <Card title="Unsupported Ambitions">
          <ul className="text-sm space-y-1">
            {output.unsupportedAmbitions.map((a, i) => (
              <li key={i}>
                <strong>{a.ambition}</strong> — {a.strategicImplication}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {output.underusedEvidence && output.underusedEvidence.length > 0 && (
        <Card title="Underused Evidence">
          <ul className="text-sm space-y-1">
            {output.underusedEvidence.map((u, i) => (
              <li key={i}>
                <strong>{u.evidence}</strong> — {u.opportunity}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {output.currentVsDesired && output.currentVsDesired.length > 0 && (
        <Card title="Current vs Desired">
          <Table
            headers={["Theme", "Current", "Desired", "Substance", "Gap", "Implication"]}
            rows={output.currentVsDesired.map((c) => [c.theme, c.current, c.desired, c.substance, c.gap, c.strategicImplication])}
          />
        </Card>
      )}
      {output.significanceClassification && output.significanceClassification.length > 0 && (
        <Card title="Strategic Significance Classification">
          <ul className="text-sm space-y-1">
            {output.significanceClassification.map((s, i) => (
              <li key={i}>
                <span className="uppercase text-xs font-medium mr-2">{s.classification}</span>
                {s.insight}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function StrategicFindingsView({ output }: { output?: StrategicFindingsOutput }) {
  if (!output) return null;
  return (
    <div className="space-y-4">
      <Card title="Major Strategic Findings">
        <ol className="space-y-3 list-decimal list-inside">
          {output.findings?.map((f, i) => (
            <li key={i} className="text-sm">
              <strong>{f.finding}</strong>
              <div className="text-xs text-neutral-500 mt-1 space-y-0.5">
                <div>Evidence: {f.evidence}</div>
                <div>Interpretation: {f.interpretation}</div>
                <div>Strategic significance: {f.strategicSignificance}</div>
                <div>Implication: {f.implication}</div>
              </div>
            </li>
          ))}
        </ol>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Current Position">{output.currentPosition}</Card>
        <Card title="Desired Position">{output.desiredPosition}</Card>
        <Card title="Central Perception Gap">{output.centralPerceptionGap}</Card>
        <Card title="Strategic Opportunity">{output.strategicOpportunity}</Card>
      </div>
      {output.perceptionMovement && (
        <Card title="Central Perception Movement (internal — not client-facing copy)">
          <div className="text-sm flex items-center gap-3">
            <span className="rounded bg-neutral-100 dark:bg-neutral-800 px-2 py-1">{output.perceptionMovement.from}</span>
            <span>→</span>
            <span className="rounded bg-emerald-100 dark:bg-emerald-900/40 px-2 py-1">{output.perceptionMovement.to}</span>
          </div>
        </Card>
      )}
      {output.strategicJudgementRequired && output.strategicJudgementRequired.length > 0 && (
        <Card title="⚠ MGS Strategic Judgement Required">
          <ul className="text-sm space-y-3">
            {output.strategicJudgementRequired.map((j, i) => (
              <li key={i} className="border-l-2 border-red-400 pl-3">
                <div className="font-medium">{j.issue}</div>
                <div className="text-xs text-neutral-500">Evidence: {j.relevantEvidence}</div>
                <div className="text-xs text-neutral-500">Interpretations: {j.plausibleInterpretations?.join(" / ")}</div>
                <div className="text-xs">Decision needed: {j.decisionNeeded}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function StrategicDirectionView({ output }: { output?: StrategicDirectionOutput }) {
  if (!output) return null;
  return (
    <div className="space-y-4">
      <Card title="Strategic North Star">
        <p className="text-base font-medium">{output.northStar}</p>
        <p className="text-xs text-neutral-500 mt-1">{output.northStarRationale}</p>
      </Card>
      <Card title="Strategic Priorities">
        <ul className="text-sm space-y-2">
          {output.strategicPriorities?.map((p, i) => (
            <li key={i}>
              <strong>{p.priority}</strong> — {p.rationale}
              <div className="text-xs text-neutral-500">Evidence: {p.evidenceBasis}</div>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="12-Month Perception Goal">{output.twelveMonthPerceptionGoal}</Card>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card title="Build">
          <BulletList items={output.build} />
        </Card>
        <Card title="Protect">
          <BulletList items={output.protect} />
        </Card>
        <Card title="Reduce">
          <BulletList items={output.reduce} />
        </Card>
      </div>
    </div>
  );
}

function StrategicPillarsView({ output }: { output?: StrategicPillarsOutput }) {
  if (!output?.pillars) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {output.pillars.map((p, i) => (
        <Card key={i} title={p.name}>
          <p className="text-sm">{p.purpose}</p>
          <div className="text-xs mt-2 space-y-1">
            <div>
              <strong>Desired perception:</strong> {p.desiredPerception}
            </div>
            <div>
              <strong>Evidence:</strong> {p.evidence}
            </div>
            <BulletList label="Demonstration" items={p.demonstration} />
            <BulletList label="Boundaries" items={p.boundaries} />
          </div>
        </Card>
      ))}
    </div>
  );
}

function RoadmapView({ output }: { output?: RoadmapOutput }) {
  if (!output) return null;
  const section = (title: string, items?: { action?: string; method?: string; rationale: string }[]) => (
    <Card title={title}>
      <ul className="text-sm space-y-2">
        {items?.map((it, i) => (
          <li key={i}>
            <strong>{it.action ?? it.method}</strong> — {it.rationale}
          </li>
        ))}
      </ul>
    </Card>
  );
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {section("Align", output.align)}
      {section("Execute", output.execute)}
      {section("Improve", output.improve)}
    </div>
  );
}

function QualityAuditView({ output }: { output?: QualityAuditOutput }) {
  if (!output) return null;
  const audits: { title: string; pass?: boolean; issues?: { [k: string]: string }[] }[] = [
    { title: "Evidence Audit", pass: output.evidenceAudit?.pass, issues: output.evidenceAudit?.issues },
    { title: "Contradiction Audit", pass: output.contradictionAudit?.pass, issues: output.contradictionAudit?.issues },
    { title: "Genericness Audit", pass: output.genericnessAudit?.pass, issues: output.genericnessAudit?.issues },
    {
      title: "Reference Contamination Audit",
      pass: output.referenceContaminationAudit?.pass,
      issues: output.referenceContaminationAudit?.issues,
    },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {audits.map((a) => (
        <Card key={a.title} title={a.title}>
          <span
            className={`text-xs uppercase tracking-wide px-2 py-1 rounded ${
              a.pass
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
            }`}
          >
            {a.pass ? "Pass" : "Issues found"}
          </span>
          {a.issues && a.issues.length > 0 && (
            <ul className="text-sm mt-2 space-y-1">
              {a.issues.map((issue, i) => (
                <li key={i} className="text-neutral-600 dark:text-neutral-400">
                  {Object.values(issue).join(" — ")}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
    </div>
  );
}

function MarkdownView({ output, title }: { output?: MarkdownOutput; title: string }) {
  if (!output?.markdown) return null;
  return (
    <Card title={title}>
      <article className="prose prose-neutral dark:prose-invert prose-sm max-w-none">
        <ReactMarkdown>{output.markdown}</ReactMarkdown>
      </article>
    </Card>
  );
}
