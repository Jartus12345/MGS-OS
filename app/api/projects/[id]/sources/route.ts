import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getProject, saveProject } from "@/lib/store";
import { extractTextFromFile } from "@/lib/extract";
import type { Source, SourceType } from "@/lib/types";

const VALID_TYPES: SourceType[] = [
  "company_context",
  "leadership_discovery",
  "employee_survey",
  "digital_credibility_scorecard",
  "additional",
];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const contentType = req.headers.get("content-type") ?? "";
  let type: string;
  let label: string;
  let producedBy: string | undefined;
  let purpose: string | undefined;
  let rawText = "";
  let fileName: string | undefined;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    type = String(form.get("type") ?? "");
    label = String(form.get("label") ?? "");
    producedBy = form.get("producedBy") ? String(form.get("producedBy")) : undefined;
    purpose = form.get("purpose") ? String(form.get("purpose")) : undefined;
    const file = form.get("file");
    if (file instanceof File) {
      fileName = file.name;
      const buffer = Buffer.from(await file.arrayBuffer());
      rawText = await extractTextFromFile(file.name, buffer);
    } else {
      rawText = String(form.get("rawText") ?? "");
    }
  } else {
    const body = await req.json();
    type = String(body.type ?? "");
    label = String(body.label ?? "");
    producedBy = body.producedBy || undefined;
    purpose = body.purpose || undefined;
    rawText = String(body.rawText ?? "");
  }

  if (!VALID_TYPES.includes(type as SourceType)) {
    return NextResponse.json({ error: `Invalid source type: ${type}` }, { status: 400 });
  }
  if (!label.trim()) {
    return NextResponse.json({ error: "label is required." }, { status: 400 });
  }
  if (!rawText.trim()) {
    return NextResponse.json({ error: "No text content found for this source." }, { status: 400 });
  }
  // Part F — optional additional evidence must be classified before it is
  // treated as authoritative: who produced it, and why.
  if (type === "additional" && (!producedBy || !purpose)) {
    return NextResponse.json(
      { error: "Additional evidence requires producedBy and purpose before it can be classified." },
      { status: 400 }
    );
  }

  const source: Source = {
    id: randomUUID(),
    type: type as SourceType,
    label: label.trim(),
    fileName,
    rawText,
    producedBy,
    purpose,
    legitimateEvidenceType: "unclassified",
    uploadedAt: new Date().toISOString(),
  };

  project.sources.push(source);
  // Uploading new evidence invalidates any downstream analysis already run.
  project.stages = {};
  await saveProject(project);

  return NextResponse.json({ project }, { status: 201 });
}
