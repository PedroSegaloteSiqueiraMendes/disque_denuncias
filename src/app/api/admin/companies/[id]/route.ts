import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentSession } from "@/lib/session";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentSession(); if (session?.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Acesso restrito ao Super Admin." }, { status: 403 });
  const body = z.object({ active: z.boolean() }).safeParse(await request.json().catch(() => null)); if (!body.success) return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  const { id } = await params; const company = await prisma.company.updateMany({ where: { id }, data: { active: body.data.active } }); if (!company.count) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  await prisma.auditLog.create({ data: { userId: session.userId, companyId: id, action: body.data.active ? "company.activated" : "company.deactivated", entityType: "Company", entityId: id } });
  return NextResponse.json({ success: true });
}
