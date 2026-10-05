import { NextResponse } from "next/server";
import { sessionCookie } from "@/lib/session";
export async function POST() { const response = NextResponse.json({ success: true }); response.cookies.set(sessionCookie, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 }); return response; }
