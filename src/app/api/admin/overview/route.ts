import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentSession } from "@/lib/session";
async function allowed() { const session = await currentSession(); return session?.role === "SUPER_ADMIN" ? session : null; }
export async function GET() {
  if (!await allowed()) return NextResponse.json({ error: "Acesso restrito ao Super Admin." }, { status: 403 });
  const [users, categories, companies] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, active: true, company: { select: { name: true } } }, orderBy: { name: "asc" } }),
    prisma.complaintCategory.findMany({ where: { companyId: null }, select: { id: true, name: true, description: true, active: true }, orderBy: { name: "asc" } }),
    prisma.company.findMany({ select: { id: true, name: true, slug: true, active: true, createdAt: true, _count: { select: { users: true, complaints: true } } }, orderBy: { createdAt: "desc" } })
  ]);
  return NextResponse.json({ users: users.map(u => ({ ...u, company: u.company?.name ?? "Focus Solutions" })), categories, companies: companies.map(c => ({ id: c.id, name: c.name, slug: c.slug, active: c.active, createdAt: c.createdAt, users: c._count.users, complaints: c._count.complaints })) });
}
export async function POST(request: Request) {
  const session = await allowed(); if (!session) return NextResponse.json({ error: "Acesso restrito ao Super Admin." }, { status: 403 });
  const parsed = z.object({ name: z.string().trim().min(2).max(100), description: z.string().trim().max(500).optional(), icon: z.string().trim().max(60).optional() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Informe um nome válido." }, { status: 400 });
  const duplicate = await prisma.complaintCategory.findFirst({ where: { companyId: null, name: parsed.data.name } }); if (duplicate) return NextResponse.json({ error: "Esta categoria global já existe." }, { status: 409 });
  const category = await prisma.complaintCategory.create({ data: { ...parsed.data, companyId: null } });
  await prisma.auditLog.create({ data: { userId: session.userId, action: "global-category.created", entityType: "ComplaintCategory", entityId: category.id } }); return NextResponse.json(category, { status: 201 });
}
export async function PATCH(request: Request) {
  const session = await allowed(); if (!session) return NextResponse.json({ error: "Acesso restrito ao Super Admin." }, { status: 403 });
  const parsed = z.object({ id: z.string().min(1), active: z.boolean() }).safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const result = await prisma.complaintCategory.updateMany({ where: { id: parsed.data.id, companyId: null }, data: { active: parsed.data.active } }); if (!result.count) return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 });
  await prisma.auditLog.create({ data: { userId: session.userId, action: parsed.data.active ? "global-category.activated" : "global-category.deactivated", entityType: "ComplaintCategory", entityId: parsed.data.id } }); return NextResponse.json({ success: true });
}
