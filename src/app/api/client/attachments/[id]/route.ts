import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { currentSession } from "@/lib/session";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentSession(); if (!session) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  if (!session.companyId || session.role === "SUPER_ADMIN") return NextResponse.json({ error: "Escopo empresarial necessário." }, { status: 403 });
  const { id } = await params;
  const attachment = await prisma.complaintAttachment.findFirst({ where: { id, complaint: { companyId: session.companyId } }, select: { storageKey: true, mimeType: true } });
  if (!attachment) return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  try { const bytes = await readFile(join(process.cwd(), "private-uploads", attachment.storageKey.slice(0, 2), attachment.storageKey)); return new Response(bytes, { headers: { "content-type": attachment.mimeType, "content-disposition": "attachment; filename=\"evidencia\"", "x-content-type-options": "nosniff", "cache-control": "private, no-store" } }); }
  catch { return NextResponse.json({ error: "Arquivo indisponível." }, { status: 404 }); }
}
