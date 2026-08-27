"use client";

import { useState } from "react";
import type { Project, StageId, StageRecord } from "@/lib/types";
import { getStageMeta } from "@/lib/pipeline/stages";

export function StagePanel({
  project,
  stageId,
  onUpdated,
  runLabel,
  children,
}: {
  project: Project;
  stageId: StageId;
  onUpdated: (project: Project) => void;
  runLabel?: string;
  children: (record: StageRecord | undefined) => React.ReactNode;
}) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const meta = getStageMeta(stageId);
  const record = project.stages[stageId];

  const unmetDeps = meta.dependsOn.filter((d) => project.stages[d]?.status !== "complete");

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/stage/${stageId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Stage failed.");
      onUpdated(data.project);
      if (data.stage.status === "error") setError(data.stage.error ?? "Stage failed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 space-y-2">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-medium">{meta.name}</h3>
            <p className="text-xs text-neutral-500 max-w-2xl">{meta.description}</p>
            <p className="text-[11px] text-neutral-400 mt-1">
              Canonical pipeline steps: {meta.canonicalSteps.join(" · ")}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <StatusBadge status={record?.status} />
            {unmetDeps.length > 0 ? (
              <span className="text-xs text-neutral-500">
                Waiting on: {unmetDeps.map((d) => getStageMeta(d).name).join(", ")}
              </span>
            ) : meta.requiresLLM || !record || record.status !== "complete" ? (
              <button
                onClick={run}
                disabled={running}
                className="rounded bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                {running
                  ? "Running…"
                  : record?.status === "complete"
                  ? "Re-run"
                  : runLabel ?? `Run ${meta.name}`}
              </button>
            ) : null}
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {record?.usage && (
          <p className="text-[11px] text-neutral-400">
            {record.model} · {record.usage.input_tokens.toLocaleString()} in /{" "}
            {record.usage.output_tokens.toLocaleString()} out tokens
          </p>
        )}
      </div>
      {record?.status === "complete" && children(record)}
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, string> = {
    complete: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    running: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    error: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    pending: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  };
  const label = status ?? "pending";
  return (
    <span className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded ${map[label] ?? map.pending}`}>
      {label}
    </span>
  );
}

export function JsonBlock({ value }: { value: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="text-xs">
      <button className="text-neutral-500 underline" onClick={() => setOpen((o) => !o)}>
        {open ? "Hide raw JSON" : "Show raw JSON (traceability)"}
      </button>
      {open && (
        <pre className="mt-2 max-h-96 overflow-auto rounded bg-neutral-100 dark:bg-neutral-900 p-3 whitespace-pre-wrap">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  );
}
