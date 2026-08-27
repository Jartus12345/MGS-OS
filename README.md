# MGS Client Strategy System v1.0

Internal strategic analysis application for **Manx Growth Solutions Limited (MGS)**. It powers the
**DISCOVER** stage of the MGS client process (Discover → Align → Execute → Improve): it preserves the
integrity of each primary-research evidence source, analyses it systematically, and helps MGS turn
genuine research into a defensible **Client Brand Direction & Strategy**.

The AI is not responsible for inventing the substance. The substance comes from the research MGS
supplies. MGS remains responsible for final strategic judgement and client approval — see the
Human Review Gate below.

## The three-layer system (v1.1 correction)

The PDMS validation run exposed a real failure mode: the pipeline was proving it could analyse
evidence correctly and then stopping there, instead of using that analysis to make a commercially
relevant strategic call. `lib/methodology/component9-weighting-and-layers.md` is the correction, and
every stage from Strategic Diagnosis onward now runs against it. Two ideas anchor it:

- **Evidence strength ≠ strategic significance.** A theme that recurs often in one source (typically
  the Employee Survey) does not automatically deserve to define the strategy. Every candidate finding
  is scored against four tests — evidence strength, commercial significance, perception significance,
  MGS relevance — and leadership's Strategic Business Discovery sets the commercial destination that
  employee and external evidence corroborate, qualify or challenge, not one that a frequent theme gets
  to override.
- **Three layers, one reasoning.** Layer 1 (Source Library → Independent Analysis → Cross-Analysis →
  Quality Control, tagged `Layer 1` in the dashboard) is the internal reasoning engine — useful, never
  the principal client output. Layer 2 (Strategic Diagnosis → Strategic Direction → Strategic Pillars →
  Roadmap → the Master Client Strategy document, tagged `Layer 2`) is the strategic source of truth
  built from Layer 1. Layer 3 (the Executive Brand Direction, tagged `Layer 3`) is its senior-leadership
  expression. Layer 2 and Layer 3 read as professional strategic writing — they do not expose Layer 1's
  internal tags (FACT / LEADERSHIP INTENT / evidence-strength labels) or dump its full register.

## The eight locked components

The methodology is encoded, verbatim in spirit, as eight distinct components under `lib/methodology/`:

1. **MGS Client Strategy Framework v1.0** — `component1-framework.md` — the section structure of the
   final strategy.
2. **MGS Research Analysis Protocol v1.0** — `component2-research-protocol.md` — what each of the four
   core inputs can and cannot establish.
3. **MGS Cross-Analysis Methodology v1.0** — `component3-cross-analysis.md` — how independent sources
   are compared to generate strategic insight.
4. **MGS Evidence & Claim Rules v1.0** — `component4-evidence-rules.md` — what the system may and may
   not claim. Injected into every LLM call.
5. **MGS Writing Standard v1.0** — `component5-writing-standard.md` — how MGS strategy documents sound.
6. **MGS Output Specification v1.0** — `component6-output-spec.md` — the Master Strategy and Executive
   Brand Direction structures.
7. **MGS AI Analysis Pipeline v1.0** — `lib/pipeline/stages.ts` — the exact order of analysis, encoded
   as a dependency-checked stage graph (`STAGES`) rather than prose.
8. **MGS Human Review Gate v1.0** — `component8-review-gate.md` + `components/ReviewGate.tsx` — nothing
   is ever automatically labelled final.
9. **MGS System Correction & Recalibration v1.1** — `component9-weighting-and-layers.md` — the
   evidence-weighting and three-layer correction described above; injected into every stage from
   Cross-Analysis onward.

## Architecture

- **Next.js 16 (App Router) + TypeScript + Tailwind.**
- **Storage:** one JSON file per project under `data/projects/<id>.json` (`lib/store.ts`). This is an
  internal tool, not a multi-tenant product — file-based storage keeps every project's full evidence
  chain human-inspectable without standing up a database. This directory is gitignored; only `.gitkeep`
  is committed.
- **Evidence ingestion:** `lib/extract.ts` reads PDF (`pdf-parse`), DOCX (`mammoth`) and plain text/
  Markdown uploads into raw text stored on the `Source`.
- **Pipeline:** `lib/pipeline/stages.ts` defines the stage graph and its dependencies;
  `lib/pipeline/prompts.ts` builds each stage's system/user prompt from the methodology files plus
  prior-stage output; `lib/pipeline/run.ts` executes one stage via `lib/anthropic.ts`
  (`@anthropic-ai/sdk`, model `claude-opus-5`, adaptive thinking, high effort) and stores the parsed
  JSON result on the project so every finding stays traceable back to its evidence
  (Part O — Internal Traceability).
- **API routes** under `app/api/projects/...` are thin wrappers around the store and pipeline — no
  business logic lives in route handlers.
- **UI** (`components/ProjectDashboard.tsx` and friends) mirrors the Part M workspace: Overview,
  Source Library, Independent Analysis, Cross-Analysis, Strategic Diagnosis, Strategic Direction,
  Roadmap, Outputs, Quality Control, MGS Review.

## Running locally

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...   # or `ant auth login`
npm run dev
```

Open http://localhost:3000, create a client project, upload the four core Discovery inputs (Company
Context, Strategic Business Discovery, Employee Brand Survey, Digital Credibility Scorecard) plus any
optional additional evidence, then run the pipeline stage by stage from the dashboard.

## The pipeline, in order

Independent analysis always runs before any reconciliation. Cross-analysis always runs before
diagnosis. Diagnosis always precedes direction. Direction precedes pillars. Pillars precede the
roadmap. Every quality audit runs before the writing pass. The Master Strategy is always generated
before the Executive Brand Direction. The pipeline always terminates in
**AWAITING MGS HUMAN REVIEW** — never "final".

| # | Stage | Canonical pipeline steps |
|---|-------|---------------------------|
| 1 | Ingest | 1. INGEST |
| 2 | Extract & Classify Evidence | 2. EXTRACT · 3. CLASSIFY |
| 3 | Independent Source Analysis | 4. INDEPENDENT ANALYSIS |
| 4 | Cross-Analysis | 5. THEME EXTRACTION · 6. CROSS-ANALYSIS · 7. CURRENT vs DESIRED · 8. PRIORITISE |
| 5 | Strategic Diagnosis | 9. STRATEGIC FINDINGS · 10. CENTRAL DIAGNOSIS · 11. PERCEPTION MOVEMENT |
| 6 | Strategic Direction | 12. STRATEGIC DIRECTION |
| 7 | Strategic Pillars | 13. STRATEGIC PILLARS |
| 8 | 12-Month Roadmap | 14. ROADMAP |
| 9 | Quality Control Audits | 15. EVIDENCE AUDIT · 16. CONTRADICTION AUDIT · 17. GENERICNESS AUDIT · 18. REFERENCE CONTAMINATION AUDIT · WEIGHTING AUDIT |
| 10 | Master Client Strategy | 19. WRITING PASS · 20. MASTER STRATEGY |
| 11 | Executive Brand Direction | 21. EXECUTIVE BRAND DIRECTION |
| 12 | MGS Human Review Gate | 22. HUMAN REVIEW |

## PDMS as the reference case

Mark a project as a **reference case** (toggle on its dashboard) to make its completed Master Strategy
available to the Quality Control → Reference Contamination Audit on *other* projects. A reference case
demonstrates the expected **standard** of work — depth, evidence discipline, restraint, writing quality
— never the answer for another client. The audit stage explicitly checks whether a concept, phrase or
recommendation entered a client's strategy because it existed in a reference case rather than because
that client's own evidence supports it.
