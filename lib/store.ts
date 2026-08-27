import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type { Project, ProjectSummary, StageId } from "./types";
import { STAGE_ORDER } from "./pipeline/stages";

// v1.0 storage: one JSON file per project on local disk. This is an
// internal MGS tool, not a multi-tenant SaaS product — file-based
// storage keeps every project's full evidence chain human-inspectable
// (Part O — Internal Traceability) without standing up a database.
const DATA_DIR = path.join(process.cwd(), "data", "projects");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function projectPath(id: string) {
  return path.join(DATA_DIR, `${id}.json`);
}

export async function listProjects(): Promise<ProjectSummary[]> {
  await ensureDir();
  const files = await fs.readdir(DATA_DIR);
  const summaries: ProjectSummary[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const project = JSON.parse(
      await fs.readFile(path.join(DATA_DIR, file), "utf-8")
    ) as Project;
    let furthestStage: StageId | null = null;
    for (const stageId of STAGE_ORDER) {
      if (project.stages[stageId]?.status === "complete") furthestStage = stageId;
    }
    summaries.push({
      id: project.id,
      clientName: project.clientName,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      isReferenceCase: project.isReferenceCase,
      reviewStatus: project.review.status,
      furthestStage,
    });
  }
  summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return summaries;
}

export async function getProject(id: string): Promise<Project | null> {
  await ensureDir();
  try {
    const raw = await fs.readFile(projectPath(id), "utf-8");
    return JSON.parse(raw) as Project;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function saveProject(project: Project): Promise<void> {
  await ensureDir();
  project.updatedAt = new Date().toISOString();
  await fs.writeFile(projectPath(project.id), JSON.stringify(project, null, 2));
}

export async function createProject(clientName: string): Promise<Project> {
  const now = new Date().toISOString();
  const project: Project = {
    id: randomUUID(),
    clientName,
    createdAt: now,
    updatedAt: now,
    isReferenceCase: false,
    sources: [],
    stages: {},
    review: { status: "not_started", decisions: [] },
  };
  await saveProject(project);
  return project;
}

export async function deleteProject(id: string): Promise<void> {
  await ensureDir();
  try {
    await fs.unlink(projectPath(id));
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

// Returns every project marked as a reference case (PDMS), for the
// Reference Contamination Audit — Part J / Part P.
export async function listReferenceCases(excludeId?: string): Promise<Project[]> {
  const summaries = await listProjects();
  const refs: Project[] = [];
  for (const s of summaries) {
    if (!s.isReferenceCase || s.id === excludeId) continue;
    const p = await getProject(s.id);
    if (p) refs.push(p);
  }
  return refs;
}
