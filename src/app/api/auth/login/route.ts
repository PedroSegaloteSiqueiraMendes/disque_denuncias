import { NextResponse } from "next/server";
import { scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { prisma } from "@/lib/prisma";
import { issueSession, sessionCookie } from "@/lib/session";
import { rateLimited } from "@/lib/rate-limit";
const scrypt = promisify(scryptCallback);

export async function POST(request: Request) {
  if (rateLimited(request, "login", 8, 15 * 60 * 1000)) return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  const body = await request.json().catch(() => null);
  if (typeof body?.email !== "string" || typeof body?.password !== "string" || body.email.length > 254 || body.password.length > 200) return NextResponse.json({ error: "Credenciais inválidas." }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase().trim() }, include: { company: { select: { id: true, active: true } } } });
  if (!user?.active || (user.company && !user.company.active)) return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
  const [salt, hash] = user.passwordHash.split(":");
  let valid = false;
  try { const candidate = await scrypt(body.password, salt, 64) as Buffer; const expected = Buffer.from(hash, "hex"); valid = expected.length === candidate.length && timingSafeEqual(candidate, expected); } catch { valid = false; }
  if (!valid) return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
  const token = issueSession({ userId: user.id, role: user.role, companyId: user.companyId, mustChangePassword: user.mustChangePassword });
  const response = NextResponse.json({ success: true, role: user.role, redirect: user.mustChangePassword ? "/primeiro-acesso" : user.role === "SUPER_ADMIN" ? "/admin/clientes" : "/cliente/dashboard" });
  response.cookies.set(sessionCookie, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 8 * 60 * 60 });
  return response;
}
