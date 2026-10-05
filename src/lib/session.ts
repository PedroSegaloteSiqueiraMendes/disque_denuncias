import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export type Session = { userId: string; role: "SUPER_ADMIN" | "CLIENT_ADMIN" | "ANALYST" | "VIEWER"; companyId: string | null; mustChangePassword?: boolean; exp: number };
const cookieName = "focus_session";
function signature(value: string) { const secret = process.env.SESSION_SECRET; if (!secret || secret.length < 32) throw new Error("SESSION_SECRET deve ter pelo menos 32 caracteres."); return createHmac("sha256", secret).update(value).digest("base64url"); }
export function issueSession(data: Omit<Session, "exp">) { const payload = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString("base64url"); return `${payload}.${signature(payload)}`; }
export function verifySession(token: string | undefined): Session | null {
  if (!token) return null;
  try { const [payload, supplied] = token.split("."); const expected = signature(payload); const a = Buffer.from(supplied); const b = Buffer.from(expected); if (a.length !== b.length || !timingSafeEqual(a, b)) return null; const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session; return session.exp > Date.now() ? session : null; } catch { return null; }
}
export async function currentSession() {
  const session = verifySession((await cookies()).get(cookieName)?.value); if (!session) return null;
  const user = await prisma.user.findFirst({ where: { id: session.userId, active: true, role: session.role, companyId: session.companyId, ...(session.companyId ? { company: { active: true } } : {}) }, select: { id: true } });
  return user ? session : null;
}
export const sessionCookie = cookieName;
