import HomeClient from "@/components/HomeClient";
import { listProjects } from "@/lib/store";

export default async function Home() {
  const projects = await listProjects();
  return <HomeClient initialProjects={projects} />;
}
