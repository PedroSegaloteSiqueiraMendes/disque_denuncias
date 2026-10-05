import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentSession } from "@/lib/session";
export async function GET() {
  const session = await currentSession(); if (!session) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  if (!session.companyId || session.role === "SUPER_ADMIN") return NextResponse.json({ error: "Escopo empresarial necessário." }, { status: 403 });
  const [units, departments, categories] = await Promise.all([
    prisma.unit.findMany({ where: { companyId: session.companyId, active: true }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { companyId: session.companyId, active: true }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.complaintCategory.findMany({ where: { active: true, OR: [{ companyId: session.companyId }, { companyId: null }] }, select: { name: true }, orderBy: { name: "asc" } })
  ]);
  return NextResponse.json({ units: units.map(x => x.name), departments: departments.map(x => x.name), categories: [...new Set(categories.map(x => x.name))] });
}
