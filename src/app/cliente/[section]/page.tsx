import { redirect } from "next/navigation";
import { Portal } from "@/components/portal";
const sections = ["dashboard", "denuncias", "configuracoes"];
export default async function ClientPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.includes(section)) redirect("/cliente/dashboard");
  return <Portal section={section} />;
}
