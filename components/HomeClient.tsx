"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProjectSummary } from "@/lib/types";
import { getStageMeta } from "@/lib/pipeline/stages";

const REVIEW_LABEL: Record<string, string> = {
  not_started: "Not started",
  awaiting_review: "Awaiting MGS Review",
  changes_requested: "Changes Requested",
  internally_approved: "Internally Approved",
  client_approved: "Client Approved",
};

export default function HomeClient({ initialProjects }: { initialProjects: ProjectSummary[] }) {
  const projects = initialProjects;
  const [clientName, setClientName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create project.");
      router.push(`/projects/${data.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-10">
      <header className="space-y-2">
        <p className="text-xs font-semibold tracking-widest text-neutral-500 uppercase">
          Manx Growth Solutions
        </p>
        <h1 className="text-3xl font-semibold">MGS Client Strategy System v1.0</h1>
        <p className="max-w-3xl text-neutral-600 dark:text-neutral-400">
          Internal strategic analysis application powering the <strong>DISCOVER</strong> stage of the
          MGS client process (Discover → Align → Execute → Improve). This system preserves the
          integrity of each evidence source, analyses it systematically, and helps MGS turn genuine
          research into a defensible Client Brand Direction &amp; Strategy. It does not invent the
          substance — the substance comes from the research.
        </p>
      </header>

      <section className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-6 space-y-4">
        <h2 className="text-lg font-medium">New Client Strategy Project</h2>
        <form onSubmit={createProject} className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-neutral-600 dark:text-neutral-400">Client name</label>
            <input
              className="border border-neutral-300 dark:border-neutral-700 rounded px-3 py-2 bg-transparent min-w-64"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. PDMS"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="rounded bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create project"}
          </button>
        </form>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <p className="text-xs text-neutral-500">
          After creating a project you will be asked to provide the four core Discovery inputs:
          Company Context, Strategic Business Discovery (leadership), Employee Brand Survey, and the
          Digital Credibility Scorecard — plus any optional additional evidence.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Client Projects</h2>
        {projects.length === 0 ? (
          <p className="text-sm text-neutral-500">No projects yet. Create the first one above.</p>
        ) : (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
            {projects.map((p) => (
              <a
                key={p.id}
                href={`/projects/${p.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-900"
              >
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {p.clientName}
                    {p.isReferenceCase && (
                      <span className="text-[10px] uppercase tracking-wide bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 rounded">
                        Reference case
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-500">
                    Updated {new Date(p.updatedAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-neutral-600 dark:text-neutral-400">
                  <span>{p.furthestStage ? getStageMeta(p.furthestStage).name : "Not started"}</span>
                  <span className="rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-1">
                    {REVIEW_LABEL[p.reviewStatus]}
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
