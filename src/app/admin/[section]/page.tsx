import { AdminPortal } from "@/components/admin-portal";
export default async function AdminPage({ params }: { params: Promise<{ section: string }> }) { const { section } = await params; return <AdminPortal section={section} />; }
