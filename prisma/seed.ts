import { PrismaClient, Role, ComplaintStatus, Severity, Result, OccurredPeriod } from "@prisma/client";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const prisma = new PrismaClient();
const scrypt = promisify(scryptCallback);
const categories = ["Assédio moral", "Assédio sexual", "Discriminação", "Fraude", "Corrupção", "Conflito de interesses", "Agressão ou ameaça", "Violação de normas internas", "Segurança do trabalho", "Comportamento inadequado", "Outro", "Não sei classificar"];
const units = ["Matriz", "Rio de Janeiro", "Macaé", "Santos", "Vitória"];
const departments = ["Administrativo", "Financeiro", "Operações", "Recursos Humanos", "Comercial", "Tecnologia", "Logística", "Jurídico"];
const statusList: ComplaintStatus[] = ["RECEIVED", "TRIAGE", "ANALYSIS", "INVESTIGATION", "DECISION_WAITING", "CLOSED"];
const severityList: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const resultList: Result[] = ["SUBSTANTIATED", "PARTIALLY_SUBSTANTIATED", "UNSUBSTANTIATED", "INCONCLUSIVE", "UNDEFINED"];
const companies = [{ name: "Acme Brasil (fictícia)", slug: "acme-brasil" }, { name: "Horizonte Logística (fictícia)", slug: "horizonte-logistica" }, { name: "Vereda Tecnologia (fictícia)", slug: "vereda-tecnologia" }];
const complaintCounts = [60, 24, 24];
const codeOffsets = [0, 60, 84];
async function hashPassword(password: string) { const salt = randomBytes(16).toString("hex"); const hash = await scrypt(password, salt, 64) as Buffer; return `${salt}:${hash.toString("hex")}`; }

async function main() {
  const permissionDefinitions = [
    ["complaints.read", "Visualizar relatos"], ["complaints.analyze", "Analisar e classificar relatos"], ["reports.read", "Visualizar relatórios"],
    ["organization.manage", "Administrar unidades, setores e categorias"], ["users.manage", "Administrar usuários e perfis"],
    ["platform.manage", "Administrar clientes e parâmetros globais"]
  ] as const;
  const rolePermissions: Record<Role, string[]> = {
    SUPER_ADMIN: permissionDefinitions.map(item => item[0]),
    CLIENT_ADMIN: ["complaints.read", "complaints.analyze", "reports.read", "organization.manage", "users.manage"],
    ANALYST: ["complaints.read", "complaints.analyze", "reports.read"], VIEWER: ["complaints.read", "reports.read"]
  };
  const permissionRows = new Map<string, string>();
  for (const [key, description] of permissionDefinitions) {
    const row = await prisma.permission.upsert({ where: { key }, update: { description }, create: { key, description } }); permissionRows.set(key, row.id);
  }
  for (const role of Object.values(Role)) for (const key of rolePermissions[role]) {
    const permissionId = permissionRows.get(key)!;
    await prisma.rolePermission.upsert({ where: { role_permissionId: { role, permissionId } }, update: {}, create: { role, permissionId } });
  }
  const superPassword = await hashPassword("FocusDemo!2026");
  const superAdmin = await prisma.user.upsert({ where: { email: "admin@focus.demo" }, update: {}, create: { name: "Admin Focus (fictício)", email: "admin@focus.demo", passwordHash: superPassword, mustChangePassword: true, role: Role.SUPER_ADMIN } });
  await prisma.userRole.upsert({ where: { userId_role: { userId: superAdmin.id, role: Role.SUPER_ADMIN } }, update: {}, create: { userId: superAdmin.id, role: Role.SUPER_ADMIN } });
  for (let companyIndex = 0; companyIndex < companies.length; companyIndex++) {
    const info = companies[companyIndex];
    const company = await prisma.company.upsert({ where: { slug: info.slug }, update: { name: info.name, active: true }, create: { name: info.name, slug: info.slug } });
    for (const name of units) await prisma.unit.upsert({ where: { companyId_name: { companyId: company.id, name } }, update: { active: true }, create: { companyId: company.id, name } });
    for (const name of departments) await prisma.department.upsert({ where: { companyId_name: { companyId: company.id, name } }, update: { active: true }, create: { companyId: company.id, name } });
    const categoryRows = [];
    for (const name of categories) categoryRows.push(await prisma.complaintCategory.upsert({ where: { companyId_name: { companyId: company.id, name } }, update: { active: true }, create: { companyId: company.id, name } }));
    const password = await hashPassword("FocusDemo!2026");
    const admin = await prisma.user.upsert({ where: { email: `admin@${info.slug}.demo` }, update: { companyId: company.id }, create: { companyId: company.id, name: `Admin ${info.slug} (fictício)`, email: `admin@${info.slug}.demo`, passwordHash: password, mustChangePassword: true, role: Role.CLIENT_ADMIN } });
    await prisma.userRole.upsert({ where: { userId_role: { userId: admin.id, role: Role.CLIENT_ADMIN } }, update: {}, create: { userId: admin.id, role: Role.CLIENT_ADMIN } });
    const analyst = await prisma.user.upsert({ where: { email: `analista@${info.slug}.demo` }, update: { companyId: company.id }, create: { companyId: company.id, name: "Analista de demonstração", email: `analista@${info.slug}.demo`, passwordHash: password, mustChangePassword: true, role: Role.ANALYST } });
    await prisma.userRole.upsert({ where: { userId_role: { userId: analyst.id, role: Role.ANALYST } }, update: {}, create: { userId: analyst.id, role: Role.ANALYST } });
    const unitRows = await prisma.unit.findMany({ where: { companyId: company.id } }); const deptRows = await prisma.department.findMany({ where: { companyId: company.id } });
    for (let i = 0; i < complaintCounts[companyIndex]; i++) {
      const createdAt = new Date(); createdAt.setMonth(createdAt.getMonth() - (11 - (i % 12))); createdAt.setDate(1 + ((i * 7 + companyIndex * 3) % 26)); createdAt.setHours(9 + (i % 8), (i * 13) % 60, 0, 0);
      const code = `DEN-2026-${String(codeOffsets[companyIndex] + i + 1).padStart(6, "0")}`;
      await prisma.complaint.upsert({ where: { publicInternalCode: code }, update: {}, create: {
        publicInternalCode: code, companyId: company.id, categoryId: categoryRows[companyIndex === 0 ? Math.floor(i / 5) % categories.length : (i * 5 + companyIndex) % categories.length].id,
        unitId: unitRows[(i + companyIndex) % unitRows.length].id, departmentId: deptRows[(i * 3 + companyIndex) % deptRows.length].id,
        occurredPeriod: [OccurredPeriod.TODAY, OccurredPeriod.LAST_7_DAYS, OccurredPeriod.LAST_30_DAYS, OccurredPeriod.OVER_30_DAYS, OccurredPeriod.UNKNOWN][i % 5],
        isRecurring: i % 4 === 0 ? null : i % 3 === 0, isStillOccurring: i % 5 === 0 ? null : i % 2 === 0,
        description: `Relato de demonstração ${i + 1}: situação fictícia criada para validar os fluxos de análise e os indicadores da plataforma. Nenhum dado representa pessoa ou empresa real.`, createdAt,
        analysis: { create: { status: statusList[i % statusList.length], severity: severityList[(i + 1) % severityList.length], result: resultList[i % resultList.length], assignedUserId: admin.id, closedAt: i % statusList.length === 5 ? new Date(createdAt.getTime() + (5 + i % 17) * 86400000) : null } },
        history: { create: { action: "Denúncia recebida", newValue: "RECEIVED", createdAt } }
      } });
    }
  }
  await prisma.complaintSequence.upsert({ where: { year: 2026 }, update: {}, create: { year: 2026, value: 108 } });
  console.log("Dados fictícios preparados: 3 empresas, 15 unidades e 108 denúncias (60 na Acme demo para preencher agregações com limiar mínimo 5).");
  console.log("Contas de demonstração: admin@focus.demo e admin@acme-brasil.demo (senha FocusDemo!2026).");
}
main().finally(async () => prisma.$disconnect());
