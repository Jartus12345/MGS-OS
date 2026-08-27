"use client";

import { useState } from "react";
import type { Project, SourceType } from "@/lib/types";
import { discoveryCompleteness } from "@/lib/discovery";

const TYPE_LABELS: Record<SourceType, string> = {
  company_context: "Company Context",
  leadership_discovery: "Strategic Business Discovery (Leadership)",
  employee_survey: "Employee Brand Survey",
  digital_credibility_scorecard: "Digital Credibility Scorecard",
  additional: "Additional Evidence",
};

export default function SourceLibrary({
  project,
  onUpdated,
}: {
  project: Project;
  onUpdated: (project: Project) => void;
}) {
  const completeness = discoveryCompleteness(project);

  const [type, setType] = useState<SourceType>("company_context");
  const [label, setLabel] = useState("");
  const [producedBy, setProducedBy] = useState("");
  const [purpose, setPurpose] = useState("");
  const [rawText, setRawText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addSource(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("type", type);
      form.set("label", label);
      if (producedBy) form.set("producedBy", producedBy);
      if (purpose) form.set("purpose", purpose);
      if (file) form.set("file", file);
      else form.set("rawText", rawText);

      const res = await fetch(`/api/projects/${project.id}/sources`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add source.");
      onUpdated(data.project);
      setLabel("");
      setProducedBy("");
      setPurpose("");
      setRawText("");
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function removeSource(sourceId: string) {
    const res = await fetch(`/api/projects/${project.id}/sources/${sourceId}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) onUpdated(data.project);
  }

  return (
    <div className="space-y-8">
      <section>
        <h3 className="font-medium mb-2">Discovery Completeness</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {completeness.map((c) => (
            <div
              key={c.type}
              className={`rounded border p-3 text-sm ${
                c.complete
                  ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
                  : "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{c.label}</span>
                <span className="text-xs uppercase tracking-wide">
                  {c.complete ? `Complete (${c.count})` : "Missing"}
                </span>
              </div>
              {!c.complete && <p className="text-xs mt-1 text-neutral-600 dark:text-neutral-400">{c.limitation}</p>}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-medium mb-2">Add Evidence Source</h3>
        <form onSubmit={addSource} className="space-y-3 rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              Source type
              <select
                className="border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1.5 bg-transparent"
                value={type}
                onChange={(e) => setType(e.target.value as SourceType)}
              >
                {Object.entries(TYPE_LABELS).map(([value, l]) => (
                  <option key={value} value={value}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Label
              <input
                className="border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1.5 bg-transparent"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Leadership discovery transcript"
              />
            </label>
          </div>

          {type === "additional" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                Produced by
                <input
                  className="border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1.5 bg-transparent"
                  value={producedBy}
                  onChange={(e) => setProducedBy(e.target.value)}
                  placeholder="Who produced this document?"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Purpose
                <input
                  className="border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1.5 bg-transparent"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Why was it produced?"
                />
              </label>
            </div>
          )}

          <label className="flex flex-col gap-1 text-sm">
            Upload a file (PDF / DOCX / TXT / MD)
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md,.csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          {!file && (
            <label className="flex flex-col gap-1 text-sm">
              Or paste text directly
              <textarea
                className="border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1.5 bg-transparent min-h-28"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
              />
            </label>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? "Adding…" : "Add source"}
          </button>
          <p className="text-[11px] text-neutral-500">
            Adding or removing a source clears any analysis already run, since downstream stages must
            always reflect the current evidence set.
          </p>
        </form>
      </section>

      <section>
        <h3 className="font-medium mb-2">Sources ({project.sources.length})</h3>
        {project.sources.length === 0 ? (
          <p className="text-sm text-neutral-500">No sources uploaded yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
            {project.sources.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <div>
                  <div className="font-medium">{s.label}</div>
                  <div className="text-xs text-neutral-500">
                    {TYPE_LABELS[s.type]}
                    {s.fileName ? ` · ${s.fileName}` : ""} · {s.rawText.length.toLocaleString()} chars
                    {s.producedBy ? ` · produced by ${s.producedBy}` : ""}
                  </div>
                </div>
                <button onClick={() => removeSource(s.id)} className="text-xs text-red-600 hover:underline">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
