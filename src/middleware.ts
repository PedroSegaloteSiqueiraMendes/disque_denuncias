import { NextRequest, NextResponse } from "next/server";

function b64(input: string) { const normalized = input.replaceAll("-", "+").replaceAll("_", "/"); return Uint8Array.from(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")), (c) => c.charCodeAt(0)); }
async function roleFromCookie(value: string | undefined) {
  try {
    if (!value || !process.env.SESSION_SECRET) return null;
    const [payload, sig] = value.split("."); const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(process.env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    if (!await crypto.subtle.verify("HMAC", key, b64(sig), new TextEncoder().encode(payload))) return null;
    const session = JSON.parse(new TextDecoder().decode(b64(payload))) as { role?: string; exp?: number; mustChangePassword?: boolean };
    return (session.exp ?? 0) > Date.now() ? session : null;
  } catch { return null; }
}
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path.startsWith("/api/")) {
    if (!path.startsWith("/api/client/") && !path.startsWith("/api/admin/")) return NextResponse.next();
    const apiSession = await roleFromCookie(request.cookies.get("focus_session")?.value);
    if (apiSession?.mustChangePassword && path !== "/api/auth/password" && path !== "/api/auth/logout") return NextResponse.json({ error: "Troque sua senha para continuar." }, { status: 403 });
    return NextResponse.next();
  }
  if (!path.startsWith("/cliente") && !path.startsWith("/admin") && path !== "/primeiro-acesso") return NextResponse.next();
  const session = await roleFromCookie(request.cookies.get("focus_session")?.value);
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  if (session.mustChangePassword && path !== "/primeiro-acesso") return NextResponse.redirect(new URL("/primeiro-acesso", request.url));
  if (!session.mustChangePassword && path === "/primeiro-acesso") return NextResponse.redirect(new URL(session.role === "SUPER_ADMIN" ? "/admin/clientes" : "/cliente/dashboard", request.url));
  if (path.startsWith("/admin") && session.role !== "SUPER_ADMIN") return NextResponse.redirect(new URL("/cliente/dashboard", request.url));
  if (path.startsWith("/cliente") && session.role === "SUPER_ADMIN") return NextResponse.redirect(new URL("/admin/clientes", request.url));
  if (path === "/cliente/configuracoes" && session.role !== "CLIENT_ADMIN") return NextResponse.redirect(new URL("/cliente/dashboard", request.url));
  return NextResponse.next();
}
export const config = { matcher: ["/cliente/:path*", "/admin/:path*", "/primeiro-acesso", "/api/:path*"] };
