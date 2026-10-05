import { NextResponse } from "next/server";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { currentSession } from "@/lib/session";
const scrypt = promisify(scryptCallback);
const userSchema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254), password: z.string().min(12).max(200), role: z.enum(["CLIENT_ADMIN", "ANALYST"]) });
export async function GET() {
  const session = await currentSession(); if (!session) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  if (!session.companyId || session.role !== "CLIENT_ADMIN") return NextResponse.json({ error: "Somente o administrador do cliente pode administrar usuários." }, { status: 403 });
  const users = await prisma.user.findMany({ where: { companyId: session.companyId }, select: { id: true, name: true, email: true, role: true, active: true, createdAt: true }, orderBy: { name: "asc" } });
  return NextResponse.json(users);
}
export async function POST(request: Request) {
  const session = await currentSession(); if (!session) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  if (!session.companyId || session.role !== "CLIENT_ADMIN") return NextResponse.json({ error: "Somente o administrador do cliente pode criar usuários." }, { status: 403 });
  const parsed = userSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Confira os dados e use uma senha com pelo menos 12 caracteres." }, { status: 400 });
  const salt = randomBytes(16).toString("hex"); const passwordHash = `${salt}:${(await scrypt(parsed.data.password, salt, 64) as Buffer).toString("hex")}`;
  try { const user = await prisma.user.create({ data: { ...parsed.data, email: parsed.data.email.toLowerCase(), passwordHash, mustChangePassword: true, companyId: session.companyId, role: parsed.data.role as Role, roleAssignments: { create: { role: parsed.data.role as Role } } }, select: { id: true, name: true, email: true, role: true, active: true } }); await prisma.auditLog.create({ data: { userId: session.userId, companyId: session.companyId, action: "user.created", entityType: "User", entityId: user.id } }); return NextResponse.json(user, { status: 201 }); }
  catch { return NextResponse.json({ error: "Este e-mail já está cadastrado." }, { status: 409 }); }
}
