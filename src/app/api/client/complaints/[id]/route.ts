import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentSession } from "@/lib/session";
import { z } from "zod";
const editSchema = z.object({ status: z.enum(["RECEIVED", "TRIAGE", "ANALYSIS", "INVESTIGATION", "DECISION_WAITING", "CLOSED"]).optional(), severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).nullable().optional(), result: z.enum(["SUBSTANTIATED", "PARTIALLY_SUBSTANTIATED", "UNSUBSTANTIATED", "INCONCLUSIVE", "UNDEFINED"]).optional(), assignedUserId: z.string().nullable().optional(), internalNotes: z.string().max(12000).optional(), actionsTaken: z.string().max(12000).optional() });
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentSession(); if (!session) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  if (!session.companyId || session.role === "SUPER_ADMIN") return NextResponse.json({ error: "Escopo empresarial necessário." }, { status: 403 });
  if (session.role === "VIEWER") return NextResponse.json({ error: "Este perfil acessa apenas dashboards e relatórios." }, { status: 403 });
  const { id } = await params; const complaint = await prisma.complaint.findFirst({ where: { companyId: session.companyId, OR: [{ id }, { publicInternalCode: id }] }, include: { category: true, unit: true, department: true, attachments: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true } }, analysis: { include: { assignedUser: { select: { id: true, name: true } } } }, history: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } } } });
  return complaint ? NextResponse.json(complaint) : NextResponse.json({ error: "Denúncia não encontrada." }, { status: 404 });
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentSession(); if (!session) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  if (!session.companyId || !["CLIENT_ADMIN", "ANALYST"].includes(session.role)) return NextResponse.json({ error: "Você não tem permissão para alterar denúncias." }, { status: 403 });
  const parsed = editSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const { id } = await params; const existing = await prisma.complaint.findFirst({ where: { companyId: session.companyId, OR: [{ id }, { publicInternalCode: id }] }, include: { analysis: true } }); if (!existing) return NextResponse.json({ error: "Denúncia não encontrada." }, { status: 404 });
  const changes = parsed.data; const before = existing.analysis;
  if (!before) return NextResponse.json({ error: "A análise desta denúncia ainda não foi inicializada." }, { status: 409 });
  if (changes.assignedUserId) { const assignee = await prisma.user.findFirst({ where: { id: changes.assignedUserId, companyId: session.companyId, active: true, role: { in: ["CLIENT_ADMIN", "ANALYST"] } }, select: { id: true } }); if (!assignee) return NextResponse.json({ error: "Responsável não autorizado neste cliente." }, { status: 400 }); }
  await prisma.$transaction(async (tx) => {
    await tx.complaintAnalysis.update({ where: { complaintId: existing.id }, data: { ...changes, closedAt: changes.status ? changes.status === "CLOSED" ? new Date() : null : undefined } });
    for (const field of ["status", "severity", "result"] as const) if (changes[field] !== undefined && changes[field] !== before[field]) await tx.complaintHistory.create({ data: { complaintId: existing.id, userId: session.userId, action: `${field} updated`, previousValue: String(before[field] ?? ""), newValue: String(changes[field] ?? "") } });
    for (const field of ["internalNotes", "actionsTaken"] as const) if (changes[field] !== undefined && changes[field] !== before[field]) await tx.complaintHistory.create({ data: { complaintId: existing.id, userId: session.userId, action: field === "internalNotes" ? "Observações internas atualizadas" : "Ações tomadas atualizadas", previousValue: before[field] ? "Preenchido" : "Vazio", newValue: changes[field] ? "Preenchido" : "Vazio" } });
    if (changes.assignedUserId !== undefined && changes.assignedUserId !== before.assignedUserId) await tx.complaintHistory.create({ data: { complaintId: existing.id, userId: session.userId, action: "Responsável alterado", previousValue: before.assignedUserId ?? "Não atribuído", newValue: changes.assignedUserId ?? "Não atribuído" } });
    await tx.auditLog.create({ data: { userId: session.userId, companyId: session.companyId, action: "complaint.analysis.updated", entityType: "Complaint", entityId: existing.id } });
  });
  return NextResponse.json({ success: true });
}
