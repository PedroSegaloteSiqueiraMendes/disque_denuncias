import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentSession } from "@/lib/session";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentSession(); if (!session) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  if (!session.companyId || session.role !== "CLIENT_ADMIN") return NextResponse.json({ error: "Somente o administrador do cliente pode alterar usuários." }, { status: 403 });
  const body = z.object({ active: z.boolean() }).safeParse(await request.json().catch(() => null)); if (!body.success) return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  const { id } = await params; if (id === session.userId && !body.data.active) return NextResponse.json({ error: "Não é possível desativar sua própria conta." }, { status: 400 });
  const changed = await prisma.user.updateMany({ where: { id, companyId: session.companyId }, data: { active: body.data.active } }); if (!changed.count) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  await prisma.auditLog.create({ data: { userId: session.userId, companyId: session.companyId, action: body.data.active ? "user.activated" : "user.deactivated", entityType: "User", entityId: id } }); return NextResponse.json({ success: true });
}
