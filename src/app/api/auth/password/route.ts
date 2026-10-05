import { NextResponse } from "next/server";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentSession, issueSession, sessionCookie } from "@/lib/session";
import { rateLimited } from "@/lib/rate-limit";
const scrypt = promisify(scryptCallback);
const passwordSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(12).max(200) });

export async function POST(request: Request) {
  if (rateLimited(request, "password", 8, 15 * 60 * 1000)) return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  const session = await currentSession(); if (!session) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  const parsed = passwordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A nova senha precisa ter ao menos 12 caracteres." }, { status: 400 });
  const { currentPassword, newPassword } = parsed.data;
  if (currentPassword === newPassword) return NextResponse.json({ error: "A nova senha deve ser diferente da atual." }, { status: 400 });
  const user = await prisma.user.findFirst({ where: { id: session.userId, active: true }, select: { id: true, companyId: true, role: true, passwordHash: true } });
  if (!user) return NextResponse.json({ error: "Conta indisponível." }, { status: 401 });
  const [salt, hash] = user.passwordHash.split(":");
  let valid = false;
  try { const candidate = await scrypt(currentPassword, salt, 64) as Buffer; const expected = Buffer.from(hash, "hex"); valid = expected.length === candidate.length && timingSafeEqual(candidate, expected); } catch { valid = false; }
  if (!valid) return NextResponse.json({ error: "A senha atual está incorreta." }, { status: 401 });
  const newSalt = randomBytes(16).toString("hex");
  const newHash = await scrypt(newPassword, newSalt, 64) as Buffer;
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: `${newSalt}:${newHash.toString("hex")}`, mustChangePassword: false } });
  await prisma.auditLog.create({ data: { userId: user.id, companyId: user.companyId, action: "user.password.changed", entityType: "User", entityId: user.id } });
  const response = NextResponse.json({ success: true, redirect: user.role === "SUPER_ADMIN" ? "/admin/clientes" : "/cliente/dashboard" });
  response.cookies.set(sessionCookie, issueSession({ userId: user.id, role: user.role, companyId: user.companyId, mustChangePassword: false }), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 8 * 60 * 60 });
  return response;
}
