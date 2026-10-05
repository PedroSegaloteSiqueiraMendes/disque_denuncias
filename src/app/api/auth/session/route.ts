import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentSession } from "@/lib/session";
export async function GET() {
  const session = await currentSession(); if (!session) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  const user = await prisma.user.findFirst({ where: { id: session.userId, active: true }, select: { id: true, name: true, email: true, role: true, mustChangePassword: true, company: { select: { id: true, name: true, slug: true, active: true, logoData: true } } } });
  if (!user || (session.companyId && (!user.company || !user.company.active))) return NextResponse.json({ error: "Conta indisponível." }, { status: 401 });
  return NextResponse.json({ ...user, company: user.company && { id: user.company.id, name: user.company.name, slug: user.company.slug } });
}
