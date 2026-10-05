import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentSession } from "@/lib/session";
export async function GET(request: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  if (session.role === "SUPER_ADMIN" || !session.companyId) return NextResponse.json({ error: "Escopo empresarial necessário." }, { status: 403 });
  if (session.role === "VIEWER") return NextResponse.json({ error: "Este perfil acessa apenas dashboards e relatórios." }, { status: 403 });
  const url = new URL(request.url); const page = Math.max(1, Number(url.searchParams.get("page")) || 1); const take = Math.min(100, Math.max(1, Number(url.searchParams.get("take")) || 20));
  const where = { companyId: session.companyId };
  const [total, items] = await Promise.all([prisma.complaint.count({ where }), prisma.complaint.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take, select: { id: true, publicInternalCode: true, createdAt: true, category: { select: { name: true } }, unit: { select: { name: true } }, department: { select: { name: true } }, analysis: { select: { status: true, severity: true, assignedUser: { select: { name: true } }, updatedAt: true } } } })]);
  return NextResponse.json({ total, page, pages: Math.ceil(total / take), items });
}
