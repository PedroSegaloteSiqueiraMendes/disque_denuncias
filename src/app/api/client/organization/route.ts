import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentSession } from "@/lib/session";
const schema = z.object({ kind: z.enum(["unit", "department", "category"]), name: z.string().trim().min(2).max(100), description: z.string().trim().max(500).optional(), icon: z.string().trim().max(60).optional() });
const editSchema = z.object({ kind: z.enum(["unit", "department", "category"]), id: z.string().min(1), active: z.boolean() });
export async function GET() {
  const session = await currentSession(); if (!session) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  if (!session.companyId || session.role === "SUPER_ADMIN") return NextResponse.json({ error: "Escopo empresarial necessário." }, { status: 403 });
  if (session.role !== "CLIENT_ADMIN") return NextResponse.json({ error: "Somente o administrador do cliente pode acessar as configurações." }, { status: 403 });
  const [units, departments, categories, company] = await Promise.all([prisma.unit.findMany({ where: { companyId: session.companyId }, orderBy: { name: "asc" } }), prisma.department.findMany({ where: { companyId: session.companyId }, orderBy: { name: "asc" } }), prisma.complaintCategory.findMany({ where: { companyId: session.companyId }, orderBy: { name: "asc" } }), prisma.company.findUnique({ where: { id: session.companyId }, select: { logoData: true } })]);
  return NextResponse.json({ units, departments, categories, logoData: company?.logoData ?? null });
}
export async function POST(request: Request) {
  const session = await currentSession(); if (!session) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  if (!session.companyId || session.role !== "CLIENT_ADMIN") return NextResponse.json({ error: "Somente o administrador do cliente pode editar a estrutura." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Confira o tipo e o nome informado." }, { status: 400 });
  const { kind, name, description, icon } = parsed.data; const companyId = session.companyId;
  if (kind === "category" && await prisma.complaintCategory.findFirst({ where: { name } })) return NextResponse.json({ error: "Uma categoria com este nome já existe na plataforma." }, { status: 409 });
  try {
    const row = kind === "unit" ? await prisma.unit.create({ data: { name, companyId } }) : kind === "department" ? await prisma.department.create({ data: { name, companyId } }) : await prisma.complaintCategory.create({ data: { name, companyId, description, icon } });
    await prisma.auditLog.create({ data: { userId: session.userId, companyId, action: `${kind}.created`, entityType: kind, entityId: row.id } });
    return NextResponse.json(row, { status: 201 });
  } catch { return NextResponse.json({ error: "Este nome já está cadastrado para a empresa." }, { status: 409 }); }
}
export async function PATCH(request: Request) {
  const session = await currentSession(); if (!session) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  if (!session.companyId || session.role !== "CLIENT_ADMIN") return NextResponse.json({ error: "Somente o administrador do cliente pode editar a estrutura." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (body && Object.hasOwn(body, "logoData")) {
    if (typeof body.logoData !== "string" || body.logoData.length > 700000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(body.logoData)) return NextResponse.json({ error: "Envie PNG, JPG ou WebP até 500 KB." }, { status: 400 });
    await prisma.company.update({ where: { id: session.companyId }, data: { logoData: body.logoData } });
    await prisma.auditLog.create({ data: { userId: session.userId, companyId: session.companyId, action: "company.logo.updated", entityType: "Company", entityId: session.companyId } });
    return NextResponse.json({ success: true });
  }
  const parsed = editSchema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const { kind, id, active } = parsed.data; const where = { id, companyId: session.companyId };
  const changed = kind === "unit" ? await prisma.unit.updateMany({ where, data: { active } }) : kind === "department" ? await prisma.department.updateMany({ where, data: { active } }) : await prisma.complaintCategory.updateMany({ where, data: { active } });
  if (!changed.count) return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
  await prisma.auditLog.create({ data: { userId: session.userId, companyId: session.companyId, action: `${kind}.${active ? "activated" : "deactivated"}`, entityType: kind, entityId: id } }); return NextResponse.json({ success: true });
}
