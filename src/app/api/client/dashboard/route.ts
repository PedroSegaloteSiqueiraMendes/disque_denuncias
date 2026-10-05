import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { currentSession } from "@/lib/session";

const threshold = 5;
export async function GET(request: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  const companyId = session.companyId;
  if (!companyId || session.role === "SUPER_ADMIN") return NextResponse.json({ error: "Escopo empresarial necessário." }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const unit = params.get("unit"); const department = params.get("department"); const category = params.get("category");
  const period = params.get("period") ?? "Últimos 12 meses"; const now = new Date();
  const start = period === "Últimos 30 dias" ? new Date(now.getTime() - 30 * 86400000) : period === "Últimos 90 dias" ? new Date(now.getTime() - 90 * 86400000) : period === "Este ano" ? new Date(now.getFullYear(), 0, 1) : new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const [unitRow, departmentRow, categoryRow] = await Promise.all([
    unit && unit !== "Todas as unidades" ? prisma.unit.findFirst({ where: { companyId, name: unit }, select: { id: true } }) : null,
    department && department !== "Todos os setores" ? prisma.department.findFirst({ where: { companyId, name: department }, select: { id: true } }) : null,
    category && category !== "Todas as categorias" ? prisma.complaintCategory.findFirst({ where: { name: category, active: true, OR: [{ companyId }, { companyId: null }] }, select: { id: true } }) : null
  ]);
  if ((unit && unit !== "Todas as unidades" && !unitRow) || (department && department !== "Todos os setores" && !departmentRow) || (category && category !== "Todas as categorias" && !categoryRow)) return NextResponse.json({ error: "Filtro inválido." }, { status: 400 });
  const where: Prisma.ComplaintWhereInput = { companyId, createdAt: { gte: start }, ...(unitRow ? { unitId: unitRow.id } : {}), ...(departmentRow ? { departmentId: departmentRow.id } : {}), ...(categoryRow ? { categoryId: categoryRow.id } : {}) };
  const [total, analyses, byCategory, byUnit, byDepartment, recurring, still, bySeverity, byResult, attachmentCount, closed] = await Promise.all([
    prisma.complaint.count({ where }),
    prisma.complaintAnalysis.groupBy({ by: ["status"], where: { complaint: where }, _count: { _all: true } }),
    prisma.complaint.groupBy({ by: ["categoryId"], where, _count: { _all: true }, orderBy: { _count: { categoryId: "desc" } } }),
    prisma.complaint.groupBy({ by: ["unitId"], where: { ...where, unitId: { not: null } }, _count: { _all: true }, orderBy: { _count: { unitId: "desc" } } }),
    prisma.complaint.groupBy({ by: ["departmentId"], where: { ...where, departmentId: { not: null } }, _count: { _all: true }, orderBy: { _count: { departmentId: "desc" } } }),
    prisma.complaint.groupBy({ by: ["isRecurring"], where, _count: { _all: true } }),
    prisma.complaint.groupBy({ by: ["isStillOccurring"], where, _count: { _all: true } }),
    prisma.complaintAnalysis.groupBy({ by: ["severity"], where: { complaint: where }, _count: { _all: true } }),
    prisma.complaintAnalysis.groupBy({ by: ["result"], where: { complaint: where }, _count: { _all: true } }),
    prisma.complaint.count({ where: { ...where, attachments: { some: {} } } }),
    prisma.complaint.findMany({ where: { ...where, analysis: { closedAt: { not: null } } }, select: { createdAt: true, analysis: { select: { closedAt: true } } } })
  ]);
  const safeNames = async (rows: { categoryId?: string; unitId?: string | null; departmentId?: string | null; _count: { _all: number } }[], kind: "category" | "unit" | "department") => {
    if (total < threshold) return [];
    const safe = rows.filter(r => r._count._all >= threshold);
    const ids = safe.map(r => kind === "category" ? r.categoryId : kind === "unit" ? r.unitId : r.departmentId).filter((v): v is string => !!v);
    const whereLabels = { companyId, id: { in: ids } };
    const labels = kind === "category" ? await prisma.complaintCategory.findMany({ where: { id: { in: ids }, OR: [{ companyId }, { companyId: null }] }, select: { id: true, name: true } }) : kind === "unit" ? await prisma.unit.findMany({ where: whereLabels, select: { id: true, name: true } }) : await prisma.department.findMany({ where: whereLabels, select: { id: true, name: true } });
    return safe.map(r => ({ name: labels.find(label => label.id === (kind === "category" ? r.categoryId : kind === "unit" ? r.unitId : r.departmentId))?.name ?? "", count: r._count._all }));
  };
  const [categories, units, departments] = await Promise.all([safeNames(byCategory, "category"), safeNames(byUnit, "unit"), safeNames(byDepartment, "department")]);
  const monthStarts = Array.from({ length: 12 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - 11 + index, 1)).filter(month => month.getTime() < new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() && (period !== "Este ano" || month.getFullYear() === now.getFullYear()));
  const monthCounts = await Promise.all(monthStarts.map(async (monthStart) => {
    const end = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
    const count = await prisma.complaint.count({ where: { ...where, createdAt: { gte: monthStart, lt: end } } });
    return { month: monthStart.toLocaleDateString("pt-BR", { month: "short" }), total: count >= threshold ? count : null };
  }));
  const closedCount = analyses.find(a => a.status === "CLOSED")?._count._all ?? 0;
  const averageDays = closed.length ? Math.round(closed.reduce((sum, item) => sum + ((item.analysis?.closedAt?.getTime() ?? item.createdAt.getTime()) - item.createdAt.getTime()) / 86400000, 0) / closed.length * 10) / 10 : null;
  const map = (rows: { key: string; label: string }[], source: { severity?: string | null; result?: string; _count: { _all: number } }[], key: "severity" | "result") => rows.map(item => ({ name: item.label, count: source.find(r => r[key] === item.key)?._count._all ?? 0 })).filter(item => item.count >= threshold);
  return NextResponse.json({
    threshold, privacyHidden: total > 0 && total < threshold, total,
    inAnalysis: analyses.filter(a => ["TRIAGE", "ANALYSIS", "INVESTIGATION", "DECISION_WAITING"].includes(a.status)).reduce((sum, a) => sum + a._count._all, 0),
    closed: closedCount, averageDays: total >= threshold ? averageDays : null, categories, units, departments, evolution: monthCounts,
    recurring: recurring.map(r => ({ name: r.isRecurring === null ? "Não informado" : r.isRecurring ? "Recorrente" : "Ocorrência única", count: r._count._all })).filter(r => total >= threshold && r.count >= threshold),
    still: still.map(r => ({ name: r.isStillOccurring === null ? "Não informado" : r.isStillOccurring ? "Sim" : "Não", count: r._count._all })).filter(r => total >= threshold && r.count >= threshold),
    severity: map([{ key: "LOW", label: "Baixa" }, { key: "MEDIUM", label: "Média" }, { key: "HIGH", label: "Alta" }, { key: "CRITICAL", label: "Crítica" }], bySeverity, "severity"),
    result: map([{ key: "SUBSTANTIATED", label: "Procedente" }, { key: "PARTIALLY_SUBSTANTIATED", label: "Parcialmente procedente" }, { key: "UNSUBSTANTIATED", label: "Improcedente" }, { key: "INCONCLUSIVE", label: "Inconclusivo" }, { key: "UNDEFINED", label: "Ainda não concluído" }], byResult, "result"),
    withEvidence: total >= threshold ? attachmentCount : null, withoutEvidence: total >= threshold ? Math.max(0, total - attachmentCount) : null
  });
}
