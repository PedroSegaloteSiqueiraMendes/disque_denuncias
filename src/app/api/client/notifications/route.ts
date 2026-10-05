import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentSession } from "@/lib/session";

export async function GET() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  if (!session.companyId || session.role === "SUPER_ADMIN") return NextResponse.json({ error: "Escopo empresarial necessário." }, { status: 403 });
  const items = await prisma.complaintNotification.findMany({
    where: { userId: session.userId }, orderBy: { createdAt: "desc" }, take: 20,
    select: { id: true, readAt: true, createdAt: true, complaint: { select: { id: true, publicInternalCode: true, category: { select: { name: true } } } } }
  });
  return NextResponse.json({ unread: items.filter(item => !item.readAt).length, items });
}

export async function PATCH(request: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (typeof body?.id !== "string") return NextResponse.json({ error: "Notificação inválida." }, { status: 400 });
  await prisma.complaintNotification.updateMany({ where: { id: body.id, userId: session.userId, readAt: null }, data: { readAt: new Date() } });
  return NextResponse.json({ success: true });
}
