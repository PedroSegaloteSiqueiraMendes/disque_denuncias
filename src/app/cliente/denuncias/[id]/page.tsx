import { ComplaintDetail } from "@/components/complaint-detail";
export default async function ComplaintPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <ComplaintDetail identifier={id} />; }
