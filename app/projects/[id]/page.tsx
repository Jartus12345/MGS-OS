import { notFound } from "next/navigation";
import { getProject } from "@/lib/store";
import ProjectDashboard from "@/components/ProjectDashboard";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  return <ProjectDashboard initialProject={project} />;
}
