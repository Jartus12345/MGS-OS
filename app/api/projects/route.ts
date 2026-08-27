import { NextRequest, NextResponse } from "next/server";
import { listProjects, createProject } from "@/lib/store";

export async function GET() {
  const projects = await listProjects();
  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const clientName = typeof body.clientName === "string" ? body.clientName.trim() : "";
  if (!clientName) {
    return NextResponse.json({ error: "clientName is required." }, { status: 400 });
  }
  const project = await createProject(clientName);
  return NextResponse.json({ project }, { status: 201 });
}
