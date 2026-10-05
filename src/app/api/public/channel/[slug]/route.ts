import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const company = await prisma.company.findFirst({ where: { slug, active: true }, select: { id: true, name: true, units: { where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }, departments: { where: { active: true }, select: { name: true }, orderBy: { name: "asc" } } } });
  if (!company) return NextResponse.json({ error: "Canal indisponível." }, { status: 404 });
  const categories = await prisma.complaintCategory.findMany({ where: { active: true, OR: [{ companyId: company.id }, { companyId: null }] }, select: { name: true }, orderBy: { name: "asc" } });
  return NextResponse.json({ name: company.name, units: company.units.map(x => x.name), departments: company.departments.map(x => x.name), categories: [...new Set(categories.map(x => x.name))] });
}
