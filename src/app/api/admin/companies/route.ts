import { NextResponse } from "next/server";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { currentSession } from "@/lib/session";
const scrypt = promisify(scryptCallback);
const companySchema = z.object({ name: z.string().trim().min(2).max(120), legalName: z.string().trim().max(160).optional(), cnpj: z.string().trim().max(24).optional(), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(80), adminName: z.string().trim().min(2).max(120), adminEmail: z.string().trim().email().max(254), adminPassword: z.string().min(12).max(200) });
async function requireSuperAdmin() { const session = await currentSession(); return session?.role === "SUPER_ADMIN" ? session : null; }
export async function GET() {
  const session = await requireSuperAdmin(); if (!session) return NextResponse.json({ error: "Acesso restrito ao Super Admin." }, { status: 403 });
  const companies = await prisma.company.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { users: true, complaints: true } }, users: { where: { role: Role.CLIENT_ADMIN }, orderBy: { createdAt: "asc" }, take: 1, select: { name: true, email: true } } } });
  return NextResponse.json(companies.map(({ id, name, legalName, cnpj, slug, active, createdAt, _count, users }) => ({ id, name, legalName, cnpj, slug, active, createdAt, users: _count.users, complaints: _count.complaints, adminName: users[0]?.name ?? null, adminEmail: users[0]?.email ?? null })));
}
export async function POST(request: Request) {
  const session = await requireSuperAdmin(); if (!session) return NextResponse.json({ error: "Acesso restrito ao Super Admin." }, { status: 403 });
  const parsed = companySchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Confira os dados da empresa e o slug." }, { status: 400 });
  try {
    const salt = randomBytes(16).toString("hex"); const passwordHash = `${salt}:${(await scrypt(parsed.data.adminPassword, salt, 64) as Buffer).toString("hex")}`;
    const { adminName, adminEmail, adminPassword: _secret, ...companyData } = parsed.data;
    const company = await prisma.company.create({ data: { ...companyData, cnpj: companyData.cnpj || null, users: { create: { name: adminName, email: adminEmail.toLowerCase(), passwordHash, mustChangePassword: true, role: Role.CLIENT_ADMIN, roleAssignments: { create: { role: Role.CLIENT_ADMIN } } } }, categories: { create: ["Assédio moral", "Assédio sexual", "Discriminação", "Fraude", "Corrupção", "Conflito de interesses", "Agressão ou ameaça", "Violação de normas internas", "Segurança do trabalho", "Comportamento inadequado", "Outro", "Não sei classificar"].map(name => ({ name })) } } });
    await prisma.auditLog.create({ data: { userId: session.userId, action: "company.created", entityType: "Company", entityId: company.id } });
    return NextResponse.json({ id: company.id, name: company.name, slug: company.slug, active: company.active }, { status: 201 });
  } catch { return NextResponse.json({ error: "Este slug ou CNPJ já está cadastrado." }, { status: 409 }); }
}
