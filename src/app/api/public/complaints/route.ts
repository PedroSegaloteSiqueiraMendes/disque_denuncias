import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { complaintSchema } from "@/lib/complaints";
import { rateLimited } from "@/lib/rate-limit";

export async function POST(request: Request) {
  if (rateLimited(request, "public-complaint", 5, 60 * 60 * 1000)) return NextResponse.json({ error: "Muitas tentativas. Tente novamente mais tarde." }, { status: 429 });
  const length = Number(request.headers.get("content-length") ?? 0); if (length > 11 * 1024 * 1024) return NextResponse.json({ error: "O arquivo deve ter até 10 MB." }, { status: 413 });
  let raw: unknown; let upload: File | null = null;
  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    const data = await request.formData().catch(() => null);
    try { raw = JSON.parse(String(data?.get("complaint") ?? "")); } catch { raw = null; }
    const possible = data?.get("file"); if (possible instanceof File) upload = possible;
  } else raw = await request.json().catch(() => null);
  const parsed = complaintSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Confira os campos obrigatórios." }, { status: 400 });
  let fileData: { path: string; key: string; name: string; mime: string; bytes: number; buffer: Buffer } | null = null;
  if (upload) {
    if (upload.size <= 0 || upload.size > 10 * 1024 * 1024) return NextResponse.json({ error: "O arquivo deve ter até 10 MB." }, { status: 400 });
    const extension = upload.name.split(".").pop()?.toLowerCase() ?? "";
    const buffer = Buffer.from(await upload.arrayBuffer()); const prefix = buffer.subarray(0, 8).toString("hex");
    const allowed: Record<string, { mime: string; valid: boolean }> = {
      pdf: { mime: "application/pdf", valid: buffer.subarray(0, 5).toString() === "%PDF-" },
      jpg: { mime: "image/jpeg", valid: prefix.startsWith("ffd8ff") }, jpeg: { mime: "image/jpeg", valid: prefix.startsWith("ffd8ff") },
      png: { mime: "image/png", valid: prefix === "89504e470d0a1a0a" },
      doc: { mime: "application/msword", valid: prefix.startsWith("d0cf11e0a1b11ae1") },
      docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", valid: prefix.startsWith("504b0304") }
    };
    const format = allowed[extension]; if (!format || !format.valid || upload.type !== format.mime) return NextResponse.json({ error: "O formato real do arquivo não corresponde a um tipo permitido." }, { status: 400 });
    const key = randomUUID(); const path = join(process.cwd(), "private-uploads", key.slice(0, 2), key); fileData = { path, key, name: upload.name.slice(0, 240), mime: format.mime, bytes: upload.size, buffer };
  }
  const input = parsed.data;
  const company = await prisma.company.findUnique({ where: { slug: input.companySlug }, select: { id: true, active: true } });
  if (!company?.active) return NextResponse.json({ error: "Canal indisponível." }, { status: 404 });
  const category = await prisma.complaintCategory.findFirst({ where: { companyId: company.id, name: input.category, active: true } }) ?? await prisma.complaintCategory.findFirst({ where: { companyId: null, name: input.category, active: true } });
  if (!category) return NextResponse.json({ error: "Categoria indisponível." }, { status: 400 });
  const unit = input.unit ? await prisma.unit.findFirst({ where: { companyId: company.id, name: input.unit, active: true } }) : null;
  const department = input.department ? await prisma.department.findFirst({ where: { companyId: company.id, name: input.department, active: true } }) : null;
  const year = new Date().getFullYear();
  const sequence = await prisma.complaintSequence.upsert({ where: { year }, create: { year, value: 1 }, update: { value: { increment: 1 } } });
  const code = `DEN-${year}-${String(sequence.value).padStart(6, "0")}`;
  if (fileData) { await mkdir(join(process.cwd(), "private-uploads", fileData.key.slice(0, 2)), { recursive: true }); await writeFile(fileData.path, fileData.buffer, { flag: "wx", mode: 0o600 }); }
  try { await prisma.$transaction(async tx => { const created = await tx.complaint.create({ data: {
    publicInternalCode: code, companyId: company.id, categoryId: category.id, unitId: unit?.id,
    departmentId: department?.id, occurredPeriod: input.occurredPeriod,
    isRecurring: input.isRecurring, isStillOccurring: input.isStillOccurring,
    description: input.description,
    analysis: { create: { status: "RECEIVED" } },
    history: { create: { action: "Denúncia recebida", newValue: "RECEIVED" } },
    attachments: fileData ? { create: { storageKey: fileData.key, originalName: fileData.name, mimeType: fileData.mime, sizeBytes: fileData.bytes } } : undefined
  } }); await tx.auditLog.create({ data: { companyId: company.id, action: "complaint.received", entityType: "Complaint", entityId: created.id } }); const recipients = await tx.user.findMany({ where: { companyId: company.id, active: true, role: { in: ["CLIENT_ADMIN", "ANALYST"] } }, select: { id: true } }); if (recipients.length) await tx.complaintNotification.createMany({ data: recipients.map(user => ({ userId: user.id, complaintId: created.id })) }); }); } catch { if (fileData) { const { unlink } = await import("node:fs/promises"); await unlink(fileData.path).catch(() => undefined); } return NextResponse.json({ error: "Não foi possível concluir o registro. Tente novamente." }, { status: 500 }); }
  return NextResponse.json({ success: true }, { status: 201 });
}
