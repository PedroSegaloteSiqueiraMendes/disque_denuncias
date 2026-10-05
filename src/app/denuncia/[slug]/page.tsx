import { PublicPortal } from "@/components/public-portal";

export default async function ComplaintPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicPortal slug={slug} />;
}
